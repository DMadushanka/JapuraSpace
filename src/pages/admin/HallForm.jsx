import React, { useState, useEffect } from 'react';
import { hallService } from '../../services/firestore';
import { authService } from '../../services/auth';
import { useNavigate, useParams } from 'react-router-dom';
import { FaSave, FaArrowLeft, FaMapMarkerAlt, FaLocationArrow } from 'react-icons/fa';
import ImageUpload from '../../components/ImageUpload';
import MapLibreLocationPicker from '../../components/MapLibreLocationPicker';
import LocationSearchBar from '../../components/LocationSearchBar';

const HallForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = Boolean(id);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(isEdit);
    const [hallData, setHallData] = useState({
        name: '',
        capacity: '',
        charges: '',
        location: '',
        latitude: null,
        longitude: null,
        description: '',
        features: [],
        images: []
    });
    const [isGettingLocation, setIsGettingLocation] = useState(false);



    useEffect(() => {
        const checkPerms = async () => {
            const user = authService.auth.currentUser;
            if (!user) {
                navigate('/login');
                return;
            }
            const perms = await authService.getUserPermissions(user.uid);
            if (!perms.manage_halls) {
                alert('You do not have permission to add or edit halls.');
                navigate('/admin/halls');
                return;
            }
            if (isEdit) {
                fetchHall();
            }
        };

        checkPerms();
    }, [id]);

    const fetchHall = async () => {
        try {
            const data = await hallService.getHall(id);
            if (data) {
                setHallData({
                    name: data.name || '',
                    capacity: data.capacity || '',
                    charges: data.charges || '',
                    location: data.location || '',
                    latitude: data.latitude || null,
                    longitude: data.longitude || null,
                    description: data.description || '',
                    features: data.features || [],
                    images: data.images || []
                });
            } else {
                alert('Hall not found');
                navigate('/admin/halls');
            }
        } catch (error) {
            console.error('Error fetching hall:', error);
            alert('Error loading hall details');
        } finally {
            setFetching(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setHallData(prev => ({ ...prev, [name]: value }));
    };

    const handleLocationSelect = (lat, lng, address) => {
        setHallData(prev => ({
            ...prev,
            latitude: lat,
            longitude: lng,
            location: address || prev.location
        }));
    };

    const handleAddressChange = (address) => {
        setHallData(prev => ({ ...prev, location: address }));
    };

    const handleUseCurrentLocation = async () => {
        setIsGettingLocation(true);
        try {
            if (!navigator.geolocation) {
                alert('Geolocation is not supported by your browser');
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    setHallData(prev => ({
                        ...prev,
                        latitude: lat,
                        longitude: lng
                    }));
                    setIsGettingLocation(false);
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    alert('Unable to get your location. Please check permissions.');
                    setIsGettingLocation(false);
                }
            );
        } catch (error) {
            console.error('Location error:', error);
            setIsGettingLocation(false);
        }
    };



    const handleToggleFeature = (feature) => {
        setHallData(prev => {
            const features = prev.features.includes(feature)
                ? prev.features.filter(f => f !== feature)
                : [...prev.features, feature];
            return { ...prev, features };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const data = {
                ...hallData,
                capacity: parseInt(hallData.capacity) || 0,
                charges: parseInt(hallData.charges) || 0
            };

            if (isEdit) {
                await hallService.updateHall(id, data);
                alert('Hall Updated Successfully!');
            } else {
                await hallService.createHall(data);
                alert('Hall Created Successfully!');
            }
            navigate('/admin/halls');
        } catch (error) {
            console.error(error);
            alert('Error saving hall: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const featureOptions = [
        { key: 'ac', label: 'AC', icon: '❄️' },
        { key: 'wifi', label: 'Wi-Fi', icon: '📶' },
        { key: 'projector', label: 'Projector', icon: '📽️' },
        { key: 'sound', label: 'Sound System', icon: '🔊' },
        { key: 'stage', label: 'Stage', icon: '🎭' },
        { key: 'parking', label: 'Parking', icon: '🅿️' }
    ];

    if (fetching) {
        return <div style={{ textAlign: 'center', padding: '50px', color: 'white' }}>Loading hall details...</div>;
    }

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <button onClick={() => navigate('/admin/halls')} style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}><FaArrowLeft /></button>
                <h2 style={{ color: 'var(--text-main)' }}>{isEdit ? 'Edit Venue' : 'Add New Venue'}</h2>
            </div>

            <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '30px' }}>
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', color: 'var(--accent-gold)', fontWeight: '600', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px' }}>Location</label>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '15px' }}>Search, use GPS, or click on map</p>

                    <LocationSearchBar onSelectLocation={handleLocationSelect} />

                    <button
                        type="button"
                        onClick={handleUseCurrentLocation}
                        disabled={isGettingLocation}
                        style={{
                            width: '100%',
                            padding: '14px 20px',
                            background: 'var(--primary-maroon)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '15px',
                            fontWeight: '700',
                            cursor: isGettingLocation ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            marginBottom: '15px',
                            opacity: isGettingLocation ? 0.6 : 1,
                            transition: 'all 0.2s'
                        }}
                    >
                        <FaLocationArrow />
                        {isGettingLocation ? 'Getting Location...' : 'Use My Current Location'}
                    </button>

                    <MapLibreLocationPicker
                        lat={hallData.latitude}
                        lng={hallData.longitude}
                        onChange={(lat, lng) => setHallData(prev => ({ ...prev, latitude: lat, longitude: lng }))}
                        onAddressChange={handleAddressChange}
                    />
                    {(hallData.latitude && hallData.longitude) && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', marginTop: '5px' }}>
                            <FaMapMarkerAlt /> Selected: {hallData.latitude.toFixed(4)}, {hallData.longitude.toFixed(4)}
                        </p>
                    )}

                    <input
                        name="location"
                        required
                        value={hallData.location}
                        onChange={handleChange}
                        style={{ ...inputStyle, marginTop: '15px' }}
                        placeholder="Address will auto-fill or type manually..."
                    />
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', color: 'var(--accent-gold)', fontWeight: '600', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px' }}>Venue Name *</label>
                    <input
                        name="name"
                        required
                        value={hallData.name}
                        onChange={handleChange}
                        style={inputStyle}
                        placeholder="Enter venue name..."
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px' }}>Capacity</label>
                        <input name="capacity" type="number" value={hallData.capacity} onChange={handleChange} style={inputStyle} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px' }}>Charges (Rs.)</label>
                        <input name="charges" type="number" value={hallData.charges} onChange={handleChange} style={inputStyle} />
                    </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px' }}>Description</label>
                    <textarea name="description" rows="4" value={hallData.description} onChange={handleChange} style={{ ...inputStyle, resize: 'vertical' }} />
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '10px', color: 'var(--accent-gold)', fontWeight: '600', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px' }}>Amenities</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {featureOptions.map(opt => (
                            <button
                                key={opt.key}
                                type="button"
                                onClick={() => handleToggleFeature(opt.key)}
                                style={{
                                    padding: '12px 20px',
                                    borderRadius: '20px',
                                    border: '1px solid var(--glass-border)',
                                    background: hallData.features.includes(opt.key) ? 'var(--primary-maroon)' : 'rgba(255,255,255,0.05)',
                                    color: 'white',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    transition: 'all 0.2s',
                                    transform: hallData.features.includes(opt.key) ? 'scale(1.05)' : 'scale(1)'
                                }}
                            >
                                <span>{opt.icon}</span>
                                <span>{opt.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ marginBottom: '30px' }}>
                    <ImageUpload
                        onUpload={(url) => setHallData(prev => ({ ...prev, images: [...prev.images, url] }))}
                        label="Add Venue Images"
                    />
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
                        {hallData.images.map((img, i) => (
                            <div key={i} style={{ position: 'relative' }}>
                                <img src={img} alt="preview" style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '8px' }} />
                                <button type="button" onClick={() => setHallData(prev => ({ ...prev, images: prev.images.filter((_, idx) => idx !== i) }))} style={{ position: 'absolute', top: '-5px', right: '-5px', width: '20px', height: '20px', borderRadius: '50%', background: 'red', color: 'white', border: 'none', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>x</button>
                            </div>
                        ))}
                    </div>
                </div>

                <button
                    className="btn-primary"
                    style={{
                        width: '100%',
                        padding: '16px',
                        fontSize: '1.2rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        background: 'linear-gradient(135deg, var(--primary-maroon) 0%, #5A0B0D 100%)',
                        fontWeight: '700',
                        letterSpacing: '0.5px'
                    }}
                    disabled={loading}
                >
                    <FaSave /> {loading ? (isEdit ? 'Updating...' : 'Creating...') : (isEdit ? 'Update Venue' : 'Finalize & Save Venue')}
                </button>
            </form>
        </div>
    );
};

const inputStyle = {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid var(--glass-border)',
    background: 'rgba(255,255,255,0.05)',
    color: 'white',
    boxSizing: 'border-box',
    outline: 'none'
};

export default HallForm;
