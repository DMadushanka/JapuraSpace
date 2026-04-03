import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaSignOutAlt, FaBell, FaBars, FaTimes } from 'react-icons/fa';
import logo from '../assets/logo.png';
import { authService } from '../services/auth';
import { bookingService, userService, hallService, courseService, timetableService } from '../services/firestore';

const Header = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [role, setRole] = useState(null);
    const [permissions, setPermissions] = useState({});
    const [unreadCount, setUnreadCount] = useState(0);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [profileName, setProfileName] = useState('');
    const [nextLecture, setNextLecture] = useState(null);
    const [timeLeft, setTimeLeft] = useState('');
    const [allUserLectures, setAllUserLectures] = useState([]);
    const [loadingNext, setLoadingNext] = useState(false);

    useEffect(() => {
        let unsubscribeUserNotifs = () => { };
        let unsubscribeAdminNotifs = () => { };

        const unsubscribeAuth = authService.onAuthStateChanged(async (u) => {
            setUser(u);
            if (u) {
                // Fetch role and permissions together to ensure they're both loaded
                const [userRole, perms] = await Promise.all([
                    authService.getUserRole(u.uid),
                    authService.getUserPermissions(u.uid)
                ]);

                setRole(userRole);
                setPermissions(perms);

                let userUnread = 0;
                let adminUnread = 0;

                const updateCount = () => {
                    setUnreadCount(userUnread + adminUnread);
                };

                unsubscribeUserNotifs = bookingService.subscribeToNotificationsForUser(u.uid, (notifs) => {
                    userUnread = notifs.filter(n => !n.read).length;
                    updateCount();
                });

                if (userRole === 'admin' || userRole === 'board' || userRole === 'Booking_Manager') {
                    unsubscribeAdminNotifs = bookingService.subscribeToNotificationsByRole(userRole, (notifs) => {
                        adminUnread = notifs.filter(n => !n.read).length;
                        updateCount();
                    });
                }

                // Fetch profile name for avatar
                const profile = await userService.getUserProfile(u.uid);
                if (profile && profile.name) {
                    setProfileName(profile.name);
                    fetchNextLecture(profile.savedCourses || []);
                }
            } else {
                setRole(null);
                setPermissions({});
                setUnreadCount(0);
                setNextLecture(null);
                setTimeLeft('');
                setAllUserLectures([]);
                unsubscribeUserNotifs();
                unsubscribeAdminNotifs();
            }
        });

        return () => {
            unsubscribeAuth();
            unsubscribeUserNotifs();
            unsubscribeAdminNotifs();
        };
    }, []);

    useEffect(() => {
        if (!user || allUserLectures.length === 0) return;

        const timer = setInterval(() => {
            calculateNext(allUserLectures);
        }, 60000);

        calculateNext(allUserLectures);

        return () => clearInterval(timer);
    }, [user, allUserLectures]);

    // Next Lecture Calculation Logic (Parity with Mobile App)
    const fetchNextLecture = async (savedCourseIds) => {
        if (!savedCourseIds || savedCourseIds.length === 0) {
            setNextLecture(null);
            return;
        }

        try {
            setLoadingNext(true);
            const [hallsData, allEntries, allCourses, allBookings] = await Promise.all([
                hallService.getAllHalls(),
                timetableService.getAllTimetableEntries(),
                courseService.getAllCourses(),
                bookingService.getAllBookings()
            ]);

            const savedCoursesInfo = allCourses.filter(c => savedCourseIds.includes(c.id));
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const todayIdx = new Date().getDay();
            const todayDay = days[todayIdx];
            const todayDateStr = new Date().toISOString().split('T')[0];

            // 1. Regular Timetable Entries
            const filteredLectures = allEntries
                .filter(entry => {
                    return savedCoursesInfo.some(course =>
                        entry.courseId === course.id ||
                        entry.courseName === course.name ||
                        (entry.courseName && course.code && entry.courseName.toLowerCase().includes(course.code.toLowerCase())) ||
                        entry.courseCode?.toLowerCase() === course.code?.toLowerCase()
                    );
                })
                .map(entry => {
                    const hall = hallsData.find(h => h.id === entry.hallId);
                    const course = allCourses.find(c =>
                        c.id === entry.courseId ||
                        c.code?.toLowerCase() === entry.courseCode?.toLowerCase() ||
                        c.name?.toLowerCase() === entry.courseName?.toLowerCase()
                    );

                    return {
                        ...entry,
                        hallName: hall ? hall.name : (entry.hallName || 'Unknown'),
                        courseName: course ? course.name : (entry.courseName || entry.courseCode || 'Unknown Course'),
                        courseCode: course ? course.code : (entry.courseCode || ''),
                    };
                });

            // 2. Rescheduled Bookings
            const reschedules = (allBookings || [])
                .filter(b => b.type === 'reschedule' && b.status === 'approved' && savedCourseIds.includes(b.courseId))
                .map(b => {
                    const [start, end] = b.timeSlot.split('-');
                    return {
                        ...b,
                        isReschedule: true,
                        startTime: start.trim(),
                        endTime: end.trim(),
                        dayOfWeek: days[new Date(b.date).getDay()],
                        isSpecificDate: true
                    };
                });

            const combinedForCountdown = [...filteredLectures, ...reschedules];
            setAllUserLectures(combinedForCountdown);
            calculateNext(combinedForCountdown);
        } catch (err) {
            console.error('Error fetching next lecture:', err);
        } finally {
            setLoadingNext(false);
        }
    };

    const calculateNext = (lectures) => {
        if (!lectures || lectures.length === 0) {
            setNextLecture(null);
            return;
        }

        const now = new Date();
        const currentDayIdx = now.getDay();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        const parseTimeToMinutes = (timeStr) => {
            if (!timeStr) return 0;
            const cleanTime = timeStr.toUpperCase().replace(/\s+/g, '');
            const isPM = cleanTime.includes('PM');
            const isAM = cleanTime.includes('AM');
            let [h, m] = cleanTime.replace(/[AP]M/, '').split(':').map(Number);

            if (isPM && h < 12) h += 12;
            if (isAM && h === 12) h = 0;
            return h * 60 + (m || 0);
        };

        for (let i = 0; i < 7; i++) {
            const searchDayIdx = (currentDayIdx + i) % 7;
            const searchDayName = days[searchDayIdx];
            const targetDate = new Date();
            targetDate.setDate(now.getDate() + i);
            const targetDateStr = targetDate.toISOString().split('T')[0];

            const dayLectures = lectures
                .filter(l => l.dayOfWeek === searchDayName)
                .map(l => ({ ...l, startMinutes: parseTimeToMinutes(l.startTime) }))
                .sort((a, b) => a.startMinutes - b.startMinutes);

            const availableLectures = (i === 0)
                ? dayLectures.filter(l => l.startMinutes > currentMinutes)
                : dayLectures;

            if (availableLectures.length > 0) {
                const next = availableLectures[0];
                const isCancelled = next.cancelledDates && next.cancelledDates.some(c => c.date === targetDateStr);

                if (next.isReschedule && next.date !== targetDateStr) {
                    continue;
                }

                setNextLecture({ ...next, relativeDay: i, isCancelled });

                if (isCancelled) {
                    setTimeLeft('CANCELLED');
                } else if (i === 0) {
                    const diff = next.startMinutes - currentMinutes;
                    if (diff >= 60) {
                        const h = Math.floor(diff / 60);
                        const m = diff % 60;
                        setTimeLeft(`${h}h ${m}m`);
                    } else {
                        setTimeLeft(`${diff}m`);
                    }
                } else {
                    setTimeLeft(next.startTime);
                }
                return;
            }
        }
        setNextLecture(null);
    };

    const handleLogout = async () => {
        await authService.signOut();
        setIsMenuOpen(false);
        navigate('/login');
    };

    const isAdmin = role === 'admin' || role === 'board' || permissions.view_dashboard || permissions.manage_halls || permissions.manage_users || permissions.manage_bookings || permissions.manage_slider || permissions.manage_calendar || permissions.manage_roles;

    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

    const closeMenu = () => setIsMenuOpen(false);

    return (
        <header style={{
            background: 'linear-gradient(to right, var(--primary-maroon), var(--bg-dark))',
            padding: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '2px solid var(--accent-gold)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            position: 'sticky',
            top: 0,
            zIndex: 1100
        }}>
            <div
                style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', transition: 'transform 0.2s' }}
                onClick={() => { navigate(user ? '/dashboard' : '/'); closeMenu(); }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
                <div style={{
                    width: '64px',
                    height: '64px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    position: 'relative',
                }}>
                    <img src={logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(212, 175, 55, 0.4))' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <h1 style={{
                        fontSize: '1.4rem',
                        color: 'white',
                        textTransform: 'uppercase',
                        letterSpacing: '1.5px',
                        margin: 0,
                        lineHeight: 1.1,
                        fontWeight: 900,
                        background: 'linear-gradient(to right, #fff, var(--accent-gold))',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>
                        UniHBooking
                    </h1>
                    <p style={{
                        margin: '2px 0 0 0',
                        fontSize: '0.65rem',
                        color: 'var(--accent-gold)',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        opacity: 0.9
                    }}>
                        University of Sri Jayewardenepura
                    </p>
                </div>
            </div>

            {/* Next Lecture Badge (Mobile-like) */}
            {user && nextLecture && (
                <div 
                    className={`next-lecture-badge ${nextLecture.isCancelled ? 'cancelled' : ''}`}
                    onClick={() => navigate('/my-timetable')}
                >
                    <div className="pulse-dot" style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: nextLecture.isCancelled ? '#e74c3c' : 'var(--accent-gold)',
                        boxShadow: `0 0 10px ${nextLecture.isCancelled ? '#e74c3c' : 'var(--accent-gold)'}`,
                        animation: 'pulse 2s infinite',
                        flexShrink: 0
                    }} />
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                            <span className="badge-label" style={{
                                fontSize: '0.7rem',
                                color: nextLecture.isCancelled ? '#e74c3c' : 'var(--accent-gold)',
                                fontWeight: '900',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}>
                                {nextLecture.isCancelled ? 'Cancelled' : nextLecture.isReschedule ? 'Rescheduled' : nextLecture.relativeDay === 0 ? 'Next Lecture' : nextLecture.relativeDay === 1 ? 'Tomorrow' : 'Upcoming'}
                            </span>
                            <span className="time-text" style={{
                                fontSize: '0.85rem',
                                color: 'white',
                                fontWeight: 'bold'
                            }}>{timeLeft}</span>
                        </div>
                        <div className="course-name" style={{
                            fontSize: '0.9rem',
                            color: 'white',
                            fontWeight: '500',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}>
                            {nextLecture.courseName}
                        </div>
                        {nextLecture.hallName && (
                            <div className="hall-name" style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.6)', marginTop: '2px' }}>
                                at {nextLecture.hallName}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Desktop Navigation */}
            <nav className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <Link to="/dashboard" style={{ color: 'var(--text-main)', fontWeight: 500 }}>Dashboard</Link>
                <Link to="/halls" style={{ color: 'var(--text-main)', fontWeight: 500 }}>Venues</Link>

                {user ? (
                    <>
                        <Link to="/my-bookings" style={{ color: 'var(--text-main)', fontWeight: 500 }}>My Bookings</Link>
                        <Link to="/my-timetable" style={{ color: 'var(--text-main)', fontWeight: 500 }}>My Timetable</Link>

                        <div style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={() => navigate('/notifications')}>
                            <FaBell size={20} color={unreadCount > 0 ? 'var(--accent-gold)' : 'var(--text-main)'} />
                            {unreadCount > 0 && (
                                <span style={{
                                    position: 'absolute', top: '-8px', right: '-8px',
                                    background: 'var(--accent-gold)', color: 'var(--primary-maroon)',
                                    fontSize: '0.75rem', fontWeight: '900', width: '20px', height: '20px',
                                    borderRadius: '50%', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', boxShadow: '0 0 10px rgba(212, 175, 55, 0.5)',
                                    border: '2px solid var(--primary-maroon)', zIndex: 1
                                }}>
                                    {unreadCount}
                                </span>
                            )}
                        </div>
                        {isAdmin && (
                            <Link to="/admin" style={{
                                color: 'var(--accent-gold)',
                                fontWeight: 'bold',
                                border: '1px solid var(--accent-gold)',
                                padding: '4px 10px',
                                borderRadius: '4px'
                            }}>Admin</Link>
                        )}

                        {/* Lecturer Attendance Link */}
                        {role === 'lecturer' && (
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <Link to="/lecturer/attendance" style={{
                                    color: 'white',
                                    fontWeight: 'bold',
                                    background: '#7B1113',
                                    border: '1px solid var(--accent-gold)',
                                    padding: '4px 10px',
                                    borderRadius: '4px'
                                }}>Attendance</Link>
                                <Link to="/admin/attendance" style={{
                                    color: 'var(--accent-gold)',
                                    fontWeight: 'bold',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--accent-gold)',
                                    padding: '4px 10px',
                                    borderRadius: '4px'
                                }}>Reports</Link>
                            </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginLeft: '10px', borderLeft: '1px solid var(--glass-border)', paddingLeft: '15px' }}>
                            <div
                                onClick={() => navigate('/profile')}
                                style={{
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '50%',
                                    background: 'var(--accent-gold)',
                                    color: 'var(--primary-maroon)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 'bold',
                                    fontSize: '1.1rem',
                                    cursor: 'pointer',
                                    border: '2px solid rgba(255,255,255,0.2)',
                                    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                                    transition: 'transform 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                title="View Profile"
                            >
                                {profileName ? profileName.charAt(0).toUpperCase() : 'U'}
                            </div>

                            <button
                                onClick={handleLogout}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'rgba(255,255,255,0.6)',
                                    padding: '5px',
                                    cursor: 'pointer',
                                    fontSize: '1.2rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    transition: 'color 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.color = '#e74c3c'}
                                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
                                title="Logout"
                            >
                                <FaSignOutAlt />
                            </button>
                        </div>
                    </>
                ) : (
                    <Link to="/login" style={{ color: 'var(--text-main)', fontWeight: 500 }}>Login</Link>
                )}
            </nav>

            {/* Mobile Menu Toggle */}
            <div className="show-mobile" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                {user && (
                    <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => navigate('/notifications')}>
                        <FaBell size={22} color={unreadCount > 0 ? 'var(--accent-gold)' : 'var(--text-main)'} />
                        {unreadCount > 0 && (
                            <span style={{
                                position: 'absolute', top: '-8px', right: '-8px',
                                background: 'var(--accent-gold)', color: 'var(--primary-maroon)',
                                fontSize: '0.7rem', fontWeight: '900', width: '18px', height: '18px',
                                borderRadius: '50%', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', border: '1px solid var(--primary-maroon)'
                            }}>
                                {unreadCount}
                            </span>
                        )}
                    </div>
                )}
                <button onClick={toggleMenu} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    {isMenuOpen ? <FaTimes /> : <FaBars />}
                </button>
            </div>

            {/* Mobile Navigation Drawer */}
            <div className={`mobile-nav-overlay ${isMenuOpen ? 'open' : ''}`}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', fontSize: '1.2rem' }}>
                    <Link to="/dashboard" onClick={closeMenu} style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '15px' }}>Dashboard</Link>
                    <Link to="/halls" onClick={closeMenu} style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '15px' }}>Venues</Link>

                    {user ? (
                        <>
                            <div style={{ paddingBottom: '20px', borderBottom: '1px solid var(--glass-border)', marginBottom: '10px' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '1px' }}>Greetings</div>
                                <div style={{ fontWeight: 'bold', fontSize: '1.5rem', marginTop: '5px' }}>{profileName || 'User'}</div>
                            </div>
                            <Link to="/my-bookings" onClick={closeMenu} style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '15px' }}>My Bookings</Link>
                            <Link to="/my-timetable" onClick={closeMenu} style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '15px' }}>My Timetable</Link>
                            <Link to="/profile" onClick={closeMenu} style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '15px' }}>Profile</Link>
                            {isAdmin && (
                                <Link to="/admin" onClick={closeMenu} style={{ color: 'var(--accent-gold)', fontWeight: 'bold' }}>Admin Panel</Link>
                            )}
                            {role === 'lecturer' && (
                                <>
                                    <Link to="/lecturer/attendance" onClick={closeMenu} style={{ color: 'var(--accent-gold)', fontWeight: 'bold' }}>Attendance Portal</Link>
                                    <Link to="/admin/attendance" onClick={closeMenu} style={{ color: 'var(--accent-gold)', fontWeight: 'bold' }}>Attendance reports</Link>
                                </>
                            )}
                            <div style={{ height: '1px', background: 'var(--glass-border)', margin: '10px 0' }} />
                            <button
                                onClick={handleLogout}
                                style={{
                                    background: 'var(--primary-maroon)', border: '1px solid var(--accent-gold)',
                                    color: 'var(--accent-gold)', padding: '15px', borderRadius: '12px',
                                    fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                                }}
                            >
                                Logout <FaSignOutAlt />
                            </button>
                        </>
                    ) : (
                        <Link to="/login" onClick={closeMenu} style={{ color: 'white' }}>Login</Link>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
