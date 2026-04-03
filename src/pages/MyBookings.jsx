import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingService, hallService } from '../services/firestore';
import { authService } from '../services/auth';
import { FaCalendarAlt, FaClock, FaInfoCircle, FaDownload, FaSchool, FaMapMarkerAlt } from 'react-icons/fa';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const MyBookings = () => {
    const navigate = useNavigate();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, pending, approved, rejected
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [showSlip, setShowSlip] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);

        let unsubscribeBookings = () => { };
        const unsubscribeAuth = authService.onAuthStateChanged((user) => {
            if (user) {
                unsubscribeBookings = bookingService.subscribeToBookingsByUser(user.uid, (data) => {
                    setBookings(data);
                    setLoading(false);
                });
            } else {
                setLoading(false);
            }
        });
        return () => {
            window.removeEventListener('resize', handleResize);
            unsubscribeAuth();
            unsubscribeBookings();
        };
    }, []);

    const getStatusColor = (status) => {
        switch (status) {
            case 'approved': return '#2ecc71';
            case 'rejected': return '#e74c3c';
            case 'pending': return '#f39c12';
            default: return '#95a5a6';
        }
    };

    const handleDownloadPDF = async () => {
        const input = document.getElementById('booking-slip-content');
        if (!input) return;

        setIsDownloading(true);
        try {
            // Get hall coordinates for the link
            const hall = await hallService.getHall(selectedBooking.hallId);
            const lat = hall ? (hall.latitude || (hall.coords && hall.coords.latitude)) : null;
            const lng = hall ? (hall.longitude || (hall.coords && hall.coords.longitude)) : null;
            const mapUrl = lat && lng ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : null;

            // Get target element position before canvas capture
            const hallCell = document.getElementById('hall-name-cell');
            let linkPos = null;
            if (hallCell && mapUrl) {
                const rect = hallCell.getBoundingClientRect();
                const containerRect = input.getBoundingClientRect();
                linkPos = {
                    x: rect.left - containerRect.left,
                    y: rect.top - containerRect.top,
                    w: rect.width,
                    h: rect.height
                };
            }

            const canvas = await html2canvas(input, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff'
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            pdf.addImage(imgData, 'PNG', 0, 10, pdfWidth, pdfHeight);

            // Add the link layer if position was found
            if (linkPos && mapUrl) {
                const scale = pdfWidth / input.offsetWidth;
                pdf.link(
                    linkPos.x * scale,
                    (linkPos.y * scale) + 10,
                    linkPos.w * scale,
                    linkPos.h * scale,
                    { url: mapUrl }
                );
            }

            pdf.save(`Booking_Slip_${selectedBooking.id.substring(0, 8)}.pdf`);
        } catch (error) {
            console.error('PDF generation failed:', error);
        } finally {
            setIsDownloading(false);
        }
    };

    const handleOpenLocation = async () => {
        if (!selectedBooking || !selectedBooking.hallId) return;
        setIsDownloading(true);
        try {
            const hall = await hallService.getHall(selectedBooking.hallId);
            if (!hall) {
                alert('Hall details not found.');
                return;
            }

            const lat = hall.latitude || (hall.coords && hall.coords.latitude);
            const lng = hall.longitude || (hall.coords && hall.coords.longitude);

            if (!lat || !lng) {
                alert('Geographic coordinates not set for this venue.');
                return;
            }

            const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
            window.open(url, '_blank');
        } catch (error) {
            console.error('Error opening maps:', error);
            alert('Could not open map.');
        } finally {
            setIsDownloading(false);
        }
    };

    const filteredBookings = bookings.filter(b => filter === 'all' ? true : b.status === filter);

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading Bookings...</div>;

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: isMobile ? '10px' : '20px' }}>
            <h2 style={{ marginBottom: '20px', color: 'var(--text-main)', fontSize: isMobile ? '1.5rem' : '1.8rem' }}>My Bookings</h2>

            {/* Tabs */}
            <div style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '20px',
                overflowX: isMobile ? 'auto' : 'visible',
                paddingBottom: isMobile ? '10px' : '0',
                WebkitOverflowScrolling: 'touch'
            }}>
                {['all', 'pending', 'approved', 'rejected'].map(s => (
                    <button
                        key={s}
                        onClick={() => setFilter(s)}
                        style={{
                            background: filter === s ? 'var(--primary-maroon)' : 'rgba(255,255,255,0.08)',
                            color: filter === s ? 'var(--accent-gold)' : 'var(--text-muted)',
                            border: `1px solid ${filter === s ? 'var(--accent-gold)' : 'var(--glass-border)'}`,
                            padding: isMobile ? '6px 14px' : '8px 18px',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            textTransform: 'capitalize',
                            whiteSpace: 'nowrap',
                            fontSize: isMobile ? '0.8rem' : '0.9rem',
                            flexShrink: 0
                        }}
                    >
                        {s}
                    </button>
                ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {filteredBookings.length > 0 ? filteredBookings.map(booking => (
                    <div
                        key={booking.id}
                        className="glass-panel"
                        onClick={() => {
                            setSelectedBooking(booking);
                            setShowSlip(true);
                        }}
                        style={{
                            padding: isMobile ? '15px' : '20px',
                            display: 'flex',
                            flexDirection: isMobile ? 'column' : 'row',
                            justifyContent: 'space-between',
                            alignItems: isMobile ? 'flex-start' : 'center',
                            gap: isMobile ? '15px' : '0',
                            cursor: 'pointer'
                        }}
                    >
                        <div>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: isMobile ? '1.1rem' : '1.3rem' }}>{booking.hallName}</h3>
                            <div style={{
                                display: 'flex',
                                flexDirection: isMobile ? 'column' : 'row',
                                gap: isMobile ? '5px' : '15px',
                                color: 'var(--text-muted)',
                                fontSize: isMobile ? '0.8rem' : '0.9rem'
                            }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><FaCalendarAlt size={14} /> {booking.date}</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><FaClock size={14} /> {booking.timeSlot}</span>
                            </div>
                            {booking.purpose && <p style={{
                                marginTop: '10px',
                                fontSize: '0.85rem',
                                fontStyle: 'italic',
                                color: '#ccc',
                                borderLeft: '2px solid var(--accent-gold)',
                                paddingLeft: '10px'
                            }}>"{booking.purpose}"</p>}
                        </div>

                        <div style={{
                            textAlign: isMobile ? 'left' : 'right',
                            width: isMobile ? '100%' : 'auto',
                            display: 'flex',
                            flexDirection: isMobile ? 'row' : 'column',
                            justifyContent: isMobile ? 'space-between' : 'center',
                            alignItems: isMobile ? 'center' : 'flex-end'
                        }}>
                            <div style={{
                                display: 'inline-block',
                                padding: '6px 14px',
                                borderRadius: '20px',
                                background: `${getStatusColor(booking.status)}25`,
                                color: getStatusColor(booking.status),
                                fontWeight: '700',
                                fontSize: '0.75rem',
                                textTransform: 'uppercase',
                                border: `1px solid ${getStatusColor(booking.status)}55`
                            }}>
                                {booking.status}
                            </div>
                        </div>
                    </div>
                )) : (
                    <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--glass-border)', borderRadius: '15px' }}>
                        <FaInfoCircle size={40} style={{ marginBottom: '15px', opacity: 0.5 }} />
                        <p style={{ fontSize: '1.1rem' }}>No bookings found for the selected filter.</p>
                    </div>
                )}
            </div>

            {/* Slip Modal */}
            {showSlip && selectedBooking && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                    padding: '20px'
                }}>
                    <div style={{
                        backgroundColor: 'white', borderRadius: '15px', color: '#333',
                        width: '100%', maxWidth: '450px', position: 'relative',
                        overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
                    }}>
                        <div id="booking-slip-content" style={{ padding: '40px', backgroundColor: 'white', fontFamily: 'Helvetica, Arial, sans-serif' }}>
                            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                                <div style={{ color: '#7B1113', fontSize: '24px', fontWeight: 'bold', letterSpacing: '1px' }}>
                                    UNIVERSITY OF SRI JAYEWARDENEPURA
                                </div>
                                <div style={{ fontSize: '18px', color: '#555', marginTop: '5px' }}>
                                    Booking Verification Slip
                                </div>
                                <div style={{ height: '2px', backgroundColor: '#7B1113', marginTop: '15px' }} />
                            </div>

                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <tbody>
                                    {[
                                        { label: 'Hall Name', value: selectedBooking.hallName || '-', bold: true, isHall: true },
                                        { label: 'Date', value: selectedBooking.date || '-' },
                                        { label: 'Time Slot', value: selectedBooking.timeSlot || '-' },
                                        { label: 'Purpose', value: selectedBooking.purpose || '-' },
                                        { label: 'Reference ID', value: selectedBooking.id || '-' },
                                        { label: 'User', value: selectedBooking.userEmail || (authService.getCurrentUser()?.email) || '-' },
                                        { label: 'Status', value: (selectedBooking.status || 'Confirmed').toUpperCase(), bold: true }
                                    ].map((row, idx) => (
                                        <tr key={idx}>
                                            <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid #eee', color: '#666', fontWeight: 600, width: '35%', fontSize: '14px' }}>
                                                {row.label}
                                            </th>
                                            <td
                                                id={row.isHall ? "hall-name-cell" : ""}
                                                style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid #eee', color: '#333', fontWeight: row.bold ? 'bold' : 'normal', fontSize: '14px' }}
                                            >
                                                {row.value}
                                                {row.isHall && (
                                                    <span
                                                        onClick={handleOpenLocation}
                                                        style={{
                                                            marginLeft: '10px',
                                                            cursor: 'pointer',
                                                            display: 'inline-block',
                                                            fontSize: '16px',
                                                            verticalAlign: 'middle'
                                                        }}
                                                        title="View on Google Maps"
                                                    >
                                                        📍
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div style={{ marginTop: '40px', textAlign: 'center', fontSize: '12px', color: '#999', borderTop: '1px solid #eee', paddingTop: '20px', lineHeight: '1.6' }}>
                                Generated on {new Date().toLocaleString()}<br />
                                University of Sri Jayewardenepura, Sri Lanka<br />
                                <i style={{ fontSize: '11px' }}>This is a computer-generated document and does not require a physical signature.</i>
                            </div>
                        </div>

                        <div style={{ padding: '20px', backgroundColor: '#f9f9f9', display: 'flex', gap: '10px' }}>
                            <button
                                onClick={handleOpenLocation}
                                disabled={isDownloading}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ddd',
                                    backgroundColor: 'white', color: 'var(--primary-maroon)',
                                    fontWeight: 'bold', cursor: 'pointer', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    opacity: isDownloading ? 0.7 : 1
                                }}
                            >
                                <FaSchool /> {isDownloading ? 'Loading...' : 'Location'}
                            </button>
                            <button
                                onClick={handleDownloadPDF}
                                disabled={isDownloading}
                                style={{
                                    flex: 1.5, padding: '12px', borderRadius: '8px', border: 'none',
                                    backgroundColor: 'var(--primary-maroon)', color: 'var(--accent-gold)',
                                    fontWeight: 'bold', cursor: 'pointer', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    opacity: isDownloading ? 0.7 : 1
                                }}
                            >
                                <FaDownload /> {isDownloading ? 'Generating...' : 'Download PDF'}
                            </button>
                            <button
                                onClick={() => { setShowSlip(false); setSelectedBooking(null); }}
                                style={{
                                    padding: '12px 20px', borderRadius: '8px', border: '1px solid #ddd',
                                    backgroundColor: 'white', color: '#666', fontWeight: 'bold', cursor: 'pointer'
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyBookings;
