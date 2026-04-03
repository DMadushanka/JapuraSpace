import React, { useState, useEffect } from 'react';
import { courseService } from '../../services/firestore';
import { FaBook, FaBookOpen, FaTrash, FaPlus, FaSearch } from 'react-icons/fa';

const ManageCourses = () => {
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Course CRUD State
    const [courseSearch, setCourseSearch] = useState('');
    const [editingCourse, setEditingCourse] = useState(null);
    const [courseForm, setCourseForm] = useState({ code: '', name: '' });
    const [courseUploadSummary, setCourseUploadSummary] = useState(null);

    useEffect(() => {
        loadCourses();
    }, []);

    const loadCourses = async () => {
        const data = await courseService.getAllCourses();
        setCourses(data);
    };

    const handleCourseSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (editingCourse) {
                await courseService.updateCourse(editingCourse.id, courseForm);
                setMessage({ type: 'success', text: 'Course updated successfully' });
            } else {
                await courseService.addCourse(courseForm);
                setMessage({ type: 'success', text: 'Course added successfully' });
            }
            setCourseForm({ code: '', name: '' });
            setEditingCourse(null);
            loadCourses();
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleEditCourse = (course) => {
        setEditingCourse(course);
        setCourseForm({ code: course.code, name: course.name });
        // Scroll to top or form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteCourse = async (id) => {
        if (!window.confirm('Are you sure you want to delete this course?')) return;
        setLoading(true);
        try {
            await courseService.deleteCourse(id);
            setMessage({ type: 'success', text: 'Course deleted successfully' });
            loadCourses();
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleCourseFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const text = evt.target.result;
            const lines = text.split('\n');
            const newCourses = [];

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const firstCommaIndex = line.indexOf(',');
                if (firstCommaIndex === -1) continue;

                const code = line.substring(0, firstCommaIndex).trim();
                const name = line.substring(firstCommaIndex + 1).trim().replace(/^"|"$/g, '');

                if (code && name) {
                    newCourses.push({ code, name });
                }
            }

            if (newCourses.length > 0) {
                setLoading(true);
                try {
                    const count = await courseService.addCoursesBatch(newCourses);
                    setCourseUploadSummary({ success: count, message: `Successfully imported ${count} courses.` });
                    loadCourses();
                } catch (error) {
                    console.error('Import failed:', error);
                    setCourseUploadSummary({ success: 0, message: `Import failed: ${error.message}` });
                } finally {
                    setLoading(false);
                }
            }
        };
        reader.readAsText(file);
    };

    const styles = {
        container: {
            padding: '24px',
            maxWidth: '1200px',
            margin: '0 auto',
            color: '#e0e0e0',
            fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
        },
        header: {
            textAlign: 'center',
            marginBottom: '40px',
            position: 'relative'
        },
        title: {
            fontSize: '2.5rem',
            color: '#ffffff',
            margin: '0 0 10px 0',
            textShadow: '0 4px 6px rgba(0,0,0,0.3)',
            background: 'linear-gradient(to right, #D4AF37, #F2C94C)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
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
        submitButton: {
            width: '100%',
            padding: '12px 24px',
            fontSize: '1rem',
            fontWeight: '600',
            border: 'none',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)',
            color: 'white',
            cursor: 'pointer',
            marginTop: '8px'
        },
        deleteButton: {
            padding: '6px 12px',
            borderRadius: '6px',
            border: 'none',
            background: 'rgba(231, 76, 60, 0.2)',
            color: '#e74c3c',
            cursor: 'pointer',
            fontSize: '0.9rem'
        },
        glassPanel: {
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(12px)',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
            padding: '30px'
        }
    };

    return (
        <main style={styles.container}>
            <header style={styles.header}>
                <h1 style={styles.title}>Manage Courses</h1>
            </header>

            <div style={styles.glassPanel}>
                {message.text && (
                    <div style={{
                        padding: '15px',
                        marginBottom: '20px',
                        borderRadius: '8px',
                        background: message.type === 'error' ? 'rgba(231, 76, 60, 0.2)' : 'rgba(46, 204, 113, 0.2)',
                        color: message.type === 'error' ? '#ff6b6b' : '#2ecc71',
                        border: `1px solid ${message.type === 'error' ? '#e74c3c' : '#2ecc71'}`
                    }}>
                        {message.text}
                    </div>
                )}

                {/* Add/Edit Form */}
                <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '20px', borderRadius: '12px', marginBottom: '30px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '15px', color: '#D4AF37' }}>
                        {editingCourse ? 'Edit Course' : 'Add New Course'}
                    </h3>
                    <form onSubmit={handleCourseSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '15px', alignItems: 'end' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', color: '#ccc' }}>Course Code</label>
                            <input
                                type="text"
                                value={courseForm.code}
                                onChange={e => setCourseForm({ ...courseForm, code: e.target.value })}
                                style={styles.input}
                                placeholder="e.g. ANT 1213"
                                required
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', color: '#ccc' }}>Course Name</label>
                            <input
                                type="text"
                                value={courseForm.name}
                                onChange={e => setCourseForm({ ...courseForm, name: e.target.value })}
                                style={styles.input}
                                placeholder="e.g. Introduction to Anthropology"
                                required
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            {editingCourse && (
                                <button
                                    type="button"
                                    onClick={() => { setEditingCourse(null); setCourseForm({ code: '', name: '' }); }}
                                    style={{ ...styles.submitButton, background: '#7f8c8d' }}
                                >
                                    Cancel
                                </button>
                            )}
                            <button
                                type="submit"
                                style={styles.submitButton}
                                disabled={loading}
                            >
                                {editingCourse ? 'Update' : 'Add'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Search and List */}
                <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <FaSearch style={{ position: 'absolute', left: '15px', top: '15px', color: '#666' }} />
                        <input
                            type="text"
                            placeholder="Search courses..."
                            value={courseSearch}
                            onChange={e => setCourseSearch(e.target.value)}
                            style={{ ...styles.input, paddingLeft: '40px' }}
                        />
                    </div>
                </div>

                {/* Import Section */}
                <details style={{ marginBottom: '20px', background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px' }}>
                    <summary style={{ cursor: 'pointer', color: '#aaa' }}>Bulk Import from CSV</summary>
                    <div style={{ marginTop: '15px', textAlign: 'center' }}>
                        <p style={{ color: '#bbb', marginBottom: '10px' }}>
                            Upload a CSV with <code>Unit No.</code> and <code>Description</code> columns.
                        </p>
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleCourseFileUpload}
                            style={{ color: '#ccc' }}
                        />
                        {courseUploadSummary && (
                            <div style={{
                                marginTop: '10px',
                                padding: '10px',
                                borderRadius: '8px',
                                background: courseUploadSummary.success > 0 ? 'rgba(46, 204, 113, 0.2)' : 'rgba(231, 76, 60, 0.2)',
                                color: courseUploadSummary.success > 0 ? '#2ecc71' : '#e74c3c'
                            }}>
                                {courseUploadSummary.message}
                            </div>
                        )}
                    </div>
                </details>

                <h3 style={{ color: '#eee', marginTop: '30px' }}>
                    Course Catalog ({courses.filter(c =>
                        c.code.toLowerCase().includes(courseSearch.toLowerCase()) ||
                        c.name.toLowerCase().includes(courseSearch.toLowerCase())
                    ).length})
                </h3>

                <div style={{ maxHeight: '500px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                    {courses.length > 0 ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse', color: '#ddd' }}>
                            <thead style={{ position: 'sticky', top: 0, background: '#2c3e50', zIndex: 1 }}>
                                <tr style={{ borderBottom: '1px solid #444' }}>
                                    <th style={{ textAlign: 'left', padding: '12px' }}>Code</th>
                                    <th style={{ textAlign: 'left', padding: '12px' }}>Name</th>
                                    <th style={{ textAlign: 'right', padding: '12px' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {courses.filter(c =>
                                    c.code.toLowerCase().includes(courseSearch.toLowerCase()) ||
                                    c.name.toLowerCase().includes(courseSearch.toLowerCase())
                                ).map((c, i) => (
                                    <tr key={c.id || i} style={{ borderBottom: '1px solid #333', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                                        <td style={{ padding: '12px', fontWeight: 'bold', color: '#D4AF37' }}>{c.code}</td>
                                        <td style={{ padding: '12px' }}>{c.name}</td>
                                        <td style={{ padding: '12px', textAlign: 'right' }}>
                                            <button
                                                onClick={() => handleEditCourse(c)}
                                                style={{ background: 'none', border: 'none', color: '#3498db', cursor: 'pointer', marginRight: '15px' }}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteCourse(c.id)}
                                                style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer' }}
                                            >
                                                <FaTrash />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#aaa' }}>No courses found. Add or import them.</div>
                    )}
                </div>
            </div>
        </main>
    );
};

export default ManageCourses;
