import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
    FaCalendarAlt, FaSchool, FaBuilding, FaFlask, 
    FaLayerGroup, FaSearch, FaChevronRight, FaChevronLeft,
    FaClock, FaMapMarkerAlt, FaCheckCircle, FaTrash, FaUser, FaInfoCircle
} from 'react-icons/fa';
import { hallService, bookingService, holidayService, timetableService, miscService, courseService } from '../services/firestore';
import { authService } from '../services/auth';
import '../styles/BookingFlow.css';

const HALL_TYPES = [
    { key: 'lecture', label: 'Lecture Hall', icon: <FaSchool /> },
    { key: 'auditorium', label: 'Auditorium', icon: <FaSearch /> }, // Using search as placeholder or megaphone if available
    { key: 'exam', label: 'Exam Hall', icon: <FaLayerGroup /> },
    { key: 'lab', label: 'Lab', icon: <FaFlask /> },
];

const TIME_SLOTS = [
    '08:00-10:00', '10:00-12:00', '12:00-14:00',
    '14:00-16:00', '16:00-18:00', '18:00-20:00', '20:00-22:00'
];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function BookingFlow() {
    const navigate = useNavigate();
    const location = useLocation();
    const [currentStep, setCurrentStep] = useState(0); // 0: Date, 1: Venue, 2: Time, 3: Type/Details, 4: Success
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Selection State
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedHall, setSelectedHall] = useState(null);
    const [selectedSlot, setSelectedSlot] = useState('');

    // Form State
    const [purposeType, setPurposeType] = useState('other'); // 'lecture' or 'other'
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [purpose, setPurpose] = useState('');
    const [organization, setOrganization] = useState('');
    const [responsiblePersons, setResponsiblePersons] = useState('');

    // Data State
    const [allHalls, setAllHalls] = useState([]);
    const [allBookings, setAllBookings] = useState([]);
    const [allTimetable, setAllTimetable] = useState([]);
    const [dbHolidays, setDbHolidays] = useState({});
    const [allCourses, setAllCourses] = useState([]);
    const [departments, setDepartments] = useState([]);
    
    // Filters
    const [typeFilter, setTypeFilter] = useState('all');
    const [deptFilter, setDeptFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            setLoading(true);
            const [halls, bookings, timetable, courses, depts] = await Promise.all([
                hallService.getAllHalls(),
                bookingService.getAllBookings(),
                timetableService.getAllTimetableEntries(),
                courseService.getAllCourses(),
                miscService.getDepartments()
            ]);

            setAllHalls(halls);
            setAllBookings(bookings);
            setAllTimetable(timetable);
            setAllCourses(courses);
            setDepartments(depts);

            // Check if hall was passed via state (e.g. from HallDetails)
            if (location.state?.hallId) {
                const hall = halls.find(h => h.id === location.state.hallId);
                if (hall) {
                    setSelectedHall(hall);
                    // If we have a hall, maybe we can skip to date? 
                    // But usually flow is Date -> Venue. Let's stay with that or adjust.
                }
            }
        } catch (error) {
            console.error('Error loading initial data:', error);
        } finally {
            setLoading(false);
        }
    };

    const timeToMins = (timeStr) => {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
    };

    const getHallAvailability = (hallId, dateStr) => {
        if (!dateStr) return { status: 'Select Date', color: '#666' };
        
        const dateObj = new Date(dateStr);
        const dayName = DAYS[dateObj.getDay()];

        const bookings = allBookings.filter(b => b.hallId === hallId && b.date === dateStr && b.status === 'approved');
        const lectures = allTimetable.filter(l => l.hallId === hallId && l.dayOfWeek === dayName);

        const activeLectures = lectures.filter(l => {
            const isCancelled = l.cancelledDates && l.cancelledDates.some(c => c.date === dateStr);
            return !isCancelled;
        });

        // Current time check if date is today
        const today = new Date().toISOString().split('T')[0];
        const isToday = dateStr === today;
        const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

        const busyPeriods = [
            ...bookings.map(b => b.timeSlot.split('-').map(timeToMins)),
            ...activeLectures.map(l => [timeToMins(l.startTime), timeToMins(l.endTime)])
        ].sort((a, b) => a[0] - b[0]);

        if (isToday && nowMinutes > 22 * 60) return { status: 'Closed', color: '#666' };

        const currentBusy = busyPeriods.find(p => (isToday ? nowMinutes : 480) >= p[0] && (isToday ? nowMinutes : 480) < p[1]);
        if (currentBusy) return { status: `Busy until ${formatMinutes(currentBusy[1])}`, color: '#e74c3c' };

        const nextBusy = busyPeriods.find(p => p[0] > (isToday ? nowMinutes : 480));
        if (nextBusy) return { status: `Available until ${formatMinutes(nextBusy[0])}`, color: '#2ecc71' };

        return { status: 'Available today', color: '#2ecc71' };
    };

    const formatMinutes = (mins) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    const handleConfirmBooking = async () => {
        if (purposeType === 'other' && (!purpose || !organization || !responsiblePersons)) {
            alert('Please fill in all details.');
            return;
        }

        try {
            setSubmitting(true);
            const user = authService.auth.currentUser;
            const profile = await userService.getUserProfile(user.uid);

            const bookingData = {
                hallId: selectedHall.id,
                hallName: selectedHall.name,
                date: selectedDate,
                timeSlot: selectedSlot.replace(/\s+/g, ''),
                purpose: purposeType === 'lecture' ? `Rescheduled: ${selectedCourse?.name}` : purpose,
                organization: purposeType === 'lecture' ? 'Academic Department' : organization,
                responsiblePersons: purposeType === 'lecture' ? [profile?.name || user.displayName] : responsiblePersons.split(',').map(s => s.trim()),
                userId: user.uid,
                status: 'pending',
                type: purposeType === 'lecture' ? 'reschedule' : 'other',
                courseId: selectedCourse?.id || null,
                courseCode: selectedCourse?.code || null,
                courseName: selectedCourse?.name || null
            };

            await bookingService.createBooking(bookingData);
            setCurrentStep(4);
        } catch (error) {
            console.error('Booking failed:', error);
            alert('Failed to create booking: ' + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const nextStep = () => setCurrentStep(prev => prev + 1);
    const prevStep = () => setCurrentStep(prev => prev - 1);

    if (loading) return <div className="booking-loading"><div className="loader"></div><p>Preparing Booking System...</p></div>;

    return (
        <div className="booking-flow-container">
            <div className="booking-header">
                <button className="back-btn" onClick={() => (currentStep === 0 ? navigate('/dashboard') : prevStep())}>
                    <FaChevronLeft /> <span>Back</span>
                </button>
                <h1>New Venue Booking</h1>
                <div className="step-indicator">
                    {[0, 1, 2, 3].map(i => (
                        <div key={i} className={`step-dot ${currentStep >= i ? 'active' : ''}`}>
                            <div className="dot-inner"></div>
                            <span>{['Date', 'Venue', 'Time', 'Details'][i]}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="booking-card glass-panel">
                {currentStep === 0 && (
                    <div className="step-content animate-in">
                        <h2 className="step-title"><FaCalendarAlt /> Select Date</h2>
                        <div className="date-picker-wrapper">
                            <input 
                                type="date" 
                                className="date-input" 
                                min={new Date().toISOString().split('T')[0]}
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                            />
                        </div>
                        <p className="step-hint">Choose the date you want to Reserve the venue.</p>
                        <button 
                            className="next-btn premium-btn" 
                            disabled={!selectedDate} 
                            onClick={nextStep}
                        >
                            Next: Choose Venue <FaChevronRight />
                        </button>
                    </div>
                )}

                {currentStep === 1 && (
                    <div className="step-content animate-in">
                        <h2 className="step-title"><FaMapMarkerAlt /> Choose Venue</h2>
                        
                        <div className="filter-bar">
                            <div className="search-wrap">
                                <FaSearch />
                                <input 
                                    type="text" 
                                    placeholder="Search halls..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                                <option value="all">All Types</option>
                                {HALL_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                            </select>
                        </div>

                        <div className="venue-list">
                            {allHalls.length === 0 ? (
                                <div className="empty-list">No venues found in the system.</div>
                            ) : (
                                allHalls
                                    .filter(h => {
                                        const name = h.name || 'Unnamed Venue';
                                        const types = Array.isArray(h.types) ? h.types : (h.type ? [h.type] : []);
                                        const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase());
                                        const matchesType = typeFilter === 'all' || types.includes(typeFilter);
                                        return matchesSearch && matchesType;
                                    })
                                    .map(hall => {
                                        const types = Array.isArray(hall.types) ? hall.types : (hall.type ? [hall.type] : []);
                                        const avail = getHallAvailability(hall.id, selectedDate);
                                        const isSelected = selectedHall?.id === hall.id;
                                        return (
                                            <div 
                                                key={hall.id} 
                                                className={`venue-item ${isSelected ? 'selected' : ''}`}
                                                onClick={() => setSelectedHall(hall)}
                                            >
                                                <div className="venue-icon">
                                                    {HALL_TYPES.find(t => types.includes(t.key))?.icon || <FaBuilding />}
                                                </div>
                                                <div className="venue-info">
                                                    <h3>{hall.name || 'Unnamed Venue'}</h3>
                                                    <p>{hall.capacity || 0} Seats • {hall.type || (types[0]) || 'Venue'}</p>
                                                </div>
                                                <div className="venue-status" style={{ color: avail.color }}>
                                                    {avail.status}
                                                </div>
                                                {isSelected && <FaCheckCircle className="check-icon" />}
                                            </div>
                                        );
                                    })
                            )}
                        </div>

                        <button 
                            className="next-btn premium-btn" 
                            disabled={!selectedHall} 
                            onClick={nextStep}
                        >
                            Next: Select Slot <FaChevronRight />
                        </button>
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="step-content animate-in">
                        <h2 className="step-title"><FaClock /> Select Time Slot</h2>
                        <div className="slot-grid">
                            {TIME_SLOTS.map(slot => {
                                const isBooked = allBookings.some(b => 
                                    b.hallId === selectedHall.id && 
                                    b.date === selectedDate && 
                                    b.timeSlot.replace(/\s+/g, '') === slot.replace(/\s+/g, '') &&
                                    b.status === 'approved'
                                );
                                const isSelected = selectedSlot === slot;
                                return (
                                    <button 
                                        key={slot}
                                        className={`slot-btn ${isBooked ? 'booked' : ''} ${isSelected ? 'selected' : ''}`}
                                        disabled={isBooked}
                                        onClick={() => setSelectedSlot(slot)}
                                    >
                                        <FaClock />
                                        <span>{slot}</span>
                                        {isBooked && <span className="booked-tag">Reserved</span>}
                                    </button>
                                );
                            })}
                        </div>
                        <button 
                            className="next-btn premium-btn" 
                            disabled={!selectedSlot} 
                            onClick={nextStep}
                        >
                            Next: Details <FaChevronRight />
                        </button>
                    </div>
                )}

                {currentStep === 3 && (
                    <div className="step-content animate-in">
                        <h2 className="step-title"><FaInfoCircle /> Booking Details</h2>
                        
                        <div className="booking-summary-mini">
                            <div className="summary-item">
                                <FaCalendarAlt /> <span>{selectedDate}</span>
                            </div>
                            <div className="summary-item">
                                <FaMapMarkerAlt /> <span>{selectedHall.name}</span>
                            </div>
                            <div className="summary-item">
                                <FaClock /> <span>{selectedSlot}</span>
                            </div>
                        </div>

                        <div className="form-section">
                            <label>Purpose Type</label>
                            <div className="type-toggle">
                                <button 
                                    className={purposeType === 'lecture' ? 'active' : ''} 
                                    onClick={() => setPurposeType('lecture')}
                                >
                                    Lecture Reschedule
                                </button>
                                <button 
                                    className={purposeType === 'other' ? 'active' : ''} 
                                    onClick={() => setPurposeType('other')}
                                >
                                    Other Event
                                </button>
                            </div>

                            {purposeType === 'lecture' ? (
                                <div className="input-group">
                                    <label>Select Course</label>
                                    <select 
                                        value={selectedCourse?.id || ''} 
                                        onChange={(e) => setSelectedCourse(allCourses.find(c => c.id === e.target.value))}
                                    >
                                        <option value="">Choose a course...</option>
                                        {allCourses.map(c => (
                                            <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <>
                                    <div className="input-group">
                                        <label>Purpose</label>
                                        <input 
                                            type="text" 
                                            placeholder="e.g. Society Meeting, Guest Lecture" 
                                            value={purpose}
                                            onChange={(e) => setPurpose(e.target.value)}
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label>Organization / Society</label>
                                        <input 
                                            type="text" 
                                            placeholder="e.g. IEEE Student Branch" 
                                            value={organization}
                                            onChange={(e) => setOrganization(e.target.value)}
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label>Responsible Persons (comma separated)</label>
                                        <textarea 
                                            placeholder="Names of persons responsible"
                                            value={responsiblePersons}
                                            onChange={(e) => setResponsiblePersons(e.target.value)}
                                        ></textarea>
                                    </div>
                                </>
                            )}
                        </div>

                        <button 
                            className="submit-btn premium-btn" 
                            disabled={submitting}
                            onClick={handleConfirmBooking}
                        >
                            {submitting ? 'Placing Request...' : 'Confirm & Request Booking'}
                        </button>
                    </div>
                )}

                {currentStep === 4 && (
                    <div className="step-content animate-in success-step">
                        <FaCheckCircle className="success-icon" />
                        <h2>Request Submitted!</h2>
                        <p>Your booking request for <strong>{selectedHall.name}</strong> on <strong>{selectedDate}</strong> has been sent for approval.</p>
                        <div className="success-actions">
                            <button className="premium-btn" onClick={() => navigate('/my-bookings')}>
                                View My Bookings
                            </button>
                            <button className="ghost-btn" onClick={() => navigate('/dashboard')}>
                                Back to Dashboard
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Helper
const userService = {
    getUserProfile: async (uid) => {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../services/firebase');
        const snap = await getDoc(doc(db, 'users', uid));
        return snap.exists() ? snap.data() : null;
    }
};
