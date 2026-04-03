import React, { useEffect, useState } from 'react';
import { userService, courseService, firestoreService } from '../../services/firestore';
import { authService } from '../../services/auth';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaCheckCircle, FaTimesCircle, FaSearch, FaBook, FaUserTag, FaInfoCircle, FaUser, FaEnvelope, FaBuilding, FaUserGraduate, FaIdCard, FaClock } from 'react-icons/fa';
import { db } from '../../services/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

const ManageLecturers = () => {
    const navigate = useNavigate();
    const [lecturers, setLecturers] = useState([]);
    const [allCourses, setAllCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [processing, setProcessing] = useState(null);

    // Course Modal State
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [selectedLecturer, setSelectedLecturer] = useState(null);
    const [selectedCourses, setSelectedCourses] = useState([]);
    const [courseSearch, setCourseSearch] = useState('');

    // Info Modal State
    const [isInfoModalVisible, setIsInfoModalVisible] = useState(false);
    const [viewingLecturer, setViewingLecturer] = useState(null);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);

        const checkAuth = async () => {
            const user = authService.auth.currentUser;
            if (!user) {
                navigate('/login');
                return;
            }
            const perms = await authService.getUserPermissions(user.uid);
            const role = await authService.getUserRole(user.uid);

            if (!perms.manage_users && role !== 'admin') {
                alert('Access Denied: You need administrator permissions.');
                navigate('/admin');
                return;
            }
            loadData();
        };

        checkAuth();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [users, courses] = await Promise.all([
                userService.getAllUsers(),
                courseService.getAllCourses()
            ]);

            // Filter only lecturers
            const lecturerList = users.filter(u => u.role === 'lecturer');
            setLecturers(lecturerList);
            setAllCourses(courses);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (lecturer) => {
        if (!window.confirm(`Verify ${lecturer.name}?`)) return;
        setProcessing(lecturer.id || lecturer.uid);
        try {
            const id = lecturer.id || lecturer.uid;
            await updateDoc(doc(db, 'users', id), {
                isVerified: true,
                verifiedAt: serverTimestamp()
            });
            loadData();
        } catch (error) {
            alert("Verification failed.");
        } finally {
            setProcessing(null);
        }
    };

    const handleRevoke = async (lecturer) => {
        if (!window.confirm(`Revoke access for ${lecturer.name}?`)) return;
        setProcessing(lecturer.id || lecturer.uid);
        try {
            const id = lecturer.id || lecturer.uid;
            await updateDoc(doc(db, 'users', id), {
                isVerified: false,
                revokedAt: serverTimestamp()
            });
            loadData();
        } catch (error) {
            alert("Revocation failed.");
        } finally {
            setProcessing(null);
        }
    };

    const openCourseModal = (lecturer) => {
        setSelectedLecturer(lecturer);
        setSelectedCourses(lecturer.savedCourses || []);
        setIsModalVisible(true);
    };

    const toggleCourse = (courseId) => {
        setSelectedCourses(prev =>
            prev.includes(courseId)
                ? prev.filter(id => id !== courseId)
                : [...prev, courseId]
        );
    };

    const saveCourses = async () => {
        if (!selectedLecturer) return;
        setProcessing('saving-courses');
        try {
            const id = selectedLecturer.id || selectedLecturer.uid;
            await updateDoc(doc(db, 'users', id), {
                savedCourses: selectedCourses,
                updatedAt: serverTimestamp()
            });
            setIsModalVisible(false);
            loadData();
        } catch (error) {
            alert("Failed to save courses.");
        } finally {
            setProcessing(null);
        }
    };

    const openInfoModal = (lecturer) => {
        setViewingLecturer(lecturer);
        setIsInfoModalVisible(true);
    };

    const filteredLecturers = lecturers.filter(u =>
        (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const filteredCourses = allCourses.filter(c =>
        c.code.toLowerCase().includes(courseSearch.toLowerCase()) ||
        c.name.toLowerCase().includes(courseSearch.toLowerCase())
    );

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
            {/* Header section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '15px', color: 'var(--text-main)', margin: 0 }}>
                    <button onClick={() => navigate('/admin')} style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', fontSize: '1.5rem', display: 'flex' }}><FaArrowLeft /></button>
                    Lecturer Management
                </h2>
                <div style={{ position: 'relative' }}>
                    <FaSearch style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
                    <input
                        placeholder="Search lecturers..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            padding: '10px 15px 10px 45px',
                            borderRadius: '30px',
                            border: '1px solid var(--glass-border)',
                            background: 'rgba(255,255,255,0.05)',
                            color: 'white',
                            width: isMobile ? '100%' : '300px',
                            outline: 'none'
                        }}
                    />
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '50px' }}>Loading lecturers...</div>
            ) : (
                <div className="glass-panel" style={{ padding: '0', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.05)', textAlign: 'left' }}>
                                <th style={{ padding: '20px' }}>Lecturer</th>
                                <th style={{ padding: '20px' }}>Status</th>
                                <th style={{ padding: '20px', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLecturers.map(lecturer => (
                                <tr key={lecturer.id || lecturer.uid} style={{ borderTop: '1px solid var(--glass-border)' }}>
                                    <td style={{ padding: '20px' }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{lecturer.name}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>{lecturer.email}</div>
                                    </td>
                                    <td style={{ padding: '20px' }}>
                                        <span style={{
                                            padding: '4px 12px',
                                            borderRadius: '20px',
                                            background: lecturer.isVerified ? 'rgba(46, 204, 113, 0.2)' : 'rgba(241, 196, 15, 0.2)',
                                            color: lecturer.isVerified ? '#2ecc71' : '#f1c40f',
                                            fontSize: '0.75rem',
                                            fontWeight: 'bold',
                                            textTransform: 'uppercase',
                                            border: `1px solid ${lecturer.isVerified ? '#2ecc7133' : '#f1c40f33'}`
                                        }}>
                                            {lecturer.isVerified ? 'Verified' : 'Pending'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '20px', textAlign: 'right' }}>
                                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                            <button
                                                onClick={() => openInfoModal(lecturer)}
                                                className="btn-glass"
                                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 15px', color: '#3498db' }}
                                                title="View Details"
                                            >
                                                <FaInfoCircle /> Info
                                            </button>

                                            <button
                                                onClick={() => openCourseModal(lecturer)}
                                                className="btn-glass"
                                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 15px', color: 'var(--accent-gold)' }}
                                            >
                                                <FaBook /> Modules
                                            </button>

                                            {lecturer.isVerified ? (
                                                <button
                                                    onClick={() => handleRevoke(lecturer)}
                                                    disabled={processing === (lecturer.id || lecturer.uid)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 15px', borderRadius: '8px', border: '1px solid #e74c3c', background: '#e74c3c22', color: '#e74c3c', cursor: 'pointer' }}
                                                >
                                                    <FaTimesCircle /> Revoke
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleVerify(lecturer)}
                                                    disabled={processing === (lecturer.id || lecturer.uid)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 15px', borderRadius: '8px', border: '1px solid #2ecc71', background: '#2ecc7122', color: '#2ecc71', cursor: 'pointer' }}
                                                >
                                                    <FaCheckCircle /> Verify
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredLecturers.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>No lecturers found matching your search.</div>}
                </div>
            )}

            {/* Modules Assignment Modal */}
            {isModalVisible && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center',
                    zIndex: 2000, padding: '20px'
                }}>
                    <div className="glass-panel" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--accent-gold)' }}>
                        <div style={{ padding: '25px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: 0, color: 'var(--accent-gold)' }}>Assign Modules</h3>
                                <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>{selectedLecturer?.name}</div>
                            </div>
                            <button onClick={() => setIsModalVisible(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                        </div>

                        <div style={{ padding: '20px' }}>
                            <div style={{ position: 'relative', marginBottom: '15px' }}>
                                <FaSearch style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
                                <input
                                    placeholder="Search modules..."
                                    value={courseSearch}
                                    onChange={(e) => setCourseSearch(e.target.value)}
                                    style={{
                                        width: '100%', padding: '12px 15px 12px 45px', borderRadius: '12px',
                                        border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)',
                                        color: 'white', outline: 'none'
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px', marginBottom: '20px' }}>
                            {filteredCourses.map(course => {
                                const isSelected = selectedCourses.includes(course.id);
                                return (
                                    <div
                                        key={course.id}
                                        onClick={() => toggleCourse(course.id)}
                                        style={{
                                            padding: '12px 15px', borderRadius: '10px', marginBottom: '10px',
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '15px',
                                            background: isSelected ? 'var(--primary-maroon)' : 'rgba(255,255,255,0.03)',
                                            border: `1px solid ${isSelected ? 'var(--accent-gold)' : 'var(--glass-border)'}`,
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: isSelected ? 'var(--accent-gold)' : 'white' }}>{course.code}</div>
                                            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{course.name}</div>
                                        </div>
                                        {isSelected && <FaCheckCircle style={{ color: 'var(--accent-gold)' }} />}
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{ padding: '20px', borderTop: '1px solid var(--glass-border)', display: 'flex', gap: '15px' }}>
                            <button
                                onClick={() => setIsModalVisible(false)}
                                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'none', color: 'white', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveCourses}
                                disabled={processing === 'saving-courses'}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
                                    background: 'var(--accent-gold)', color: 'var(--primary-maroon)',
                                    fontWeight: 'bold', cursor: 'pointer',
                                    opacity: processing === 'saving-courses' ? 0.7 : 1
                                }}
                            >
                                {processing === 'saving-courses' ? 'Saving...' : `Save (${selectedCourses.length})`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Lecturer Details Modal */}
            {isInfoModalVisible && viewingLecturer && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center',
                    zIndex: 2000, padding: '20px'
                }}>
                    <div className="glass-panel" style={{ width: '100%', maxWidth: '550px', border: '1px solid var(--accent-gold)', overflow: 'hidden' }}>
                        <div style={{ padding: '25px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <FaIdCard /> Lecturer Profile
                            </h3>
                            <button onClick={() => setIsInfoModalVisible(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                        </div>

                        <div style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '10px' }}>
                                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--primary-maroon)', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 'bold', border: '2px solid var(--accent-gold)' }}>
                                    {viewingLecturer.name?.charAt(0).toUpperCase() || 'L'}
                                </div>
                                <div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>{viewingLecturer.name}</div>
                                    <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '5px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <FaEnvelope style={{ fontSize: '0.8rem' }} /> {viewingLecturer.email}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <FaUserTag style={{ fontSize: '0.8rem' }} /> {viewingLecturer.phone || 'No phone provided'}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', opacity: 0.5, marginTop: '2px' }}>
                                            Member since {viewingLecturer.createdAt?.toDate ? viewingLecturer.createdAt.toDate().toLocaleDateString() : 'recently'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', textTransform: 'uppercase', marginBottom: '5px', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '6px' }}><FaUser /> Lecturer Type</div>
                                    <div style={{ fontWeight: '500' }}>{(viewingLecturer.lecturerType || 'Permanent').toUpperCase()}</div>
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', textTransform: 'uppercase', marginBottom: '5px', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '6px' }}><FaBuilding /> Organization</div>
                                    <div style={{ fontWeight: '500' }}>{viewingLecturer.organization || 'University of Sri Jayewardenepura'}</div>
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '12px', border: '1px solid var(--glass-border)', gridColumn: 'span 2' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', textTransform: 'uppercase', marginBottom: '5px', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '6px' }}><FaUserGraduate /> Qualifications & Expertise</div>
                                    <div style={{ fontWeight: '500' }}>{viewingLecturer.qualifications || 'N/A'}</div>
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '12px', border: '1px solid var(--glass-border)', gridColumn: 'span 2' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', textTransform: 'uppercase', marginBottom: '5px', letterSpacing: '1px' }}>Total Modules Assigned</div>
                                    <div style={{ fontWeight: '500' }}>{viewingLecturer.savedCourses?.length || 0} Modules under management</div>
                                </div>
                            </div>

                            <div style={{ marginTop: '10px', padding: '15px', borderRadius: '12px', background: viewingLecturer.isVerified ? 'rgba(46, 204, 113, 0.1)' : 'rgba(241, 196, 15, 0.1)', border: `1px solid ${viewingLecturer.isVerified ? '#2ecc7133' : '#f1c40f33'}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Account Status</div>
                                        <div style={{ fontWeight: 'bold', color: viewingLecturer.isVerified ? '#2ecc71' : '#f1c40f' }}>
                                            {viewingLecturer.isVerified ? 'Verified System Access' : 'Awaiting Administration Review'}
                                        </div>
                                    </div>
                                    {viewingLecturer.isVerified ? <FaCheckCircle style={{ color: '#2ecc71', fontSize: '1.5rem' }} /> : <FaClock style={{ color: '#f1c40f', fontSize: '1.5rem' }} />}
                                </div>
                            </div>

                            {/* Assigned Modules List */}
                            <div style={{ marginTop: '10px' }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--accent-gold)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FaBook /> Assigned Modules ({viewingLecturer.savedCourses?.length || 0})
                                </div>
                                <div style={{
                                    maxHeight: '150px',
                                    overflowY: 'auto',
                                    background: 'rgba(255,255,255,0.02)',
                                    borderRadius: '12px',
                                    border: '1px solid var(--glass-border)',
                                    padding: '10px'
                                }}>
                                    {viewingLecturer.savedCourses && viewingLecturer.savedCourses.length > 0 ? (
                                        viewingLecturer.savedCourses.map(id => {
                                            const course = allCourses.find(c => c.id === id);
                                            return (
                                                <div key={id} style={{
                                                    padding: '8px 12px',
                                                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}>
                                                    <span style={{ fontWeight: 'bold', color: 'var(--accent-gold)', fontSize: '0.85rem' }}>{course?.code || 'Unknown'}</span>
                                                    <span style={{ fontSize: '0.8rem', opacity: 0.8, textAlign: 'right', flex: 1, marginLeft: '10px' }}>{course?.name || 'Course not found'}</span>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5, fontSize: '0.85rem' }}>No modules assigned yet.</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: '20px', borderTop: '1px solid var(--glass-border)', textAlign: 'right' }}>
                            <button
                                onClick={() => setIsInfoModalVisible(false)}
                                style={{ padding: '10px 30px', borderRadius: '8px', border: 'none', background: 'var(--accent-gold)', color: 'var(--primary-maroon)', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                Close Profile
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManageLecturers;
