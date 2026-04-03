import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { holidayService } from '../../services/firestore';
import { FaArrowLeft, FaUpload, FaCalendarAlt, FaCheckCircle, FaExclamationTriangle, FaGithub, FaCloudDownloadAlt } from 'react-icons/fa';

const ManageHolidays = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [parsedData, setParsedData] = useState(null);
    const [selectedFileName, setSelectedFileName] = useState('');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setSelectedFileName(file.name);
        setError('');
        setSuccess('');

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target.result;
            parseCSV(content);
        };
        reader.readAsText(file);
    };

    const parseCSV = (content) => {
        try {
            const lines = content.split('\n');
            if (lines.length < 2) {
                setError('Invalid CSV format. File is too short.');
                return;
            }

            const holidays = [];
            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;

                const parts = lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || lines[i].split(',');

                if (parts.length < 5) continue;

                const holiday = {
                    uid: parts[0].replace(/"/g, '').trim(),
                    summary: parts[1].replace(/"/g, '').trim(),
                    categories: parts[2].replace(/"/g, '').trim(),
                    date: parts[3].replace(/"/g, '').trim(),
                    end: parts[4].replace(/"/g, '').trim()
                };
                holidays.push(holiday);
            }

            if (holidays.length === 0) {
                setError('No valid holiday entries found in the CSV.');
                return;
            }

            setParsedData(holidays);

            // Auto-detect year
            const yearMatch = holidays[0].date.match(/^(\d{4})/);
            if (yearMatch) {
                setSelectedYear(yearMatch[1]);
            }
        } catch (err) {
            console.error('Error parsing CSV:', err);
            setError('Failed to parse CSV content. Please check the file format.');
        }
    };

    const handleUpload = async () => {
        if (!parsedData || parsedData.length === 0) {
            setError('Please select a valid CSV file first.');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            await holidayService.uploadHolidays(parsedData, selectedYear);
            setSuccess(`Successfully uploaded ${parsedData.length} holidays for the year ${selectedYear}.`);
            setParsedData(null);
            setSelectedFileName('');
            // Reset file input
            document.getElementById('file-upload').value = '';
        } catch (err) {
            console.error('Error uploading holidays:', err);
            setError('Failed to upload holidays to database. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="admin-container" style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px' }}>
                <button
                    onClick={() => navigate('/admin')}
                    className="btn-glass"
                    style={{ padding: '10px', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    <FaArrowLeft />
                </button>
                <h1 style={{ color: 'var(--accent-gold)', margin: 0 }}>Manage University Holidays</h1>
            </div>

            <div className="glass-panel" style={{ padding: '30px', marginBottom: '30px' }}>
                <h3 style={{ marginBottom: '10px' }}>Upload Holiday Calendar</h3>
                <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '25px' }}>
                    Select a CSV file containing the university's holiday dates for a specific year.
                </p>

                <div
                    style={{
                        border: '2px dashed rgba(212, 175, 55, 0.3)',
                        borderRadius: '12px',
                        padding: '40px',
                        textAlign: 'center',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        cursor: 'pointer'
                    }}
                    onClick={() => document.getElementById('file-upload').click()}
                >
                    <input
                        type="file"
                        id="file-upload"
                        accept=".csv"
                        onChange={handleFileSelect}
                        style={{ display: 'none' }}
                    />
                    <FaUpload style={{ fontSize: '3rem', color: 'var(--accent-gold)', marginBottom: '15px', opacity: 0.7 }} />
                    <p style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: '0 0 5px 0' }}>
                        {selectedFileName || 'Click to select CSV file'}
                    </p>
                    <p style={{ color: '#888', fontSize: '0.85rem' }}>Only .csv files are supported</p>
                </div>

                {error && (
                    <div style={{ marginTop: '20px', padding: '15px', borderRadius: '8px', backgroundColor: 'rgba(231, 76, 60, 0.1)', color: '#e74c3c', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FaExclamationTriangle /> {error}
                    </div>
                )}

                {success && (
                    <div style={{ marginTop: '20px', padding: '15px', borderRadius: '8px', backgroundColor: 'rgba(46, 204, 113, 0.1)', color: '#2ecc71', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FaCheckCircle /> {success}
                    </div>
                )}

                {parsedData && (
                    <div style={{ marginTop: '30px', paddingTop: '30px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                            <div>
                                <div style={{ color: '#888', fontSize: '0.8rem' }}>Identified Year</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{selectedYear}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ color: '#888', fontSize: '0.8rem' }}>Total Holidays</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{parsedData.length}</div>
                            </div>
                        </div>

                        <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '15px', marginBottom: '25px' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '10px', color: '#aaa' }}>Preview (First 5 items):</div>
                            {parsedData.slice(0, 5).map((h, i) => (
                                <div key={i} style={{ display: 'flex', gap: '15px', fontSize: '0.85rem', padding: '5px 0' }}>
                                    <span style={{ color: 'var(--accent-gold)', fontWeight: 'bold' }}>{h.date}</span>
                                    <span style={{ color: '#eee' }}>{h.summary}</span>
                                </div>
                            ))}
                        </div>

                        <button
                            className="btn-glass"
                            style={{
                                width: '100%',
                                padding: '15px',
                                background: 'var(--accent-gold)',
                                color: 'var(--primary-maroon)',
                                fontWeight: 'bold',
                                fontSize: '1rem'
                            }}
                            onClick={handleUpload}
                            disabled={loading}
                        >
                            {loading ? 'Uploading...' : `Upload ${parsedData.length} Holidays`}
                        </button>
                    </div>
                )}
            </div>

            <div className="glass-panel" style={{ padding: '25px', marginBottom: '30px', background: 'linear-gradient(135deg, rgba(21, 101, 192, 0.1) 0%, rgba(21, 101, 192, 0.05) 100%)', border: '1px solid rgba(21, 101, 192, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
                    <FaCloudDownloadAlt style={{ fontSize: '1.8rem', color: '#3498db' }} />
                    <h3 style={{ margin: 0, color: '#3498db' }}>Need Holiday Data?</h3>
                </div>
                <p style={{ color: '#ccc', fontSize: '0.95rem', marginBottom: '20px' }}>
                    You can download official Sri Lankan holiday CSV files for the upcoming years from our public repository. This ensures your calendar stays up-to-date with accurate university holiday data.
                </p>
                <a
                    href="https://github.com/Dilshan-H/srilanka-holidays/tree/main/csv"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-glass"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px 24px',
                        background: '#24292e',
                        color: '#fff',
                        textDecoration: 'none',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    <FaGithub style={{ fontSize: '1.2rem' }} />
                    Download Holidays for Next Year
                </a>
            </div>

            <div className="glass-panel" style={{ padding: '25px', backgroundColor: 'rgba(52, 152, 219, 0.05)', border: '1px solid rgba(52, 152, 219, 0.2)' }}>
                <h4 style={{ color: '#3498db', marginTop: 0, marginBottom: '15px' }}>Instructions</h4>
                <ul style={{ fontSize: '0.9rem', color: '#ccc', paddingLeft: '20px', lineHeight: '1.6' }}>
                    <li>The CSV file must contain columns in this order: <code style={{ color: '#fff' }}>UID, Summary, Categories, Start, End</code>.</li>
                    <li>The <strong>'Start'</strong> column must contain the date in <code style={{ color: '#fff' }}>YYYY-MM-DD</code> format.</li>
                    <li>Categories containing the word <strong>"Poya"</strong> will be automatically marked with unique yellow styling in the calendar.</li>
                    <li>Uploading holidays for a year will overwrite any previously uploaded holidays for that same year if their UIDs match.</li>
                </ul>
            </div>
        </div>
    );
};

export default ManageHolidays;
