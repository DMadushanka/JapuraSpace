import React, { useState } from 'react';
import { FaCloudUploadAlt, FaSpinner } from 'react-icons/fa';
import { uploadImageToCloudinary } from '../services/cloudinary';

const ImageUpload = ({ onUpload, label = "Upload Image" }) => {
    const [uploading, setUploading] = useState(false);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            const url = await uploadImageToCloudinary(file);
            if (url) {
                onUpload(url);
            }
        } catch (error) {
            alert('Upload failed: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{label}</label>
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    height: '100px',
                    border: '2px dashed var(--glass-border)',
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    background: 'rgba(255,255,255,0.02)',
                    transition: 'all 0.3s ease',
                    gap: '10px'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                onClick={() => !uploading && document.getElementById(`file-upload-${label}`).click()}
            >
                {uploading ? (
                    <>
                        <FaSpinner className="spin" style={{ fontSize: '24px', color: 'var(--accent-gold)' }} />
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Uploading...</span>
                    </>
                ) : (
                    <>
                        <FaCloudUploadAlt style={{ fontSize: '24px', color: 'var(--text-muted)' }} />
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Click to upload or drag & drop</span>
                    </>
                )}
                <input
                    id={`file-upload-${label}`}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    disabled={uploading}
                />
            </div>
            <style>
                {`
                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                    .spin {
                        animation: spin 1s linear infinite;
                    }
                `}
            </style>
        </div>
    );
};

export default ImageUpload;
