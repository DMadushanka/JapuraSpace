import React, { useState, useEffect, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { db, auth } from '../../services/firebase';
import { collection, query, where, onSnapshot, orderBy, limit, getDoc, doc, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import {
    FaArrowLeft, FaMobileAlt, FaClock, FaCheckCircle,
    FaSpinner, FaUniversity, FaBuilding, FaBook,
    FaUsers, FaShieldAlt, FaCalendarCheck, FaUserGraduate
} from 'react-icons/fa';
import * as OTPAuth from 'otpauth';

const AttendanceSession = () => {
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [qrValue, setQrValue] = useState('');
    const [timeLeft, setTimeLeft] = useState(30);
    const [currentTime, setCurrentTime] = useState(new Date());

    const [courseDetails, setCourseDetails] = useState([]); // Array of course objects
    const [hallDetails, setHallDetails] = useState(null);
    const [showSummary, setShowSummary] = useState(false);
    const [attendanceList, setAttendanceList] = useState([]);
    const [attendanceCount, setAttendanceCount] = useState(0);
    const [recentScans, setRecentScans] = useState([]);
    const userCache = useRef({}); // Cache for student names

    const pageStyles = `
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }

                /* Modern Premium UI */
                .summary-container {
                    min-height: 100vh !important;
                    background: linear-gradient(135deg, #1a0505 0%, #2d0a0a 50%, #1a0505 100%) !important;
                    color: white !important;
                    padding: 60px 40px !important;
                    display: flex !important;
                    flex-direction: column !important;
                    align-items: center !important;
                    position: relative !important;
                    overflow-x: hidden !important;
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
                }

                .summary-container::before {
                    content: '' !important;
                    position: fixed !important;
                    top: -50% !important;
                    left: -50% !important;
                    width: 200% !important;
                    height: 200% !important;
                    background: radial-gradient(circle at 30% 50%, rgba(255, 215, 0, 0.08) 0%, transparent 50%),
                                radial-gradient(circle at 70% 50%, rgba(123, 17, 19, 0.15) 0%, transparent 50%) !important;
                    animation: gradientShift 20s ease infinite !important;
                    pointer-events: none !important;
                    z-index: 1 !important;
                }

                @keyframes gradientShift {
                    0%, 100% { transform: translate(0, 0) rotate(0deg); }
                    50% { transform: translate(5%, 5%) rotate(180deg); }
                }

                .mandala-bg-fixed {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background-image: url('/mandala_bg.png');
                    background-position: center;
                    background-repeat: no-repeat;
                    background-size: cover;
                    opacity: 0.03;
                    transform: scale(1.5);
                    pointer-events: none;
                    filter: blur(2px);
                }

                .summary-header {
                    position: relative;
                    z-index: 10;
                    width: 100%;
                    max-width: 1200px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    margin-bottom: 60px;
                    animation: fadeInDown 0.8s ease-out;
                }

                @keyframes fadeInDown {
                    from { opacity: 0; transform: translateY(-40px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .success-icon-wrapper {
                    width: 100px !important;
                    height: 100px !important;
                    background: linear-gradient(135deg, rgba(34, 197, 94, 0.25), rgba(16, 185, 129, 0.15)) !important;
                    border-radius: 30px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    margin-bottom: 30px !important;
                    border: 2px solid rgba(34, 197, 94, 0.4) !important;
                    font-size: 50px !important;
                    color: #22c55e !important;
                    box-shadow: 0 20px 60px rgba(34, 197, 94, 0.3),
                                0 0 0 1px rgba(255, 255, 255, 0.05),
                                inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
                    animation: scaleIn 0.6s ease-out 0.3s backwards, float 3s ease-in-out infinite !important;
                    position: relative !important;
                }

                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.3) rotate(-20deg); }
                    to { opacity: 1; transform: scale(1) rotate(0deg); }
                }

                @keyframes float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-8px); }
                }

                .summary-header h1 {
                    font-size: 56px;
                    font-weight: 900;
                    margin: 0 0 16px 0;
                    background: linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FFD700 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    animation: fadeIn 1s ease-out 0.5s backwards;
                    letter-spacing: -1px;
                    filter: drop-shadow(0 2px 20px rgba(255, 215, 0, 0.3));
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                .summary-header p {
                    font-size: 18px;
                    color: #d1d5db;
                    font-weight: 400;
                    margin: 0;
                    animation: fadeIn 1s ease-out 0.7s backwards;
                    letter-spacing: 0.5px;
                }

                .stats-grid {
                    position: relative;
                    z-index: 10;
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 28px;
                    width: 100%;
                    max-width: 1200px;
                    margin-bottom: 60px;
                }

                .stat-card {
                    background: linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03));
                    backdrop-filter: blur(20px);
                    padding: 36px 32px;
                    border-radius: 28px;
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    animation: slideUp 0.6s ease-out backwards;
                    position: relative;
                    overflow: hidden;
                }

                .stat-card::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    border-radius: 28px;
                    padding: 1px;
                    background: linear-gradient(135deg, rgba(255, 215, 0, 0.3), transparent);
                    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                    -webkit-mask-composite: xor;
                    mask-composite: exclude;
                    opacity: 0;
                    transition: opacity 0.4s;
                }

                .stat-card:hover::before { opacity: 1; }
                .stat-card:nth-child(1) { animation-delay: 0.9s; }
                .stat-card:nth-child(2) { animation-delay: 1.1s; }
                .stat-card:nth-child(3) { animation-delay: 1.3s; }

                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(40px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .stat-card:hover {
                    border-color: rgba(255, 215, 0, 0.5);
                    transform: translateY(-8px) scale(1.02);
                    box-shadow: 0 20px 50px rgba(255, 215, 0, 0.2),
                                0 0 0 1px rgba(255, 215, 0, 0.1);
                }

                .stat-label {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    margin-bottom: 8px;
                }

                .stat-label span {
                    font-size: 10px;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    color: #6b7280;
                }

                .stat-value {
                    font-size: 32px;
                    font-weight: 900;
                    color: white;
                }

                .stat-sub {
                    font-size: 14px;
                    color: #9ca3af;
                    margin-top: 4px;
                }

                .gold-text { color: #FFD700; }
                .green-text { color: #22c55e; }
                .blue-text { color: #3b82f6; }

                .table-container {
                    position: relative;
                    z-index: 10;
                    width: 100%;
                    max-width: 1200px;
                    background: linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03));
                    backdrop-filter: blur(30px);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    border-radius: 32px;
                    overflow: hidden;
                    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6),
                                0 0 0 1px rgba(255, 255, 255, 0.05),
                                inset 0 1px 0 rgba(255, 255, 255, 0.1);
                    animation: fadeInUp 0.8s ease-out 1.5s backwards;
                }

                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(50px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .table-header-row {
                    padding: 36px 40px;
                    background: linear-gradient(135deg, rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.2));
                    border-bottom: 1px solid rgba(255, 215, 0, 0.15);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .table-title {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }

                .gold-accent-line {
                    width: 4px; height: 40px;
                    background: #FFD700;
                    border-radius: 10px;
                }

                .table-title h3 {
                    margin: 0;
                    font-size: 20px;
                    font-weight: 700;
                }

                .table-title .subtitle {
                    margin: 4px 0 0 0;
                    font-size: 10px;
                    text-transform: uppercase;
                    font-weight: 800;
                    letter-spacing: 2px;
                    color: #6b7280;
                }

                .return-btn-minimal {
                    padding: 8px 16px;
                    color: #9ca3af;
                    font-size: 13px;
                    font-weight: 600;
                    text-decoration: none;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    transition: color 0.3s;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    background: rgba(255, 255, 255, 0.03);
                }

                .return-btn-minimal:hover {
                    color: #FFD700;
                    border-color: #FFD700;
                }

                .time-display-box {
                    display: flex;
                    align-items: center;
                }

                .time-val-main {
                    font-size: 15px;
                    font-family: 'JetBrains Mono', monospace;
                    color: white;
                    font-weight: 600;
                }

                .student-name-simple {
                    font-size: 15px;
                    font-weight: 700;
                    color: white;
                }

                .reg-id-val {
                    font-size: 14px;
                    font-family: 'JetBrains Mono', monospace;
                    color: #d1d5db;
                    font-weight: 600;
                }

                .table-wrapper {
                    overflow-x: auto;
                    width: 100%;
                    padding: 30px;
                    background: rgba(0, 0, 0, 0.3);
                }

                .attendance-table {
                    width: 100% !important;
                    border-collapse: collapse !important;
                    background: rgba(255, 255, 255, 0.02) !important;
                    border: 2px solid rgba(255, 215, 0, 0.15) !important;
                    border-radius: 16px;
                    overflow: hidden;
                }

                .attendance-table thead {
                    background: linear-gradient(135deg, rgba(123, 17, 19, 0.4), rgba(45, 10, 10, 0.4)) !important;
                    border-bottom: 2px solid rgba(255, 215, 0, 0.3) !important;
                }

                .attendance-table th {
                    padding: 20px 24px !important;
                    text-align: left;
                    font-size: 12px !important;
                    font-weight: 900 !important;
                    text-transform: uppercase;
                    letter-spacing: 2.5px;
                    color: #FFD700 !important;
                    border-right: 1px solid rgba(255, 255, 255, 0.15) !important;
                    white-space: nowrap;
                    background: transparent !important;
                }

                .attendance-table th:last-child {
                    border-right: none !important;
                }

                .attendance-table tbody tr {
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.15) !important;
                    animation: fadeInRow 0.5s ease-out backwards;
                    background: transparent !important;
                }

                .attendance-table tbody tr:nth-child(1) { animation-delay: 0.1s; }
                .attendance-table tbody tr:nth-child(2) { animation-delay: 0.2s; }
                .attendance-table tbody tr:nth-child(3) { animation-delay: 0.3s; }
                .attendance-table tbody tr:nth-child(4) { animation-delay: 0.4s; }
                .attendance-table tbody tr:nth-child(5) { animation-delay: 0.5s; }

                @keyframes fadeInRow {
                    from { opacity: 0; transform: translateX(-20px); }
                    to { opacity: 1; transform: translateX(0); }
                }

                .attendance-table tbody tr:hover {
                    background: rgba(255, 215, 0, 0.08) !important;
                    transform: scale(1.01);
                    box-shadow: 0 8px 24px rgba(255, 215, 0, 0.1);
                }

                .attendance-table td {
                    padding: 22px 24px !important;
                    border-right: 1px solid rgba(255, 255, 255, 0.15) !important;
                    vertical-align: middle;
                    color: white !important;
                    background: transparent !important;
                }

                .attendance-table td:last-child {
                    border-right: none !important;
                }

                .entry-no {
                    font-size: 16px;
                    font-weight: 900;
                    color: #FFD700;
                    font-family: 'JetBrains Mono', monospace;
                    text-shadow: 0 0 10px rgba(255, 215, 0, 0.3);
                }

                .status-badge-verified {
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                    background: linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.08));
                    border: 2px solid rgba(34, 197, 94, 0.4);
                    padding: 10px 24px;
                    border-radius: 100px;
                    color: #4ade80;
                    font-size: 11px;
                    font-weight: 900;
                    letter-spacing: 2.5px;
                    box-shadow: 0 4px 16px rgba(34, 197, 94, 0.2);
                    animation: pulse-badge 3s infinite;
                }

                @keyframes pulse-badge {
                    0%, 100% { box-shadow: 0 4px 16px rgba(34, 197, 94, 0.2); }
                    50% { box-shadow: 0 4px 24px rgba(34, 197, 94, 0.4); }
                }

                .pulse-indicator {
                    width: 8px; height: 8px;
                    background: #22c55e;
                    border-radius: 50%;
                    box-shadow: 0 0 10px #22c55e;
                    animation: pulse-lux 2s infinite;
                }

                @keyframes pulse-lux {
                    0% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.4; transform: scale(1.3); }
                    100% { opacity: 1; transform: scale(1); }
                }

                .empty-state-lux {
                    padding: 100px 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    color: #374151;
                }

                .empty-state-lux svg { font-size: 60px; margin-bottom: 20px; opacity: 0.15; }
                .bounce-subtle { animation: bounce-subtle-anim 3s infinite ease-in-out; }

                @keyframes bounce-subtle-anim {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }

                .table-footer-lux {
                    padding: 32px 40px;
                    background: rgba(0, 0, 0, 0.3);
                    border-top: 1px solid rgba(255, 255, 255, 0.05);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 20px;
                }

                .footer-line {
                    height: 1px;
                    flex: 1;
                    background: rgba(255, 255, 255, 0.03);
                }

                .table-footer-lux span {
                    font-size: 11px;
                    font-weight: 900;
                    color: #4b5563;
                    letter-spacing: 3px;
                }
                @keyframes scan { 0% {top: 0;} 100% {top: 100%;} }
    `;

    // Auth Listener
    useEffect(() => {
        const unsubAuth = auth.onAuthStateChanged((u) => {
            setUser(u);
            if (!u) setLoading(false);
        });
        return () => unsubAuth();
    }, []);

    // Session Listener
    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, 'sessions'),
            where('lecturerId', '==', user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const sortedDocs = [...snapshot.docs].sort((a, b) => {
                    const dataA = a.data();
                    const dataB = b.data();
                    const timeA = dataA.createdAt?.toMillis() || Date.now() + 10000;
                    const timeB = dataB.createdAt?.toMillis() || Date.now() + 10000;
                    return timeB - timeA;
                });

                const docData = sortedDocs[0].data();
                const sid = sortedDocs[0].id;

                if (docData.status === 'ACTIVE') {
                    setSession({ id: sid, ...docData });
                    setShowSummary(false);
                    fetchDetails(docData.courseIds || [docData.courseId], docData.hallId);
                } else if (docData.status === 'ENDED') {
                    setSession({ id: sid, ...docData });
                    setShowSummary(true);
                    fetchDetails(docData.courseIds || [docData.courseId], docData.hallId);
                    fetchAttendanceList(sid);
                }
            } else {
                setSession(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    // Live Counter Listener
    useEffect(() => {
        if (!session || session.status !== 'ACTIVE') return;

        const countQ = query(
            collection(db, 'attendance'),
            where('sessionId', '==', session.id)
        );

        const unsubscribe = onSnapshot(countQ, (snapshot) => {
            setAttendanceCount(snapshot.size);
        });

        return () => unsubscribe();
    }, [session]);

    // Recent Scans Listener
    useEffect(() => {
        if (!session || session.status !== 'ACTIVE') return;

        const q = query(
            collection(db, 'attendance'),
            where('sessionId', '==', session.id),
            orderBy('timestamp', 'desc'),
            limit(10)
        );

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const scans = await Promise.all(snapshot.docs.map(async (d) => {
                const data = d.data();
                const studentId = data.studentId;

                // Use cache if available
                if (userCache.current[studentId]) {
                    return {
                        id: d.id,
                        name: userCache.current[studentId],
                        time: data.timestamp?.toMillis() || Date.now()
                    };
                }

                // Fetch and cache
                let name = 'Unknown Student';
                if (studentId) {
                    try {
                        const uRef = doc(db, 'users', studentId);
                        const uSnap = await getDoc(uRef);
                        if (uSnap.exists()) {
                            name = uSnap.data().name || 'Unknown';
                            userCache.current[studentId] = name;
                        }
                    } catch (e) { console.error("Cache fetch error", e); }
                }

                return { id: d.id, name, time: data.timestamp?.toMillis() || Date.now() };
            }));
            setRecentScans(scans);
        });

        return () => unsubscribe();
    }, [session]);

    // Clock
    useEffect(() => {
        const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(clockInterval);
    }, []);

    // QR Logic
    useEffect(() => {
        let interval;
        if (session && session.status === 'ACTIVE' && session.secret) {
            updateQr();
            interval = setInterval(updateQr, 1000);
        }
        return () => clearInterval(interval);
    }, [session]);

    const updateQr = () => {
        if (!session || !session.secret) return;
        const epoch = Math.floor(Date.now() / 1000);
        const period = 30;
        const remaining = period - (epoch % period);
        setTimeLeft(remaining);
        try {
            const totp = new OTPAuth.TOTP({
                issuer: 'UniAttendance',
                label: 'Attendance',
                algorithm: 'SHA1',
                digits: 6,
                period: 30,
                secret: OTPAuth.Secret.fromHex(session.secret)
            });
            const token = totp.generate();
            setQrValue(`${session.id}:${token}`);
        } catch (e) { console.error(e); }
    };

    const fetchDetails = async (courseIds, hallId) => {
        if (courseIds && Array.isArray(courseIds)) {
            const coursePromises = courseIds.map(async (cid) => {
                if (!cid) return null;
                const cRef = doc(db, 'courses', cid);
                const snap = await getDoc(cRef);
                return snap.exists() ? { id: snap.id, ...snap.data() } : null;
            });
            const results = await Promise.all(coursePromises);
            setCourseDetails(results.filter(c => c !== null));
        } else if (courseIds) {
            // Fallback for single courseId
            const cRef = doc(db, 'courses', courseIds);
            getDoc(cRef).then(s => { if (s.exists()) setCourseDetails([{ id: s.id, ...s.data() }]) });
        }

        if (hallId) {
            const hRef = doc(db, 'halls', hallId);
            getDoc(hRef).then(s => { if (s.exists()) setHallDetails(s.data()) });
        }
    };

    const fetchAttendanceList = async (sid) => {
        try {
            const attRef = collection(db, 'attendance');
            const q = query(attRef, where('sessionId', '==', sid));
            const snap = await getDocs(q);

            const list = await Promise.all(snap.docs.map(async (d) => {
                const data = d.data();
                let studentDetails = {};

                // Fetch student details from users collection
                if (data.studentId) {
                    try {
                        const userRef = doc(db, 'users', data.studentId);
                        const userSnap = await getDoc(userRef);
                        if (userSnap.exists()) {
                            studentDetails = userSnap.data();
                        }
                    } catch (err) {
                        console.error("Error fetching user details:", err);
                    }
                }

                return {
                    id: d.id,
                    ...data,
                    studentName: studentDetails.name || 'Unknown',
                    afString: studentDetails.afNumber || 'N/A',
                    arString: studentDetails.arNumber || 'N/A',
                    studentDept: studentDetails.department || 'N/A',
                    studentDegree: studentDetails.degree || 'N/A'
                };
            }));

            list.sort((a, b) => (a.timestamp?.toMillis() || 0) - (b.timestamp?.toMillis() || 0));
            setAttendanceList(list);
            setAttendanceCount(list.length);
        } catch (e) { console.error(e); }
    };

    const handleEndSession = async () => {
        if (!session) return;
        if (!window.confirm("Are you sure you want to end this attendance session? Students will no longer be able to mark attendance.")) return;

        try {
            const sessionRef = doc(db, 'sessions', session.id);
            await updateDoc(sessionRef, {
                status: 'ENDED',
                endedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error ending session:", error);
            alert("Failed to end session. Please try again.");
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#270905] flex flex-col items-center justify-center text-white font-sans">
                <FaSpinner className="animate-spin text-5xl text-[#FFD700] mb-4" />
                <p className="text-xl font-medium tracking-widest uppercase">Connecting to Digital Ledger...</p>
            </div>
        );
    }

    if (!session) {
        return (
            <div className="min-h-screen bg-[#270905] flex items-center justify-center p-6 text-white font-sans overflow-hidden">
                <div className="absolute inset-0 bg-radial-gradient from-[#3a0d08] to-transparent opacity-50"></div>
                <div className="relative z-10 max-w-lg w-full bg-white/5 backdrop-blur-xl border border-white/10 p-12 rounded-[2.5rem] shadow-2xl text-center">
                    <div className="w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-white/10">
                        <FaMobileAlt className="text-5xl text-[#FFD700] animate-bounce" />
                    </div>
                    <h1 className="text-3xl font-bold mb-4 tracking-tight">Projector Console</h1>
                    <p className="text-gray-400 mb-10 text-lg leading-relaxed">
                        Please initiate the attendance session from your <span className="text-[#FFD700] font-bold">UniApp Mobile</span>. This screen will sync automatically.
                    </p>
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-center gap-3 text-sm text-gray-500 bg-black/20 py-3 rounded-xl border border-white/5">
                            <FaUniversity /> University of Sri Jayewardenepura
                        </div>
                        <Link to="/dashboard" className="inline-flex items-center justify-center gap-2 text-gray-400 hover:text-white transition-all py-2 text-sm font-medium">
                            <FaArrowLeft /> Exit to Dashboard
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    if (showSummary) {
        return (
            <div className="summary-container">
                <style>{pageStyles}</style>
                <div className="mandala-bg-fixed"></div>

                <div className="summary-header">
                    <div className="success-icon-wrapper">
                        <FaCheckCircle />
                    </div>
                    <h1>Lecture Completed</h1>
                    <p>Digital ledger secured & verified.</p>
                </div>

                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-label">
                            <FaBook className="gold-text" />
                            <span>Course Module{courseDetails.length > 1 ? 's' : ''}</span>
                        </div>
                        <div className="stat-value" style={{ fontSize: courseDetails.length > 2 ? '20px' : '32px' }}>
                            {courseDetails.map(c => c?.code).join(' / ') || 'N/A'}
                        </div>
                        <div className="stat-sub" style={{ fontSize: '12px' }}>
                            {courseDetails.map(c => c?.name).join(', ')}
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-label">
                            <FaUsers className="green-text" />
                            <span>Success Rate</span>
                        </div>
                        <div className="stat-value">{attendanceCount}</div>
                        <div className="stat-sub">Students Present</div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-label">
                            <FaClock className="blue-text" />
                            <span>Session End</span>
                        </div>
                        <div className="stat-value">
                            {session.endedAt ? new Date(session.endedAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                        </div>
                        <div className="stat-sub blue-text">LOCKED</div>
                    </div>
                </div>

                <div className="table-container shadow-heavy">
                    <div className="table-header-row">
                        <div className="table-title">
                            <div className="gold-accent-line"></div>
                            <div>
                                <h3>Attendance Register</h3>
                                <p className="subtitle">Official Verification Entry</p>
                            </div>
                        </div>
                        <Link to="/dashboard" className="return-btn-minimal">
                            <FaArrowLeft /> Return to Dashboard
                        </Link>
                    </div>

                    <div className="table-wrapper">
                        <table className="attendance-table" style={{ border: '2px solid rgba(255, 215, 0, 0.3)' }}>
                            <thead>
                                <tr>
                                    <th style={{ width: '60px', textAlign: 'center', borderRight: '1px solid rgba(255, 255, 255, 0.2)', borderBottom: '2px solid rgba(255, 215, 0, 0.3)' }}>#</th>
                                    <th style={{ width: '130px', borderRight: '1px solid rgba(255, 255, 255, 0.2)', borderBottom: '2px solid rgba(255, 215, 0, 0.3)' }}>Entry Time</th>
                                    <th style={{ borderRight: '1px solid rgba(255, 255, 255, 0.2)', borderBottom: '2px solid rgba(255, 215, 0, 0.3)' }}>Student Name</th>
                                    <th style={{ width: '160px', borderRight: '1px solid rgba(255, 255, 255, 0.2)', borderBottom: '2px solid rgba(255, 215, 0, 0.3)' }}>Registration ID</th>
                                    <th style={{ width: '160px', borderRight: '1px solid rgba(255, 255, 255, 0.2)', borderBottom: '2px solid rgba(255, 215, 0, 0.3)' }}>Index No</th>
                                    <th style={{ width: '120px', textAlign: 'right', borderBottom: '2px solid rgba(255, 215, 0, 0.3)' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {attendanceList.map((record, index) => (
                                    <tr key={record.id}>
                                        <td className="entry-no" style={{ textAlign: 'center', borderRight: '1px solid rgba(255, 255, 255, 0.2)', borderBottom: '1px solid rgba(255, 255, 255, 0.2)' }}>{String(index + 1).padStart(2, '0')}</td>
                                        <td style={{ borderRight: '1px solid rgba(255, 255, 255, 0.2)', borderBottom: '1px solid rgba(255, 255, 255, 0.2)' }}>
                                            <div className="time-display-box">
                                                <span className="time-val-main">
                                                    {new Date(record.timestamp?.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </span>
                                            </div>
                                        </td>
                                        <td style={{ borderRight: '1px solid rgba(255, 255, 255, 0.2)', borderBottom: '1px solid rgba(255, 255, 255, 0.2)' }}>
                                            <div className="student-name-simple">{record.studentName || 'Unknown Student'}</div>
                                        </td>
                                        <td style={{ borderRight: '1px solid rgba(255, 255, 255, 0.2)', borderBottom: '1px solid rgba(255, 255, 255, 0.2)' }}>
                                            <div className="reg-id-val">{record.arString || 'N/A'}</div>
                                        </td>
                                        <td style={{ borderRight: '1px solid rgba(255, 255, 255, 0.2)', borderBottom: '1px solid rgba(255, 255, 255, 0.2)' }}>
                                            <div className="reg-id-val">{record.afString || 'N/A'}</div>
                                        </td>
                                        <td style={{ textAlign: 'right', borderBottom: '1px solid rgba(255, 255, 255, 0.2)' }}>
                                            <div className="status-badge-verified">
                                                <div className="pulse-indicator"></div>
                                                PRESENT
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {attendanceList.length === 0 && (
                        <div className="empty-state-lux">
                            <FaUserGraduate className="bounce-subtle" />
                            <p>Scanning complete. No records found for this session.</p>
                        </div>
                    )}

                    <div className="table-footer-lux">
                        <div className="footer-line"></div>
                        <span>REPORT SUMMARY • {attendanceCount} TOTAL VERIFIED ENTRIES</span>
                        <div className="footer-line"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#111] text-white flex flex-col font-sans overflow-hidden relative">
            <style>{pageStyles}</style>

            {/* Background elements */}
            <div className="absolute inset-0 pointer-events-none opacity-20">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#7B1113] rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-[#FFD700] rounded-full blur-[100px] opacity-30"></div>
            </div>

            {/* Premium Navigation */}
            <nav className="relative z-20 px-12 py-8 flex items-center justify-between border-b border-white/5 backdrop-blur-3xl bg-black/40 min-h-[120px]">
                <div className="flex items-center gap-10">
                    <div className="relative">
                        <div className="h-16 w-16 bg-[#7B1113] rounded-2xl flex items-center justify-center shadow-2xl relative z-10">
                            <FaUniversity className="text-3xl text-[#FFD700]" />
                        </div>
                        <div className="absolute -inset-2 bg-[#7B1113]/20 rounded-3xl blur-md"></div>
                    </div>

                    <div className="flex flex-col gap-1 border-l border-white/20 pl-10">
                        <div className="flex items-center gap-3">
                            <FaBook className="text-[#FFD700] text-sm" />
                            <h2 className="text-3xl font-black tracking-tight text-white leading-none">
                                {courseDetails.length > 0 
                                    ? courseDetails.map(c => c.code).join(' / ') 
                                    : 'FETCHING...'}
                            </h2>
                        </div>
                        <p className="text-gray-400 font-medium tracking-wide uppercase text-xs">
                            {courseDetails.length > 0 
                                ? (courseDetails.length === 1 ? courseDetails[0].name : `${courseDetails.length} MODULES SELECTED`) 
                                : 'SYNCING COURSE MODULE...'}
                        </p>
                    </div>

                    <div className="flex flex-col gap-1 border-l border-white/20 pl-10 hidden lg:flex">
                        <div className="flex items-center gap-3">
                            <FaBuilding className="text-[#FFD700] text-sm" />
                            <h2 className="text-3xl font-black tracking-tight text-white leading-none">
                                {hallDetails?.name || 'AUTO-SYNCING...'}
                            </h2>
                        </div>
                        <p className="text-gray-400 font-medium tracking-wide uppercase text-xs">
                            Designated Lecture Venue
                        </p>
                    </div>
                </div>

                <div className="flex flex-col items-end">
                    <div className="text-5xl font-black font-mono tracking-tighter text-white">
                        {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                    </div>
                    <div className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">
                        {currentTime.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                    </div>
                </div>
            </nav>

            {/* Split Screen Master Layout */}
            <main className="flex-1 flex flex-col xl:flex-row relative z-10 bg-black/30">
                {/* QR Display - Optimized for Maximum Visibility on Projector */}
                <div className="flex-1 flex flex-col items-center justify-center p-12 border-r border-white/5 relative">
                    <div className="relative group p-10 bg-white rounded-[3.5rem] shadow-[0_0_100px_rgba(255,255,255,0.05)] transition-all transform hover:scale-[1.01]">
                        {/* Decorative animated corners */}
                        <div className="absolute -inset-1 border-4 border-[#7B1113] rounded-[4rem] opacity-20"></div>
                        <div className="absolute -top-4 -left-4 w-12 h-12 border-t-8 border-l-8 border-[#7B1113] rounded-tl-2xl"></div>
                        <div className="absolute -top-4 -right-4 w-12 h-12 border-t-8 border-r-8 border-[#7B1113] rounded-tr-2xl"></div>
                        <div className="absolute -bottom-4 -left-4 w-12 h-12 border-b-8 border-l-8 border-[#7B1113] rounded-bl-2xl"></div>
                        <div className="absolute -bottom-4 -right-4 w-12 h-12 border-b-8 border-r-8 border-[#7B1113] rounded-br-2xl"></div>

                        {qrValue ? (
                            <div className="relative">
                                <QRCodeCanvas
                                    value={qrValue}
                                    size={550}
                                    level="H"
                                    includeMargin={true}
                                    className="rounded-xl"
                                />
                                {/* Scanning line effect */}
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#7B1113]/40 to-transparent animate-[scan_4s_linear_infinite]"></div>
                            </div>
                        ) : (
                            <div className="w-[550px] h-[550px] bg-gray-50 flex items-center justify-center text-gray-300 rounded-3xl">
                                <FaSpinner className="animate-spin text-4xl" />
                            </div>
                        )}
                    </div>

                    {/* Time Progress Bar */}
                    <div className="mt-16 flex flex-col items-center w-full max-w-2xl">
                        <div className="flex justify-between w-full mb-3 text-sm font-black uppercase tracking-[0.2em]">
                            <span className="text-gray-500">Security Refresh</span>
                            <span className={timeLeft < 10 ? "text-red-500 animate-pulse" : "text-[#FFD700]"}>{timeLeft} SECONDS REMAINING</span>
                        </div>
                        <div className="w-full h-4 bg-white/5 rounded-full p-1 border border-white/10 shadow-inner">
                            <div
                                className={`h-full rounded-full transition-all duration-1000 ease-linear ${timeLeft < 10 ? 'bg-red-600 shadow-[0_0_15px_#dc2626]' : 'bg-gradient-to-r from-[#7B1113] to-[#a1161a] shadow-[0_0_15px_#7B1113]'}`}
                                style={{ width: `${(timeLeft / 30) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                </div>

                {/* Sidebar - Interactive Content & Realtime status */}
                <aside className="w-full xl:w-[500px] h-full flex flex-col border-l border-white/5 backdrop-blur-2xl bg-black/60 p-12 overflow-y-auto custom-scrollbar">
                    <div className="space-y-16">
                        {/* Live Status Card */}
                        <div className="bg-green-500/5 border border-green-500/20 p-8 rounded-[2rem] relative overflow-hidden group">
                            <div className="relative z-10 flex flex-col gap-6">
                                <div className="flex items-center gap-6">
                                    <div className="h-16 w-16 bg-green-500 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.3)] shrink-0">
                                        <div className="flex flex-col items-center">
                                            <span className="text-white font-black text-2xl leading-none">{attendanceCount}</span>
                                            <FaUsers className="text-[10px] text-white/80" />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-green-500 font-black text-xl tracking-tight uppercase">Live Attendance</div>
                                        <div className="text-white/60 text-xs font-bold tracking-widest uppercase mt-0.5">Scanned: {attendanceCount} Students</div>
                                    </div>
                                </div>
                                <button
                                    onClick={handleEndSession}
                                    className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black text-sm uppercase tracking-widest rounded-2xl transition-all shadow-lg hover:shadow-red-600/20 flex items-center justify-center gap-3 active:scale-95"
                                >
                                    <FaClock /> End Session Now
                                </button>
                            </div>
                            <div className="absolute top-0 right-0 p-4">
                                <span className="flex h-3 w-3 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                </span>
                            </div>
                        </div>

                        {/* Live Activity Feed */}
                        <div className="space-y-6">
                            <h3 className="text-[#FFD700] text-xs font-black uppercase tracking-[0.3em] flex items-center gap-4">
                                <span className="h-[1px] bg-white/10 flex-1"></span>
                                Live Activity
                                <span className="h-[1px] bg-white/10 flex-1"></span>
                            </h3>

                            <div className="space-y-3 min-h-[250px]">
                                {recentScans.length > 0 ? (
                                    recentScans.map((scan, idx) => (
                                        <div
                                            key={scan.id}
                                            className="flex items-center gap-4 p-4 bg-white/5 border border-white/5 rounded-2xl animate-in slide-in-from-right duration-500"
                                            style={{ animationDelay: `${idx * 100}ms` }}
                                        >
                                            <div className="h-8 w-8 bg-[#7B1113] rounded-lg flex items-center justify-center text-[10px] font-bold text-[#FFD700] border border-[#FFD700]/20">
                                                {scan.name[0].toUpperCase()}
                                            </div>
                                            <div className="flex-1 overflow-hidden">
                                                <div className="text-sm font-bold text-gray-200 truncate">{scan.name}</div>
                                                <div className="text-[10px] text-gray-500 uppercase font-mono">Verified • {new Date(scan.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                                            </div>
                                            <FaCheckCircle className="text-green-500 text-xs" />
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-[250px] flex flex-col items-center justify-center text-gray-600 border border-white/5 border-dashed rounded-3xl">
                                        <FaSpinner className="animate-spin mb-4 opacity-20" />
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Awaiting first scan...</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Guide Section */}
                        <div className="space-y-10 group opacity-40 hover:opacity-100 transition-opacity">
                            <h3 className="text-[#FFD700] text-xs font-black uppercase tracking-[0.3em] flex items-center gap-4">
                                <span className="h-[1px] bg-white/10 flex-1"></span>
                                Quick Steps
                                <span className="h-[1px] bg-white/10 flex-1"></span>
                            </h3>

                            <div className="space-y-8">
                                <div className="flex items-start gap-6 group/item">
                                    <div className="text-3xl font-black text-white opacity-10 group-hover/item:opacity-100 transition-opacity">01</div>
                                    <div>
                                        <h4 className="text-white font-bold text-sm mb-1 tracking-tight">Open UniApp</h4>
                                        <p className="text-gray-500 leading-relaxed text-[10px] font-medium uppercase">Log in with USJ credentials.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-6 group/item">
                                    <div className="text-3xl font-black text-white opacity-10 group-hover/item:opacity-100 transition-opacity">02</div>
                                    <div>
                                        <h4 className="text-white font-bold text-sm mb-1 tracking-tight">Scan QR</h4>
                                        <p className="text-gray-500 leading-relaxed text-[10px] font-medium uppercase">Point camera at the screen code.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Control Notification */}
                        <div className="bg-white/5 border border-white/10 p-8 rounded-[2rem] flex items-center gap-6">
                            <div className="h-12 w-12 bg-black/40 rounded-xl flex items-center justify-center border border-white/5">
                                <FaShieldAlt className="text-[#FFD700]" />
                            </div>
                            <p className="text-[11px] text-gray-500 font-bold uppercase leading-relaxed tracking-wider">
                                This session is remotely controlled by your mobile device. Do not refresh or exit this console.
                            </p>
                        </div>
                    </div>

                    <div className="mt-auto pt-10 text-center text-gray-700 text-[10px] font-black uppercase tracking-[0.5em]">
                        Projector Display V2.0 // USJ Attendance
                    </div>
                </aside>
            </main>
        </div >
    );
};

export default AttendanceSession;
