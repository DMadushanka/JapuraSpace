import React, { useState, useEffect } from 'react';
import { db, auth } from '../../services/firebase';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { FaFileExcel, FaUsers, FaBook, FaSearch, FaSpinner, FaArrowLeft, FaCheck, FaTimes, FaCalendarAlt } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { authService } from '../../services/auth';
import { userService } from '../../services/firestore';

const AttendanceManagement = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [role, setRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState('');
    const [students, setStudents] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [attendanceData, setAttendanceData] = useState({}); // { studentId: { sessionId: true } }
    const [fetchingData, setFetchingData] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (u) => {
            if (u) {
                setUser(u);
                const [userRole, permissions] = await Promise.all([
                    authService.getUserRole(u.uid),
                    authService.getUserPermissions(u.uid)
                ]);
                setRole(userRole);
                const isFullAccess = userRole === 'admin' || userRole === 'board' || permissions.manage_users;
                fetchCourses(u.uid, isFullAccess);
            } else {
                navigate('/login');
            }
        });
        return () => unsubscribe();
    }, [navigate]);

    const fetchCourses = async (uid, isFullAccess) => {
        try {
            setLoading(true);
            let coursesList = [];
            if (isFullAccess) {
                const q = query(collection(db, 'courses'), orderBy('code'));
                const snap = await getDocs(q);
                coursesList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } else {
                // Lecturer: only their assigned courses
                const profile = await userService.getUserProfile(uid);
                const assignedIds = profile?.savedCourses || [];
                if (assignedIds.length > 0) {
                    const coursesSnap = await Promise.all(
                        assignedIds.map(id => getDoc(doc(db, 'courses', id)))
                    );
                    coursesList = coursesSnap
                        .filter(s => s.exists())
                        .map(s => ({ id: s.id, ...s.data() }));
                }
            }
            setCourses(coursesList);
            if (coursesList.length > 0) {
                setSelectedCourse(coursesList[0].id);
            }
        } catch (error) {
            console.error("Error fetching courses:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedCourse) {
            fetchAttendanceMatrix(selectedCourse);
        }
    }, [selectedCourse]);

    const fetchAttendanceMatrix = async (courseId) => {
        setFetchingData(true);
        try {
            // 1. Fetch Students enrolled in this course (those who have it in savedCourses)
            const studentsQuery = query(
                collection(db, 'users'),
                where('role', '==', 'student'),
                where('savedCourses', 'array-contains', courseId)
            );
            const studentsSnap = await getDocs(studentsQuery);
            const enrolledStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            setStudents(enrolledStudents);

            // 2. Fetch Sessions for this course (ENDED status preferred for historical)
            const sessionsQuery = query(
                collection(db, 'sessions'),
                where('courseIds', 'array-contains', courseId),
                orderBy('createdAt', 'asc')
            );
            const sessionsSnap = await getDocs(sessionsQuery);
            const courseSessions = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            // Limit to 15 sessions as per requirement
            const limitedSessions = courseSessions.slice(0, 15);
            setSessions(limitedSessions);

            // 3. Fetch Attendance records for these sessions
            if (limitedSessions.length > 0) {
                const matrix = {};
                for (const session of limitedSessions) {
                    const attQuery = query(collection(db, 'attendance'), where('sessionId', '==', session.id));
                    const attSnap = await getDocs(attQuery);
                    attSnap.forEach(d => {
                        const data = d.data();
                        if (!matrix[data.studentId]) matrix[data.studentId] = {};
                        matrix[data.studentId][session.id] = true;
                    });
                }
                setAttendanceData(matrix);
            } else {
                setAttendanceData({});
            }

        } catch (error) {
            console.error("Error fetching matrix:", error);
        } finally {
            setFetchingData(false);
        }
    };

    const handleExport = () => {
        const course = courses.find(c => c.id === selectedCourse);
        const fileName = `${course?.code || 'Attendance'}_Report.xlsx`;

        const data = students.map((s, index) => {
            const row = {
                '#': index + 1,
                'Name': s.name,
                'AF Number': s.afNumber || 'N/A',
                'AR Number': s.arNumber || 'N/A',
                'Email': s.email
            };

            sessions.forEach((sess, i) => {
                row[`Session ${i + 1}`] = attendanceData[s.id]?.[sess.id] ? 'P' : 'A';
            });

            // Fill up to 15 sessions even if not exists
            for (let i = sessions.length; i < 15; i++) {
                row[`Session ${i + 1}`] = '-';
            }

            const presentCount = Object.values(attendanceData[s.id] || {}).length;
            row['Total Present'] = presentCount;
            row['Percentage'] = sessions.length > 0 ? `${Math.round((presentCount / sessions.length) * 100)}%` : '0%';

            return row;
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Attendance");
        XLSX.writeFile(wb, fileName);
    };

    const filteredStudents = students.filter(s =>
        s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.afNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.arNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh', color: 'var(--accent-gold)' }}>
                <FaSpinner className="animate-spin" size={40} />
            </div>
        );
    }

    return (
        <div style={{ padding: '20px', color: 'white', animation: 'fadeIn 0.5s ease-out' }}>
            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .glass-card {
                    background: rgba(255, 255, 255, 0.03);
                    backdrop-filter: blur(10px);
                    border: 1px solid var(--glass-border);
                    border-radius: 16px;
                    padding: 24px;
                    margin-bottom: 24px;
                }
                .attendance-table {
                    width: 100%;
                    border-collapse: separate;
                    border-spacing: 0;
                    margin-top: 20px;
                }
                .attendance-table th {
                    background: rgba(123, 17, 19, 0.4);
                    padding: 12px;
                    text-align: left;
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    color: var(--accent-gold);
                    border-bottom: 1px solid var(--glass-border);
                    white-space: nowrap;
                }
                .attendance-table td {
                    padding: 12px;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    font-size: 0.9rem;
                }
                .status-p { color: #2ecc71; font-weight: bold; }
                .status-a { color: #e74c3c; opacity: 0.5; }
                .session-col { text-align: center !important; min-width: 40px; }
                .export-btn {
                    background: linear-gradient(135deg, #27ae60, #2ecc71);
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 8px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-weight: 600;
                    transition: all 0.2s;
                }
                .export-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(46, 204, 113, 0.3); }
                .search-input {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid var(--glass-border);
                    color: white;
                    padding: 10px 15px;
                    border-radius: 8px;
                    width: 300px;
                    outline: none;
                }
                .search-input:focus { border-color: var(--accent-gold); }
            `}</style>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: '800', margin: 0, background: 'linear-gradient(to right, #fff, var(--accent-gold))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Attendance Management
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.6)', margin: '5px 0 0 0' }}>Semester Master Sheet • 15 Session Tracking</p>
                </div>
                <button className="export-btn" onClick={handleExport}>
                    <FaFileExcel /> Export to Excel
                </button>
            </div>

            <div className="glass-card" style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '300px' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--accent-gold)', marginBottom: '8px', textTransform: 'uppercase' }}>Select Module</label>
                    <select
                        value={selectedCourse}
                        onChange={(e) => setSelectedCourse(e.target.value)}
                        style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'white', borderRadius: '8px', outline: 'none' }}
                    >
                        {courses.length > 0 ? (
                            courses.map(c => (
                                <option key={c.id} value={c.id} style={{ background: '#1a1a1a' }}>{c.code} - {c.name}</option>
                            ))
                        ) : (
                            <option value="">No modules assigned</option>
                        )}
                    </select>
                </div>
                <div style={{ flex: 1, minWidth: '300px' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--accent-gold)', marginBottom: '8px', textTransform: 'uppercase' }}>Search Students</label>
                    <div style={{ position: 'relative' }}>
                        <FaSearch style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Name, AF or AR Number..."
                            style={{ width: '100%', paddingLeft: '40px' }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="glass-card" style={{ padding: 0, overflowX: 'auto' }}>
                {fetchingData ? (
                    <div style={{ padding: '100px', textAlign: 'center', color: 'var(--accent-gold)' }}>
                        <FaSpinner className="animate-spin" size={30} style={{ marginBottom: '10px' }} />
                        <p>Syncing enrollment data...</p>
                    </div>
                ) : (
                    <table className="attendance-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Student Details</th>
                                <th>AF Number</th>
                                <th>AR Number</th>
                                {[...Array(15)].map((_, i) => (
                                    <th key={i} className="session-col">S{i + 1}</th>
                                ))}
                                <th style={{ textAlign: 'center' }}>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStudents.length > 0 ? filteredStudents.map((s, idx) => (
                                <tr key={s.id}>
                                    <td>{idx + 1}</td>
                                    <td>
                                        <div style={{ fontWeight: '600' }}>{s.name}</div>
                                        <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>{s.email}</div>
                                    </td>
                                    <td>{s.afNumber || '-'}</td>
                                    <td>{s.arNumber || '-'}</td>
                                    {[...Array(15)].map((_, i) => {
                                        const session = sessions[i];
                                        const isPresent = session && attendanceData[s.id]?.[session.id];
                                        return (
                                            <td key={i} className="session-col">
                                                {!session ? (
                                                    <span style={{ opacity: 0.2 }}>-</span>
                                                ) : isPresent ? (
                                                    <FaCheck className="status-p" />
                                                ) : (
                                                    <FaTimes className="status-a" />
                                                )}
                                            </td>
                                        );
                                    })}
                                    <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--accent-gold)' }}>
                                        {Object.values(attendanceData[s.id] || {}).length}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={20} style={{ padding: '50px', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
                                        <FaUsers size={40} style={{ marginBottom: '10px', opacity: 0.2 }} />
                                        <p>No students found for this module.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '20px', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <FaCheck style={{ color: '#2ecc71' }} /> Present
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <FaTimes style={{ color: '#e74c3c' }} /> Absent
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ opacity: 0.3 }}>-</span> Session Not Held
                </div>
            </div>
        </div>
    );
};

export default AttendanceManagement;
