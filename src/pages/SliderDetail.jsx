import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { firestoreService } from '../services/firestore';
import { FaArrowLeft, FaCalendarAlt, FaMapMarkerAlt, FaLink } from 'react-icons/fa';

const SliderDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [slide, setSlide] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSlide = async () => {
            setLoading(true);
            const data = await firestoreService.getSliderImage(id);
            setSlide(data);
            setLoading(false);
        };
        fetchSlide();
        window.scrollTo(0, 0);
    }, [id]);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <div className="loader"></div>
            </div>
        );
    }

    if (!slide) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <h2>Slide not found</h2>
                <button onClick={() => navigate('/dashboard')} className="btn-primary" style={{ marginTop: '20px' }}>
                    Back to Dashboard
                </button>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px 0' }}>
            {/* Header Navigation */}
            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center' }}>
                <button
                    onClick={() => navigate('/dashboard')}
                    style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: '500' }}
                >
                    <FaArrowLeft /> Back to Dashboard
                </button>
            </div>

            {/* Hero Image Section */}
            <div className="glass-panel" style={{
                borderRadius: '24px',
                overflow: 'hidden',
                marginBottom: '40px',
                boxShadow: '0 20px 50px rgba(0,0,0,0.3)'
            }}>
                <div style={{ height: '400px', width: '100%', position: 'relative' }}>
                    <img
                        src={slide.imageUrl}
                        alt={slide.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.9))',
                        padding: '40px',
                        paddingTop: '80px'
                    }}>
                        <h1 style={{ fontSize: '3rem', margin: 0, color: 'white', fontWeight: '800', lineHeight: 1.1 }}>
                            {slide.title}
                        </h1>
                        {slide.subtitle && (
                            <p style={{ fontSize: '1.4rem', color: 'var(--accent-gold)', margin: '15px 0 0 0', fontWeight: '500' }}>
                                {slide.subtitle}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Section */}
            <div style={{ display: 'grid', gridTemplateColumns: '7fr 3fr', gap: '40px' }}>
                <div>
                    <h3 style={{ color: 'var(--accent-gold)', marginBottom: '20px', fontSize: '1.5rem' }}>About this Event</h3>
                    <div style={{
                        fontSize: '1.1rem',
                        lineHeight: '1.8',
                        color: 'rgba(255,255,255,0.8)',
                        whiteSpace: 'pre-wrap'
                    }}>
                        {slide.description || 'No detailed description available for this item.'}
                    </div>

                    {slide.linkType === 'external' && slide.targetUrl && (
                        <div style={{ marginTop: '40px' }}>
                            <a
                                href={slide.targetUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-primary"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '15px 30px',
                                    borderRadius: '12px',
                                    textDecoration: 'none'
                                }}
                            >
                                <FaLink /> Visit Official Website
                            </a>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {(slide.eventDate || slide.location) && (
                        <div className="glass-panel" style={{ padding: '25px', borderRadius: '16px' }}>
                            <h4 style={{ margin: '0 0 20px 0', color: 'white', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
                                Details
                            </h4>
                            {slide.eventDate && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                                    <div style={iconBoxStyle}><FaCalendarAlt /></div>
                                    <div>
                                        <div style={metaLabelStyle}>Date</div>
                                        <div style={metaValueStyle}>{slide.eventDate}</div>
                                    </div>
                                </div>
                            )}
                            {slide.location && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <div style={iconBoxStyle}><FaMapMarkerAlt /></div>
                                    <div>
                                        <div style={metaLabelStyle}>Location</div>
                                        <div style={metaValueStyle}>{slide.location}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="glass-panel" style={{ padding: '25px', borderRadius: '16px', background: 'rgba(212, 175, 55, 0.05)' }}>
                        <h4 style={{ margin: '0 0 10px 0', color: 'var(--accent-gold)' }}>Need assistance?</h4>
                        <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', margin: 0 }}>
                            If you have questions about this event, please contact the administration office.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const iconBoxStyle = {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: 'rgba(212, 175, 55, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--accent-gold)',
    fontSize: '1.2rem'
};

const metaLabelStyle = {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: '1px'
};

const metaValueStyle = {
    fontSize: '1rem',
    color: 'white',
    fontWeight: '600'
};

export default SliderDetail;
