import React, { useEffect, useState } from 'react';
import { reportingService } from '../../services/firestore';
import { authService } from '../../services/auth';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaTools, FaCheckCircle, FaExclamationTriangle, FaClock } from 'react-icons/fa';

const MaintenanceDashboard = () => {
    const navigate = useNavigate();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);

        const checkPerms = async () => {
            const user = authService.auth.currentUser;
            if (!user) {
                navigate('/login');
                return;
            }
            const [perms, role] = await Promise.all([
                authService.getUserPermissions(user.uid),
                authService.getUserRole(user.uid)
            ]);

            if (!perms.view_dashboard && role !== 'admin' && role !== 'board') {
                alert('You do not have permission to access this page.');
                navigate('/admin');
                return;
            }

            // Subscribe to real-time reports
            const unsubscribe = reportingService.subscribeToReports((data) => {
                setReports(data);
                setLoading(false);
            });

            return unsubscribe;
        };

        const unsubscribePromise = checkPerms();
        return () => {
            window.removeEventListener('resize', handleResize);
            unsubscribePromise.then(unsub => unsub && unsub());
        };
    }, []);

    const handleUpdateStatus = async (id, status) => {
        try {
            await reportingService.updateReportStatus(id, status);
        } catch (error) {
            alert('Failed to update status');
        }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'resolved': return { color: '#2ecc71', bg: '#2ecc7122', icon: <FaCheckCircle /> };
            case 'in-progress': return { color: '#f39c12', bg: '#f39c1222', icon: <FaClock /> };
            default: return { color: '#e74c3c', bg: '#e74c3c22', icon: <FaExclamationTriangle /> };
        }
    };

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: isMobile ? '10px' : '20px' }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '30px'
            }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-main)', margin: 0 }}>
                    <button onClick={() => navigate('/admin')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex' }}><FaArrowLeft /></button>
                    Maintenance Hub
                </h2>
                <div style={{ color: 'var(--accent-gold)', fontWeight: 'bold' }}>
                    {reports.filter(r => r.status !== 'resolved').length} Active Issues
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', color: 'white', padding: '50px' }}>Loading reports...</div>
            ) : reports.length === 0 ? (
                <div className="glass-panel" style={{ textAlign: 'center', padding: '50px' }}>
                    <FaTools size={48} style={{ color: 'var(--glass-border)', marginBottom: '15px' }} />
                    <p style={{ color: 'var(--text-muted)' }}>No issues reported yet. Facilities are looking good!</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '15px' }}>
                    {reports.map(report => {
                        const style = getStatusStyle(report.status);
                        return (
                            <div key={report.id} className="glass-panel" style={{
                                padding: '20px',
                                borderLeft: `4px solid ${style.color}`
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                                            <span style={{
                                                padding: '4px 10px',
                                                borderRadius: '20px',
                                                fontSize: '0.75rem',
                                                backgroundColor: style.bg,
                                                color: style.color,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                textTransform: 'uppercase',
                                                fontWeight: 'bold'
                                            }}>
                                                {style.icon} {report.status || 'pending'}
                                            </span>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                                {report.createdAt?.toDate ? report.createdAt.toDate().toLocaleString() : 'Just now'}
                                            </span>
                                        </div>
                                        <h3 style={{ margin: '0', color: 'white' }}>{report.hallName} - {report.category}</h3>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ color: 'white', fontSize: '0.9rem' }}>{report.userEmail}</div>
                                    </div>
                                </div>

                                <p style={{ color: 'rgba(255,255,255,0.8)', margin: '0 0 20px 0', lineHeight: '1.5' }}>
                                    {report.description}
                                </p>

                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                    {report.status !== 'pending' && (
                                        <button
                                            onClick={() => handleUpdateStatus(report.id, 'pending')}
                                            style={{ padding: '8px 15px', borderRadius: '6px', border: '1px solid #666', background: 'none', color: 'white', cursor: 'pointer' }}
                                        >Pending</button>
                                    )}
                                    {report.status !== 'in-progress' && (
                                        <button
                                            onClick={() => handleUpdateStatus(report.id, 'in-progress')}
                                            style={{ padding: '8px 15px', borderRadius: '6px', border: '1px solid #f39c12', background: '#f39c1222', color: '#f39c12', cursor: 'pointer' }}
                                        >In Progress</button>
                                    )}
                                    {report.status !== 'resolved' && (
                                        <button
                                            onClick={() => handleUpdateStatus(report.id, 'resolved')}
                                            style={{ padding: '8px 15px', borderRadius: '6px', border: '1px solid #2ecc71', background: '#2ecc7122', color: '#2ecc71', cursor: 'pointer' }}
                                        >Resolve</button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default MaintenanceDashboard;
