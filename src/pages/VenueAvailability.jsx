import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FaArrowLeft, FaSchool, FaBuilding, FaFlask, 
    FaLayerGroup, FaMicrophoneAlt, FaSearch, FaChevronRight,
    FaClock, FaMapMarkerAlt, FaCircle
} from 'react-icons/fa';
import { hallService, timetableService, bookingService, miscService } from '../services/firestore';
import '../styles/VenueAvailability.css';

const HALL_CATEGORIES = [
    { key: 'All', label: 'All Types', icon: <FaSearch /> },
    { key: 'Lecture Hall', label: 'Lecture Hall', icon: <FaSchool /> },
    { key: 'Auditorium', label: 'Auditorium', icon: <FaMicrophoneAlt /> },
    { key: 'Lab', label: 'Lab', icon: <FaFlask /> },
    { key: 'Exam Hall', label: 'Exam Hall', icon: <FaLayerGroup /> }
];

export default function VenueAvailability() {
    const navigate = useNavigate();
    const [departments, setDepartments] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedDept, setSelectedDept] = useState('All');
    const [availableHalls, setAvailableHalls] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchHallAvailability();
    }, []);

    const parseTimeToMinutes = (timeStr) => {
        if (!timeStr) return 0;
        const cleanTime = timeStr.toUpperCase().replace(/\s+/g, '');
        const isPM = cleanTime.includes('PM');
        const isAM = cleanTime.includes('AM');
        let [h, m] = cleanTime.replace(/[AP]M/, '').split(':').map(Number);
        if (isPM && h < 12) h += 12;
        if (isAM && h === 12) h = 0;
        return h * 60 + (m || 0);
    };

    const fetchHallAvailability = async () => {
        try {
            setLoading(true);
            const today = new Date();
            const dateStr = today.toISOString().split('T')[0];
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dayName = days[today.getDay()];
            const currentMinutes = today.getHours() * 60 + today.getMinutes();

            const [hallsData, allEntries, todayBooks, depts] = await Promise.all([
                hallService.getAllHalls(),
                timetableService.getAllTimetableEntries(),
                bookingService.getBookingsByDay(dayName, dateStr),
                miscService.getDepartments()
            ]);

            setDepartments(depts);

            const processedHalls = hallsData.map(hall => {
                const hallEntries = allEntries.filter(e => e.hallId === hall.id && e.dayOfWeek === dayName);
                const currentLecture = hallEntries.find(e => {
                    const start = parseTimeToMinutes(e.startTime);
                    const end = parseTimeToMinutes(e.endTime);
                    const isCancelled = e.cancelledDates && e.cancelledDates.some(c => c.date === dateStr);
                    return !isCancelled && currentMinutes >= start && currentMinutes < end;
                });

                const hallBookings = todayBooks.filter(b => b.hallId === hall.id && b.status !== 'cancelled');
                const currentBooking = hallBookings.find(b => {
                    const start = parseTimeToMinutes(b.startTime);
                    const end = parseTimeToMinutes(b.endTime);
                    return currentMinutes >= start && currentMinutes < end;
                });

                const isAvailable = !currentLecture && !currentBooking;
                let availableUntil = 'End of day';

                if (isAvailable) {
                    const futureEvents = [];
                    hallEntries.forEach(e => {
                        const start = parseTimeToMinutes(e.startTime);
                        const isCancelled = e.cancelledDates && e.cancelledDates.some(c => c.date === dateStr);
                        if (!isCancelled && start > currentMinutes) futureEvents.push({ time: e.startTime, minutes: start });
                    });
                    hallBookings.forEach(b => {
                        const start = parseTimeToMinutes(b.startTime);
                        if (start > currentMinutes) futureEvents.push({ time: b.startTime, minutes: start });
                    });

                    if (futureEvents.length > 0) {
                        futureEvents.sort((a, b) => a.minutes - b.minutes);
                        availableUntil = futureEvents[0].time;
                    }
                }

                return {
                    ...hall,
                    isAvailable,
                    availableUntil
                };
            });

            setAvailableHalls(processedHalls);
        } catch (error) {
            console.error("Error fetching hall availability:", error);
        } finally {
            setLoading(false);
        }
    };

    const getCategoryKey = (catStr) => {
        if (catStr === 'Lecture Hall') return 'lecture';
        if (catStr === 'Auditorium') return 'auditorium';
        if (catStr === 'Lab') return 'lab';
        if (catStr === 'Exam Hall') return 'exam';
        return catStr.toLowerCase();
    };

    const filteredHalls = availableHalls
        .filter(h => h.isAvailable)
        .filter(h => {
            if (selectedCategory === 'All') return true;
            const targetKey = getCategoryKey(selectedCategory);
            if (h.type && h.type === selectedCategory) return true;
            if (h.types && Array.isArray(h.types) && h.types.includes(targetKey)) return true;
            return false;
        })
        .filter(h => selectedDept === 'All' || h.departmentId === selectedDept);

    return (
        <div className="venue-availability-page">
            <header className="page-header-premium">
                <button onClick={() => navigate(-1)} className="back-button">
                    <FaArrowLeft />
                </button>
                <div className="header-content">
                    <div className="live-badge">
                        <FaCircle className="pulse-icon" />
                        <span>LIVE STATUS</span>
                    </div>
                    <h1>Venue Availability</h1>
                    <p>Real-time campus facility status</p>
                </div>
            </header>

            <div className="availability-container">
                <div className="filter-panel">
                    <div className="filter-section">
                        <h4>Facility Type</h4>
                        <div className="filter-chips">
                            {HALL_CATEGORIES.map(cat => (
                                <button
                                    key={cat.key}
                                    className={`filter-chip ${selectedCategory === cat.key ? 'active' : ''}`}
                                    onClick={() => setSelectedCategory(cat.key)}
                                >
                                    {cat.icon}
                                    <span>{cat.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="filter-section">
                        <h4>Department</h4>
                        <div className="dept-select-wrapper">
                            <select 
                                value={selectedDept} 
                                onChange={(e) => setSelectedDept(e.target.value)}
                            >
                                <option value="All">All Departments</option>
                                {departments.map(dept => (
                                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="loading-state">
                        <div className="loader"></div>
                        <p>Scanning Campus Venues...</p>
                    </div>
                ) : (
                    <div className="venues-grid">
                        {filteredHalls.length > 0 ? (
                            filteredHalls.map(venue => (
                                <div 
                                    key={venue.id} 
                                    className="venue-availability-card"
                                    onClick={() => navigate(`/hall/${venue.id}`)}
                                >
                                    <div className="card-top">
                                        <span className="type-badge">{venue.type || 'VENUE'}</span>
                                        <span className="status-badge">FREE NOW</span>
                                    </div>
                                    <h3>{venue.name}</h3>
                                    <div className="venue-details">
                                        <div className="detail-item">
                                            <FaMapMarkerAlt />
                                            <span>{departments.find(d => d.id === venue.departmentId)?.name || 'General'}</span>
                                        </div>
                                        <div className="detail-item availability-info">
                                            <FaClock />
                                            <span>
                                                {venue.availableUntil === 'End of day' 
                                                    ? 'Available Rest of Day' 
                                                    : `Free until ${venue.availableUntil}`
                                                }
                                            </span>
                                        </div>
                                    </div>
                                    <div className="card-footer">
                                        <span>View Details</span>
                                        <FaChevronRight />
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="empty-state">
                                <FaSearch size={40} />
                                <p>No available venues found matching your criteria.</p>
                                <button onClick={() => { setSelectedCategory('All'); setSelectedDept('All'); }}>
                                    Reset Filters
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
