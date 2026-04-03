import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { firestoreService, hallService, bookingService } from '../services/firestore';
import { authService } from '../services/auth';
import { FaBell, FaCheckCircle, FaTrash, FaDownload, FaSchool, FaTimesCircle, FaMapMarkerAlt } from 'react-icons/fa';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Assuming getNotificationsForUser is in firestoreService based on previous read
// If not, I'll need to double check where I put it. 
// I put it in `firestoreService.js` (technically I modified the same file).

const Notifications = () => {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedNotif, setSelectedNotif] = useState(null);
    const [bookingData, setBookingData] = useState(null);
    const [showSlip, setShowSlip] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [userRole, setUserRole] = useState(null);

    const handleNotifClick = async (notif) => {
        if (!notif.read) {
            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
            await handleMarkRead(notif.id);
        }

        if (notif.bookingId) {
            // Check if user is admin/manager
            if (userRole === 'admin' || userRole === 'Booking_Manager' || userRole === 'board') {
                navigate(`/admin/booking/${notif.bookingId}`);
            } else {
                // For regular users, show the professional slip modal
                setSelectedNotif(notif);
                try {
                    const bk = await bookingService.getBooking(notif.bookingId);
                    setBookingData(bk);
                    setShowSlip(true);
                } catch (error) {
                    console.error('Error fetching booking for slip:', error);
                    // Fallback to detail page if modal fails
                    navigate(`/booking/${notif.bookingId}`);
                }
            }
        }
    };

    useEffect(() => {
        let unsubscribeUser = () => { };
        let unsubscribeAdmin = () => { };

        const unsubscribeAuth = authService.onAuthStateChanged(async (u) => {
            if (u) {
                const role = await authService.getUserRole(u.uid);
                setUserRole(role);

                let userNotifs = [];
                let adminNotifs = [];

                const updateState = (uArr, aArr) => {
                    const combined = [...uArr, ...aArr].sort((a, b) => {
                        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date();
                        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date();
                        return dateB - dateA;
                    });
                    setNotifications(combined);
                    setLoading(false);
                };

                unsubscribeUser = bookingService.subscribeToNotificationsForUser(u.uid, (data) => {
                    userNotifs = data;
                    updateState(userNotifs, adminNotifs);
                });

                if (userRole === 'admin' || userRole === 'board' || userRole === 'Booking_Manager') {
                    unsubscribeAdmin = bookingService.subscribeToNotificationsByRole(userRole, (data) => {
                        adminNotifs = data;
                        updateState(userNotifs, adminNotifs);
                    });
                }
            } else {
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            unsubscribeUser();
            unsubscribeAdmin();
        };
    }, []);

    const handleMarkRead = async (id) => {
        try {
            await bookingService.markNotificationRead(id);
        } catch (error) {
            console.error('Error marking read:', error);
        }
    };

    const handleMarkAllRead = async () => {
        const unread = notifications.filter(n => !n.read);
        for (const n of unread) {
            await bookingService.markNotificationRead(n.id);
        }
    };

    const handleDelete = async (id) => {
        await bookingService.deleteNotification(id);
    };

    const handleDownloadPDF = async () => {
        const input = document.getElementById('booking-slip-content');
        if (!input) return;

        setIsDownloading(true);
        try {
            // Get hall coordinates for the link
            const hall = await hallService.getHall(bookingData.hallId);
            const lat = hall ? (hall.latitude || (hall.coords && hall.coords.latitude)) : null;
            const lng = hall ? (hall.longitude || (hall.coords && hall.coords.longitude)) : null;
            const mapUrl = lat && lng ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : null;

            // Get target element position before canvas capture
            const hallCell = document.getElementById('hall-name-cell-notif');
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

            pdf.save(`Booking_Slip_${selectedNotif.bookingId.substring(0, 8)}.pdf`);
        } catch (error) {
            console.error('PDF generation failed:', error);
        } finally {
            setIsDownloading(false);
        }
    };

    const handleOpenLocation = async () => {
        if (!bookingData || !bookingData.hallId) return;
        setIsDownloading(true);
        try {
            const hall = await hallService.getHall(bookingData.hallId);
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

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading Notifications...</div>;

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h2 style={{ margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FaBell /> Notifications
                </h2>
                {notifications.some(n => !n.read) && (
                    <button
                        onClick={handleMarkAllRead}
                        style={{
                            background: 'none',
                            border: '1px solid var(--accent-gold)',
                            color: 'var(--accent-gold)',
                            padding: '6px 16px',
                            borderRadius: '20px',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.3s'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'rgba(212, 175, 55, 0.1)'}
                        onMouseLeave={(e) => e.target.style.background = 'none'}
                    >
                        Mark all as read
                    </button>
                )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {notifications.length > 0 ? (
                    notifications.map(notif => {
                        const isApproved = notif.type === 'booking_approved';
                        const isRejected = notif.type === 'booking_rejected';

                        let borderColor = 'var(--accent-gold)';
                        if (isApproved) borderColor = '#2ecc71';
                        if (isRejected) borderColor = '#e74c3c';

                        return (
                            <div
                                key={notif.id}
                                className="glass-panel"
                                onClick={() => handleNotifClick(notif)}
                                style={{
                                    padding: '20px',
                                    borderLeft: notif.read ? 'none' : `4px solid ${borderColor}`,
                                    transition: 'all 0.3s',
                                    cursor: notif.bookingId ? 'pointer' : 'default',
                                    position: 'relative'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', gap: '15px' }}>
                                        <div style={{
                                            marginTop: '5px',
                                            color: isApproved ? '#2ecc71' : isRejected ? '#e74c3c' : 'var(--accent-gold)'
                                        }}>
                                            {isApproved ? <FaCheckCircle size={24} /> : isRejected ? <FaCheckCircle size={24} /> : <FaBell size={24} />}
                                        </div>
                                        <div>
                                            {(notif.forRole === 'admin' || notif.forRole === 'Booking_Manager') && (
                                                <span style={{
                                                    fontSize: '0.7rem',
                                                    background: 'var(--accent-gold)',
                                                    color: 'var(--primary-maroon)',
                                                    padding: '2px 8px',
                                                    borderRadius: '10px',
                                                    fontWeight: 'bold',
                                                    marginBottom: '5px',
                                                    display: 'inline-block'
                                                }}>{notif.forRole === 'admin' ? 'ADMIN ALERT' : 'MANAGER ALERT'}</span>
                                            )}
                                            <h4 style={{ margin: '0 0 5px 0', fontSize: '1.1rem', color: isApproved ? '#2ecc71' : isRejected ? '#e74c3c' : 'white' }}>{notif.title}</h4>
                                            <p style={{ margin: '0 0 10px 0', color: 'var(--text-muted)', lineHeight: '1.4' }}>{notif.body}</p>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#999', minWidth: '80px', textAlign: 'right' }}>
                                        {notif.createdAt?.toDate ? notif.createdAt.toDate().toLocaleDateString() : 'Just now'}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                                    {!notif.read && (
                                        <button onClick={(e) => { e.stopPropagation(); handleMarkRead(notif.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <FaCheckCircle /> Mark as Read
                                        </button>
                                    )}
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(notif.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e74c3c', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <FaTrash /> Delete
                                    </button>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No notifications yet.
                    </div>
                )}
                {/* Slip Modal */}
                {showSlip && (
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

                                {bookingData ? (
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <tbody>
                                            {[
                                                { label: 'Hall Name', value: bookingData.hallName || '-', bold: true, isHall: true },
                                                { label: 'Date', value: bookingData.date || '-' },
                                                { label: 'Time Slot', value: bookingData.timeSlot || '-' },
                                                { label: 'Purpose', value: bookingData.purpose || '-' },
                                                { label: 'Reference ID', value: selectedNotif.bookingId || '-' },
                                                { label: 'User', value: bookingData.userEmail || (authService.getCurrentUser()?.email) || '-' },
                                                { label: 'Status', value: (bookingData.status || 'Confirmed').toUpperCase(), bold: true }
                                            ].map((row, idx) => (
                                                <tr key={idx}>
                                                    <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid #eee', color: '#666', fontWeight: 600, width: '35%', fontSize: '14px' }}>
                                                        {row.label}
                                                    </th>
                                                    <td
                                                        id={row.isHall ? "hall-name-cell-notif" : ""}
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
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
                                )}

                                <div style={{ marginTop: '40px', textAlign: 'center', fontSize: '12px', color: '#999', borderTop: '1px solid #eee', paddingTop: '20px', lineHeight: '1.6' }}>
                                    Generated on {new Date().toLocaleString()}<br />
                                    University of Sri Jayewardenepura, Sri Lanka<br />
                                    <i style={{ fontSize: '11px' }}>This is a computer-generated document and does not require a physical signature.</i>
                                </div>
                            </div>

                            <div style={{ padding: '20px', backgroundColor: '#f9f9f9', display: 'flex', gap: '10px' }}>
                                <button
                                    onClick={handleOpenLocation}
                                    disabled={isDownloading || !bookingData}
                                    style={{
                                        flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ddd',
                                        backgroundColor: 'white', color: 'var(--primary-maroon)',
                                        fontWeight: 'bold', cursor: 'pointer', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', gap: '8px',
                                        opacity: (isDownloading || !bookingData) ? 0.7 : 1
                                    }}
                                >
                                    <FaSchool /> {isDownloading ? 'Loading...' : 'Location'}
                                </button>
                                <button
                                    onClick={handleDownloadPDF}
                                    disabled={isDownloading || !bookingData}
                                    style={{
                                        flex: 1.5, padding: '12px', borderRadius: '8px', border: 'none',
                                        backgroundColor: 'var(--primary-maroon)', color: 'var(--accent-gold)',
                                        fontWeight: 'bold', cursor: 'pointer', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', gap: '8px',
                                        opacity: (isDownloading || !bookingData) ? 0.7 : 1
                                    }}
                                >
                                    <FaDownload /> {isDownloading ? 'Generating...' : 'Download PDF'}
                                </button>
                                <button
                                    onClick={() => { setShowSlip(false); setBookingData(null); }}
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
        </div>
    );
};

export default Notifications;
