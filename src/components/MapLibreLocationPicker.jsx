import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { FaMapMarkerAlt } from 'react-icons/fa';

const MapLibreLocationPicker = ({ lat, lng, onChange, onAddressChange }) => {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const marker = useRef(null);
    const [mapLoaded, setMapLoaded] = useState(false);

    const defaultCenter = [79.9042, 6.8517]; // [lng, lat] for MapLibre (USJ Sri Lanka)

    const reverseGeocode = async (latitude, longitude) => {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
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

    // Initialize map
    useEffect(() => {
        if (map.current) return; // Initialize map only once

        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: {
                version: 8,
                sources: {
                    'osm': {
                        type: 'raster',
                        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                        tileSize: 256,
                        attribution: '&copy; OpenStreetMap Contributors'
                    }
                },
                layers: [
                    {
                        id: 'osm',
                        type: 'raster',
                        source: 'osm',
                        minzoom: 0,
                        maxzoom: 19
                    }
                ]
            },
            center: lat && lng ? [lng, lat] : defaultCenter,
            zoom: 15
        });

        map.current.on('load', () => {
            setMapLoaded(true);
        });

        // Add click handler
        map.current.on('click', (e) => {
            const { lng, lat } = e.lngLat;

            // Update marker
            if (marker.current) {
                marker.current.setLngLat([lng, lat]);
            } else {
                marker.current = new maplibregl.Marker({ color: '#7B1113' })
                    .setLngLat([lng, lat])
                    .addTo(map.current);
            }

            // Notify parent
            onChange(lat, lng);
            reverseGeocode(lat, lng);
        });

        // Cleanup
        return () => {
            if (map.current) {
                map.current.remove();
                map.current = null;
            }
        };
    }, []);

    // Update marker when lat/lng props change
    useEffect(() => {
        if (!map.current || !mapLoaded) return;

        if (lat && lng) {
            if (marker.current) {
                marker.current.setLngLat([lng, lat]);
            } else {
                marker.current = new maplibregl.Marker({ color: '#7B1113' })
                    .setLngLat([lng, lat])
                    .addTo(map.current);
            }

            map.current.flyTo({
                center: [lng, lat],
                zoom: 15,
                essential: true
            });

            // Trigger reverse geocode
            reverseGeocode(lat, lng);
        }
    }, [lat, lng, mapLoaded]);

    return (
        <div style={{
            height: '300px',
            width: '100%',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid var(--glass-border)',
            marginTop: '10px',
            position: 'relative'
        }}>
            <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
            <div style={{
                padding: '8px',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                background: 'rgba(0,0,0,0.2)',
                textAlign: 'center',
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0
            }}>
                <FaMapMarkerAlt /> Click on the map to set the hall location.
            </div>
        </div>
    );
};

export default MapLibreLocationPicker;
