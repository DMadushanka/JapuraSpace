import React, { useState, useEffect } from 'react';
import { bookingService, holidayService } from '../../services/firestore';
import { authService } from '../../services/auth';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaChevronLeft, FaChevronRight, FaCircle } from 'react-icons/fa';

const AdminCalendar = () => {
    const navigate = useNavigate();
    const todayStr = new Date().toISOString().split('T')[0];
    const [bookings, setBookings] = useState([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDateBookings, setSelectedDateBookings] = useState([]);
    const [selectedDate, setSelectedDate] = useState(null);
    const [dbHolidays, setDbHolidays] = useState({});

    useEffect(() => {
        const checkPerms = async () => {
            const user = authService.auth.currentUser;
            if (!user) {
                navigate('/login');
                return;
            }
            const perms = await authService.getUserPermissions(user.uid);
            if (!perms.manage_calendar) {
                alert('You do not have permission to view the calendar.');
                navigate('/admin');
                return;
            }
            loadBookings();
        };

        checkPerms();
    }, []);

    useEffect(() => {
        loadHolidays();
    }, [currentDate]);

    const loadHolidays = async () => {
        const year = currentDate.getFullYear();
        const holidays = await holidayService.getHolidaysByYear(year);
        setDbHolidays(holidays || {});
    };

    const loadBookings = async () => {
        const data = await bookingService.getAllBookings();
        setBookings(data);
    };

    const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const renderCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const numDays = daysInMonth(year, month);
        const startDay = firstDayOfMonth(year, month);
        const days = [];

        for (let i = 0; i < startDay; i++) {
            days.push(<div key={`empty-${i}`} style={dayBoxStyle}></div>);
        }

        for (let d = 1; d <= numDays; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayBookings = bookings.filter(b => b.date === dateStr);
            const isSelected = selectedDate === dateStr;
            const isToday = dateStr === todayStr;
            const holiday = dbHolidays[dateStr];

            // Weekend logic
            const dayOfWeek = new Date(year, month, d).getDay();
            const isSaturday = dayOfWeek === 6;
            const isSunday = dayOfWeek === 0;

            let bgColor = 'rgba(255,255,255,0.05)';
            let borderColor = 'var(--glass-border)';

            if (isSelected) {
                bgColor = 'rgba(212, 175, 55, 0.2)';
                borderColor = 'var(--accent-gold)';
            } else if (holiday) {
                if (holiday.type === 'full-poya') {
                    bgColor = 'rgba(241, 196, 15, 0.3)';
                    borderColor = '#E67E22'; // Orange outline for Full Moon
                } else if (holiday.type === 'poya') {
                    bgColor = 'rgba(241, 196, 15, 0.3)';
                    borderColor = '#f1c40f';
                } else {
                    bgColor = 'rgba(46, 204, 113, 0.2)';
                    borderColor = '#2ecc71';
                }
            } else if (isSaturday) {
                bgColor = 'rgba(52, 152, 219, 0.15)';
            } else if (isSunday) {
                bgColor = 'rgba(231, 76, 60, 0.15)';
            }

            days.push(
                <div
                    key={d}
                    style={{
                        ...dayBoxStyle,
                        background: bgColor,
                        borderColor: borderColor,
                        borderWidth: (holiday || isSelected) ? '2px' : '1px',
                        cursor: 'pointer',
                        position: 'relative'
                    }}
                    onClick={() => {
                        setSelectedDate(dateStr);
                        setSelectedDateBookings(dayBookings);
                    }}
                >
                    <span style={{
                        fontSize: '0.9rem',
                        marginBottom: '5px',
                        fontWeight: (holiday || isToday) ? 'bold' : 'normal',
                        color: isToday ? 'var(--accent-gold)' : (isSunday ? '#ff7675' : isSaturday ? '#74b9ff' : 'inherit'),
                        position: 'relative',
                        zIndex: 2
                    }}>
                        {d}
                        {isToday && <div className="today-glow" />}
                    </span>


                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center', marginTop: 'auto' }}>
                        {dayBookings.map(b => (
                            <FaCircle
                                key={b.id}
                                size={6}
                                color={b.status === 'approved' ? '#3498db' : b.status === 'pending' ? '#e74c3c' : '#888'}
                            />
                        ))}
                    </div>
                </div>
            );
        }
        return days;
    };

    const changeMonth = (offset) => {
        const newDate = new Date(currentDate);
        newDate.setMonth(currentDate.getMonth() + offset);
        setCurrentDate(newDate);
    };

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <style>
                {`
                    @keyframes pulse-gold {
                        0% { box-shadow: 0 0 0 0 rgba(212, 175, 55, 0.4); }
                        70% { box-shadow: 0 0 0 10px rgba(212, 175, 55, 0); }
                        100% { box-shadow: 0 0 0 0 rgba(212, 175, 55, 0); }
                    }
                    .today-glow {
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        width: 24px;
                        height: 24px;
                        background: rgba(212, 175, 55, 0.15);
                        border-radius: 50%;
                        z-index: -1;
                        animation: pulse-gold 2s infinite;
                        border: 1px solid var(--accent-gold);
                    }
                `}
            </style>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <button onClick={() => navigate('/admin')} style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}><FaArrowLeft /></button>
                <h2 style={{ color: 'var(--text-main)' }}>Booking Calendar</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '30px' }}>
                <div className="glass-panel" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <button onClick={() => changeMonth(-1)} style={navBtnStyle}><FaChevronLeft /></button>
                        <h3 style={{ margin: 0 }}>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h3>
                        <button onClick={() => changeMonth(1)} style={navBtnStyle}><FaChevronRight /></button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px', textAlign: 'center', marginBottom: '10px', fontWeight: 'bold', color: 'var(--accent-gold)' }}>
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px' }}>
                        {renderCalendar()}
                    </div>
                </div>

                <div className="glass-panel" style={{ padding: '20px' }}>
                    <h3 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', marginBottom: '15px' }}>
                        {selectedDate ? `Bookings for ${selectedDate}` : 'Select a date'}
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {selectedDate && dbHolidays[selectedDate] && (
                            <div style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', borderLeft: `4px solid ${dbHolidays[selectedDate].type === 'full-poya' ? '#E67E22' : (dbHolidays[selectedDate].type.includes('poya') ? '#f1c40f' : '#2ecc71')}` }}>
                                <h4 style={{ margin: '0 0 5px 0', color: '#fff' }}>{dbHolidays[selectedDate].name}</h4>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#aaa' }}>
                                    {dbHolidays[selectedDate].type === 'full-poya' ? 'Full Moon Poya Day' : (dbHolidays[selectedDate].type === 'poya' ? 'Poya Day' : 'University Holiday')}
                                </p>
                                {dbHolidays[selectedDate].categories && (
                                    <div style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', marginTop: '8px' }}>
                                        {dbHolidays[selectedDate].categories}
                                    </div>
                                )}
                            </div>
                        )}

                        {selectedDateBookings.length > 0 ? (
                            <>
                                {selectedDate && dbHolidays[selectedDate] && (
                                    <h4 style={{ margin: '10px 0 5px 0', fontSize: '0.9rem', color: '#aaa' }}>Bookings:</h4>
                                )}
                                {selectedDateBookings.map(b => (
                                    <div
                                        key={b.id}
                                        onClick={() => navigate(`/admin/booking/${b.id}`)}
                                        style={{
                                            padding: '12px',
                                            borderRadius: '8px',
                                            background: 'rgba(255,255,255,0.05)',
                                            borderLeft: `4px solid ${b.status === 'approved' ? '#3498db' : b.status === 'pending' ? '#e74c3c' : '#888'}`,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <div style={{ fontWeight: 'bold' }}>{b.hallName}</div>
                                        <div style={{ fontSize: '0.85rem', color: '#888' }}>{b.timeSlot} | {b.userEmail}</div>
                                    </div>
                                ))}
                            </>
                        ) : (
                            !selectedDate || !dbHolidays[selectedDate] ? (
                                <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>No bookings or events on this day.</div>
                            ) : null
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const dayBoxStyle = {
    height: '60px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    border: '1px solid transparent',
    transition: 'all 0.2s'
};

const navBtnStyle = {
    background: 'none',
    border: 'none',
    color: 'var(--accent-gold)',
    cursor: 'pointer',
    fontSize: '1.2rem'
};

export default AdminCalendar;
