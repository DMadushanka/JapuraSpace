import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { FaMapMarkerAlt } from 'react-icons/fa';

// Fix for default marker icons in Leaflet with React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const LocationPicker = ({ lat, lng, onChange, onAddressChange }) => {
    const defaultCenter = [6.8517, 79.9042]; // USJ Sri Lanka
    const [markerPos, setMarkerPos] = useState(lat && lng ? [lat, lng] : null);
    const mapRef = useRef(null);

    useEffect(() => {
        if (lat && lng) {
            setMarkerPos([lat, lng]);
        }
    }, [lat, lng]);

    const reverseGeocode = async (lat, lng) => {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
                {
                    headers: {
                        'User-Agent': 'USJ-Hall-Booking-App/1.0'
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                if (data && data.address) {
                    const addr = data.address;
                    const parts = [
                        addr.road || addr.street,
                        addr.suburb || addr.neighbourhood,
                        addr.city || addr.town || addr.village,
                        addr.state
                    ].filter(Boolean);

                    const formatted = parts.join(', ') || data.display_name;
                    if (onAddressChange) {
                        onAddressChange(formatted);
                    }
                }
            }
        } catch (e) {
            console.warn('Reverse geocoding failed:', e);
        }
    };

    function MapEvents() {
        const map = useMapEvents({
            click(e) {
                const newPos = [e.latlng.lat, e.latlng.lng];
                setMarkerPos(newPos);
                onChange(e.latlng.lat, e.latlng.lng);
                reverseGeocode(e.latlng.lat, e.latlng.lng);
            },
        });

        useEffect(() => {
            mapRef.current = map;
        }, [map]);

        return null;
    }

    function ChangeView({ center, zoom }) {
        const map = useMap();
        useEffect(() => {
            if (center) {
                map.setView(center, zoom || map.getZoom());
            }
        }, [center, zoom]);
        return null;
    }

    // Expose method to parent for programmatic zoom/pan
    useEffect(() => {
        if (lat && lng && markerPos) {
            // When coordinates change externally (from search/GPS), trigger reverse geocode
            reverseGeocode(lat, lng);
        }
    }, [lat, lng]);

    return (
        <div style={{ height: '300px', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--glass-border)', marginTop: '10px' }}>
            <MapContainer
                center={markerPos || defaultCenter}
                zoom={15}
                style={{ height: '100%', width: '100%' }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {markerPos && <Marker position={markerPos} />}
                <MapEvents />
                {markerPos && <ChangeView center={markerPos} />}
            </MapContainer>
            <div style={{ padding: '8px', fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', textAlign: 'center' }}>
                <FaMapMarkerAlt /> Click on the map to set the hall location.
            </div>
        </div>
    );
};

export default LocationPicker;
