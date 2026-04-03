import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { FaExternalLinkAlt } from 'react-icons/fa';

// Fix for default marker icons
if (!L.Icon.Default.prototype._getIconUrl) {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
}

const LocationView = ({ lat, lng, hallName }) => {
    if (!lat || !lng) return null;

    const position = [lat, lng];

    const openInGoogleMaps = () => {
        window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
    };

    return (
        <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ color: 'var(--accent-gold)', margin: 0 }}>Venue Location</h3>
                <button
                    onClick={openInGoogleMaps}
                    aria-label="Open location in Google Maps"
                    style={{
                        background: 'rgba(212, 175, 55, 0.1)',
                        border: '1px solid var(--accent-gold)',
                        color: 'var(--accent-gold)',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = 'var(--accent-gold)';
                        e.currentTarget.style.color = 'var(--primary-maroon)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(212, 175, 55, 0.1)';
                        e.currentTarget.style.color = 'var(--accent-gold)';
                        e.currentTarget.style.transform = 'translateY(0)';
                    }}
                >
                    <FaExternalLinkAlt size={12} /> Open in Maps
                </button>
            </div>
            <div style={{ height: '250px', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--glass-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
                <MapContainer center={position} zoom={16} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={position}>
                        {hallName && <Popup>{hallName}</Popup>}
                    </Marker>
                </MapContainer>
            </div>
        </div>
    );
};

export default LocationView;
