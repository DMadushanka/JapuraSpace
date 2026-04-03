import React, { useState, useEffect } from 'react';
import { firestoreService, timetableService, hallService, courseService, miscService } from '../../services/firestore';
import { FaCalendarAlt, FaFileUpload, FaList, FaTrash, FaPlus, FaDownload, FaExclamationTriangle, FaFileDownload, FaSync, FaBook } from 'react-icons/fa';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { useNavigate } from 'react-router-dom';

const TimetableManagement = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('view');
    const [halls, setHalls] = useState([]);
    const [courses, setCourses] = useState([]);
    const [timetable, setTimetable] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Department list state
    const [departments, setDepartments] = useState([]);

    const [manualEntry, setManualEntry] = useState({
        hallId: '',
        dayOfWeek: 'Monday',
        startTime: '',
        endTime: '',
        courseName: '',
        faculty: ''
    });

    const [excelData, setExcelData] = useState([]);
    const [excelFile, setExcelFile] = useState(null);
    const [uploadSummary, setUploadSummary] = useState(null);




    useEffect(() => {
        loadHalls();
        loadCourses();
        loadTimetable();
        loadDepartments();
    }, []);

    const loadDepartments = async () => {
        const data = await miscService.getDepartments();
        setDepartments(data.sort((a, b) => a.name.localeCompare(b.name)));
    };

    const loadHalls = async () => {
        const data = await hallService.getAllHalls();
        setHalls(data);
        if (data.length > 0 && !manualEntry.hallId) {
            setManualEntry(prev => ({ ...prev, hallId: data[0].id }));
        }
    };

    const loadCourses = async () => {
        const data = await courseService.getAllCourses();
        setCourses(data);
    };

    const loadTimetable = async () => {
        setLoading(true);
        let allEntries = [];
        const hallsData = await hallService.getAllHalls();
        for (const hall of hallsData) {
            const entries = await timetableService.getTimetableForHall(hall.id);
            allEntries = [...allEntries, ...entries.map(e => ({ ...e, hallName: hall.name }))];
        }
        setTimetable(allEntries);
        setLoading(false);
    };

    const handleManualSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', text: '' });
        try {
            const hall = halls.find(h => h.id === manualEntry.hallId);
            await timetableService.addTimetableEntry({
                ...manualEntry,
                hallName: hall.name,
                source: 'manual'
            });
            setMessage({ type: 'success', text: 'Timetable entry added successfully!' });
            setManualEntry({ ...manualEntry, courseName: '', startTime: '', endTime: '' });
            loadTimetable();
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);
            setExcelData(data);
            setExcelFile(file);
        };
        reader.readAsBinaryString(file);
    };

    const downloadTemplate = async () => {
        if (departments.length === 0) {
            alert('Warning: No departments found. The Excel template dropdown for Departments will be empty. Please add departments in the Admin Dashboard first.');
        }
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Timetable Template');

        worksheet.columns = [
            { header: 'Hall Name', key: 'hallName', width: 25 },
            { header: 'Day', key: 'day', width: 15 },
            { header: 'Start Time', key: 'startTime', width: 15 },
            { header: 'End Time', key: 'endTime', width: 15 },
            { header: 'Course Name', key: 'courseName', width: 45 },
            { header: 'Department', key: 'department', width: 45 }
        ];

        worksheet.getRow(1).font = { bold: true, size: 12 };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD9D9D9' }
        };

        const classesList = courses
            .map(c => `${c.code} - ${c.name}`)
            .sort((a, b) => a.localeCompare(b));

        const departmentsList = departments
            .map(d => typeof d === 'object' ? d.name : d)
            .sort((a, b) => a.localeCompare(b));

        const hallsList = halls.map(h => h.name).sort((a, b) => a.localeCompare(b));

        const sampleHall = halls.length > 0 ? halls[0].name : 'Select from dropdown';
        const sampleCourse = courses.length > 0 ? `${courses[0].code} - ${courses[0].name}` : 'Select from dropdown';

        worksheet.addRow({
            hallName: sampleHall,
            day: 'Monday',
            startTime: '09:00',
            endTime: '11:00',
            courseName: sampleCourse,
            department: departmentsList.length > 0 ? departmentsList[0] : 'Information & Communication Technology'
        });

        const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

        // Create hidden sheets for validation lists
        const daysSheet = workbook.addWorksheet('Days');
        daysOfWeek.forEach((day, index) => {
            daysSheet.getCell(`A${index + 1}`).value = day;
        });
        daysSheet.state = 'hidden';

        const deptsSheet = workbook.addWorksheet('Departments');
        departmentsList.forEach((dept, index) => {
            deptsSheet.getCell(`A${index + 1}`).value = dept;
        });
        deptsSheet.state = 'hidden';

        if (halls.length > 0) {
            const hallsSheet = workbook.addWorksheet('Halls');
            hallsList.forEach((hallName, index) => {
                hallsSheet.getCell(`A${index + 1}`).value = hallName;
            });
            hallsSheet.state = 'hidden';
        }

        if (courses.length > 0) {
            const coursesSheet = workbook.addWorksheet('Courses');
            classesList.forEach((courseStr, index) => {
                coursesSheet.getCell(`A${index + 1}`).value = courseStr;
            });
            coursesSheet.state = 'hidden';
        }

        for (let row = 2; row <= 101; row++) {
            // Hall Validation
            if (halls.length > 0) {
                worksheet.getCell(`A${row}`).dataValidation = {
                    type: 'list',
                    allowBlank: false,
                    formulae: [`Halls!$A$1:$A$${halls.length}`],
                    showErrorMessage: true,
                    errorStyle: 'error',
                    errorTitle: 'Invalid Hall',
                    error: 'Please select a hall from the dropdown list.'
                };
            }

            // Day Validation
            worksheet.getCell(`B${row}`).dataValidation = {
                type: 'list',
                allowBlank: false,
                formulae: [`Days!$A$1:$A$${daysOfWeek.length}`],
                showErrorMessage: true,
                errorStyle: 'error',
                errorTitle: 'Invalid Day',
                error: 'Please select a day from the dropdown list.'
            };

            // Time Formatting
            worksheet.getCell(`C${row}`).numFmt = 'hh:mm';
            worksheet.getCell(`C${row}`).value = null;

            worksheet.getCell(`D${row}`).numFmt = 'hh:mm';
            worksheet.getCell(`D${row}`).value = null;

            // Course Validation
            if (courses.length > 0) {
                worksheet.getCell(`E${row}`).dataValidation = {
                    type: 'list',
                    allowBlank: false,
                    formulae: [`Courses!$A$1:$A$${courses.length}`],
                    showErrorMessage: true,
                    errorStyle: 'error',
                    errorTitle: 'Invalid Course',
                    error: 'Please select a course from the dropdown list.'
                };
            }

            // Department Validation
            worksheet.getCell(`F${row}`).dataValidation = {
                type: 'list',
                allowBlank: false,
                formulae: [`Departments!$A$1:$A$${departmentsList.length}`],
                showErrorMessage: true,
                errorStyle: 'error',
                errorTitle: 'Invalid Department',
                error: 'Please select a department from the dropdown list.'
            };
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Timetable_Template.xlsx';
        link.click();
        window.URL.revokeObjectURL(url);
    };

    const processExcelUpload = async () => {
        if (!excelData.length) return;
        setLoading(true);
        setUploadSummary(null);

        let success = 0;
        let failed = 0;
        let errors = [];

        // Helper to convert Excel decimal time to HH:mm
        const formatExcelTime = (val) => {
            if (!val) return '';
            // If it's already a string like "09:00", return it
            if (typeof val === 'string') return val;
            // If it's a number (Excel fraction of day)
            if (typeof val === 'number') {
                const totalMinutes = Math.round(val * 24 * 60);
                const hours = Math.floor(totalMinutes / 60);
                const minutes = totalMinutes % 60;
                return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            }
            return String(val);
        };

        for (const row of excelData) {
            try {
                const hallName = row['Hall Name'] || row['Hall'];
                const day = row['Day'];
                const start = formatExcelTime(row['Start Time']);
                const end = formatExcelTime(row['End Time']);
                const courseRaw = row['Course Name'] || row['Course'];
                const faculty = row['Department'] || row['Faculty']; // Accept 'Department' or 'Faculty'

                if (!hallName || !day || !start || !end) {
                    throw new Error('Missing required fields');
                }

                // If course was selected from dropdown (Code - Name), extract the code or use name
                // For simplicity, we'll store the whole string or just the name if user wants
                // But usually we want just the name or code. Let's keep it flexible.
                // If the user selected "ANT 1213 - Intro...", we might want to store "ANT 1213" or the whole thing.
                // The current app displays 'courseName'. Storing the full string is fine for display.
                // Or if we want to reverse lookup the course ID, we could.
                // For now, let's clean it up if it matches the pattern "Code - Name"
                let courseName = courseRaw;
                if (courseRaw && courseRaw.includes(' - ')) {
                    // Optional: trim to just name or code? User request says "select from course list".
                    // The manual entry stores "courseName".
                    // If we store "Code - Name", it might look long on the timetable card.
                    // Let's store the full string if selected, or just name.
                    // Actually, let's keep it as is, it's informative.
                }

                const hall = halls.find(h => h.name.toLowerCase() === hallName.toLowerCase());
                if (!hall) throw new Error(`Hall "${hallName}" not found`);

                await timetableService.addTimetableEntry({
                    hallId: hall.id,
                    hallName: hall.name,
                    dayOfWeek: day,
                    startTime: start,
                    endTime: end,
                    courseName: courseName,
                    faculty: faculty,
                    source: 'excel'
                });
                success++;
            } catch (err) {
                failed++;
                errors.push(`Row ${excelData.indexOf(row) + 2}: ${err.message}`);
            }
        }

        setUploadSummary({ success, failed, errors });
        setLoading(false);
        if (success > 0) loadTimetable();
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this entry?')) return;
        try {
            await timetableService.deleteTimetableEntry(id);
            setTimetable(timetable.filter(t => t.id !== id));
        } catch (error) {
            alert('Failed to delete: ' + error.message);
        }
    };

    return (
        <main style={styles.container} role="main" aria-label="Timetable Management">
            <header style={styles.header}>
                <h1 style={styles.title}>Timetable Management</h1>
            </header>

            <nav style={styles.tabContainer} role="tablist" aria-label="Timetable sections">
                <TabButton
                    active={activeTab === 'view'}
                    onClick={() => setActiveTab('view')}
                    icon={<FaList />}
                    label="View Timetables"
                    ariaLabel="View all timetables"
                    ariaControls="view-panel"
                />
                <TabButton
                    active={activeTab === 'manual'}
                    onClick={() => setActiveTab('manual')}
                    icon={<FaPlus />}
                    label="Manual Entry"
                    ariaLabel="Add manual timetable entry"
                    ariaControls="manual-panel"
                />

                <TabButton
                    active={activeTab === 'excel'}
                    onClick={() => setActiveTab('excel')}
                    icon={<FaFileUpload />}
                    label="Excel Upload"
                    ariaLabel="Upload timetable from Excel"
                    ariaControls="excel-panel"
                />
            </nav>

            <div className="glass-panel" style={styles.content}>
                {message.text && (
                    <div
                        role="alert"
                        aria-live="polite"
                        style={{
                            ...styles.message,
                            background: message.type === 'error' ? 'rgba(231, 76, 60, 0.3)' : 'rgba(46, 204, 113, 0.3)',
                            border: `2px solid ${message.type === 'error' ? '#e74c3c' : '#2ecc71'}`,
                            color: message.type === 'error' ? '#ff6b6b' : '#51cf66'
                        }}
                    >
                        {message.text}
                    </div>
                )}

                {activeTab === 'view' && (
                    <section id="view-panel" role="tabpanel" aria-labelledby="view-tab">
                        <div style={styles.sectionHeader}>
                            <h2 style={styles.sectionTitle}>Scheduled Lectures</h2>
                            <button
                                onClick={loadTimetable}
                                style={styles.refreshButton}
                                aria-label="Refresh timetable data"
                            >
                                <FaSync aria-hidden="true" /> Refresh
                            </button>
                        </div>
                        <div style={styles.tableWrapper}>
                            <table style={styles.table} aria-label="Timetable entries">
                                <thead>
                                    <tr style={styles.tableHeaderRow}>
                                        <th scope="col" style={styles.th}>Hall</th>
                                        <th scope="col" style={styles.th}>Day</th>
                                        <th scope="col" style={styles.th}>Time</th>
                                        <th scope="col" style={styles.th}>Course</th>
                                        <th scope="col" style={styles.th}>Department</th>
                                        <th scope="col" style={styles.th}>Source</th>
                                        <th scope="col" style={styles.th}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {timetable.map(entry => (
                                        <tr key={entry.id} style={styles.tableRow}>
                                            <td style={styles.td}>{entry.hallName}</td>
                                            <td style={styles.td}>{entry.dayOfWeek}</td>
                                            <td style={styles.td}>{entry.startTime} - {entry.endTime}</td>
                                            <td style={styles.td}>{entry.courseName}</td>
                                            <td style={styles.td}>{entry.faculty}</td>
                                            <td style={styles.td}>
                                                <span style={styles.badge} aria-label={`Entry source: ${entry.source}`}>
                                                    {entry.source}
                                                </span>
                                            </td>
                                            <td style={styles.td}>
                                                <button
                                                    onClick={() => handleDelete(entry.id)}
                                                    style={styles.deleteButton}
                                                    aria-label={`Delete timetable entry for ${entry.courseName}`}
                                                >
                                                    <FaTrash aria-hidden="true" /> Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {timetable.length === 0 && !loading && (
                                        <tr>
                                            <td colSpan="7" style={styles.emptyState}>No timetables found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {activeTab === 'manual' && (
                    <section id="manual-panel" role="tabpanel" aria-labelledby="manual-tab">
                        <form onSubmit={handleManualSubmit} style={styles.form} aria-label="Manual timetable entry form">
                            <h2 style={styles.formTitle}>Add Lecture Schedule</h2>

                            <div style={styles.formGroup}>
                                <label htmlFor="hall-select" style={styles.label}>Select Hall *</label>
                                <select
                                    id="hall-select"
                                    value={manualEntry.hallId}
                                    onChange={(e) => setManualEntry({ ...manualEntry, hallId: e.target.value })}
                                    style={styles.input}
                                    required
                                    aria-required="true"
                                >
                                    <option value="">-- Select Hall --</option>
                                    {halls.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                                </select>
                            </div>

                            <div style={styles.formGroup}>
                                <label htmlFor="day-select" style={styles.label}>Day of Week *</label>
                                <select
                                    id="day-select"
                                    value={manualEntry.dayOfWeek}
                                    onChange={(e) => setManualEntry({ ...manualEntry, dayOfWeek: e.target.value })}
                                    style={styles.input}
                                    aria-required="true"
                                >
                                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(d => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={styles.timeGrid}>
                                <div style={styles.formGroup}>
                                    <label htmlFor="start-time" style={styles.label}>Start Time *</label>
                                    <input
                                        id="start-time"
                                        type="time"
                                        value={manualEntry.startTime}
                                        onChange={e => setManualEntry({ ...manualEntry, startTime: e.target.value })}
                                        style={styles.input}
                                        required
                                        aria-required="true"
                                    />
                                </div>
                                <div style={styles.formGroup}>
                                    <label htmlFor="end-time" style={styles.label}>End Time *</label>
                                    <input
                                        id="end-time"
                                        type="time"
                                        value={manualEntry.endTime}
                                        onChange={e => setManualEntry({ ...manualEntry, endTime: e.target.value })}
                                        style={styles.input}
                                        required
                                        aria-required="true"
                                    />
                                </div>
                            </div>

                            <div style={styles.formGroup}>
                                <label htmlFor="course-select" style={styles.label}>Select Course *</label>
                                <select
                                    id="course-select"
                                    value={manualEntry.courseName}
                                    onChange={e => setManualEntry({ ...manualEntry, courseName: e.target.value })}
                                    style={styles.input}
                                    required
                                    aria-required="true"
                                >
                                    <option value="">-- Select Course --</option>
                                    {courses
                                        .sort((a, b) => a.code.localeCompare(b.code))
                                        .map((c, idx) => (
                                            <option key={idx} value={`${c.code} - ${c.name}`}>
                                                {c.code} - {c.name}
                                            </option>
                                        ))}
                                </select>
                                {courses.length === 0 && (
                                    <small style={{ color: '#aaa', marginTop: '5px', display: 'block' }}>
                                        No courses found. Please import courses first.
                                    </small>
                                )}
                            </div>

                            <div style={styles.formGroup}>
                                <label htmlFor="department" style={styles.label}>Department *</label>
                                <select
                                    id="department"
                                    value={manualEntry.faculty}
                                    onChange={e => setManualEntry({ ...manualEntry, faculty: e.target.value })}
                                    style={styles.input}
                                    required
                                    aria-required="true"
                                >
                                    <option value="">-- Select Department --</option>
                                    {departments.map((dept, index) => {
                                        const deptName = typeof dept === 'object' ? dept.name : dept;
                                        return <option key={dept.id || index} value={deptName}>{deptName}</option>;
                                    })}
                                </select>
                                {departments.length === 0 && (
                                    <small style={{ color: '#aaa', marginTop: '5px', display: 'block' }}>
                                        No departments found. Please add them in Admin / Departments.
                                    </small>
                                )}
                            </div>

                            <button
                                type="submit"
                                className="btn-primary"
                                style={styles.submitButton}
                                disabled={loading}
                                aria-busy={loading}
                            >
                                {loading ? 'Saving...' : 'Add to Timetable'}
                            </button>
                        </form>
                    </section>
                )}

                {activeTab === 'excel' && (
                    <section id="excel-panel" role="tabpanel" aria-labelledby="excel-tab" style={styles.excelSection}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={styles.formTitle}>Bulk Upload Timetable</h2>
                            <button
                                onClick={downloadTemplate}
                                className="btn-pulse"
                                style={styles.downloadButton}
                                aria-label="Download Excel template"
                            >
                                <FaFileDownload aria-hidden="true" /> Download Template
                            </button>
                        </div>

                        <p style={styles.description}>
                            Upload an Excel file (.xlsx) with columns: Hall Name, Day, Start Time, End Time, Course Name, Department
                        </p>

                        <div style={styles.uploadZone}>
                            <FaDownload size={48} color="var(--accent-gold)" style={{ marginBottom: '20px' }} aria-hidden="true" />
                            <label htmlFor="file-upload" style={styles.uploadLabel}>
                                <input
                                    id="file-upload"
                                    type="file"
                                    accept=".xlsx, .xls"
                                    onChange={handleFileUpload}
                                    style={styles.fileInput}
                                    aria-label="Select Excel file to upload"
                                />
                                Choose Excel File
                            </label>
                        </div>

                        {excelData.length > 0 && (
                            <div style={styles.preview}>
                                <h3 style={styles.previewTitle}>Preview ({excelData.length} entries)</h3>
                                <div style={styles.previewBox}>
                                    <pre style={styles.previewContent}>{JSON.stringify(excelData.slice(0, 3), null, 2)} ...</pre>
                                </div>
                                <button
                                    onClick={processExcelUpload}
                                    className="btn-primary btn-pulse"
                                    style={styles.processButton}
                                    disabled={loading}
                                    aria-busy={loading}
                                >
                                    {loading ? 'Processing...' : 'Upload & Process'}
                                </button>
                            </div>
                        )}

                        {uploadSummary && (
                            <div style={styles.summary} role="status" aria-live="polite">
                                <h3 style={styles.summaryTitle}>Upload Summary</h3>
                                <div style={styles.summarySuccess}>Successfully Added: {uploadSummary.success}</div>
                                <div style={styles.summaryFailed}>Failed: {uploadSummary.failed}</div>
                                {uploadSummary.errors.length > 0 && (
                                    <div style={styles.errorSection}>
                                        <strong style={styles.errorTitle}>Errors:</strong>
                                        <ul style={styles.errorList}>
                                            {uploadSummary.errors.map((err, i) => <li key={i}>{err}</li>)}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </section>
                )}
            </div>
        </main>
    );
};

const TabButton = ({ active, icon, label, onClick, ariaLabel, ariaControls }) => (
    <button
        onClick={onClick}
        role="tab"
        aria-selected={active}
        aria-label={ariaLabel}
        aria-controls={ariaControls}
        style={{
            ...styles.tabButton,
            background: active ? 'linear-gradient(135deg, #8B1538 0%, #a91d42 100%)' : 'rgba(255,255,255,0.08)',
            border: active ? '2px solid #D4AF37' : '2px solid rgba(255,255,255,0.15)',
            color: active ? '#ffffff' : '#d0d0d0',
            fontWeight: active ? '600' : '500',
            transform: active ? 'translateY(-2px)' : 'translateY(0)',
            boxShadow: active ? '0 6px 20px rgba(212, 175, 55, 0.3)' : '0 2px 8px rgba(0,0,0,0.2)'
        }}
    >
        <span aria-hidden="true">{icon}</span>
        <span style={styles.tabLabel}>{label}</span>
    </button>
);

const styles = {
    container: {
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '24px',
        color: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    },
    header: {
        marginBottom: '32px'
    },
    title: {
        color: '#D4AF37',
        fontSize: '2.5rem',
        fontWeight: '700',
        marginBottom: '8px',
        letterSpacing: '-0.5px'
    },
    tabContainer: {
        display: 'flex',
        gap: '16px',
        marginBottom: '32px',
        flexWrap: 'wrap'
    },
    tabButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px 24px',
        borderRadius: '12px',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        fontSize: '1.05rem',
        outline: 'none'
    },
    tabLabel: {
        fontSize: '1.05rem'
    },
    content: {
        padding: '40px',
        minHeight: '500px',
        borderRadius: '16px'
    },
    message: {
        padding: '18px 24px',
        borderRadius: '12px',
        marginBottom: '24px',
        fontSize: '1.05rem',
        fontWeight: '500'
    },
    sectionHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
    },
    sectionTitle: {
        fontSize: '1.8rem',
        fontWeight: '600',
        color: '#ffffff',
        margin: 0
    },
    refreshButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'rgba(212, 175, 55, 0.15)',
        border: '2px solid #D4AF37',
        color: '#D4AF37',
        padding: '10px 20px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: '500',
        transition: 'all 0.3s ease'
    },
    tableWrapper: {
        overflowX: 'auto',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.1)'
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        minWidth: '900px'
    },
    tableHeaderRow: {
        background: 'rgba(255,255,255,0.05)',
        borderBottom: '2px solid rgba(212, 175, 55, 0.3)'
    },
    th: {
        padding: '16px',
        textAlign: 'left',
        fontSize: '1.05rem',
        fontWeight: '600',
        color: '#D4AF37'
    },
    tableRow: {
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        transition: 'background 0.2s ease'
    },
    td: {
        padding: '16px',
        fontSize: '1rem',
        color: '#e8e8e8'
    },
    badge: {
        fontSize: '0.9rem',
        padding: '4px 12px',
        borderRadius: '12px',
        background: 'rgba(212, 175, 55, 0.2)',
        color: '#D4AF37',
        fontWeight: '500',
        border: '1px solid rgba(212, 175, 55, 0.4)'
    },
    deleteButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        color: '#ff6b6b',
        background: 'rgba(255, 107, 107, 0.1)',
        border: '1px solid rgba(255, 107, 107, 0.3)',
        padding: '8px 16px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '0.95rem',
        fontWeight: '500',
        transition: 'all 0.3s ease'
    },
    emptyState: {
        padding: '48px',
        textAlign: 'center',
        color: '#a0a0a0',
        fontSize: '1.1rem'
    },
    form: {
        maxWidth: '700px',
        margin: '0 auto'
    },
    formTitle: {
        fontSize: '1.8rem',
        fontWeight: '600',
        marginBottom: '32px',
        color: '#ffffff'
    },
    formGroup: {
        marginBottom: '24px'
    },
    label: {
        display: 'block',
        marginBottom: '10px',
        color: '#e0e0e0',
        fontSize: '1.05rem',
        fontWeight: '500'
    },
    input: {
        width: '100%',
        padding: '14px 16px',
        borderRadius: '10px',
        border: '2px solid rgba(212, 175, 55, 0.4)',
        background: 'rgba(255, 255, 255, 0.95)',
        color: '#1a1a1a',
        fontSize: '1.05rem',
        outline: 'none',
        boxSizing: 'border-box',
        transition: 'all 0.3s ease'
    },
    timeGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px',
        marginBottom: '24px'
    },
    submitButton: {
        width: '100%',
        padding: '16px',
        fontSize: '1.1rem',
        fontWeight: '600',
        marginTop: '8px'
    },
    excelSection: {
        textAlign: 'center',
        maxWidth: '900px',
        margin: '0 auto'
    },
    excelHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '16px'
    },
    downloadButton: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 24px',
        borderRadius: '10px',
        background: 'rgba(46, 204, 113, 0.15)',
        border: '2px solid #2ecc71',
        color: '#2ecc71',
        cursor: 'pointer',
        fontSize: '1.05rem',
        fontWeight: '500',
        transition: 'all 0.3s ease'
    },
    description: {
        color: '#b8b8b8',
        marginBottom: '32px',
        fontSize: '1.05rem',
        lineHeight: '1.6'
    },
    uploadZone: {
        border: '3px dashed rgba(212, 175, 55, 0.4)',
        borderRadius: '16px',
        padding: '48px',
        marginBottom: '32px',
        background: 'rgba(255,255,255,0.02)',
        transition: 'all 0.3s ease'
    },
    uploadLabel: {
        display: 'inline-block',
        padding: '14px 28px',
        background: 'linear-gradient(135deg, #8B1538 0%, #a91d42 100%)',
        color: '#ffffff',
        borderRadius: '10px',
        cursor: 'pointer',
        fontSize: '1.1rem',
        fontWeight: '600',
        border: '2px solid #D4AF37',
        transition: 'all 0.3s ease'
    },
    fileInput: {
        display: 'none'
    },
    preview: {
        marginBottom: '32px',
        textAlign: 'left'
    },
    previewTitle: {
        fontSize: '1.4rem',
        fontWeight: '600',
        marginBottom: '16px',
        color: '#ffffff'
    },
    previewBox: {
        maxHeight: '250px',
        overflowY: 'auto',
        background: 'rgba(0,0,0,0.3)',
        padding: '16px',
        borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.1)'
    },
    previewContent: {
        fontSize: '0.95rem',
        color: '#d0d0d0',
        margin: 0
    },
    processButton: {
        marginTop: '24px',
        width: '100%',
        padding: '16px',
        fontSize: '1.1rem',
        fontWeight: '600'
    },
    summary: {
        textAlign: 'left',
        background: 'rgba(0,0,0,0.3)',
        padding: '32px',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.1)'
    },
    summaryTitle: {
        marginTop: 0,
        marginBottom: '20px',
        fontSize: '1.5rem',
        fontWeight: '600',
        color: '#ffffff'
    },
    summarySuccess: {
        color: '#51cf66',
        fontSize: '1.1rem',
        marginBottom: '12px',
        fontWeight: '500'
    },
    summaryFailed: {
        color: '#ff6b6b',
        fontSize: '1.1rem',
        marginBottom: '20px',
        fontWeight: '500'
    },
    errorSection: {
        marginTop: '16px',
        maxHeight: '200px',
        overflowY: 'auto'
    },
    errorTitle: {
        color: '#ff6b6b',
        fontSize: '1.1rem',
        display: 'block',
        marginBottom: '12px'
    },
    errorList: {
        color: '#c0c0c0',
        fontSize: '1rem',
        lineHeight: '1.8'
    }
};

export default TimetableManagement;
