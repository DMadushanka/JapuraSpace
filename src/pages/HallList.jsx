import React, { useEffect, useState } from 'react';
import { firestoreService } from '../services/firestore';
import { FaSearch, FaFilter, FaMapMarkerAlt, FaUsers, FaStar } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const HallList = () => {
    const navigate = useNavigate();
    const [halls, setHalls] = useState([]);
    const [filteredHalls, setFilteredHalls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [showFilters, setShowFilters] = useState(false);
    const [minCapacity, setMinCapacity] = useState(0);
    const [selectedFeatures, setSelectedFeatures] = useState([]);
    const [availableFeatures, setAvailableFeatures] = useState([]);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        loadHalls();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        let result = halls;

        // Search filter
        if (search.trim()) {
            const lower = search.toLowerCase();
            result = result.filter(h =>
                h.name.toLowerCase().includes(lower) ||
                (h.location && h.location.toLowerCase().includes(lower))
            );
        }

        // Capacity filter
        if (minCapacity > 0) {
            result = result.filter(h => (h.capacity || 0) >= minCapacity);
        }

        // Features filter
        if (selectedFeatures.length > 0) {
            result = result.filter(h => {
                const hFeatures = h.features || [];
                // Check if hall has ALL selected features
                return selectedFeatures.every(f => hFeatures.includes(f));
            });
        }

        setFilteredHalls(result);
    }, [search, halls, minCapacity, selectedFeatures]);

    const loadHalls = async () => {
        setLoading(true);
        const data = await firestoreService.getAllHalls();
        setHalls(data);
        setFilteredHalls(data);

        // Extract all unique features
        const features = new Set();
        data.forEach(h => {
            if (h.features && Array.isArray(h.features)) {
                h.features.forEach(f => features.add(f));
            }
        });
        setAvailableFeatures(Array.from(features).sort());

        setLoading(false);
    };

    const toggleFeature = (feature) => {
        setSelectedFeatures(prev =>
            prev.includes(feature)
                ? prev.filter(f => f !== feature)
                : [...prev, feature]
        );
    };

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading Venues...</div>;

    return (
        <div style={{ padding: isMobile ? '10px 0' : '20px 0' }}>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '15px', marginBottom: '30px' }}>
                {/* Search Bar */}
                <div className='glass-panel' style={{
                    flex: 1,
                    padding: isMobile ? '15px' : '20px',
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'center'
                }}>
                    <FaSearch style={{ color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Search halls, auditoriums..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            color: 'white',
                            fontSize: isMobile ? '0.9rem' : '1rem',
                            outline: 'none'
                        }}
                    />
                </div>

                {/* Filter Toggle Button */}
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="glass-panel"
                    style={{
                        padding: '0 25px',
                        height: isMobile ? '50px' : 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        color: showFilters ? 'var(--accent-gold)' : 'white',
                        cursor: 'pointer',
                        border: showFilters ? '1px solid var(--accent-gold)' : '1px solid var(--glass-border)',
                        transition: 'all 0.3s'
                    }}
                >
                    <FaFilter /> {isMobile ? '' : 'Filters'}
                    {(minCapacity > 0 || selectedFeatures.length > 0) && (
                        <span style={{
                            background: 'var(--accent-gold)',
                            color: 'var(--primary-maroon)',
                            borderRadius: '50%',
                            width: '18px',
                            height: '18px',
                            fontSize: '0.7rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold'
                        }}>
                            {(minCapacity > 0 ? 1 : 0) + selectedFeatures.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Filters Panel */}
            {showFilters && (
                <div className="glass-panel" style={{
                    padding: '25px',
                    marginBottom: '30px',
                    animation: 'fadeIn 0.3s ease',
                    border: '1px solid rgba(212, 175, 55, 0.2)'
                }}>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: '40px' }}>
                        {/* Capacity Filter */}
                        <div>
                            <h4 style={{ color: 'var(--accent-gold)', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <FaUsers /> Minimum Seats: {minCapacity === 0 ? 'Any' : minCapacity}
                            </h4>
                            <input
                                type="range"
                                min="0"
                                max="1000"
                                step="50"
                                value={minCapacity}
                                onChange={(e) => setMinCapacity(parseInt(e.target.value))}
                                style={{
                                    width: '100%',
                                    accentColor: 'var(--accent-gold)',
                                    cursor: 'pointer'
                                }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '10px' }}>
                                <span>0</span>
                                <span>500</span>
                                <span>1000+</span>
                            </div>
                        </div>

                        {/* Features Filter */}
                        <div>
                            <h4 style={{ color: 'var(--accent-gold)', marginBottom: '15px' }}>Features</h4>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                {availableFeatures.map(feature => (
                                    <button
                                        key={feature}
                                        onClick={() => toggleFeature(feature)}
                                        style={{
                                            padding: '8px 16px',
                                            borderRadius: '20px',
                                            border: '1px solid',
                                            borderColor: selectedFeatures.includes(feature) ? 'var(--accent-gold)' : 'var(--glass-border)',
                                            background: selectedFeatures.includes(feature) ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255,255,255,0.05)',
                                            color: selectedFeatures.includes(feature) ? 'var(--accent-gold)' : 'white',
                                            fontSize: '0.85rem',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {feature}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            setMinCapacity(0);
                            setSelectedFeatures([]);
                        }}
                        style={{
                            marginTop: '20px',
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                        }}
                    >
                        Reset Filters
                    </button>
                </div>
            )}

            {/* Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: isMobile ? '15px' : '25px'
            }}>
                {filteredHalls.length > 0 ? (
                    filteredHalls.map(hall => (
                        <div key={hall.id} className="glass-panel" style={{ overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s' }}
                            onClick={() => navigate(`/hall/${hall.id}`)}
                            onMouseEnter={(e) => !isMobile && (e.currentTarget.style.transform = 'translateY(-5px)')}
                            onMouseLeave={(e) => !isMobile && (e.currentTarget.style.transform = 'translateY(0)')}
                        >
                            {/* Image */}
                            <div style={{ height: isMobile ? '160px' : '180px', background: '#333', position: 'relative' }}>
                                {hall.images && hall.images[0] ? (
                                    <img src={hall.images[0]} alt={hall.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>No Image</div>
                                )}
                                {hall.charges > 0 && (
                                    <div style={{
                                        position: 'absolute',
                                        bottom: '10px',
                                        right: '10px',
                                        background: 'white',
                                        color: 'var(--primary-maroon)',
                                        padding: '4px 10px',
                                        borderRadius: '12px',
                                        fontSize: '0.75rem',
                                        fontWeight: 700
                                    }}>
                                        Rs. {hall.charges}
                                    </div>
                                )}
                            </div>

                            {/* Content */}
                            <div style={{ padding: isMobile ? '12px' : '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <h3 style={{ fontSize: isMobile ? '1rem' : '1.2rem', margin: 0, color: 'var(--text-main)' }}>{hall.name}</h3>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', marginBottom: '12px', fontSize: '0.8rem' }}>
                                    <FaMapMarkerAlt /> {hall.location || 'Unknown Location'}
                                </div>

                                <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#aaa', fontSize: '0.8rem' }}>
                                        <FaUsers /> {hall.capacity || 0} Seats
                                    </div>
                                    <span style={{ color: 'var(--accent-gold)', fontWeight: 600, fontSize: '0.85rem' }}>View Details &rarr;</span>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '100px 0', color: 'var(--text-muted)' }}>
                        <h3>No halls match your filters</h3>
                        <p>Try adjusting your search or filters to find more results.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HallList;
