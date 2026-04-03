import React, { useEffect, useState } from 'react';
import { bookingService, firestoreService } from '../../services/firestore';
import { authService } from '../../services/auth';
import { useNavigate } from 'react-router-dom';
import { FaCalendarCheck, FaCalendarAlt, FaUsers, FaBuilding, FaImages, FaCheckCircle, FaTimesCircle, FaClock, FaTools, FaBook, FaUserTag, FaFileExcel } from 'react-icons/fa';
import logo from '../../assets/logo.png';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
    const [userRole, setUserRole] = useState(null);
    const [permissions, setPermissions] = useState({});
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        checkAdmin();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const checkAdmin = async () => {
        const user = authService.auth.currentUser;
        if (!user) {
            navigate('/login');
            return;
        }

        try {
            // Fetch both role and permissions with proper error handling
            const [perms, role] = await Promise.all([
                authService.getUserPermissions(user.uid),
                authService.getUserRole(user.uid)
            ]);

            // Check if user has any admin access
            const hasAdminAccess =
                perms.view_dashboard ||
                perms.manage_halls ||
                perms.manage_users ||
                perms.manage_bookings ||
                perms.manage_slider ||
                perms.manage_calendar ||
                perms.manage_roles ||
                role === 'admin' ||
                role === 'board';

            if (!hasAdminAccess) {
                // Only redirect if we're certain the user doesn't have access
                navigate('/dashboard');
                return;
            }

            // User has access, set state and load data
            setPermissions(perms);
            setUserRole(role);
            loadBookings();
        } catch (error) {
            console.error('Error checking admin access:', error);
            // On error, redirect to login to be safe
            navigate('/login');
        }
    };

    const loadBookings = async () => {
        setLoading(true);
        const data = await bookingService.getAllBookings();
        data.sort((a, b) => new Date(b.createdAt?.toDate ? b.createdAt.toDate() : b.date) - new Date(a.createdAt?.toDate ? a.createdAt.toDate() : a.date));

        setBookings(data);
        calculateStats(data);
        setLoading(false);
    };

    const calculateStats = (data) => {
        const s = { pending: 0, approved: 0, rejected: 0, total: data.length };
        data.forEach(b => {
            if (s[b.status] !== undefined) s[b.status]++;
        });
        setStats(s);
    };

    const handleUpdateStatus = async (id, status) => {
        if (!window.confirm(`Are you sure you want to ${status} this booking?`)) return;
        await bookingService.updateBooking(id, { status });
        loadBookings();
    };

    const filteredBookings = bookings.filter(b => filter === 'all' ? true : b.status === filter);

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '10px' : '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', borderBottom: '2px solid var(--accent-gold)', paddingBottom: '10px', marginBottom: '20px' }}>
                <img src={logo} alt="University Logo" style={{ width: '50px', height: '50px', objectFit: 'contain' }} />
                <h1 style={{ color: '#6d6308ff', fontSize: isMobile ? '1.5rem' : '2rem', margin: 0 }}>Admin Dashboard</h1>
            </div>

            {/* Stats Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: isMobile ? '10px' : '20px',
                marginBottom: '30px',
                marginTop: '20px'
            }}>
                <div className="glass-panel" style={{ padding: isMobile ? '15px' : '20px', textAlign: 'center' }}>
                    <h3 style={{ fontSize: isMobile ? '1.5rem' : '2rem', margin: '0 0 5px 0', color: '#f39c12' }}>{stats.pending}</h3>
                    <div style={{ color: '#aaa', fontSize: '0.8rem' }}>Pending</div>
                </div>
                <div className="glass-panel" style={{ padding: isMobile ? '15px' : '20px', textAlign: 'center' }}>
                    <h3 style={{ fontSize: isMobile ? '1.5rem' : '2rem', margin: '0 0 5px 0', color: '#2ecc71' }}>{stats.approved}</h3>
                    <div style={{ color: '#aaa', fontSize: '0.8rem' }}>Approved</div>
                </div>
                <div className="glass-panel" style={{ padding: isMobile ? '15px' : '20px', textAlign: 'center' }}>
                    <h3 style={{ fontSize: isMobile ? '1.5rem' : '2rem', margin: '0 0 5px 0', color: '#e74c3c' }}>{stats.rejected}</h3>
                    <div style={{ color: '#aaa', fontSize: '0.8rem' }}>Rejected</div>
                </div>
                <div className="glass-panel" style={{ padding: isMobile ? '15px' : '20px', textAlign: 'center' }}>
                    <h3 style={{ fontSize: isMobile ? '1.5rem' : '2rem', margin: '0 0 5px 0', color: '#3498db' }}>{stats.total}</h3>
                    <div style={{ color: '#aaa', fontSize: '0.8rem' }}>Total</div>
                </div>
            </div>

            {/* Quick Actions */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: isMobile ? '10px' : '15px',
                marginBottom: '30px'
            }}>
                {permissions.manage_users && (
                    <button className="btn-glass" onClick={() => navigate('/admin/users')} style={{ fontSize: isMobile ? '0.8rem' : '1rem', padding: '10px' }}>
                        <FaUsers /> Users
                    </button>
                )}
                {(permissions.manage_users || userRole === 'admin') && (
                    <button className="btn-glass" onClick={() => navigate('/admin/lecturers')} style={{ fontSize: isMobile ? '0.8rem' : '1rem', padding: '10px', color: 'var(--accent-gold)' }}>
                        <FaUserTag /> Lecturers
                    </button>
                )}
                {permissions.manage_halls && (
                    <button className="btn-glass" onClick={() => navigate('/admin/halls')} style={{ fontSize: isMobile ? '0.8rem' : '1rem', padding: '10px' }}>
                        <FaBuilding /> Halls
                    </button>
                )}
                {(userRole === 'admin' || userRole === 'board') && (
                    <button className="btn-glass" onClick={() => navigate('/admin/departments')} style={{ fontSize: isMobile ? '0.8rem' : '1rem', padding: '10px' }}>
                        <FaBuilding /> Departments
                    </button>
                )}
                <button className="btn-glass" onClick={() => navigate('/admin/courses')} style={{ fontSize: isMobile ? '0.8rem' : '1rem', padding: '10px' }}>
                    <FaBook /> Courses
                </button>
                <button className="btn-glass" onClick={() => navigate('/admin/degrees')} style={{ fontSize: isMobile ? '0.8rem' : '1rem', padding: '10px' }}>
                    <FaBook /> Degrees
                </button>
                {permissions.manage_slider && (
                    <button className="btn-glass" onClick={() => navigate('/admin/slider')} style={{ fontSize: isMobile ? '0.8rem' : '1rem', padding: '10px' }}>
                        <FaImages /> Slider
                    </button>
                )}
                {permissions.manage_roles && (
                    <button className="btn-glass" onClick={() => navigate('/admin/roles')} style={{ fontSize: isMobile ? '0.8rem' : '1rem', padding: '10px' }}>
                        <FaUsers /> Roles
                    </button>
                )}
                <button className="btn-glass" onClick={() => navigate('/admin/calendar')} style={{ background: 'var(--accent-gold)', color: 'var(--primary-maroon)', fontSize: isMobile ? '0.8rem' : '1rem', padding: '10px' }}>
                    <FaCalendarCheck /> Calendar
                </button>

                <button className="btn-glass" onClick={() => navigate('/admin/maintenance')} style={{ background: '#e74c3c22', color: '#e74c3c', fontSize: isMobile ? '0.8rem' : '1rem', padding: '10px', border: '1px solid #e74c3c' }}>
                    <FaTools /> Maintenance
                </button>

                <button className="btn-glass" onClick={() => navigate('/admin/holidays')} style={{ background: '#2ecc7122', color: '#2ecc71', fontSize: isMobile ? '0.8rem' : '1rem', padding: '10px', border: '1px solid #2ecc71' }}>
                    <FaCalendarAlt /> Holidays
                </button>

                {permissions.manage_halls && (
                    <button className="btn-glass" onClick={() => navigate('/admin/timetables')} style={{ fontSize: isMobile ? '0.8rem' : '1rem', padding: '10px' }}>
                        <FaClock /> Timetables
                    </button>
                )}
                <button className="btn-glass" onClick={() => navigate('/admin/attendance')} style={{ fontSize: isMobile ? '0.8rem' : '1rem', padding: '10px', background: 'rgba(46, 204, 113, 0.1)', color: '#2ecc71', border: '1px solid #2ecc71' }}>
                    <FaFileExcel /> Reports
                </button>
            </div>

            {/* Booking Management */}
            {(userRole === 'admin' || permissions.manage_bookings) && (
                <div className="glass-panel" style={{ padding: '30px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3>Recent Bookings</h3>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            {['all', 'pending', 'approved', 'rejected'].map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '15px',
                                        border: '1px solid #ccc',
                                        background: filter === f ? 'var(--primary-maroon)' : 'transparent',
                                        color: filter === f ? 'white' : '#666',
                                        cursor: 'pointer',
                                        textTransform: 'capitalize'
                                    }}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                                    <th style={{ padding: '12px' }}>Details</th>
                                    <th style={{ padding: '12px' }}>User</th>
                                    <th style={{ padding: '12px' }}>Date/Time</th>
                                    <th style={{ padding: '12px' }}>Purpose</th>
                                    <th style={{ padding: '12px' }}>Status</th>
                                    <th style={{ padding: '12px' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredBookings.map(booking => (
                                    <tr
                                        key={booking.id}
                                        style={{ borderBottom: '1px solid #eee', cursor: 'pointer' }}
                                        onClick={() => navigate(`/admin/booking/${booking.id}`)}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        <td style={{ padding: '12px' }}>
                                            <strong>{booking.hallName}</strong>
                                            {booking.charges > 0 && <div style={{ fontSize: '0.85rem', color: '#666' }}>Rs. {booking.charges}</div>}
                                        </td>
                                        <td style={{ padding: '12px' }}>{booking.userEmail}</td>
                                        <td style={{ padding: '12px' }}>
                                            <div>{booking.date}</div>
                                            <div style={{ fontSize: '0.85rem', color: '#999' }}>{booking.timeSlot}</div>
                                        </td>
                                        <td style={{ padding: '12px', fontSize: '0.9rem', color: '#555' }}>
                                            {booking.purpose}
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <span style={{
                                                padding: '4px 8px',
                                                borderRadius: '6px',
                                                fontWeight: 'bold',
                                                fontSize: '0.85rem',
                                                backgroundColor: booking.status === 'approved' ? '#e8f5e9' : booking.status === 'rejected' ? '#ffebee' : '#fff3e0',
                                                color: booking.status === 'approved' ? '#2e7d32' : booking.status === 'rejected' ? '#c62828' : '#ef6c00'
                                            }}>
                                                {booking.status?.toUpperCase()}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            {booking.status === 'pending' && (
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button onClick={() => handleUpdateStatus(booking.id, 'approved')} title="Approve" style={{ cursor: 'pointer', background: 'none', border: 'none', color: '#2ecc71' }}>
                                                        <FaCheckCircle size={20} />
                                                    </button>
                                                    <button onClick={() => handleUpdateStatus(booking.id, 'rejected')} title="Reject" style={{ cursor: 'pointer', background: 'none', border: 'none', color: '#e74c3c' }}>
                                                        <FaTimesCircle size={20} />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredBookings.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>No bookings found</div>}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
