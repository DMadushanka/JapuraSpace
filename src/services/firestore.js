import { db, auth } from './firebase';
import {
    collection,
    getDocs,
    doc,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    writeBatch
} from 'firebase/firestore';

export const firestoreService = {
    // Get Slider Images
    getSliderImages: async () => {
        try {
            const q = query(collection(db, 'slider_images'), orderBy('order'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error fetching slider images:', error);
            return [];
        }
    },

    getSliderImage: async (id) => {
        try {
            const docRef = doc(db, 'slider_images', id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() };
            }
            return null;
        } catch (error) {
            console.error('Error fetching slider image:', error);
            return null;
        }
    },

    createSliderImage: async (data) => {
        return addDoc(collection(db, 'slider_images'), {
            ...data,
            createdAt: serverTimestamp()
        });
    },

    deleteSliderImage: async (id) => {
        return deleteDoc(doc(db, 'slider_images', id));
    },

    // Bridge for components using firestoreService for halls
    getAllHalls: async () => hallService.getAllHalls(),
    getHall: async (id) => hallService.getHall(id)
};

export const hallService = {
    // Get All Halls
    getAllHalls: async () => {
        try {
            const snapshot = await getDocs(collection(db, 'halls'));
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error fetching halls:', error);
            return [];
        }
    },

    // Get Hall Details
    getHall: async (id) => {
        try {
            const docRef = doc(db, 'halls', id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() };
            }
            return null;
        } catch (error) {
            console.error('Error fetching hall:', error);
            return null;
        }
    },

    createHall: async (hallData) => {
        return addDoc(collection(db, 'halls'), {
            ...hallData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    },

    updateHall: async (id, data) => {
        return updateDoc(doc(db, 'halls', id), {
            ...data,
            updatedAt: serverTimestamp()
        });
    },

    deleteHall: async (id) => {
        return deleteDoc(doc(db, 'halls', id));
    }
};

export const bookingService = {
    // Create Booking
    createBooking: async (bookingData) => {
        // [NEW] Check for conflicts before creating
        const [startTime, endTime] = bookingData.timeSlot.includes(' - ') 
            ? bookingData.timeSlot.split(' - ') 
            : bookingData.timeSlot.split('-');

        const isAvailable = await timetableService.checkAvailability(
            bookingData.hallId,
            bookingData.date,
            startTime,
            endTime
        );

        if (!isAvailable.available) {
            throw new Error(isAvailable.reason);
        }

        const docRef = await addDoc(collection(db, 'bookings'), {
            ...bookingData,
            createdAt: serverTimestamp(),
            status: 'pending'
        });

        // Notify Admins
        await bookingService.createNotification({
            forRole: 'admin',
            title: 'New Booking Request',
            body: `New request for ${bookingData.hallName} on ${bookingData.date}`,
            bookingId: docRef.id
        });

        // Notify Booking Managers
        await bookingService.createNotification({
            forRole: 'Booking_Manager',
            title: 'New Booking Request',
            body: `New request for ${bookingData.hallName} on ${bookingData.date}`,
            bookingId: docRef.id
        });

        return docRef;
    },

    // Get Bookings for a user (real-time)
    subscribeToBookingsByUser: (userId, callback) => {
        const q = query(collection(db, 'bookings'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
    },

    // Get All Bookings (Admin)
    getAllBookings: async () => {
        try {
            const snapshot = await getDocs(collection(db, 'bookings'));
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error fetching all bookings:', error);
            return [];
        }
    },

    // Get Single Booking
    getBooking: async (id) => {
        try {
            const docRef = doc(db, 'bookings', id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() };
            }
            return null;
        } catch (error) {
            console.error('Error fetching booking:', error);
            return null;
        }
    },

    // Update Booking Status
    updateBooking: async (id, data) => {
        const bookingRef = doc(db, 'bookings', id);

        // Get existing data to find userId if not provided
        if (data.status) {
            const snap = await getDoc(bookingRef);
            const bookingData = snap.data();

            if (bookingData && bookingData.userId) {
                // Notify User
                const isApproved = data.status === 'approved';
                const isRejected = data.status === 'rejected';

                let body = isApproved
                    ? `Great news! Your booking for ${bookingData.hallName} on ${bookingData.date} has been approved.`
                    : `We regret to inform you that your booking request for ${bookingData.hallName} on ${bookingData.date} could not be approved at this time.`;

                if (isRejected && data.rejectionReason) {
                    body += `\n\nReason: ${data.rejectionReason}`;
                }

                await bookingService.createNotification({
                    recipientId: bookingData.userId,
                    title: isApproved ? 'Booking Confirmed! 🎉' : 'Booking Request Update',
                    body: body,
                    bookingId: id,
                    type: isApproved ? 'booking_approved' : 'booking_rejected',
                    status: data.status
                });
            }
        }

        return updateDoc(bookingRef, {
            ...data,
            updatedAt: serverTimestamp()
        });
    },

    // Get bookings for a hall
    getBookingsByHall: async (hallId) => {
        const q = query(collection(db, 'bookings'), where('hallId', '==', hallId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    // Get bookings for a specific day/date
    getBookingsByDay: async (day, date) => {
        try {
            const q = query(
                collection(db, 'bookings'),
                where('date', '==', date)
            );
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting bookings by day:', error);
            return [];
        }
    },

    // Notifications
    createNotification: async (data) => {
        return addDoc(collection(db, 'notifications'), {
            ...data,
            read: false,
            createdAt: serverTimestamp()
        });
    },

    subscribeToNotificationsForUser: (userId, callback) => {
        const q = query(collection(db, 'notifications'), where('recipientId', '==', userId), orderBy('createdAt', 'desc'));
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
    },

    subscribeToNotificationsByRole: (role, callback) => {
        const q = query(collection(db, 'notifications'), where('forRole', '==', role), orderBy('createdAt', 'desc'));
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
    },

    subscribeToNotificationsForAdmin: (callback) => {
        return bookingService.subscribeToNotificationsByRole('admin', callback);
    },

    markNotificationRead: async (id) => {
        return updateDoc(doc(db, 'notifications', id), { read: true });
    },

    deleteNotification: async (id) => {
        return deleteDoc(doc(db, 'notifications', id));
    }
};

export const courseService = {
    getAllCourses: async () => {
        try {
            const q = query(collection(db, 'courses'), orderBy('code'));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error fetching courses:', error);
            return [];
        }
    },

    addCourse: async (courseData) => {
        // Check for duplicates based on code
        const q = query(collection(db, 'courses'), where('code', '==', courseData.code));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            // Update existing? Or skip? Let's skip or error.
            // checking if name changed?
            // For now, simpler to just add if not exists, or update.
            // Let's iterate and use setDoc if we want valid IDs, but addDoc is fine.
            return;
        }

        return addDoc(collection(db, 'courses'), {
            ...courseData,
            createdAt: serverTimestamp()
        });
    },

    updateCourse: async (id, data) => {
        return updateDoc(doc(db, 'courses', id), {
            ...data,
            updatedAt: serverTimestamp()
        });
    },

    deleteCourse: async (id) => {
        return deleteDoc(doc(db, 'courses', id));
    },

    // Batch add courses (for CSV upload)
    addCoursesBatch: async (courses) => {
        const batch = writeBatch(db);
        const coursesRef = collection(db, 'courses');

        // Firestore batches are limited to 500 writes. 
        // Our file is < 400 lines, so one batch is fine.
        // But to be safe, we should loop chunks if it grows.
        // For now, simple implementation.

        let operationCount = 0;

        for (const course of courses) {
            // Create a ref with auto-ID
            const newDocRef = doc(coursesRef);
            batch.set(newDocRef, {
                ...course,
                createdAt: serverTimestamp()
            });
            operationCount++;
        }

        if (operationCount > 0) {
            await batch.commit();
        }
        return operationCount;
    }
};

export const timetableService = {
    // Add a single timetable entry
    addTimetableEntry: async (entry) => {
        // Validation: Check if entry overlaps with existing timetable entries
        const conflicts = await timetableService.checkTimetableConflict(
            entry.hallId,
            entry.dayOfWeek, // "Monday", "Tuesday", etc.
            entry.startTime,
            entry.endTime
        );

        if (conflicts) {
            throw new Error(`Conflict with existing lecture: ${conflicts.courseName} (${conflicts.startTime} - ${conflicts.endTime})`);
        }

        return addDoc(collection(db, 'hall_timetable'), {
            ...entry,
            createdAt: serverTimestamp()
        });
    },

    // Get all timetable entries for a specific hall
    getTimetableForHall: async (hallId) => {
        try {
            const q = query(collection(db, 'hall_timetable'), where('hallId', '==', hallId));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error fetching timetable:', error);
            return [];
        }
    },

    // Get ALL timetable entries for all halls
    getAllTimetableEntries: async () => {
        try {
            const snapshot = await getDocs(collection(db, 'hall_timetable'));
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error fetching all timetable entries:', error);
            return [];
        }
    },

    // Delete an entry
    deleteTimetableEntry: async (id) => {
        return deleteDoc(doc(db, 'hall_timetable', id));
    },

    // Check if a new timetable entry conflicts with EXISTING timetable entries
    checkTimetableConflict: async (hallId, dayOfWeek, newStart, newEnd) => {
        // Get all entries for this hall on this day
        const q = query(
            collection(db, 'hall_timetable'),
            where('hallId', '==', hallId),
            where('dayOfWeek', '==', dayOfWeek)
        );
        const snapshot = await getDocs(q);
        const entries = snapshot.docs.map(d => d.data());

        // Simple time overlap check
        // Time format: "HH:MM"
        // Overlap logic: (StartA < EndB) and (EndA > StartB)

        for (const entry of entries) {
            if (newStart < entry.endTime && newEnd > entry.startTime) {
                return entry; // Return conflicting entry
            }
        }
        return null;
    },

    // Core availability check for BOOKINGS
    checkAvailability: async (hallId, dateString, startTime, endTime) => {
        // 1. Check Fixed Timetables
        const date = new Date(dateString);
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = days[date.getDay()];

        const timetableConflict = await timetableService.checkTimetableConflict(hallId, dayName, startTime, endTime);
        if (timetableConflict) {
            return {
                available: false,
                reason: `Unavailable: Lecture scheduled (${timetableConflict.courseName})`
            };
        }

        // 2. Check Existing Approved Bookings
        // Note: Ideally query by date to filter, then check time in JS
        const q = query(
            collection(db, 'bookings'),
            where('hallId', '==', hallId),
            where('date', '==', dateString),
            where('status', '==', 'approved')
        );

        const snapshot = await getDocs(q);
        const bookings = snapshot.docs.map(d => d.data());

        for (const booking of bookings) {
            const [bStart, bEnd] = booking.timeSlot.split(' - ');
            if (startTime < bEnd && endTime > bStart) {
                return {
                    available: false,
                    reason: "Unavailable: Already booked"
                };
            }
        }

        return { available: true };
    },
    
    // Save user's selected courses
    saveUserTimetable: async (userId, courseIds) => {
        try {
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, {
                savedCourses: courseIds,
                updatedAt: serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error('Error saving user timetable:', error);
            throw error;
        }
    },

    // Get user's saved courses
    getUserTimetable: async (userId) => {
        try {
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                return userSnap.data().savedCourses || [];
            }
            return [];
        } catch (error) {
            console.error('Error getting user timetable:', error);
            return [];
        }
    }
};

export const userService = {
    getAllUsers: async () => {
        const snapshot = await getDocs(collection(db, 'users'));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    getUserProfile: async (uid) => {
        const snap = await getDoc(doc(db, 'users', uid));
        return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    },
    updateUserRole: async (uid, role) => {
        return updateDoc(doc(db, 'users', uid), { role });
    }
};

export const roleService = {
    getAllRoles: async () => {
        try {
            const snapshot = await getDocs(collection(db, 'roles'));
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error fetching roles:', error);
            return [];
        }
    },
    createRole: async (roleData) => {
        return addDoc(collection(db, 'roles'), {
            ...roleData,
            createdAt: serverTimestamp()
        });
    },
    updateRole: async (id, roleData) => {
        return updateDoc(doc(db, 'roles', id), {
            ...roleData,
            updatedAt: serverTimestamp()
        });
    },
    deleteRole: async (id) => {
        return deleteDoc(doc(db, 'roles', id));
    },
    getRole: async (id) => {
        const snap = await getDoc(doc(db, 'roles', id));
        return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    }
};

export const reportingService = {
    getAllReports: async () => {
        try {
            const q = query(collection(db, 'issue_reports'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error fetching reports:', error);
            return [];
        }
    },
    subscribeToReports: (callback) => {
        const q = query(collection(db, 'issue_reports'), orderBy('createdAt', 'desc'));
        return onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
    },
    updateReportStatus: async (id, status) => {
        return updateDoc(doc(db, 'issue_reports', id), {
            status,
            updatedAt: serverTimestamp()
        });
    },
    createReport: async (reportData) => {
        return addDoc(collection(db, 'issue_reports'), {
            ...reportData,
            status: 'pending',
            createdAt: serverTimestamp()
        });
    }
};

export const miscService = {
    getDepartments: async () => {
        try {
            const q = query(collection(db, 'departments'), orderBy('name'));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error fetching departments:', error);
            return [];
        }
    },
    addDepartment: async (name) => {
        return addDoc(collection(db, 'departments'), { name });
    },
    updateDepartment: async (id, data) => {
        const docRef = doc(db, 'departments', id);
        return updateDoc(docRef, data);
    },
    deleteDepartment: async (id) => {
        const docRef = doc(db, 'departments', id);
        return deleteDoc(docRef);
    },

    // Degree Management (Sub-collection of departments)
    getDegrees: async (deptId) => {
        try {
            if (!deptId) return [];
            const q = query(collection(db, 'departments', deptId, 'degrees'), orderBy('name'));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error fetching degrees:', error);
            return [];
        }
    },
    addDegree: async (deptId, data) => {
        return addDoc(collection(db, 'departments', deptId, 'degrees'), {
            ...data,
            createdAt: serverTimestamp()
        });
    },
    updateDegree: async (deptId, degreeId, data) => {
        const docRef = doc(db, 'departments', deptId, 'degrees', degreeId);
        return updateDoc(docRef, {
            ...data,
            updatedAt: serverTimestamp()
        });
    },
    deleteDegree: async (deptId, degreeId) => {
        const docRef = doc(db, 'departments', deptId, 'degrees', degreeId);
        return deleteDoc(docRef);
    }
};

export const holidayService = {
    // Upload multiple holidays using batch (useful for CSV upload)
    uploadHolidays: async (holidays, year) => {
        try {
            const batch = writeBatch(db);

            holidays.forEach(holiday => {
                const holidayId = `${year}_${holiday.uid || Math.random().toString(36).substr(2, 9)}`;
                const holidayRef = doc(db, 'holidays', holidayId);
                batch.set(holidayRef, {
                    ...holiday,
                    year: parseInt(year),
                    updatedAt: serverTimestamp()
                });
            });

            await batch.commit();
        } catch (error) {
            console.error('Error uploading holidays:', error);
            throw error;
        }
    },

    // Get holidays for a specific year
    getHolidaysByYear: async (year) => {
        try {
            const q = query(
                collection(db, 'holidays'),
                where('year', '==', parseInt(year))
            );
            const querySnapshot = await getDocs(q);
            const holidays = {};
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const isPoya = data.categories?.toLowerCase().includes('poya');
                const isFullMoon = data.summary?.toLowerCase().includes('full moon') || data.categories?.toLowerCase().includes('full-poya');

                holidays[data.date] = {
                    name: data.summary,
                    categories: data.categories || '',
                    type: isFullMoon ? 'full-poya' : (isPoya ? 'poya' : 'holiday')
                };
            });
            return holidays;
        } catch (error) {
            console.error('Error getting holidays:', error);
            throw error;
        }
    }
};
