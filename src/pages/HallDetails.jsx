import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { firestoreService, hallService } from '../services/firestore';
import { authService } from '../services/auth';
import { FaMapMarkerAlt, FaWifi, FaSnowflake, FaVolumeUp, FaVideo, FaUsers, FaArrowLeft } from 'react-icons/fa';
import LocationView from '../components/LocationView';

const HallDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [hall, setHall] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        loadHall();
        return () => window.removeEventListener('resize', handleResize);
    }, [id]);

    const loadHall = async () => {
        setLoading(true);
        const data = await hallService.getHall(id);
        setHall(data);
        setLoading(false);
    };

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
    if (!hall) return <div style={{ padding: '40px', textAlign: 'center' }}>Hall not found</div>;

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', color: 'var(--text-main)', padding: isMobile ? '10px' : '0' }}>
            <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <FaArrowLeft /> Back
            </button>

            {/* Image Gallery (Simplified) */}
            <div className="glass-panel" style={{ overflow: 'hidden', height: isMobile ? '200px' : '350px', marginBottom: '30px' }}>
                {hall.images && hall.images.length > 0 ? (
                    <img src={hall.images[0]} alt={hall.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>No Images</div>
                )}
            </div>

            <div className="glass-panel" style={{ padding: isMobile ? '20px' : '40px' }}>
                <div style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    justifyContent: 'space-between',
                    alignItems: isMobile ? 'flex-start' : 'center',
                    marginBottom: '20px',
                    gap: isMobile ? '15px' : '0'
                }}>
                    <h1 style={{ margin: 0, color: 'var(--text-main)', fontSize: isMobile ? '1.5rem' : '2.2rem' }}>{hall.name}</h1>
                    {hall.charges > 0 && (
                        <div style={{
                            background: 'rgba(212,175,55,0.25)',
                            padding: '10px 20px',
                            borderRadius: '30px',
                            color: 'var(--accent-gold)',
                            fontWeight: '700',
                            border: '1px solid rgba(212,175,55,0.3)',
                            fontSize: isMobile ? '1rem' : '1.2rem'
                        }}>
                            Rs. {hall.charges}
                        </div>
                    )}
                </div>

                <div style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    gap: isMobile ? '10px' : '30px',
                    marginBottom: '30px',
                    color: 'var(--text-muted)',
                    fontSize: isMobile ? '0.85rem' : '1rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FaMapMarkerAlt color="var(--accent-gold)" /> {hall.location || hall.address}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FaUsers color="var(--accent-gold)" /> Capacity: {hall.capacity} Guests
                    </div>
                </div>

                <h3 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px', marginBottom: '20px', color: 'var(--accent-gold)' }}>About this Venue</h3>
                <p style={{ lineHeight: '1.7', marginBottom: '30px', color: '#ccc' }}>{hall.description || 'No description available.'}</p>

                <h3 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px', marginBottom: '20px', color: 'var(--accent-gold)' }}>Amenities</h3>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '40px' }}>
                    {hall.features && (Array.isArray(hall.features) ? hall.features : Object.keys(hall.features)).map((f, i) => (
                        <div key={i} style={{
                            background: 'rgba(255,255,255,0.08)',
                            padding: '8px 18px',
                            borderRadius: '25px',
                            fontSize: '0.85rem',
                            border: '1px solid var(--glass-border)',
                            color: 'white'
                        }}>
                            {f}
                        </div>
                    ))}
                </div>

                <LocationView
                    lat={hall.latitude}
                    lng={hall.longitude}
                    hallName={hall.name}
                />

                <div style={{ height: '30px' }}></div>

                <button
                    className="btn-primary"
                    style={{ width: '100%', padding: '18px', fontSize: '1.1rem', fontWeight: '700' }}
                    onClick={() => {
                        if (authService.auth.currentUser) {
                            navigate(`/hall/${id}/book`);
                        } else {
                            navigate('/login', { state: { from: `/hall/${id}/book` } });
                        }
                    }}
                >
                    Book This Venue
                </button>
            </div>
        </div>
    );
};

export default HallDetails;
