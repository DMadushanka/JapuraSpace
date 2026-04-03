import React, { useState, useEffect } from 'react';
import { timetableService, hallService, courseService, miscService } from '../services/firestore';
import { authService } from '../services/auth';
import { useNavigate } from 'react-router-dom';
import { FaFilter, FaCheckCircle, FaExclamationTriangle, FaCalendarAlt, FaDownload, FaMapMarkerAlt, FaSpinner, FaSearch, FaSave } from 'react-icons/fa';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import logo from '../assets/logo.png';
import '../styles/UserTimetable.css';

const UserTimetable = () => {
    const [allCourses, setAllCourses] = useState([]);
    const [coursesCatalog, setCoursesCatalog] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [selectedDepartment, setSelectedDepartment] = useState('');
    const [filteredCourses, setFilteredCourses] = useState([]);
    const [selectedCourses, setSelectedCourses] = useState([]);
    const [conflicts, setConflicts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [currentTheme, setCurrentTheme] = useState('university');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState('full'); // 'full' or 'codeOnly'
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    const themes = {
        university: {
            name: 'University (Default)',
            primary: '#8B1538', // Maroon
            secondary: '#D4AF37', // Gold
            background: '#1a1a1a',
            text: '#ffffff',
            accent: 'rgba(212, 175, 55, 0.2)',
            cardBg: 'rgba(255, 255, 255, 0.05)',
            border: 'rgba(255, 255, 255, 0.1)'
        },
        ocean: {
            name: 'Ocean Blue',
            primary: '#006994',
            secondary: '#48D1CC',
            background: '#0f172a',
            text: '#e2e8f0',
            accent: 'rgba(72, 209, 204, 0.2)',
            cardBg: 'rgba(255, 255, 255, 0.05)',
            border: 'rgba(255, 255, 255, 0.1)'
        },
        forest: {
            name: 'Forest Green',
            primary: '#2d6a4f',
            secondary: '#95d5b2',
            background: '#1b4332',
            text: '#e2e8f0',
            accent: 'rgba(149, 213, 178, 0.2)',
            cardBg: 'rgba(255, 255, 255, 0.05)',
            border: 'rgba(255, 255, 255, 0.1)'
        },
        sunset: {
            name: 'Sunset',
            primary: '#c0392b',
            secondary: '#e67e22',
            background: '#2c3e50',
            text: '#ecf0f1',
            accent: 'rgba(230, 126, 34, 0.2)',
            cardBg: 'rgba(255, 255, 255, 0.05)',
            border: 'rgba(255, 255, 255, 0.1)'
        },
        dark: {
            name: 'Dark Mode',
            primary: '#2d3436',
            secondary: '#dfe6e9',
            background: '#000000',
            text: '#ffffff',
            accent: 'rgba(223, 230, 233, 0.2)',
            cardBg: 'rgba(255, 255, 255, 0.1)',
            border: 'rgba(255, 255, 255, 0.2)'
        }
    };

    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    // Grid Constants for Minute-Accurate Timetable
    const START_HOUR = 8;
    const END_HOUR = 21;
    const HOUR_HEIGHT = 60; // 1px per minute
    const DAY_START_MINUTES = START_HOUR * 60;

    // Helper to convert HH:MM to minutes
    const timeToMinutes = (timeStr) => {
        if (!timeStr) return 0;
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + (minutes || 0);
    };

    const timeSlots = [];
    for (let h = START_HOUR; h <= END_HOUR; h++) {
        timeSlots.push(`${h.toString().padStart(2, '0')}:00`);
    }

    useEffect(() => {
        const unsubscribe = authService.onAuthStateChanged((u) => {
            if (u) {
                setUser(u);
                loadAllCourses(u);
            } else {
                // Not authenticated
                navigate('/login');
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        let filtered = coursesCatalog;

        if (selectedDepartment) {
            // Filter catalog by department
            filtered = filtered.filter(course => course.faculty === selectedDepartment);
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(course =>
                (course.name && course.name.toLowerCase().includes(query)) ||
                (course.code && course.code.toLowerCase().includes(query))
            );
        }

        setFilteredCourses(filtered);
    }, [selectedDepartment, searchQuery, coursesCatalog]);

    useEffect(() => {
        detectConflicts();
    }, [selectedCourses]);

    const loadAllCourses = async (currentUser) => {
        setLoading(true);
        try {
            const [hallsData, coursesData, deptsData] = await Promise.all([
                hallService.getAllHalls(),
                courseService.getAllCourses(),
                miscService.getDepartments()
            ]);

            setCoursesCatalog(coursesData);

            let allEntries = [];
            for (const hall of hallsData) {
                const entries = await timetableService.getTimetableForHall(hall.id);
                allEntries = [...allEntries, ...entries.map(e => ({
                    ...e,
                    hallName: hall.name,
                    hallLat: hall.latitude,
                    hallLng: hall.longitude,
                    hallLocation: hall.location
                }))];
            }

            setAllCourses(allEntries);

            // Fetch saved courses for the user
            if (currentUser) {
                const savedIds = await timetableService.getUserTimetable(currentUser.uid);
                if (savedIds && savedIds.length > 0) {
                    const saved = coursesData.filter(c => savedIds.includes(c.id));
                    setSelectedCourses(saved);
                }
            }

            // Use master list of departments
            setDepartments(deptsData.map(d => d.name).sort());
        } catch (error) {
            console.error('Error loading courses:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveTimetable = async () => {
        if (!user) return;
        
        setIsSaving(true);
        try {
            const courseIds = selectedCourses.map(c => c.id);
            await timetableService.saveUserTimetable(user.uid, courseIds);
            alert('Timetable saved successfully!');
        } catch (error) {
            console.error('Error saving timetable:', error);
            alert('Failed to save timetable. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const detectConflicts = () => {
        const conflictList = [];
        const displayedEntries = getDisplayedEntries();

        for (let i = 0; i < displayedEntries.length; i++) {
            for (let j = i + 1; j < displayedEntries.length; j++) {
                const entry1 = displayedEntries[i];
                const entry2 = displayedEntries[j];

                if (entry1.dayOfWeek === entry2.dayOfWeek) {
                    const start1 = entry1.startTime;
                    const end1 = entry1.endTime;
                    const start2 = entry2.startTime;
                    const end2 = entry2.endTime;

                    // Check for time overlap
                    if ((start1 < end2 && end1 > start2)) {
                        conflictList.push({
                            course1: entry1.courseName,
                            course2: entry2.courseName,
                            day: entry1.dayOfWeek,
                            time: `${start1}-${end1} overlaps ${start2}-${end2}`
                        });
                    }
                }
            }
        }

        setConflicts(conflictList);
    };

    const getDisplayedEntries = () => {
        // Find all entries in 'allCourses' (timetable entries) that belong to selected courses
        return allCourses.filter(entry => {
            return selectedCourses.some(course => 
                entry.courseName === course.name || 
                entry.courseName === course.code || 
                entry.courseName === `${course.code} - ${course.name}` ||
                (entry.courseId && entry.courseId === course.id)
            );
        });
    };

    const toggleCourseSelection = (course) => {
        const isSelected = selectedCourses.some(c => c.id === course.id);

        if (isSelected) {
            setSelectedCourses(selectedCourses.filter(c => c.id !== course.id));
        } else {
            setSelectedCourses([...selectedCourses, course]);
        }
    };

    const isCourseSelected = (courseId) => {
        return selectedCourses.some(c => c.id === courseId);
    };

    const getCourseDetails = (course) => {
        if (!course) return null;
        let details = { code: '', name: course.courseName };
        const catalogMatch = coursesCatalog.find(c => c.name === course.courseName || c.code === course.courseName || `${c.code} - ${c.name}` === course.courseName);
        if (catalogMatch) {
            details.code = catalogMatch.code;
            details.name = catalogMatch.name;
        } else if (course.courseName.includes(' - ')) {
            const parts = course.courseName.split(' - ');
            details.code = parts[0].trim();
            details.name = parts.slice(1).join(' - ').trim();
        } else {
            details.name = course.courseName;
            details.code = course.moduleCode || course.courseName.split(' ')[0];
        }
        return details;
    };

    const hasConflict = (targetCourse) => {
        return conflicts.some(c =>
            (c.course1 === targetCourse.courseName || c.course2 === targetCourse.courseName) &&
            c.day === targetCourse.dayOfWeek
        );
    };

    const hasConflictInSlot = (day, time) => {
        const displayed = getDisplayedEntries();
        const entriesInSlot = displayed.filter(entry => {
            if (entry.dayOfWeek !== day) return false;
            return time >= entry.startTime && time < entry.endTime;
        });
        return entriesInSlot.length > 1;
    };

    const openGoogleMaps = (hallName, lat, lng) => {
        let mapsUrl;
        if (lat && lng) {
            mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
        } else {
            // Fallback to text search if no coordinates
            const query = encodeURIComponent(`${hallName} University of Sri Jayewardenepura`);
            mapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
        }
        window.open(mapsUrl, '_blank');
    };

    const downloadTimetableAsPDF = async () => {
        if (selectedCourses.length === 0) {
            alert('Please select at least one course before downloading');
            return;
        }

        setIsGeneratingPDF(true);

        // Create a temporary container for full-width capture
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'fixed';
        tempContainer.style.top = '-10000px';
        tempContainer.style.left = '0';
        tempContainer.style.zIndex = '-1000';
        tempContainer.style.width = 'auto';
        tempContainer.style.height = 'auto';
        tempContainer.style.overflow = 'visible';
        document.body.appendChild(tempContainer);

        try {
            // Get the original timetable element
            const originalElement = document.getElementById('timetable-for-pdf');
            if (!originalElement) {
                alert('Timetable not found');
                return;
            }

            // Clone the node to manipulate for capture without affecting UI
            const clone = originalElement.cloneNode(true);

            // Force styles on clone wrapper
            clone.style.width = 'fit-content';
            clone.style.minWidth = '0'; // Remove min-width to allow compact capture if needed

            // Find the scroll container inside and force it to be fully visible
            const scrollContainer = clone.querySelector('.timetable-scroll-wrapper');
            if (scrollContainer) {
                scrollContainer.style.overflow = 'visible';
                scrollContainer.style.width = 'auto';
                scrollContainer.style.height = 'auto';
                scrollContainer.classList.remove('timetable-scroll-wrapper');
            }

            tempContainer.appendChild(clone);

            // Capture the clone
            const canvas = await html2canvas(clone, {
                scale: 1.5, // Reduced from 2 to 1.5 for smaller file size
                backgroundColor: themes[currentTheme].background,
                logging: false,
                useCORS: true,
                windowWidth: clone.scrollWidth,
                windowHeight: clone.scrollHeight
            });

            // Create PDF
            const pdf = new jsPDF('landscape', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            // Add title
            pdf.setFontSize(16);
            pdf.setTextColor(themes[currentTheme].secondary);
            const title = selectedDepartment ? `Timetable - ${selectedDepartment}` : 'My Timetable - University of Sri Jayewardenepura';
            pdf.text(title, pageWidth / 2, 12, { align: 'center' });

            // Calculate image dimensions to fit on one page
            // Use JPEG with 0.8 quality for significant file size reduction
            const imgData = canvas.toDataURL('image/jpeg', 0.8);
            const marginTop = 20;
            const marginSide = 10;
            const availableWidth = pageWidth - (marginSide * 2);
            const availableHeight = pageHeight - marginTop - 15;

            const canvasRatio = canvas.height / canvas.width;
            let imgWidth = availableWidth;
            let imgHeight = availableWidth * canvasRatio;

            // If image is too tall, scale based on height instead
            if (imgHeight > availableHeight) {
                imgHeight = availableHeight;
                imgWidth = imgHeight / canvasRatio;
            }

            const xOffset = (pageWidth - imgWidth) / 2;
            const yOffset = marginTop;

            // Add the timetable image
            pdf.addImage(imgData, 'JPEG', xOffset, yOffset, imgWidth, imgHeight);

            // Now add clickable link overlays using the CLONE for coordinates
            const lectureBlocks = clone.querySelectorAll('.pdf-lecture-block');
            const tableRect = clone.getBoundingClientRect(); // Dimensions of the captured full table

            lectureBlocks.forEach(block => {
                const courseId = block.getAttribute('data-course-id');
                const course = selectedCourses.find(c => c.id === courseId);

                if (course) {
                    // Calculate cell position relative to table (using clone's rects)
                    const cellRect = block.getBoundingClientRect();
                    const relativeX = cellRect.left - tableRect.left;
                    const relativeY = cellRect.top - tableRect.top;

                    // Convert to PDF coordinates
                    const pdfX = xOffset + (relativeX / tableRect.width) * imgWidth;
                    const pdfY = yOffset + (relativeY / tableRect.height) * imgHeight;
                    const pdfWidth = (cellRect.width / tableRect.width) * imgWidth;
                    const pdfHeight = (cellRect.height / tableRect.height) * imgHeight;

                    // Add clickable link
                    let mapsUrl;
                    if (course.hallLat && course.hallLng) {
                        mapsUrl = `https://www.google.com/maps/search/?api=1&query=${course.hallLat},${course.hallLng}`;
                    } else {
                        const query = encodeURIComponent(`${course.hallName} University of Sri Jayewardenepura`);
                        mapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
                    }
                    pdf.link(pdfX, pdfY, pdfWidth, pdfHeight, { url: mapsUrl });
                }
            });

            // Add footer instruction
            pdf.setFontSize(9);
            pdf.setTextColor(150, 150, 150);
            pdf.text('Click on course cells to view hall location on Google Maps', pageWidth / 2, pageHeight - 5, { align: 'center' });

            // Save PDF
            pdf.save(`my-timetable-${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error('Detailed PDF error:', error);
            alert(`Failed to generate PDF: ${error.message}`);
        } finally {
            // Clean up temporary container
            if (document.body.contains(tempContainer)) {
                document.body.removeChild(tempContainer);
            }
            setIsGeneratingPDF(false);
        }
    };

    return (
        <div style={{ ...styles.container, background: themes[currentTheme].background, color: themes[currentTheme].text }}>
            {/* Header with Logo */}
            <header style={styles.header} className="timetable-header-content">
                <div style={styles.logoSection} className="timetable-header-content">
                    <img src={logo} alt="University Logo" style={styles.logo} />
                    <div>
                        <h1 style={{ ...styles.title, color: themes[currentTheme].secondary }}>
                            {selectedDepartment ? `Timetable - ${selectedDepartment}` : 'My Timetable'}
                        </h1>
                        <p style={{ ...styles.subtitle, color: themes[currentTheme].text }}>
                            {selectedDepartment ? 'Department Schedule' : 'Create your personalized class schedule'}
                        </p>
                    </div>
                </div>
            </header>

            <div className="timetable-main-content">
                {/* Left Panel - Course Selection */}
                <aside style={styles.leftPanel} className="timetable-left-panel" role="complementary" aria-label="Course selection panel">
                    <div style={styles.filterSection}>
                        <h2 style={{ ...styles.sectionTitle, color: themes[currentTheme].secondary }}>
                            <FaSearch aria-hidden="true" /> Search Courses
                        </h2>
                        <div style={{ position: 'relative' }}>
                            <FaSearch style={{
                                position: 'absolute',
                                left: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: themes[currentTheme].text,
                                opacity: 0.5
                            }} />
                            <input
                                type="text"
                                placeholder="Search by name or code..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    ...styles.select,
                                    borderColor: themes[currentTheme].secondary,
                                    backgroundColor: themes[currentTheme].cardBg,
                                    color: themes[currentTheme].text,
                                    paddingLeft: '36px'
                                }}
                                aria-label="Search courses"
                            />
                        </div>
                    </div>

                    <div style={styles.filterSection}>
                        <h2 style={styles.sectionTitle}>
                            <FaFilter aria-hidden="true" /> Filter Courses
                        </h2>
                        <label htmlFor="department-filter" style={styles.label}>Select Department</label>
                        <select
                            id="department-filter"
                            value={selectedDepartment}
                            onChange={(e) => setSelectedDepartment(e.target.value)}
                            style={styles.select}
                            aria-label="Filter courses by department"
                        >
                            <option value="">All Departments</option>
                            {departments.map(dept => (
                                <option key={dept} value={dept}>{dept}</option>
                            ))}
                        </select>
                    </div>

                    <div style={styles.filterSection}>
                        <h2 style={{ ...styles.sectionTitle, color: themes[currentTheme].secondary }}>
                            <FaCheckCircle aria-hidden="true" /> Timetable View
                        </h2>
                        <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                            <label style={{ ...styles.label, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="radio"
                                    name="viewMode"
                                    value="full"
                                    checked={viewMode === 'full'}
                                    onChange={(e) => setViewMode(e.target.value)}
                                    style={{ accentColor: themes[currentTheme].secondary }}
                                />
                                Full Details (Code + Name)
                            </label>
                            <label style={{ ...styles.label, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="radio"
                                    name="viewMode"
                                    value="codeOnly"
                                    checked={viewMode === 'codeOnly'}
                                    onChange={(e) => setViewMode(e.target.value)}
                                    style={{ accentColor: themes[currentTheme].secondary }}
                                />
                                Course Code Only
                            </label>
                        </div>
                    </div>

                    <div style={styles.filterSection}>
                        <h2 style={{ ...styles.sectionTitle, color: themes[currentTheme].secondary }}>
                            <FaCheckCircle aria-hidden="true" /> Select Theme
                        </h2>
                        <label htmlFor="theme-select" style={styles.label}>Choose Look</label>
                        <select
                            id="theme-select"
                            value={currentTheme}
                            onChange={(e) => setCurrentTheme(e.target.value)}
                            style={{
                                ...styles.select,
                                borderColor: themes[currentTheme].secondary,
                                backgroundColor: themes[currentTheme].cardBg,
                                color: themes[currentTheme].text
                            }}
                            aria-label="Select color theme"
                        >
                            {Object.entries(themes).map(([key, theme]) => (
                                <option key={key} value={key} style={{ background: '#333', color: '#fff' }}>{theme.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Selected Courses Summary */}
                    <div style={{ ...styles.summaryBox, background: themes[currentTheme].accent, borderColor: themes[currentTheme].secondary }}>
                        <h3 style={{ ...styles.summaryTitle, color: themes[currentTheme].secondary }}>Selected Courses</h3>
                        <p style={{ ...styles.summaryCount, color: themes[currentTheme].text }}>{selectedCourses.length} courses selected</p>
                    </div>

                    {/* Conflict Warnings */}
                    {conflicts.length > 0 && (
                        <div style={styles.conflictBox} role="alert" aria-live="polite">
                            <FaExclamationTriangle style={styles.conflictIcon} aria-hidden="true" />
                            <strong style={styles.conflictTitle}>Time Conflicts Detected!</strong>
                            <ul style={styles.conflictList}>
                                {conflicts.map((conflict, idx) => (
                                    <li key={idx}>
                                        {conflict.course1} and {conflict.course2} on {conflict.day}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Available Courses */}
                    <div style={styles.courseListSection}>
                        <h2 style={styles.sectionTitle}>Available Courses</h2>
                        {loading ? (
                            <p style={styles.loadingText}>Loading courses...</p>
                        ) : filteredCourses.length === 0 ? (
                            <p style={styles.emptyText}>No courses found for this department</p>
                        ) : (
                            <div style={styles.courseList}>
                                {filteredCourses.map(course => (
                                    <div
                                        key={course.id}
                                        style={{
                                            ...styles.courseCard,
                                            background: themes[currentTheme].cardBg,
                                            borderColor: themes[currentTheme].border,
                                            ...(isCourseSelected(course.id) ? {
                                                ...styles.courseCardSelected,
                                                background: themes[currentTheme].accent,
                                                borderColor: themes[currentTheme].secondary,
                                                boxShadow: `0 4px 12px ${themes[currentTheme].accent}`
                                            } : {})
                                        }}
                                        onClick={() => toggleCourseSelection(course)}
                                        role="button"
                                        tabIndex={0}
                                        aria-pressed={isCourseSelected(course.id)}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                toggleCourseSelection(course);
                                            }
                                        }}
                                    >
                                        <div style={styles.courseCardHeader}>
                                            {isCourseSelected(course.id) && (
                                                <FaCheckCircle style={{ ...styles.checkIcon, color: themes[currentTheme].secondary }} aria-label="Selected" />
                                            )}
                                            <h3 style={{ ...styles.courseName, color: themes[currentTheme].text }}>{course.code} - {course.name}</h3>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </aside>

                {/* Right Panel - Timetable Grid */}
                <main style={styles.rightPanel} className="timetable-right-panel" role="main" aria-label="Weekly timetable">
                    <div style={styles.timetableHeader}>
                        <h2 style={styles.sectionTitle}>
                            <FaCalendarAlt aria-hidden="true" /> Weekly Timetable
                        </h2>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            {selectedCourses.length > 0 && (
                                <button
                                    onClick={handleSaveTimetable}
                                    style={{
                                        ...styles.saveButton,
                                        background: `linear-gradient(135deg, ${themes[currentTheme].primary} 0%, #000 100%)`,
                                        ...(isSaving ? styles.buttonDisabled : {})
                                    }}
                                    disabled={isSaving}
                                >
                                    {isSaving ? <FaSpinner className="spin" /> : <FaSave />} Save Timetable
                                </button>
                            )}
                            {selectedCourses.length > 0 && (
                                <button
                                    onClick={downloadTimetableAsPDF}
                                    style={{
                                        ...styles.downloadButton,
                                        background: `linear-gradient(135deg, ${themes[currentTheme].secondary} 0%, ${themes[currentTheme].primary} 100%)`,
                                        ...(isGeneratingPDF ? styles.downloadButtonDisabled : {})
                                    }}
                                    disabled={isGeneratingPDF}
                                    aria-label={isGeneratingPDF ? "Generating PDF, please wait" : "Download timetable as PDF"}
                                >
                                {isGeneratingPDF ? (
                                    <>
                                        <style>
                                            {`
                                                @keyframes spin {
                                                    0% { transform: rotate(0deg); }
                                                    100% { transform: rotate(360deg); }
                                                }
                                            `}
                                        </style>
                                        <FaSpinner style={{ animation: 'spin 1s linear infinite' }} aria-hidden="true" /> Generating PDF...
                                    </>
                                ) : (
                                    <>
                                        <FaDownload aria-hidden="true" /> Download as PDF
                                    </>
                                )}
                            </button>
                        )}
                        </div>
                    </div>

                    {/* Wrap everything in timetable-for-pdf so both table and legend are captured */}
                    <div id="timetable-for-pdf">
                        <div className="timetable-scroll-wrapper">
                            <div style={styles.timetable}>
                                {/* Time Gutter */}
                                <div style={styles.timeGutter}>
                                    {timeSlots.map(time => (
                                        <div key={time} style={styles.timeLabel}>{time}</div>
                                    ))}
                                </div>

                                {/* Days Grid */}
                                <div style={styles.daysContainer}>
                                    {daysOfWeek.map(day => {
                                        const displayedEntries = getDisplayedEntries();
                                        const dayEntries = displayedEntries.filter(e => e.dayOfWeek === day);

                                        const colWidth = viewMode === 'codeOnly' ? '100px' : '140px';

                                        return (
                                            <div key={day} style={{ ...styles.dayColumn, width: colWidth }}>
                                                <div style={styles.dayHeader}>{day}</div>

                                                {/* Grid Background Lines */}
                                                <div style={styles.gridBackground}>
                                                    {timeSlots.map(time => (
                                                        <div key={time} style={styles.gridHourLine}></div>
                                                    ))}
                                                </div>

                                                {/* Absolute Positioned Lectures */}
                                                {dayEntries.map((entry, idx) => {
                                                    const startMin = timeToMinutes(entry.startTime);
                                                    const endMin = timeToMinutes(entry.endTime);
                                                    const top = startMin - DAY_START_MINUTES;
                                                    const height = endMin - startMin;

                                                    const isConflicting = hasConflict(entry);
                                                    const details = getCourseDetails(entry);

                                                    return (
                                                        <div
                                                            key={`${entry.id}-${idx}`}
                                                            className="pdf-lecture-block"
                                                            data-course-id={entry.id}
                                                            style={{
                                                                ...styles.lectureBlock,
                                                                top: `${top + 40}px`, // 40px offset for day header
                                                                height: `${height}px`,
                                                                background: `linear-gradient(135deg, ${themes[currentTheme].primary} 0%, ${themes[currentTheme].background} 100%)`,
                                                                borderColor: isConflicting ? '#ff6b6b' : themes[currentTheme].secondary,
                                                                borderWidth: isConflicting ? '2px' : '1px'
                                                            }}
                                                        >
                                                            <div style={styles.slotCourseName}>
                                                                {viewMode === 'full'
                                                                    ? (
                                                                        <>
                                                                            {details.code && <span style={{ display: 'block', fontSize: '0.7em', opacity: 0.8 }}>{details.code}</span>}
                                                                            {details.name}
                                                                        </>
                                                                    )
                                                                    : (details.code || details.name)}
                                                            </div>
                                                            <div style={styles.slotCourseHall}>
                                                                <span style={{ flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    {entry.hallName}
                                                                </span>
                                                                <FaMapMarkerAlt
                                                                    style={styles.locationIcon}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        openGoogleMaps(entry.hallName, entry.hallLat, entry.hallLng);
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Legend for Code Only View */}
                        {viewMode === 'codeOnly' && selectedCourses.length > 0 && (
                            <div style={{
                                marginTop: '20px',
                                padding: '16px',
                                background: themes[currentTheme].cardBg,
                                border: `1px solid ${themes[currentTheme].border}`,
                                borderRadius: '8px'
                            }}>
                                <h3 style={{
                                    fontSize: '1.1rem',
                                    color: themes[currentTheme].secondary,
                                    marginTop: 0,
                                    marginBottom: '12px',
                                    borderBottom: `1px solid ${themes[currentTheme].border}`,
                                    paddingBottom: '8px'
                                }}>Course Legend</h3>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                                    gap: '12px'
                                }}>
                                    {Object.values(
                                        selectedCourses.reduce((acc, course) => {
                                            // Deduplicate by course ID/Name to show unique legend items
                                            const details = getCourseDetails(course);

                                            const key = details.code || details.name;
                                            if (!acc[key]) {
                                                acc[key] = details;
                                            }
                                            return acc;
                                        }, {})
                                    ).map((details, index) => (
                                        <div key={index} style={{ display: 'flex', gap: '8px', fontSize: '0.9rem' }}>
                                            <strong style={{ color: themes[currentTheme].secondary, minWidth: '80px' }}>
                                                {details.code || 'No Code'}:
                                            </strong>
                                            <span style={{ color: themes[currentTheme].text }}>
                                                {details.name}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {selectedCourses.length === 0 && (
                        <div style={styles.emptyTimetable}>
                            <FaCalendarAlt size={64} style={styles.emptyIcon} aria-hidden="true" />
                            <p style={styles.emptyTimetableText}>Select courses from the left panel to build your timetable</p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

const styles = {
    container: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg, rgba(139, 21, 56, 0.05) 0%, rgba(0, 0, 0, 0.9) 100%)',
        padding: '12px',
        color: '#ffffff'
    },
    header: {
        marginBottom: '32px',
        paddingBottom: '24px',
        borderBottom: '2px solid rgba(212, 175, 55, 0.3)'
    },
    logoSection: {
        // Handled by CSS
    },
    logo: {
        height: '80px',
        width: 'auto',
        objectFit: 'contain'
    },
    title: {
        fontSize: '2.5rem',
        fontWeight: '700',
        color: '#D4AF37',
        margin: '0 0 8px 0',
        letterSpacing: '-0.5px'
    },
    subtitle: {
        fontSize: '1.1rem',
        color: '#b8b8b8',
        margin: 0
    },
    mainContent: {
        // Handled by CSS grid
    },
    leftPanel: {
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        // Size and scrolling handled by CSS
    },
    rightPanel: {
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '12px', /* Matched with left panel for consistency */
        border: '1px solid rgba(255, 255, 255, 0.1)',
        // Padding and minHeight handled/overridden by CSS where needed
    },
    filterSection: {
        marginBottom: '24px'
    },
    sectionTitle: {
        fontSize: '1.4rem',
        fontWeight: '600',
        marginBottom: '16px',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
    },
    label: {
        display: 'block',
        marginBottom: '8px',
        fontSize: '1rem',
        color: '#e0e0e0',
        fontWeight: '500'
    },
    select: {
        width: '100%',
        padding: '12px 16px',
        borderRadius: '10px',
        border: '2px solid rgba(212, 175, 55, 0.4)',
        background: 'rgba(255, 255, 255, 0.95)',
        color: '#1a1a1a',
        fontSize: '1rem',
        outline: 'none',
        cursor: 'pointer',
        transition: 'all 0.3s ease'
    },
    summaryBox: {
        background: 'rgba(212, 175, 55, 0.15)',
        border: '2px solid #D4AF37',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '24px'
    },
    summaryTitle: {
        fontSize: '1.1rem',
        fontWeight: '600',
        color: '#D4AF37',
        margin: '0 0 8px 0'
    },
    summaryCount: {
        fontSize: '1.5rem',
        fontWeight: '700',
        color: '#ffffff',
        margin: 0
    },
    conflictBox: {
        background: 'rgba(255, 107, 107, 0.2)',
        border: '2px solid #ff6b6b',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '24px'
    },
    conflictIcon: {
        color: '#ff6b6b',
        marginRight: '8px',
        fontSize: '1.2rem'
    },
    conflictTitle: {
        color: '#ff6b6b',
        fontSize: '1.1rem',
        display: 'block',
        marginBottom: '12px'
    },
    conflictList: {
        color: '#ffcccc',
        fontSize: '0.95rem',
        margin: '8px 0 0 0',
        paddingLeft: '24px',
        lineHeight: '1.8'
    },
    courseListSection: {
        marginTop: '24px'
    },
    courseList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
    },
    courseCard: {
        background: 'rgba(255, 255, 255, 0.08)',
        border: '2px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '8px',
        padding: '10px 12px',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        outline: 'none'
    },
    courseCardSelected: {
        background: 'rgba(212, 175, 55, 0.2)',
        border: '2px solid #D4AF37',
        boxShadow: '0 4px 12px rgba(212, 175, 55, 0.3)'
    },
    courseCardHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '12px'
    },
    checkIcon: {
        color: '#51cf66',
        fontSize: '1.3rem'
    },
    courseName: {
        fontSize: '0.95rem',
        fontWeight: '600',
        color: '#ffffff',
        margin: 0,
        lineHeight: '1.4'
    },
    courseDetail: {
        fontSize: '0.95rem',
        color: '#d0d0d0',
        margin: '4px 0',
        lineHeight: '1.6'
    },
    loadingText: {
        textAlign: 'center',
        color: '#b8b8b8',
        fontSize: '1.1rem',
        padding: '32px'
    },
    emptyText: {
        textAlign: 'center',
        color: '#888',
        fontSize: '1rem',
        padding: '24px'
    },
    timetableHeader: {
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
    },
    downloadButton: {
        background: 'linear-gradient(135deg, #D4AF37 0%, #8B1538 100%)',
        color: '#ffffff',
        border: 'none',
        padding: '12px 24px',
        borderRadius: '10px',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        transition: 'all 0.3s ease',
        boxShadow: '0 4px 12px rgba(212, 175, 55, 0.3)'
    },
    saveButton: {
        background: 'linear-gradient(135deg, #8B1538 0%, #000 100%)',
        color: '#ffffff',
        border: '1px solid rgba(212, 175, 55, 0.3)',
        padding: '12px 24px',
        borderRadius: '10px',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        transition: 'all 0.3s ease',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
    },
    buttonDisabled: {
        opacity: 0.6,
        cursor: 'not-allowed',
        transform: 'none'
    },
    timetableWrapper: {
        // Handled by CSS
    },
    timetable: {
        display: 'flex',
        width: 'fit-content', // Shrink to fit columns
        minWidth: '0',
        background: 'rgba(255, 255, 255, 0.02)',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        position: 'relative',
        minHeight: '820px'
    },
    timeGutter: {
        width: '50px', // Slightly narrowergutter
        flexShrink: 0,
        borderRight: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'rgba(255, 255, 255, 0.03)',
        paddingTop: '40px',
        display: 'flex',
        flexDirection: 'column'
    },
    timeLabel: {
        height: '60px',
        fontSize: '0.7rem', // Smaller label
        color: '#888',
        textAlign: 'center',
        paddingTop: '4px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        boxSizing: 'border-box'
    },
    daysContainer: {
        display: 'flex',
        flexGrow: 1,
        minHeight: '820px'
    },
    dayColumn: {
        flex: '0 0 auto', // Don't force equal stretch
        position: 'relative',
        borderRight: '1px solid rgba(255, 255, 255, 0.1)',
        minHeight: '820px'
    },
    dayHeader: {
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(212, 175, 55, 0.15)',
        color: '#D4AF37',
        fontWeight: '700',
        fontSize: '0.9rem',
        borderBottom: '1px solid rgba(212, 175, 55, 0.3)'
    },
    gridBackground: {
        position: 'absolute',
        top: '40px',
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none'
    },
    gridHourLine: {
        height: '60px', // Matches HOUR_HEIGHT
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
    },
    lectureBlock: {
        position: 'absolute',
        left: '2px', // Tighter margins
        right: '2px',
        borderRadius: '4px',
        padding: '3px 5px', // Minimal padding
        fontSize: '0.75rem', // Even smaller font
        color: '#ffffff',
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.2)',
        zIndex: 2,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        transition: 'transform 0.2s ease'
    },
    slotCourseName: {
        fontSize: '0.75rem', // Slightly smaller for better fit
        fontWeight: '700',
        color: '#ffffff',
        marginBottom: '2px',
        lineHeight: '1.2',
        wordBreak: 'break-word',
        whiteSpace: 'normal',
        overflow: 'visible'
    },
    slotCourseHall: {
        fontSize: '0.7rem',
        color: 'rgba(255, 255, 255, 0.8)',
        fontWeight: '500',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        marginTop: 'auto'
    },
    locationIcon: {
        fontSize: '0.75rem',
        color: '#ff6b6b',
        cursor: 'pointer'
    },
    emptyTimetable: {
        textAlign: 'center',
        padding: '64px 24px',
        color: '#888'
    },
    emptyIcon: {
        color: 'rgba(212, 175, 55, 0.3)',
        marginBottom: '16px'
    },
    emptyTimetableText: {
        fontSize: '1.2rem',
        color: '#b8b8b8',
        margin: 0
    }
};

export default UserTimetable;
