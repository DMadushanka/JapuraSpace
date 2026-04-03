import React, { useEffect, useState } from 'react';
import { miscService } from '../../services/firestore';
import { authService } from '../../services/auth';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaPlus, FaTrash, FaEdit, FaCheck, FaTimes, FaGraduationCap } from 'react-icons/fa';

const ManageDegrees = () => {
    const navigate = useNavigate();
    const [departments, setDepartments] = useState([]);
    const [selectedDeptId, setSelectedDeptId] = useState('');
    const [degrees, setDegrees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [degreesLoading, setDegreesLoading] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    // Modal & Form State
    const [showModal, setShowModal] = useState(false);
    const [editingDegree, setEditingDegree] = useState(null);
    const [degreeName, setDegreeName] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        checkAdmin();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (selectedDeptId) {
            loadDegrees(selectedDeptId);
        }
    }, [selectedDeptId]);

    const checkAdmin = async () => {
        const user = authService.auth.currentUser;
        if (!user) {
            navigate('/login');
            return;
        }
        const role = await authService.getUserRole(user.uid);
        if (role !== 'admin' && role !== 'board') {
            const perms = await authService.getUserPermissions(user.uid);
            if (!perms.manage_halls) {
                alert('Access denied. Admins only.');
                navigate('/admin');
                return;
            }
        }
        loadDepartments();
    };

    const loadDepartments = async () => {
        setLoading(true);
        const data = await miscService.getDepartments();
        data.sort((a, b) => a.name.localeCompare(b.name));
        setDepartments(data);
        if (data.length > 0) {
            setSelectedDeptId(data[0].id);
        }
        setLoading(false);
    };

    const loadDegrees = async (deptId) => {
        setDegreesLoading(true);
        const data = await miscService.getDegrees(deptId);
        data.sort((a, b) => a.name.localeCompare(b.name));
        setDegrees(data);
        setDegreesLoading(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!degreeName.trim() || !selectedDeptId) return;
        setSubmitting(true);
        try {
            if (editingDegree) {
                await miscService.updateDegree(selectedDeptId, editingDegree.id, { name: degreeName });
            } else {
                await miscService.addDegree(selectedDeptId, { name: degreeName });
            }
            setShowModal(false);
            setDegreeName('');
            setEditingDegree(null);
            loadDegrees(selectedDeptId);
        } catch (error) {
            console.error('Error saving degree:', error);
            alert('Failed to save degree.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (degree) => {
        setEditingDegree(degree);
        setDegreeName(degree.name);
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this degree?')) return;
        try {
            await miscService.deleteDegree(selectedDeptId, id);
            loadDegrees(selectedDeptId);
        } catch (error) {
            console.error('Error deleting degree:', error);
            alert('Failed to delete degree.');
        }
    };

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: isMobile ? '10px' : '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', gap: '15px', flexWrap: 'wrap' }}>
                <button
                    onClick={() => navigate('/admin')}
                    style={{ background: 'none', border: 'none', color: 'var(--primary-maroon)', fontSize: '1.2rem', cursor: 'pointer' }}
                >
                    <FaArrowLeft />
                </button>
                <h1 style={{ margin: 0, color: 'var(--primary-maroon)', fontSize: isMobile ? '1.5rem' : '2rem' }}>Manage Degrees</h1>

                <div style={{ flex: 1, minWidth: '200px' }}>
                    <select
                        value={selectedDeptId}
                        onChange={(e) => setSelectedDeptId(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: '8px',
                            border: '1px solid #ddd',
                            backgroundColor: 'white',
                            fontSize: '1rem'
                        }}
                    >
                        {departments.map(dept => (
                            <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                    </select>
                </div>

                <button
                    className="btn-primary"
                    onClick={() => { setEditingDegree(null); setDegreeName(''); setShowModal(true); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    disabled={!selectedDeptId}
                >
                    <FaPlus /> Add Degree
                </button>
            </div>

            <div className="glass-panel" style={{ padding: '20px' }}>
                {loading || degreesLoading ? (
                    <div style={{ textAlign: 'center', padding: '20px' }}>Loading...</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                                <th style={{ padding: '12px', color: '#666' }}>Degree Name</th>
                                <th style={{ padding: '12px', textAlign: 'right', color: '#666' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {degrees.map(degree => (
                                <tr key={degree.id} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '15px 12px', fontWeight: '500' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <FaGraduationCap color="var(--primary-maroon)" />
                                            {degree.name}
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'right' }}>
                                        <button
                                            onClick={() => handleEdit(degree)}
                                            style={{ marginRight: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#f39c12' }}
                                            title="Edit"
                                        >
                                            <FaEdit size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(degree.id)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e74c3c' }}
                                            title="Delete"
                                        >
                                            <FaTrash size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {degrees.length === 0 && (
                                <tr>
                                    <td colSpan="2" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                                        {selectedDeptId ? 'No degrees found for this department.' : 'Select a department to view degrees.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <div style={{
                        background: 'white', padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '500px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
                    }}>
                        <h2 style={{ marginTop: 0, color: 'var(--primary-maroon)' }}>
                            {editingDegree ? 'Edit Degree' : 'Add Degree'}
                        </h2>
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', color: '#666' }}>Degree Name</label>
                                <input
                                    type="text"
                                    value={degreeName}
                                    onChange={(e) => setDegreeName(e.target.value)}
                                    style={{
                                        width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd',
                                        fontSize: '1rem'
                                    }}
                                    placeholder="e.g. B.Sc. in Computer Science"
                                    autoFocus
                                    required
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #ddd', background: 'white', cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn-primary"
                                    disabled={submitting}
                                    style={{ padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }}
                                >
                                    {submitting ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManageDegrees;
