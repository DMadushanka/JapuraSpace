import React, { useEffect, useState } from 'react';
import { firestoreService } from '../../services/firestore';
import { authService } from '../../services/auth';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaTrash, FaPlus, FaImage } from 'react-icons/fa';
import ImageUpload from '../../components/ImageUpload';

const ManageSlider = () => {
    const navigate = useNavigate();
    const [images, setImages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [newImage, setNewImage] = useState({
        title: '',
        subtitle: '',
        description: '',
        eventDate: '',
        location: '',
        linkType: 'none', // none, detail, external
        targetUrl: '',
        imageUrl: '',
        order: 0
    });

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
            if (!perms.manage_slider) {
                alert('You do not have permission to manage the slider.');
                navigate('/admin');
                return;
            }
            loadSlider();
        };

        checkPerms();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const loadSlider = async () => {
        setLoading(true);
        const data = await firestoreService.getSliderImages();
        setImages(data);
        setLoading(false);
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newImage.imageUrl) return;
        setLoading(true);
        try {
            await firestoreService.createSliderImage({ ...newImage, order: images.length });
            setNewImage({
                title: '',
                subtitle: '',
                description: '',
                eventDate: '',
                location: '',
                linkType: 'none',
                targetUrl: '',
                imageUrl: '',
                order: 0
            });
            loadSlider();
        } catch (err) {
            alert('Error adding slide: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this slider image?')) return;
        await firestoreService.deleteSliderImage(id);
        loadSlider();
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <button onClick={() => navigate('/admin')} style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}><FaArrowLeft /></button>
                <h2 style={{ color: 'var(--text-main)' }}>Manage Homepage Slider</h2>
            </div>

            <form onSubmit={handleAdd} className="glass-panel" style={{ padding: '30px', marginBottom: '30px', borderRadius: '20px' }}>
                <h3 style={{ marginBottom: '20px', color: 'var(--accent-gold)' }}>Add New Slide</h3>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '25px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div>
                            <label style={labelStyle}>Headline (Main Title)*</label>
                            <input
                                required
                                placeholder="e.g., University Annual Gala"
                                value={newImage.title}
                                onChange={(e) => setNewImage({ ...newImage, title: e.target.value })}
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Subtitle (Optional)</label>
                            <input
                                placeholder="e.g., An evening of excellence and celebration"
                                value={newImage.subtitle}
                                onChange={(e) => setNewImage({ ...newImage, subtitle: e.target.value })}
                                style={inputStyle}
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                                <label style={labelStyle}>Event Date (Optional)</label>
                                <input
                                    type="date"
                                    value={newImage.eventDate}
                                    onChange={(e) => setNewImage({ ...newImage, eventDate: e.target.value })}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Location (Optional)</label>
                                <input
                                    placeholder="e.g., Main Hall"
                                    value={newImage.location}
                                    onChange={(e) => setNewImage({ ...newImage, location: e.target.value })}
                                    style={inputStyle}
                                />
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <div>
                            <label style={labelStyle}>Image Upload*</label>
                            {newImage.imageUrl ? (
                                <div style={{ position: 'relative', width: '100%', height: '145px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--accent-gold)' }}>
                                    <img src={newImage.imageUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    <button
                                        type="button"
                                        onClick={() => setNewImage({ ...newImage, imageUrl: '' })}
                                        style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(231, 76, 60, 0.9)', color: 'white', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}
                                    >✕</button>
                                </div>
                            ) : (
                                <div style={{ minHeight: '145px' }}>
                                    <ImageUpload onUpload={(url) => setNewImage({ ...newImage, imageUrl: url })} label="Select Slide Image" />
                                </div>
                            )}
                        </div>
                        <div>
                            <label style={labelStyle}>Interactivity (Click action)</label>
                            <select
                                value={newImage.linkType}
                                onChange={(e) => setNewImage({ ...newImage, linkType: e.target.value })}
                                style={inputStyle}
                            >
                                <option value="none">None (Static Image)</option>
                                <option value="detail">Internal (Show Detail Page)</option>
                                <option value="external">External (Link to website)</option>
                            </select>
                        </div>
                        {newImage.linkType === 'external' && (
                            <div>
                                <label style={labelStyle}>External URL</label>
                                <input
                                    type="url"
                                    placeholder="https://example.com"
                                    value={newImage.targetUrl}
                                    onChange={(e) => setNewImage({ ...newImage, targetUrl: e.target.value })}
                                    style={inputStyle}
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ marginBottom: '25px' }}>
                    <label style={labelStyle}>Description / Event Details</label>
                    <textarea
                        placeholder="Provide more details about the event or advertisement..."
                        value={newImage.description}
                        onChange={(e) => setNewImage({ ...newImage, description: e.target.value })}
                        style={{ ...inputStyle, minHeight: '100px', resize: 'vertical', fontFamily: 'inherit' }}
                    />
                </div>

                <button type="submit" className="btn-primary" style={{ padding: '12px 30px', width: '100%', borderRadius: '12px' }} disabled={loading || !newImage.imageUrl}>
                    {loading ? 'Adding Slide...' : <><FaPlus /> Add New Slide</>}
                </button>
            </form>

            <div style={{ display: 'grid', gap: '20px' }}>
                <h3 style={{ color: 'var(--text-main)', marginBottom: '5px' }}>Existing Slides</h3>
                {images.length === 0 && !loading && <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: '#888' }}>No slides added yet.</div>}
                {images.map(img => (
                    <div key={img.id} className="glass-panel" style={{ padding: '20px', display: 'flex', gap: '25px', alignItems: 'flex-start', borderRadius: '16px' }}>
                        <div style={{ position: 'relative' }}>
                            <img src={img.imageUrl} alt={img.title} style={{ width: '180px', height: '100px', objectFit: 'cover', borderRadius: '12px', border: '1px solid var(--glass-border)' }} />
                            <div style={{ position: 'absolute', bottom: '5px', right: '5px', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem' }}>
                                #{img.order + 1}
                            </div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <h4 style={{ margin: '0 0 5px 0', color: 'var(--accent-gold)', fontSize: '1.2rem' }}>{img.title || 'Untitled Slide'}</h4>
                                <button onClick={() => handleDelete(img.id)} style={{ padding: '8px', borderRadius: '8px', border: 'none', background: 'rgba(231, 76, 60, 0.1)', color: '#e74c3c', cursor: 'pointer', transition: 'all 0.2s' }}>
                                    <FaTrash />
                                </button>
                            </div>
                            {img.subtitle && <div style={{ fontSize: '0.9rem', color: '#ccc', marginBottom: '8px' }}>{img.subtitle}</div>}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', color: '#888', fontSize: '0.8rem' }}>
                                {img.eventDate && <span>📅 {img.eventDate}</span>}
                                {img.location && <span>📍 {img.location}</span>}
                                <span>🔗 {img.linkType === 'none' ? 'Static' : img.linkType === 'detail' ? 'Detail Page' : 'External Link'}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const labelStyle = {
    display: 'block',
    marginBottom: '8px',
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500'
};

const inputStyle = {
    width: '100%',
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid var(--glass-border)',
    background: 'rgba(255,255,255,0.05)',
    color: 'white',
    outline: 'none',
    boxSizing: 'border-box',
    fontSize: '0.95rem'
};

export default ManageSlider;
