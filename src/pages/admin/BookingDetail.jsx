import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bookingService, hallService } from '../../services/firestore';
import { authService } from '../../services/auth';
import { FaArrowLeft, FaCheckCircle, FaTimesCircle, FaUser, FaCalendarDay, FaClock, FaUniversity, FaDownload, FaUsers, FaMapMarkerAlt, FaSnowflake } from 'react-icons/fa';
import LocationView from '../../components/LocationView';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const BookingDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [userPermissions, setUserPermissions] = useState({});
    const [userRole, setUserRole] = useState(null);
    const [booking, setBooking] = useState(null);
    const [hall, setHall] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showRejectForm, setShowRejectForm] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const receiptRef = React.useRef();

    useEffect(() => {
        loadBooking();
        checkPermissions();
    }, [id]);

    const checkPermissions = async () => {
        const user = authService.auth.currentUser;
        if (user) {
            const [role, perms] = await Promise.all([
                authService.getUserRole(user.uid),
                authService.getUserPermissions(user.uid)
            ]);
            setUserRole(role);
            setUserPermissions(perms);
        }
    };

    const isAdmin = userRole === 'admin';
    const canManageBookings = isAdmin || userPermissions.manage_bookings;

    const loadBooking = async () => {
        setLoading(true);
        const data = await bookingService.getBooking(id);
        setBooking(data);
        if (data && data.hallId) {
            const hData = await hallService.getHall(data.hallId);
            setHall(hData);
        }
        setLoading(false);
    };

    const handleUpdateStatus = async (status) => {
        if (status === 'rejected' && !showRejectForm) {
            setShowRejectForm(true);
            return;
        }

        const confirmMsg = status === 'approved'
            ? 'Mark this booking as approved?'
            : `Mark this booking as rejected${rejectionReason ? ' with reason: ' + rejectionReason : ''}?`;

        if (!window.confirm(confirmMsg)) return;

        const updateData = { status };
        if (status === 'rejected' && rejectionReason) {
            updateData.rejectionReason = rejectionReason;
        }

        await bookingService.updateBooking(id, updateData);
        setShowRejectForm(false);
        setRejectionReason('');
        loadBooking();
    };

    const generatePDF = async () => {
        if (!receiptRef.current) return;
        setIsExporting(true);

        try {
            const canvas = await html2canvas(receiptRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#1a1a1a', // Match theme background for PDF
                logging: false
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

            // Add Clickable Link at the bottom if coordinates exist
            if (hall && (hall.latitude || hall.longitude)) {
                const mapUrl = `https://www.google.com/maps?q=${hall.latitude},${hall.longitude}`;
                pdf.setTextColor(212, 175, 55); // var(--accent-gold)
                pdf.setFontSize(10);
                pdf.text('Click here to view location on Google Maps', 15, pdfHeight + 10);
                pdf.link(15, pdfHeight + 5, 80, 7, { url: mapUrl });
            }

            pdf.save(`Booking_${booking.id.substr(0, 8)}.pdf`);
        } catch (error) {
            console.error('PDF Generation Error:', error);
            alert('Failed to generate PDF. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading Booking Details...</div>;
    if (!booking) return <div style={{ padding: '40px', textAlign: 'center' }}>Booking not found.</div>;

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button onClick={() => navigate((isAdmin || userPermissions.view_dashboard) ? '/admin' : '/my-bookings')} style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}><FaArrowLeft /></button>
                    <h2 style={{ color: 'var(--text-main)' }}>Booking Details</h2>
                </div>
                <button
                    onClick={generatePDF}
                    disabled={isExporting}
                    style={{
                        padding: '10px 20px',
                        borderRadius: '10px',
                        background: 'var(--accent-gold)',
                        color: 'var(--primary-maroon)',
                        border: 'none',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.3s'
                    }}
                    onMouseEnter={e => !isExporting && (e.currentTarget.style.transform = 'scale(1.05)')}
                    onMouseLeave={e => !isExporting && (e.currentTarget.style.transform = 'scale(1)')}
                >
                    <FaDownload /> {isExporting ? 'Generating...' : 'Download PDF'}
                </button>
            </div>

            <div ref={receiptRef} className="glass-panel" style={{ padding: '40px', background: '#1a1a1a', color: 'white' }}>
                {/* PDF Header for branding (Visible only during export) */}
                <div style={{ marginBottom: '30px', borderBottom: '2px solid var(--accent-gold)', paddingBottom: '20px', display: isExporting ? 'block' : 'none' }}>
                    <h1 style={{ color: 'var(--accent-gold)', margin: 0 }}>UniHBooking</h1>
                    <p style={{ color: '#888', margin: '5px 0 0 0' }}>University of Sri Jayewardenepura - Official Booking Receipt</p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '20px' }}>
                    <div>
                        <h3 style={{ fontSize: '1.8rem', margin: '0 0 5px 0', color: 'var(--accent-gold)' }}>{booking.hallName}</h3>
                        <div style={{ padding: '4px 12px', borderRadius: '20px', background: booking.status === 'approved' ? '#2ecc71' : booking.status === 'rejected' ? '#e74c3c' : '#f39c12', color: 'white', display: 'inline-block', fontWeight: 'bold', fontSize: '0.8rem' }}>
                            {booking.status?.toUpperCase()}
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ color: '#888', fontSize: '0.9rem' }}>Reference ID</div>
                        <div style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>{booking.id}</div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                    <section>
                        <h4 style={{ color: '#888', marginBottom: '15px', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '1px' }}>User Information</h4>
                        <div style={detailRow}><FaUser color="var(--accent-gold)" /> <span>{booking.userEmail}</span></div>
                        <div style={detailRow}><FaUniversity color="var(--accent-gold)" /> <span>{booking.userRole || 'Student'}</span></div>
                    </section>
                    <section>
                        <h4 style={{ color: '#888', marginBottom: '15px', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '1px' }}>Schedule</h4>
                        <div style={detailRow}><FaCalendarDay color="var(--accent-gold)" /> <span>{booking.date}</span></div>
                        <div style={detailRow}><FaClock color="var(--accent-gold)" /> <span>{booking.timeSlot}</span></div>
                        {booking.charges > 0 && (
                            <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                                <div style={{ fontSize: '0.8rem', color: '#888' }}>Payment Status</div>
                                <div style={{ fontWeight: 'bold', color: booking.paymentStatus === 'paid' ? '#2ecc71' : '#f39c12' }}>
                                    {booking.paymentStatus?.toUpperCase() || 'UNPAID'}
                                </div>
                                {booking.transactionId && (
                                    <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '5px' }}>ID: {booking.transactionId}</div>
                                )}
                            </div>
                        )}
                    </section>
                </div>

                <div style={{ marginTop: '30px', borderTop: '1px solid var(--glass-border)', paddingTop: '20px' }}>
                    <h4 style={{ color: '#888', marginBottom: '10px', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '1px' }}>Purpose</h4>
                    <p style={{ fontSize: '1.1rem', lineHeight: '1.6', color: '#eee' }}>{booking.purpose || 'No purpose provided.'}</p>

                    {booking.notes && (
                        <div style={{ marginTop: '20px' }}>
                            <h4 style={{ color: '#888', marginBottom: '10px', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '1px' }}>Additional Notes</h4>
                            <p style={{ fontStyle: 'italic', color: '#ccc' }}>{booking.notes}</p>
                        </div>
                    )}

                    {booking.rejectionReason && (
                        <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(231, 76, 60, 0.1)', border: '1px solid #e74c3c', borderRadius: '8px' }}>
                            <h4 style={{ color: '#e74c3c', marginBottom: '5px', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '1px' }}>Rejection Reason</h4>
                            <p style={{ color: '#eee', margin: 0 }}>{booking.rejectionReason}</p>
                        </div>
                    )}
                </div>

                {/* Hall Information Section */}
                {hall && (
                    <div style={{ marginTop: '40px', borderTop: '1px solid var(--glass-border)', paddingTop: '30px' }}>
                        <h4 style={{ color: '#888', marginBottom: '20px', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '1px' }}>Venue Information</h4>

                        <div style={{ display: 'grid', gridTemplateColumns: isExporting ? '1fr' : '1fr 1fr', gap: '30px' }}>
                            <div>
                                {hall.images && hall.images[0] && (
                                    <div style={{ borderRadius: '12px', overflow: 'hidden', height: '180px', marginBottom: '15px', border: '1px solid var(--glass-border)' }}>
                                        <img src={hall.images[0]} alt={hall.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                )}
                                <div style={{ ...detailRow, fontSize: '0.9rem' }}><FaUsers color="var(--accent-gold)" /> <span>Capacity: {hall.capacity} Guests</span></div>
                                <div style={{ ...detailRow, fontSize: '0.9rem', marginBottom: '5px' }}><FaMapMarkerAlt color="var(--accent-gold)" /> <span>{hall.location}</span></div>
                                {hall && (hall.latitude || hall.longitude) && (
                                    <div style={{ marginLeft: '26px', fontSize: '0.8rem', color: 'var(--accent-gold)', textDecoration: 'underline' }}>
                                        {isExporting ? 'Google Maps Link included in PDF footer' : (
                                            <a href={`https://www.google.com/maps?q=${hall.latitude},${hall.longitude}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                                                View on Google Maps
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div>
                                <h5 style={{ color: 'var(--accent-gold)', marginBottom: '10px', fontSize: '1rem' }}>Key Amenities</h5>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {hall.features && hall.features.map((f, i) => (
                                        <span key={i} style={{ padding: '4px 10px', borderRadius: '15px', background: 'rgba(255,255,255,0.05)', fontSize: '0.75rem', border: '1px solid var(--glass-border)' }}>
                                            {f}
                                        </span>
                                    ))}
                                </div>
                                <p style={{ marginTop: '15px', fontSize: '0.85rem', color: '#aaa', lineHeight: '1.5' }}>
                                    {hall.description}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Interactive Location Map (Not in PDF) */}
            {!isExporting && hall && (hall.latitude || hall.longitude) && (
                <div style={{ marginTop: '30px' }}>
                    <LocationView
                        lat={hall.latitude}
                        lng={hall.longitude}
                        hallName={hall.name}
                    />
                </div>
            )}

            {/* Admin Management Section (Not in PDF) */}
            {!isExporting && canManageBookings && booking.status === 'pending' && (
                <div style={{ marginTop: '40px' }}>
                    {!showRejectForm ? (
                        <div style={{ display: 'flex', gap: '20px' }}>
                            <button onClick={() => handleUpdateStatus('approved')} className="btn-primary" style={{ flex: 1, padding: '15px', background: '#2ecc71', borderColor: '#2ecc71', color: 'white' }}>
                                <FaCheckCircle /> Approve Booking
                            </button>
                            <button onClick={() => setShowRejectForm(true)} style={{ flex: 1, padding: '15px', borderRadius: '12px', border: '1px solid #e74c3c', background: 'transparent', color: '#e74c3c' }}>
                                <FaTimesCircle /> Reject Booking
                            </button>
                        </div>
                    ) : (
                        <div className="glass-panel" style={{ padding: '20px', border: '1px solid #e74c3c' }}>
                            <h4 style={{ color: '#e74c3c', marginBottom: '15px' }}>Provide a reason for rejection</h4>
                            <textarea
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Enter rejection reason here..."
                                style={{
                                    width: '100%',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    color: 'white',
                                    minHeight: '100px',
                                    marginBottom: '15px'
                                }}
                            />
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => handleUpdateStatus('rejected')} style={{ flex: 1, padding: '12px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '8px' }}>
                                    Confirm Rejection
                                </button>
                                <button onClick={() => { setShowRejectForm(false); setRejectionReason(''); }} style={{ flex: 1, padding: '12px', background: 'transparent', color: 'white', border: '1px solid var(--glass-border)', borderRadius: '8px' }}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const detailRow = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '10px',
    fontSize: '1rem',
    color: '#eee'
};

export default BookingDetail;
