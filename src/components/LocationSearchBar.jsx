import React, { useState, useRef, useEffect } from 'react';
import { FaSearch, FaSpinner } from 'react-icons/fa';

const LocationSearchBar = ({ onSelectLocation }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const searchTimeout = useRef(null);

    const handleSearch = async (query) => {
        setSearchQuery(query);

        if (searchTimeout.current) {
            clearTimeout(searchTimeout.current);
        }

        if (!query || query.trim().length < 3) {
            setSearchResults([]);
            return;
        }

        searchTimeout.current = setTimeout(async () => {
            setIsSearching(true);
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?` +
                    `format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=lk`,
                    {
                        headers: {
                            'User-Agent': 'USJ-Hall-Booking-App/1.0'
                        }
                    }
                );

                if (response.ok) {
                    const results = await response.json();
                    setSearchResults(results);
                }
            } catch (e) {
                console.warn('Search failed:', e);
            } finally {
                setIsSearching(false);
            }
        }, 500);
    };

    const selectResult = (result) => {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        onSelectLocation(lat, lng, result.display_name);
        setSearchQuery('');
        setSearchResults([]);
    };

    return (
        <div style={{ position: 'relative', marginBottom: '15px' }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--glass-border)',
                borderRadius: '8px'
            }}>
                <FaSearch style={{ color: 'var(--text-muted)' }} />
                <input
                    type="text"
                    placeholder="Search for a place..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        color: 'white',
                        fontSize: '14px'
                    }}
                />
                {isSearching && <FaSpinner className="spin" style={{ color: 'var(--primary-maroon)' }} />}
            </div>

            {searchResults.length > 0 && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'rgba(20,20,30,0.98)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '8px',
                    marginTop: '5px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 1000,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                }}>
                    {searchResults.map((result, idx) => (
                        <div
                            key={idx}
                            onClick={() => selectResult(result)}
                            style={{
                                padding: '12px',
                                borderBottom: idx < searchResults.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                                cursor: 'pointer',
                                transition: 'background 0.2s',
                                display: 'flex',
                                gap: '10px',
                                alignItems: 'center'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(123,17,19,0.2)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <span style={{ color: 'var(--accent-gold)' }}>📍</span>
                            <span style={{ fontSize: '13px', color: 'white', flex: 1 }}>
                                {result.display_name}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LocationSearchBar;
