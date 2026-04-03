import { db, auth } from './firebase';
import {
    collection,
    addDoc,
    doc,
    updateDoc,
    getDoc,
    query,
    where,
    orderBy,
    getDocs,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import * as OTPAuth from 'otpauth';

// Helper: Calculate distance in meters
function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return d * 1000; // Distance in m
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

// Simple random hex generator for secret
const generateSecret = () => {
    const chars = '0123456789ABCDEF';
    let secret = '';
    for (let i = 0; i < 40; i++) {
        secret += chars[Math.floor(Math.random() * 16)];
    }
    return secret;
};

export const attendanceService = {
    /**
     * Starts a new attendance session (Lecturer only).
     * Direct Firestore Write.
     */
    startSession: async (courseIds, hallId, location) => {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error('Not authenticated');

            const secret = generateSecret();
            const durationMinutes = 60; // Default duration

            const sessionData = {
                courseIds: Array.isArray(courseIds) ? courseIds : [courseIds], // Normalize to array
                hallId,
                lecturerId: user.uid,
                secret, // Private secret needed for validation
                startTime: serverTimestamp(),
                // We use a future date for endTime, careful with serverTimestamp vs client date
                // Ideally use serverTimestamp for start, and calculate end based on it, 
                // but for client-side check we need a real date object.
                endTime: Timestamp.fromMillis(Date.now() + durationMinutes * 60000),
                location: location || null,
                status: 'ACTIVE',
                createdAt: serverTimestamp()
            };

            const docRef = await addDoc(collection(db, 'sessions'), sessionData);

            return {
                sessionId: docRef.id,
                secret: secret
            };
        } catch (error) {
            console.error('Error starting session:', error);
            throw error;
        }
    },

    /**
     * Ends an active session.
     */
    endSession: async (sessionId) => {
        try {
            if (!sessionId) return;
            const sessionRef = doc(db, 'sessions', sessionId);
            await updateDoc(sessionRef, {
                status: 'ENDED',
                endedAt: serverTimestamp()
            });
        } catch (error) {
            console.error('Error ending session:', error);
            throw error;
        }
    },

    /**
     * Submits attendance for a student.
     * Client-side validation + Direct Firestore Write.
     */
    submitAttendance: async (sessionId, token, location, deviceId) => {
        try {
            const user = auth.currentUser;
            if (!user) throw new Error('Not authenticated');

            // 1. Fetch Session Data
            const sessionRef = doc(db, 'sessions', sessionId);
            const sessionSnap = await getDoc(sessionRef);

            if (!sessionSnap.exists()) {
                const err = new Error('Session not found');
                err.code = 'not-found';
                throw err;
            }

            const session = sessionSnap.data();

            if (session.status !== 'ACTIVE') {
                const err = new Error('Session is not active');
                err.code = 'failed-precondition';
                throw err;
            }

            // Check Expiry (Client side check)
            const now = Timestamp.now();
            if (now.toMillis() > session.endTime.toMillis()) {
                const err = new Error('Session has ended');
                err.code = 'failed-precondition';
                throw err;
            }

            // 2. Validate TOTP Token locally
            const totp = new OTPAuth.TOTP({
                algorithm: 'SHA1',
                digits: 6,
                period: 30, // 30s window
                secret: OTPAuth.Secret.fromHex(session.secret)
            });

            // Validate with window +/- 1 (30 seconds margin)
            const delta = totp.validate({ token, window: 1 });
            if (delta === null) {
                const err = new Error('Invalid or expired QR code');
                err.code = 'invalid-argument';
                throw err;
            }

            // 3. Location Validation (Geofencing)
            if (session.location && location) {
                const dist = getDistanceFromLatLonInM(
                    session.location.latitude, session.location.longitude,
                    location.latitude, location.longitude
                );

                console.log("--- ATTENDANCE LOCATION DEBUG (v2) ---");
                console.log("Lecturer (Hall) Location:", session.location.latitude, session.location.longitude);
                console.log("Student Location:", location.latitude, location.longitude);
                console.log("Student Accuracy:", location.accuracy || 'unknown', "meters");
                console.log("Calculated Distance (m):", Math.round(dist));
                console.log("Threshold (m): 300");
                console.log("---------------------------------------");

                // 300 meters radius (increased for indoor accuracy)
                if (dist > 300) {
                    const err = new Error(`You are too far from the hall (${Math.round(dist)}m)`);
                    err.code = 'permission-denied';
                    throw err;
                }
            }

            // 4. Duplicate Check (Student)
            const attendanceRef = collection(db, 'attendance');
            const q = query(
                attendanceRef,
                where('sessionId', '==', sessionId),
                where('studentId', '==', user.uid)
            );
            const querySnap = await getDocs(q);

            if (!querySnap.empty) {
                const err = new Error('Attendance already marked');
                err.code = 'already-exists';
                throw err;
            }

            // 5. Device ID Check
            if (deviceId) {
                const deviceQ = query(
                    attendanceRef,
                    where('sessionId', '==', sessionId),
                    where('deviceId', '==', deviceId)
                );
                const deviceSnap = await getDocs(deviceQ);

                if (!deviceSnap.empty) {
                    const err = new Error('This device has already been used for attendance in this session');
                    err.code = 'resource-exhausted';
                    throw err;
                }
            }

            // 6. Record Attendance
            await addDoc(attendanceRef, {
                sessionId,
                studentId: user.uid,
                studentEmail: user.email,
                timestamp: serverTimestamp(),
                location: location || null,
                deviceId: deviceId || 'unknown'
            });

            return { success: true };

        } catch (error) {
            console.error('Error submitting attendance:', error);
            throw error;
        }
    },

    /**
     * Generates a TOTP token (Lecturer side).
     */
    generateToken: (secret) => {
        if (!secret) return '';
        const totp = new OTPAuth.TOTP({
            issuer: 'UniAttendance',
            label: 'Attendance',
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
            secret: OTPAuth.Secret.fromHex(secret)
        });
        return totp.generate();
    },

    /**
     * Fetches comprehensive report data for a course (Admin/Lecturer).
     */
    getCourseReportData: async (courseId) => {
        try {
            // 1. Get all students subscribed to this course
            const usersRef = collection(db, 'users');
            const studentsQ = query(usersRef, where('savedCourses', 'array-contains', courseId));
            const studentsSnap = await getDocs(studentsQ);
            const students = studentsSnap.docs.map(d => ({
                id: d.id,
                name: d.data().name || d.data().displayName || 'Unknown',
                afNumber: d.data().afNumber || 'N/A',
                arNumber: d.data().arNumber || 'N/A'
            }));

            // 2. Get all sessions recorded for this course
            const sessionsRef = collection(db, 'sessions');
            const sessionsQ = query(sessionsRef, where('courseIds', 'array-contains', courseId), orderBy('startTime', 'asc'));
            const sessionsSnap = await getDocs(sessionsQ);
            const sessions = sessionsSnap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                date: d.data().startTime?.toDate ? d.data().startTime.toDate().toLocaleDateString() : 'N/A'
            }));

            // 3. Get all attendance records for these sessions
            const attendanceRef = collection(db, 'attendance');
            const report = [];

            for (const student of students) {
                const studentAttendance = [];
                let presentCount = 0;

                // Check attendance for each of the 15 possible columns (as requested)
                // We'll map the first 15 recorded sessions to columns
                for (let i = 0; i < 15; i++) {
                    const session = sessions[i];
                    if (session) {
                        const attQ = query(
                            attendanceRef,
                            where('sessionId', '==', session.id),
                            where('studentId', '==', student.id)
                        );
                        const attSnap = await getDocs(attQ);
                        const isPresent = !attSnap.empty;
                        studentAttendance.push({
                            sessionId: session.id,
                            isPresent,
                            date: session.date
                        });
                        if (isPresent) presentCount++;
                    } else {
                        // Placeholders for future sessions
                        studentAttendance.push({ isPresent: null });
                    }
                }

                const attendanceRate = sessions.length > 0 ? (presentCount / sessions.length) * 100 : 0;

                report.push({
                    studentId: student.id,
                    name: student.name,
                    afNumber: student.afNumber,
                    arNumber: student.arNumber,
                    attendance: studentAttendance,
                    ar: attendanceRate.toFixed(1),
                    af: sessions.length - presentCount,
                    status: attendanceRate.toFixed(0) + '%'
                });
            }

            return {
                students: report,
                sessions: sessions.slice(0, 15)
            };
        } catch (error) {
            console.error('Error fetching course report:', error);
            throw error;
        }
    }
};

export default attendanceService;
