import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
    FaArrowLeft, FaClock, FaMapMarkerAlt, FaUser, 
    FaExclamationCircle, FaCalendarAlt, FaInfoCircle
} from 'react-icons/fa';
import { timetableService, hallService } from '../services/firestore';
import '../styles/LectureDetails.css';

export default function LectureDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    
    // Get additional info from location state if available (e.g. date, cancelled status)
    const { date, status, reason } = location.state || {};

    const [loading, setLoading] = useState(true);
    const [lecture, setLecture] = useState(null);

    useEffect(() => {
        fetchLectureDetails();
    }, [id]);

    const fetchLectureDetails = async () => {
        if (!id) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const allEntries = await timetableService.getAllTimetableEntries();
            const entry = allEntries.find(e => e.id === id);

            if (entry) {
                const halls = await hallService.getAllHalls();
                const hall = halls.find(h => h.id === entry.hallId);
                setLecture({
                    ...entry,
                    hallName: hall ? hall.name : 'Unknown Hall',
                    hallLocation: hall?.location || ''
                });
            }
        } catch (error) {
            console.error('Error fetching lecture details:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="loading-state">
                <div className="loader"></div>
                <p>Loading lecture details...</p>
            </div>
        );
    }

    if (!lecture) {
        return (
            <div className="error-state">
                <FaExclamationCircle size={50} />
                <h2>Lecture Not Found</h2>
                <p>The lecture you are looking for does not exist or has been removed.</p>
                <button onClick={() => navigate(-1)}>Go Back</button>
            </div>
        );
    }

    const isCancelled = status === 'cancelled' || (lecture.cancelledDates && lecture.cancelledDates.some(c => c.date === date));
    const cancelReason = reason || (lecture.cancelledDates && lecture.cancelledDates.find(c => c.date === date)?.reason);

    return (
        <div className="lecture-details-page">
            <header className="page-header-premium">
                <button onClick={() => navigate(-1)} className="back-button">
                    <FaArrowLeft />
                </button>
                <div className="header-content">
                    <h1>Lecture Insights</h1>
                    <p>Details and status of the session</p>
                </div>
            </header>

            <div className="details-container">
                {isCancelled && (
                    <div className="cancelled-card">
                        <div className="cancelled-header">
                            <FaExclamationCircle />
                            <h3>SESSION CANCELLED</h3>
                        </div>
                        <div className="cancelled-body">
                            <p className="cancel-date"><FaCalendarAlt /> {date || 'Today'}</p>
                            {cancelReason && (
                                <div className="reason-box">
                                    <label>Reason for cancellation:</label>
                                    <p>{cancelReason}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="main-details-card">
                    <div className="course-banner">
                        <span className="course-code">{lecture.courseCode}</span>
                        <h2>{lecture.courseName}</h2>
                    </div>

                    <div className="info-grid">
                        <div className="info-block">
                            <div className="block-icon">
                                <FaClock />
                            </div>
                            <div className="block-content">
                                <label>Schedule</label>
                                <p className="primary-text">{lecture.startTime} - {lecture.endTime}</p>
                                <p className="secondary-text">{lecture.dayOfWeek}</p>
                            </div>
                        </div>

                        <div className="info-block" onClick={() => navigate(`/hall/${lecture.hallId}`)}>
                            <div className="block-icon">
                                <FaMapMarkerAlt />
                            </div>
                            <div className="block-content">
                                <label>Location</label>
                                <p className="primary-text highlight">{lecture.hallName}</p>
                                {lecture.hallLocation && <p className="secondary-text">{lecture.hallLocation}</p>}
                            </div>
                        </div>

                        <div className="info-block">
                            <div className="block-icon">
                                <FaUser />
                            </div>
                            <div className="block-content">
                                <label>Lecturer</label>
                                <p className="primary-text">{lecture.lecturerName || 'Assigned Staff'}</p>
                            </div>
                        </div>

                        <div className="info-block">
                            <div className="block-icon">
                                <FaInfoCircle />
                            </div>
                            <div className="block-content">
                                <label>Status</label>
                                <p className={`status-text ${isCancelled ? 'status-cancelled' : 'status-active'}`}>
                                    {isCancelled ? 'CANCELLED' : 'ACTIVE'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="action-footer">
                        <button onClick={() => navigate('/my-timetable')} className="timetable-btn">
                            View Full Timetable
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
