import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { bookingService } from '../services/firestore';
import { authService } from '../services/auth';
import { FaCheckCircle, FaClipboardList, FaArrowLeft, FaCreditCard, FaLock, FaCheck } from 'react-icons/fa';

const BookingForm = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { hall, date, timeSlot } = location.state || {};

    const [step, setStep] = useState(1); // 1: Form, 2: Payment Summary, 3: Processing
    const [purpose, setPurpose] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [paymentData, setPaymentData] = useState({
        cardNumber: '',
        expiry: '',
        cvc: '',
        nameOnCard: ''
    });

    if (!hall) return <div>Invalid Booking Data</div>;

    const hasCharges = hall.charges > 0;

    const handleFormSubmit = (e) => {
        e.preventDefault();
        if (hasCharges) {
            setStep(2);
        } else {
            processBooking('none');
        }
    };

    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        // Simulate payment processing delay
        setTimeout(() => {
            processBooking('paid');
        }, 2000);
    };

    const processBooking = async (paymentStatus = 'none') => {
        setLoading(true);
        try {
            const currentUser = authService.auth.currentUser;
            if (!currentUser) {
                alert('Please login to continue');
                navigate('/login');
                return;
            }

            const bookingData = {
                hallId: hall.id,
                hallName: hall.name,
                userId: currentUser.uid,
                userEmail: currentUser.email,
                date,
                timeSlot,
                purpose,
                notes,
                charges: hall.charges || 0,
                status: 'pending',
                paymentStatus: paymentStatus,
                transactionId: paymentStatus === 'paid' ? 'TXN-' + Math.random().toString(36).substr(2, 9).toUpperCase() : null
            };

            await bookingService.createBooking(bookingData);
            setStep(3); // Success state
            setTimeout(() => navigate('/dashboard'), 3000);

        } catch (error) {
            console.error(error);
            alert('Failed to create booking: ' + error.message);
            setStep(1);
        } finally {
            setLoading(false);
        }
    };

    if (step === 3) {
        return (
            <div style={{ textAlign: 'center', padding: '100px 20px' }}>
                <div style={{ fontSize: '5rem', color: '#2ecc71', marginBottom: '20px' }}><FaCheckCircle /></div>
                <h2 style={{ color: 'white', marginBottom: '10px' }}>Booking Confirmed!</h2>
                <p style={{ color: 'var(--text-muted)' }}>Redirecting you to dashboard...</p>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto', color: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <button onClick={() => step === 2 ? setStep(1) : navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FaArrowLeft /> {step === 2 ? 'Back to Details' : 'Back'}
                </button>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <StepIndicator active={step >= 1} current={step === 1} label="Details" />
                    {hasCharges && <StepIndicator active={step >= 2} current={step === 2} label="Payment" />}
                </div>
            </div>

            <div className="glass-panel" style={{ padding: '30px', position: 'relative', overflow: 'hidden' }}>
                {step === 1 ? (
                    <>
                        <h2 style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <FaClipboardList /> Booking Details
                        </h2>

                        <div style={summaryBox}>
                            <div style={summaryRow}><span>Venue</span> <strong>{hall.name}</strong></div>
                            <div style={summaryRow}><span>Schedule</span> <strong>{date} | {timeSlot}</strong></div>
                        </div>

                        <form onSubmit={handleFormSubmit}>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={labelStyle}>Purpose of Booking *</label>
                                <input required type="text" value={purpose} onChange={(e) => setPurpose(e.target.value)} style={inputStyle} placeholder="e.g. Annual General Meeting" />
                            </div>
                            <div style={{ marginBottom: '30px' }}>
                                <label style={labelStyle}>Additional Notes</label>
                                <textarea rows="3" value={notes} onChange={(e) => setNotes(e.target.value)} style={inputStyle} placeholder="Any specific requirements?" />
                            </div>

                            <button className="btn-primary" style={actionBtn}>
                                {hasCharges ? 'Review & Pay' : 'Confirm Booking'}
                            </button>
                        </form>
                    </>
                ) : (
                    <form onSubmit={handlePaymentSubmit}>
                        <h2 style={{ marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <FaCreditCard /> Secure Payment
                        </h2>

                        <div style={{ ...summaryBox, background: 'var(--primary-maroon)', border: '1px solid var(--accent-gold)' }}>
                            <div style={{ ...summaryRow, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '15px' }}>
                                <span>Reservation Fee</span>
                                <span style={{ fontSize: '1.4rem', color: 'var(--accent-gold)', fontWeight: 'bold' }}>Rs. {hall.charges}</span>
                            </div>
                            <div style={{ paddingTop: '10px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <FaLock size={12} /> SSL Secure Encrypted Payment
                            </div>
                        </div>

                        <div style={{ display: 'grid', gap: '15px', marginBottom: '25px' }}>
                            <div>
                                <label style={labelStyle}>Cardholder Name</label>
                                <input required type="text" style={inputStyle} placeholder="As printed on card" value={paymentData.nameOnCard} onChange={e => setPaymentData({ ...paymentData, nameOnCard: e.target.value })} />
                            </div>
                            <div>
                                <label style={labelStyle}>Card Number</label>
                                <input required type="text" style={inputStyle} placeholder="0000 0000 0000 0000" maxLength="16" value={paymentData.cardNumber} onChange={e => setPaymentData({ ...paymentData, cardNumber: e.target.value })} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <div>
                                    <label style={labelStyle}>Expiry (MM/YY)</label>
                                    <input required type="text" style={inputStyle} placeholder="MM/YY" maxLength="5" value={paymentData.expiry} onChange={e => setPaymentData({ ...paymentData, expiry: e.target.value })} />
                                </div>
                                <div>
                                    <label style={labelStyle}>CVC</label>
                                    <input required type="password" style={inputStyle} placeholder="123" maxLength="3" value={paymentData.cvc} onChange={e => setPaymentData({ ...paymentData, cvc: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        <button className="btn-primary" style={actionBtn} disabled={loading}>
                            {loading ? 'Processing Payment...' : `Pay Rs. ${hall.charges}`}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

const StepIndicator = ({ active, current, label }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: active ? 1 : 0.3 }}>
        <div style={{
            width: '24px', height: '24px', borderRadius: '50%',
            background: current ? 'var(--accent-gold)' : (active ? '#2ecc71' : 'rgba(255,255,255,0.1)'),
            color: 'var(--primary-maroon)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold'
        }}>
            {active && !current ? <FaCheck /> : (label === 'Details' ? '1' : '2')}
        </div>
        <span style={{ fontSize: '0.8rem', fontWeight: current ? 'bold' : 'normal', color: current ? 'var(--accent-gold)' : 'white' }}>{label}</span>
    </div>
);

const summaryBox = {
    background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '20px', marginBottom: '25px', border: '1px solid var(--glass-border)'
};

const summaryRow = {
    display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '1rem'
};

const inputStyle = {
    width: '100%', padding: '14px', borderRadius: '10px',
    border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.08)',
    color: 'white', outline: 'none', transition: 'border 0.3s ease', boxSizing: 'border-box'
};

const labelStyle = { display: 'block', marginBottom: '8px', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' };

const actionBtn = { width: '100%', padding: '18px', fontSize: '1.1rem', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' };

export default BookingForm;
