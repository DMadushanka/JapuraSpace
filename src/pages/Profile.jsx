import React, { useEffect, useState } from 'react';
import { authService } from '../services/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaEnvelope, FaPhone, FaBuilding, FaUserTag, FaSignOutAlt, FaCalendarAlt, FaGraduationCap } from 'react-icons/fa';

const Profile = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);

        const unsubscribe = authService.onAuthStateChanged(async (currentUser) => {
            if (currentUser) {
                try {
                    const docRef = doc(db, 'users', currentUser.uid);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        setUser({
                            ...currentUser,
                            ...docSnap.data()
                        });
                    } else {
                        setUser(currentUser);
                    }
                } catch (error) {
                    console.error("Error fetching user data:", error);
                    setUser(currentUser);
                }
            } else {
                navigate('/login');
            }
            setLoading(false);
        });

        return () => {
            window.removeEventListener('resize', handleResize);
            unsubscribe();
        };
    }, [navigate]);

    const handleLogout = async () => {
        try {
            await authService.signOut();
            navigate('/login');
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--accent-gold)' }}>
                <h3>Loading Profile...</h3>
            </div>
        );
    }

    const getInitials = (name) => {
        if (!name) return 'U';
        return name.split(' ').map(n => n[0]).join('').toUpperCase();
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: isMobile ? '10px' : '20px' }}>
            <h2 style={{ marginBottom: isMobile ? '20px' : '30px', color: 'var(--accent-gold)', textAlign: isMobile ? 'center' : 'left' }}>My Profile</h2>

            <div className="glass-panel" style={{ padding: isMobile ? '20px' : '40px', position: 'relative' }}>
                {/* Profile Header */}
                <div style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: 'center',
                    marginBottom: '40px',
                    borderBottom: '1px solid var(--glass-border)',
                    paddingBottom: '30px',
                    textAlign: isMobile ? 'center' : 'left',
                    gap: isMobile ? '20px' : '0'
                }}>
                    <div style={{
                        width: isMobile ? '80px' : '100px',
                        height: isMobile ? '80px' : '100px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--accent-gold), #b8860b)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: isMobile ? '2rem' : '2.5rem',
                        fontWeight: '700',
                        color: 'var(--primary-maroon)',
                        marginRight: isMobile ? '0' : '30px',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
                    }}>
                        {getInitials(user?.name || user?.displayName)}
                    </div>
                    <div>
                        <h1 style={{ color: 'white', fontSize: isMobile ? '1.5rem' : '2rem', marginBottom: '5px' }}>{user?.name || user?.displayName || 'User'}</h1>
                        <span style={{
                            background: 'var(--accent-gold)',
                            color: 'var(--primary-maroon)',
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '0.8rem',
                            fontWeight: '700',
                            textTransform: 'uppercase'
                        }}>
                            {user?.role || 'User'}
                        </span>
                    </div>
                </div>

                {/* Details Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ color: 'var(--accent-gold)' }}><FaEnvelope size={isMobile ? 18 : 20} /></div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Email Address</div>
                            <div style={{ fontSize: isMobile ? '1rem' : '1.1rem', wordBreak: 'break-all' }}>{user?.email}</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ color: 'var(--accent-gold)' }}><FaPhone size={isMobile ? 18 : 20} /></div>
                        <div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Phone Number</div>
                            <div style={{ fontSize: isMobile ? '1rem' : '1.1rem' }}>{user?.phone || 'Not provided'}</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ color: 'var(--accent-gold)' }}><FaBuilding size={isMobile ? 18 : 20} /></div>
                        <div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Department / Unit</div>
                            <div style={{ fontSize: isMobile ? '1rem' : '1.1rem' }}>{user?.department || 'Not assigned'}</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ color: 'var(--accent-gold)' }}><FaGraduationCap size={isMobile ? 18 : 20} /></div>
                        <div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Degree Program</div>
                            <div style={{ fontSize: isMobile ? '1rem' : '1.1rem' }}>{user?.degree || 'Not assigned'}</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ color: 'var(--accent-gold)' }}><FaUserTag size={isMobile ? 18 : 20} /></div>
                        <div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>User Role</div>
                            <div style={{ fontSize: isMobile ? '1rem' : '1.1rem' }}>{user?.role || 'User'}</div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div style={{ marginTop: '50px', display: 'flex', gap: '15px', flexWrap: 'wrap', justifyContent: isMobile ? 'center' : 'flex-start' }}>
                    <button
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', width: isMobile ? '100%' : 'auto', justifyContent: 'center' }}
                        onClick={() => navigate('/my-bookings')}
                    >
                        <FaCalendarAlt /> My Bookings
                    </button>

                    <button
                        className="btn-glass"
                        style={{ border: '1px solid #ff4444', color: '#ff4444', width: isMobile ? '100%' : 'auto', justifyContent: 'center' }}
                        onClick={handleLogout}
                    >
                        <FaSignOutAlt /> Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Profile;
