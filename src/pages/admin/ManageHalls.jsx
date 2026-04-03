import React, { useEffect, useState } from 'react';
import { firestoreService, hallService } from '../../services/firestore';
import { authService } from '../../services/auth';
import { useNavigate } from 'react-router-dom';
import { FaTrash, FaPlus, FaArrowLeft } from 'react-icons/fa';

const ManageHalls = () => {
    const navigate = useNavigate();
    const [halls, setHalls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [permissions, setPermissions] = useState(null);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);

        const checkPerms = async () => {
            const user = authService.auth.currentUser;
            if (!user) {
                navigate('/login');
                return;
            }
            const perms = await authService.getUserPermissions(user.uid);
            if (!perms.manage_halls) {
                alert('You do not have permission to manage halls.');
                navigate('/admin');
                return;
            }
            setPermissions(perms);
            loadHalls();
        };

        checkPerms();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const loadHalls = async () => {
        setLoading(true);
        const data = await hallService.getAllHalls();
        setHalls(data);
        setLoading(false);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this hall? This action cannot be undone.')) return;
        await hallService.deleteHall(id);
        loadHalls();
    };

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: isMobile ? '10px' : '20px' }}>
            <div style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between',
                alignItems: isMobile ? 'flex-start' : 'center',
                marginBottom: '30px',
                gap: isMobile ? '15px' : '0'
            }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-main)', margin: 0 }}>
                    <button onClick={() => navigate('/admin')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex' }}><FaArrowLeft /></button>
                    Manage Halls
                </h2>
                <button className="btn-primary" onClick={() => navigate('/admin/halls/add')} style={{ width: isMobile ? '100%' : 'auto', justifyContent: 'center' }}>
                    <FaPlus /> Add New Hall
                </button>
            </div>

            <div style={{ display: 'grid', gap: '15px' }}>
                {halls.map(hall => (
                    <div key={hall.id} className="glass-panel" style={{
                        padding: '15px',
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        justifyContent: 'space-between',
                        alignItems: isMobile ? 'stretch' : 'center',
                        gap: isMobile ? '15px' : '0'
                    }}>
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                            {hall.images && hall.images[0] ? (
                                <img src={hall.images[0]} alt={hall.name} style={{ width: isMobile ? '70px' : '90px', height: isMobile ? '50px' : '65px', objectFit: 'cover', borderRadius: '8px' }} />
                            ) : (
                                <div style={{ width: '70px', height: '50px', background: '#333', borderRadius: '8px' }} />
                            )}
                            <div>
                                <h3 style={{ margin: '0 0 5px 0', fontSize: isMobile ? '1rem' : '1.2rem', color: 'white' }}>{hall.name}</h3>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    Capacity: {hall.capacity} | <span style={{ color: 'var(--accent-gold)' }}>Rs. {hall.charges}</span>
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => navigate(`/admin/halls/edit/${hall.id}`)}
                                style={{
                                    flex: 1,
                                    padding: '8px 16px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--glass-border)',
                                    background: 'rgba(255,255,255,0.05)',
                                    color: 'white',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem'
                                }}>Edit</button>
                            <button onClick={() => handleDelete(hall.id)} style={{
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: '1px solid #e74c3c',
                                background: '#e74c3c22',
                                color: '#e74c3c',
                                cursor: 'pointer'
                            }}><FaTrash /></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ManageHalls;
