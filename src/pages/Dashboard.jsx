import React, { useEffect, useState } from 'react';
import { firestoreService, userService, bookingService, reportingService, hallService } from '../services/firestore';
import { authService } from '../services/auth';
import { useNavigate } from 'react-router-dom';
import { FaCalendarAlt, FaSearch, FaBell, FaUser, FaClock, FaChevronRight, FaMapMarkerAlt } from 'react-icons/fa';

const Dashboard = () => {
    const navigate = useNavigate();
    const [sliderImages, setSliderImages] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userName, setUserName] = useState('Guest');
    const [userRole, setUserRole] = useState('student');
    const [upcomingBookings, setUpcomingBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const scrollRef = React.useRef(null);

    // Reporting State
    const [showReportModal, setShowReportModal] = useState(false);
    const [allHalls, setAllHalls] = useState([]);
    const [selectedHall, setSelectedHall] = useState('');
    const [reportCategory, setReportCategory] = useState('');
    const [reportDesc, setReportDesc] = useState('');
    const [reporting, setReporting] = useState(false);

    const handleOpenReport = async () => {
        setShowReportModal(true);
        try {
            const halls = await hallService.getAllHalls();
            setAllHalls(halls);
        } catch (error) {
            console.error('Error fetching halls:', error);
        }
    };

    const submitReport = async () => {
        if (!selectedHall || !reportCategory || !reportDesc) {
            alert('Please fill in all fields (Hall, Category, Description)');
            return;
        }

        setReporting(true);
        try {
            const user = authService.auth.currentUser;
            const hall = allHalls.find(h => h.id === selectedHall);

            await reportingService.createReport({
                hallId: selectedHall,
                hallName: hall ? hall.name : 'Unknown',
                category: reportCategory,
                description: reportDesc,
                userId: user.uid,
                userEmail: user.email
            });

            alert('Report submitted successfully! Maintenance team will take action.');
            setShowReportModal(false);
            setReportDesc('');
            setReportCategory('');
            setSelectedHall('');
        } catch (error) {
            console.error('Error submitting report:', error);
            alert('Failed to submit report. Please try again.');
        } finally {
            setReporting(false);
        }
    };

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);

        const init = async () => {
            setLoading(true);
            await Promise.all([loadSlider(), loadUserData(), loadUpcomingBookings()]);
            setLoading(false);
        };
        init();

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (sliderImages.length > 0) {
            const timer = setInterval(() => {
                setCurrentIndex(prev => (prev + 1) % sliderImages.length);
            }, 5000);
            return () => clearInterval(timer);
        }
    }, [sliderImages]);

    useEffect(() => {
        if (scrollRef.current && sliderImages.length > 0) {
            const container = scrollRef.current;
            const scrollAmount = container.clientWidth * currentIndex;
            container.scrollTo({
                left: scrollAmount,
                behavior: 'smooth'
            });
        }
    }, [currentIndex, sliderImages]);

    const loadSlider = async () => {
        try {
            const data = await firestoreService.getSliderImages();
            setSliderImages(data);
        } catch (error) {
            console.error('Error loading slider:', error);
        }
    };

    const loadUserData = async () => {
        const user = authService.auth.currentUser;
        if (user) {
            const profile = await userService.getUserProfile(user.uid);
            if (profile) {
                if (profile.name) setUserName(profile.name.split(' ')[0]);
                setUserRole(profile.role || 'student');
            }
        } else {
            setUserName('Guest');
            setUserRole('guest');
        }
    };

    const loadUpcomingBookings = async () => {
        const user = authService.auth.currentUser;
        if (user) {
            return new Promise((resolve) => {
                const unsubscribe = bookingService.subscribeToBookingsByUser(user.uid, (bookings) => {
                    const upcoming = bookings
                        .filter(b => b.status === 'approved' || b.status === 'pending')
                        .sort((a, b) => new Date(a.date) - new Date(b.date))
                        .slice(0, 3);
                    setUpcomingBookings(upcoming);
                    resolve();
                    unsubscribe();
                });
            });
        } else {
            setUpcomingBookings([]);
        }
    };

    const getTimeGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    return (
        <div style={{ padding: isMobile ? '10px 0' : '20px 0', maxWidth: '1400px', margin: '0 auto' }}>

            {/* Header/Greeting Section */}
            <div className="glass-panel" style={{
                padding: isMobile ? '20px' : '40px',
                marginBottom: '30px',
                background: 'linear-gradient(135deg, rgba(78, 2, 5, 0.4), rgba(212, 175, 55, 0.1))',
                borderRadius: '24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div>
                    <h2 style={{ fontSize: isMobile ? '1.5rem' : '2.5rem', color: 'var(--text-main)', margin: 0, fontWeight: 800 }}>
                        {getTimeGreeting()}, <span style={{ color: 'var(--accent-gold)' }}>{userName}</span>
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: isMobile ? '0.9rem' : '1.1rem', marginTop: '10px' }}>
                        welcome to your dashboard.
                    </p>
                </div>
                {!isMobile && (
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.5rem', color: 'var(--accent-gold)', fontWeight: 'bold' }}>
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                        </div>
                        <div style={{ color: 'var(--text-muted)' }}>USJ Web Portal</div>
                    </div>
                )}
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 350px',
                gap: '30px'
            }}>
                {/* Main Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

                    {/* Slider Carousel */}
                    <div className="glass-panel" style={{
                        height: isMobile ? '200px' : '400px',
                        overflow: 'hidden',
                        position: 'relative',
                        borderRadius: '24px',
                        boxShadow: '0 12px 40px rgba(0,0,0,0.4)'
                    }}>
                        {sliderImages.length > 0 ? (
                            <>
                                <div
                                    ref={scrollRef}
                                    style={{
                                        display: 'flex',
                                        width: '100%',
                                        height: '100%',
                                        scrollBehavior: 'smooth',
                                        overflow: 'hidden'
                                    }}
                                >
                                    {sliderImages.map((img, i) => (
                                        <div
                                            key={img.id}
                                            className="action-card"
                                            style={{
                                                flex: '0 0 100%',
                                                position: 'relative',
                                                height: '100%',
                                                cursor: img.linkType !== 'none' ? 'pointer' : 'default'
                                            }}
                                            onClick={() => {
                                                if (img.linkType === 'detail') navigate(`/slider/${img.id}`);
                                                else if (img.linkType === 'external' && img.targetUrl) window.open(img.targetUrl, '_blank');
                                            }}
                                        >
                                            <img
                                                src={img.imageUrl}
                                                alt={img.title || 'Slide'}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                            <div style={{
                                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                                background: 'linear-gradient(transparent, rgba(0,0,0,0.9))',
                                                padding: isMobile ? '20px' : '40px', color: 'white'
                                            }}>
                                                <h3 style={{ fontSize: isMobile ? '1.2rem' : '2rem', color: 'var(--accent-gold)', margin: 0, fontWeight: 800 }}>{img.title}</h3>
                                                {img.subtitle && <div style={{ fontSize: isMobile ? '0.8rem' : '1.1rem', color: 'white', marginTop: '5px', fontWeight: '500' }}>{img.subtitle}</div>}

                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '15px' }}>
                                                    {img.description && <p style={{
                                                        color: 'rgba(255,255,255,0.7)',
                                                        fontSize: isMobile ? '0.75rem' : '0.95rem',
                                                        maxWidth: '70%',
                                                        margin: 0,
                                                        display: '-webkit-box',
                                                        WebkitLineClamp: 2,
                                                        WebkitBoxOrient: 'vertical',
                                                        overflow: 'hidden',
                                                        lineHeight: '1.4'
                                                    }}>{img.description}</p>}

                                                    {img.linkType !== 'none' && !isMobile && (
                                                        <button
                                                            className="btn-glass"
                                                            style={{
                                                                padding: '8px 20px',
                                                                fontSize: '0.9rem',
                                                                background: 'rgba(212, 175, 55, 0.2)',
                                                                borderColor: 'var(--accent-gold)'
                                                            }}
                                                        >
                                                            {img.linkType === 'detail' ? 'View Details' : 'Visit Website'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div style={{
                                    position: 'absolute',
                                    bottom: '20px',
                                    right: '20px',
                                    display: 'flex',
                                    gap: '8px'
                                }}>
                                    {sliderImages.map((_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setCurrentIndex(i)}
                                            style={{
                                                width: currentIndex === i ? '30px' : '10px',
                                                height: '6px',
                                                borderRadius: '3px',
                                                background: currentIndex === i ? 'var(--accent-gold)' : 'rgba(255,255,255,0.3)',
                                                border: 'none',
                                                cursor: 'pointer',
                                                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                                            }}
                                            aria-label={`Go to slide ${i + 1}`}
                                        />
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                                <div className="loader"></div>
                            </div>
                        )}
                    </div>

                    {/* Academic Hub (Mirroring Mobile App) */}
                    <div>
                        <h3 style={{ margin: '0 0 15px 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-main)' }}>
                            <FaCalendarAlt /> Academic Hub
                        </h3>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
                            gap: '15px'
                        }}>
                            {(userRole === 'lecturer' || userRole === 'admin') && (
                                <div className="glass-panel hub-card" onClick={() => navigate('/lecturer/attendance')} style={{ padding: '20px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.3s' }}>
                                    <div style={{ fontSize: '1.8rem', color: '#4CAF50', marginBottom: '10px' }}>📱</div>
                                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Show QR</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>Session</div>
                                </div>
                            )}
                            
                            {userRole === 'student' && (
                                <div className="glass-panel hub-card" onClick={() => navigate('/student/attendance')} style={{ padding: '20px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.3s' }}>
                                    <div style={{ fontSize: '1.8rem', color: '#4CAF50', marginBottom: '10px' }}>📸</div>
                                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Scan Now</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>Attendance</div>
                                </div>
                            )}

                            <div className="glass-panel hub-card" onClick={() => navigate('/halls/availability')} style={{ padding: '20px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.3s' }}>
                                <div style={{ fontSize: '1.8rem', color: '#3498db', marginBottom: '10px' }}>📍</div>
                                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Venues</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>Availability</div>
                            </div>

                            <div className="glass-panel hub-card" onClick={() => navigate('/my-timetable')} style={{ padding: '20px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.3s' }}>
                                <div style={{ fontSize: '1.8rem', color: '#e67e22', marginBottom: '10px' }}>🗓️</div>
                                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Timetable</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>My Schedule</div>
                            </div>



                            <div className="glass-panel hub-card" onClick={() => navigate('/booking')} style={{ padding: '20px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.3s' }}>
                                <div style={{ fontSize: '1.8rem', color: '#ffcc00', marginBottom: '10px' }}>➕</div>
                                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Booking</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>New Request</div>
                            </div>

                            <div className="glass-panel hub-card" onClick={() => navigate('/halls')} style={{ padding: '20px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.3s' }}>
                                <div style={{ fontSize: '1.8rem', color: '#9b59b6', marginBottom: '10px' }}>🏫</div>
                                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Hall List</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>Details</div>
                            </div>
                            
                            <div className="glass-panel hub-card" onClick={handleOpenReport} style={{ padding: '20px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.3s' }}>
                                <div style={{ fontSize: '1.8rem', color: '#e74c3c', marginBottom: '10px' }}>⚠️</div>
                                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Report</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>Issue</div>
                            </div>

                            {userRole === 'admin' && (
                                <div className="glass-panel hub-card" onClick={() => navigate('/admin')} style={{ padding: '20px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.3s' }}>
                                    <div style={{ fontSize: '1.8rem', color: '#2c3e50', marginBottom: '10px' }}>🛡️</div>
                                    <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Admin</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>Console</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Upcoming Bookings Section */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <FaClock /> Upcoming Schedule
                            </h3>
                            <button
                                onClick={() => {
                                    if (authService.auth.currentUser) navigate('/my-bookings');
                                    else navigate('/login', { state: { from: '/my-bookings' } });
                                }}
                                style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                            >
                                View All <FaChevronRight size={12} />
                            </button>
                        </div>
                        <div style={{ display: 'grid', gap: '15px' }}>
                            {upcomingBookings.length > 0 ? (
                                upcomingBookings.map(booking => (
                                    <div key={booking.id} className="glass-panel" style={{
                                        padding: '20px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        borderLeft: `5px solid ${booking.status === 'approved' ? '#4CAF50' : '#FFC107'}`
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'white' }}>{booking.hallName}</div>
                                            <div style={{ display: 'flex', gap: '15px', marginTop: '5px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    <FaCalendarAlt size={14} /> {booking.date}
                                                </span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    <FaClock size={14} /> {booking.timeSlot}
                                                </span>
                                            </div>
                                        </div>
                                        <div style={{
                                            padding: '4px 12px',
                                            borderRadius: '20px',
                                            fontSize: '0.8rem',
                                            fontWeight: 'bold',
                                            textTransform: 'uppercase',
                                            backgroundColor: booking.status === 'approved' ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 193, 7, 0.2)',
                                            color: booking.status === 'approved' ? '#4CAF50' : '#FFC107'
                                        }}>
                                            {booking.status}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="glass-panel" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    {authService.auth.currentUser ? 'No upcoming bookings found. Start booking now!' : 'Sign in to view and manage your bookings.'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

                    {/* Quick Actions */}
                    <div>
                        <h3 style={{ marginBottom: '15px', fontSize: '1.2rem' }}>Quick Actions</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
                            {[
                                { icon: <FaSearch />, label: 'Find a Venue', desc: 'Browse available university halls', path: '/halls', color: '#3498db' },
                                { icon: <FaCalendarAlt />, label: 'My Bookings', desc: 'Track your pending/past requests', path: '/my-bookings', color: '#e67e22' },
                                { icon: <FaClock />, label: 'Report a Problem', desc: 'Report maintenance issues', action: 'report', color: '#e74c3c' }
                            ].map((action, i) => (
                                <div
                                    key={i}
                                    className="glass-panel action-card"
                                    onClick={() => {
                                        if (action.action === 'report') {
                                            if (authService.auth.currentUser) handleOpenReport();
                                            else navigate('/login', { state: { from: '/dashboard' } });
                                        } else if (authService.auth.currentUser || action.path === '/halls') {
                                            navigate(action.path);
                                        } else {
                                            navigate('/login', { state: { from: action.path } });
                                        }
                                    }}
                                    style={{
                                        padding: '20px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '20px',
                                        transition: 'all 0.3s'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                                        e.currentTarget.style.borderColor = 'var(--accent-gold)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'var(--glass-bg)';
                                        e.currentTarget.style.borderColor = 'var(--glass-border)';
                                    }}
                                >
                                    <div style={{
                                        width: '50px',
                                        height: '50px',
                                        borderRadius: '12px',
                                        background: `rgba(212, 175, 55, 0.1)`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.5rem',
                                        color: 'var(--accent-gold)'
                                    }}>
                                        {action.icon}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 'bold', color: 'white' }}>{action.label}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{action.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Stats/Info Section */}
                    <div className="glass-panel" style={{ padding: '25px', background: 'rgba(255,255,255,0.03)' }}>
                        <h4 style={{ color: 'var(--accent-gold)', marginBottom: '15px' }}>Venue Information</h4>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                            Booking requests are usually processed within 24-48 hours by the faculty board.
                        </p>
                        <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', fontSize: '0.85rem' }}>
                            <div style={{ color: 'var(--accent-gold)', fontWeight: 'bold' }}>Need help?</div>
                            <div style={{ marginTop: '5px' }}>Contact IT Service Desk for technical support.</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Report Modal */}
            {showReportModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)', zIndex: 1000,
                    display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
                }} onClick={() => setShowReportModal(false)}>
                    <div style={{
                        background: '#1a1a1a', padding: '30px', borderRadius: '20px',
                        width: '100%', maxWidth: '500px', border: '1px solid var(--accent-gold)',
                        maxHeight: '90vh', overflowY: 'auto'
                    }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ color: 'var(--accent-gold)', marginBottom: '20px' }}>Report a Problem</h2>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', color: 'white', marginBottom: '10px' }}>Select Hall</label>
                            <select
                                value={selectedHall}
                                onChange={(e) => setSelectedHall(e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#333', color: 'white', border: '1px solid #555' }}
                            >
                                <option value="">Select a Hall</option>
                                {allHalls.map(h => (
                                    <option key={h.id} value={h.id}>{h.name}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', color: 'white', marginBottom: '10px' }}>Category</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                {['Fan', 'AC', 'Multimedia', 'Furniture', 'Other'].map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setReportCategory(cat)}
                                        style={{
                                            padding: '8px 16px', borderRadius: '20px',
                                            background: reportCategory === cat ? 'var(--accent-gold)' : '#333',
                                            color: reportCategory === cat ? '#000' : 'white',
                                            border: 'none', cursor: 'pointer'
                                        }}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', color: 'white', marginBottom: '10px' }}>Description</label>
                            <textarea
                                value={reportDesc}
                                onChange={(e) => setReportDesc(e.target.value)}
                                placeholder="Describe the problem..."
                                rows={4}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#333', color: 'white', border: '1px solid #555' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowReportModal(false)} style={{ padding: '10px 20px', borderRadius: '8px', background: 'transparent', color: 'white', border: '1px solid #555', cursor: 'pointer' }}>Cancel</button>
                            <button onClick={submitReport} disabled={reporting} style={{ padding: '10px 20px', borderRadius: '8px', background: 'var(--primary-maroon)', color: 'white', border: 'none', cursor: 'pointer', opacity: reporting ? 0.7 : 1 }}>
                                {reporting ? 'Submitting...' : 'Submit Report'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Floating Action Button */}
            <button 
                className="fab-booking"
                onClick={() => navigate('/booking')}
                title="New Booking"
            >
                <div className="plus-icon">+</div>
            </button>
        </div>
    );
};

export default Dashboard;
