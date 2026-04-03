import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { hallService, bookingService, holidayService } from '../services/firestore';
import { FaCalendarAlt, FaClock, FaArrowLeft } from 'react-icons/fa';

const BookingCalendar = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [hall, setHall] = useState(null);
    const [bookings, setBookings] = useState([]);
    const [selectedDate, setSelectedDate] = useState('');
    const [availableSlots, setAvailableSlots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dbHolidays, setDbHolidays] = useState({});

    const timeSlots = [
        '08:00-10:00', '10:00-12:00', '12:00-14:00',
        '14:00-16:00', '16:00-18:00', '18:00-20:00', '20:00-22:00'
    ];

    useEffect(() => {
        loadData();
    }, [id]);

    useEffect(() => {
        if (selectedDate) {
            calculateAvailability();
            loadHolidaysForDate();
        }
    }, [selectedDate, bookings]);

    const loadHolidaysForDate = async () => {
        const year = selectedDate.split('-')[0];
        if (!dbHolidays[year]) {
            const holidays = await holidayService.getHolidaysByYear(year);
            setDbHolidays(prev => ({ ...prev, [year]: holidays }));
        }
    };

    const loadData = async () => {
        setLoading(true);
        const hallData = await hallService.getHall(id);
        const bookingData = await bookingService.getBookingsByHall(id);
        setHall(hallData);
        setBookings(bookingData);
        setLoading(false);
    };

    const calculateAvailability = () => {
        const dayBookings = bookings.filter(b => b.date === selectedDate && b.status === 'approved');
        const booked = dayBookings.map(b => b.timeSlot);
        setAvailableSlots(timeSlots.filter(s => !booked.includes(s)));
    };

    const handleSlotClick = (slot) => {
        navigate(`/hall/${id}/confirm`, {
            state: {
                hall,
                date: selectedDate,
                timeSlot: slot
            }
        });
    };

    // Get tomorrow's date for min attribute
    const today = new Date().toISOString().split('T')[0];

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <FaArrowLeft /> Back
            </button>

            <div className="glass-panel" style={{ padding: '30px' }}>
                <h2 style={{ marginBottom: '20px', color: 'var(--text-main)' }}>Select Date & Time</h2>

                <div style={{ marginBottom: '30px' }}>
                    <label style={{ display: 'block', marginBottom: '10px', color: 'var(--text-muted)' }}>
                        <FaCalendarAlt /> Select Date
                    </label>
                    <input
                        type="date"
                        min={today}
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '12px',
                            borderRadius: '8px',
                            border: '1px solid var(--glass-border)',
                            background: 'rgba(255,255,255,0.1)',
                            color: 'white',
                            fontSize: '1rem'
                        }}
                    />
                </div>

                {selectedDate && dbHolidays[selectedDate.split('-')[0]]?.[selectedDate] && (
                    <div style={{
                        marginBottom: '25px',
                        padding: '15px',
                        borderRadius: '12px',
                        backgroundColor: dbHolidays[selectedDate.split('-')[0]][selectedDate].type === 'full-poya' ? 'rgba(230, 126, 34, 0.1)' : (dbHolidays[selectedDate.split('-')[0]][selectedDate].type.includes('poya') ? 'rgba(241, 196, 15, 0.1)' : 'rgba(46, 204, 113, 0.1)'),
                        border: `1px solid ${dbHolidays[selectedDate.split('-')[0]][selectedDate].type === 'full-poya' ? '#E67E22' : (dbHolidays[selectedDate.split('-')[0]][selectedDate].type.includes('poya') ? '#f1c40f' : '#2ecc71')}`,
                        color: dbHolidays[selectedDate.split('-')[0]][selectedDate].type === 'full-poya' ? '#E67E22' : (dbHolidays[selectedDate.split('-')[0]][selectedDate].type.includes('poya') ? '#f1c40f' : '#2ecc71'),
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                    }}>
                        <FaCalendarAlt />
                        <div>
                            <div style={{ fontWeight: 'bold' }}>{dbHolidays[selectedDate.split('-')[0]][selectedDate].name}</div>
                            <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                                {dbHolidays[selectedDate.split('-')[0]][selectedDate].type === 'full-poya' ? 'Full Moon Poya Day' : (dbHolidays[selectedDate.split('-')[0]][selectedDate].type === 'poya' ? 'Poya Day' : 'University Holiday')}
                                {dbHolidays[selectedDate.split('-')[0]][selectedDate].categories ? ` | ${dbHolidays[selectedDate.split('-')[0]][selectedDate].categories}` : ''}
                            </div>
                        </div>
                    </div>
                )}

                {selectedDate && (
                    <div>
                        <h3 style={{ marginBottom: '15px', color: 'var(--text-main)', fontSize: '1.1rem' }}>Available Slots</h3>
                        {availableSlots.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' }}>
                                {availableSlots.map(slot => (
                                    <button
                                        key={slot}
                                        onClick={() => handleSlotClick(slot)}
                                        style={{
                                            padding: '12px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--glass-border)',
                                            background: 'rgba(255,255,255,0.05)',
                                            color: 'white',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.target.style.background = 'var(--primary-maroon)'}
                                        onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
                                    >
                                        {slot}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div style={{ color: '#ff6b6b', padding: '10px', background: 'rgba(255,0,0,0.1)', borderRadius: '8px' }}>
                                No slots available for this date.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div >
    );
};

export default BookingCalendar;
