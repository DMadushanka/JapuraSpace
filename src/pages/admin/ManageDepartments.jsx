import React, { useEffect, useState } from 'react';
import { miscService } from '../../services/firestore';
import { authService } from '../../services/auth';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaPlus, FaTrash, FaEdit, FaCheck, FaTimes } from 'react-icons/fa';

const ManageDepartments = () => {
    const navigate = useNavigate();
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    // Modal & Form State
    const [showModal, setShowModal] = useState(false);
    const [editingDept, setEditingDept] = useState(null);
    const [deptName, setDeptName] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        checkAdmin();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const checkAdmin = async () => {
        const user = authService.auth.currentUser;
        if (!user) {
            navigate('/login');
            return;
        }
        // Simpler check for now - if they can access dashboard, they can likely manage departments? 
        // Or specific permission? User said "Admin can add".
        // Let's rely on role === 'admin' or board, or a new permission if strictly needed.
        // For now, reuse role check.
        const role = await authService.getUserRole(user.uid);
        if (role !== 'admin' && role !== 'board') {
            // Maybe check permissions object too?
            const perms = await authService.getUserPermissions(user.uid);
            if (!perms.manage_halls) { // Reuse manage_halls or create new? 
                // Let's assume admins only for now as requested.
                // But the user dashboard uses manage_halls. 
                // Let's stick to admin/board for safety.
                if (role !== 'admin' && role !== 'board') {
                    alert('Access denied. Admins only.');
                    navigate('/admin');
                    return;
                }
            }
        }
        loadDepartments();
    };

    const loadDepartments = async () => {
        setLoading(true);
        const data = await miscService.getDepartments();
        // Sort alphabetically
        data.sort((a, b) => a.name.localeCompare(b.name));
        setDepartments(data);
        setLoading(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!deptName.trim()) return;
        setSubmitting(true);
        try {
            if (editingDept) {
                await miscService.updateDepartment(editingDept.id, { name: deptName });
            } else {
                await miscService.addDepartment(deptName);
            }
            setShowModal(false);
            setDeptName('');
            setEditingDept(null);
            loadDepartments();
        } catch (error) {
            console.error('Error saving department:', error);
            alert('Failed to save department.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (dept) => {
        setEditingDept(dept);
        setDeptName(dept.name);
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this department? This might affect users/courses linked to it.')) return;
        try {
            await miscService.deleteDepartment(id);
            loadDepartments();
        } catch (error) {
            console.error('Error deleting department:', error);
            alert('Failed to delete department.');
        }
    };

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: isMobile ? '10px' : '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                <button
                    onClick={() => navigate('/admin')}
                    style={{ background: 'none', border: 'none', color: 'var(--primary-maroon)', fontSize: '1.2rem', cursor: 'pointer', marginRight: '15px' }}
                >
                    <FaArrowLeft />
                </button>
                <h1 style={{ margin: 0, color: 'var(--primary-maroon)' }}>Manage Departments</h1>
                <button
                    className="btn-primary"
                    onClick={() => { setEditingDept(null); setDeptName(''); setShowModal(true); }}
                    style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <FaPlus /> Add Department
                </button>
            </div>

            <div className="glass-panel" style={{ padding: '20px' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '20px' }}>Loading departments...</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                                <th style={{ padding: '12px', color: '#666' }}>Department Name</th>
                                <th style={{ padding: '12px', textAlign: 'right', color: '#666' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {departments.map(dept => (
                                <tr key={dept.id} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '15px 12px', fontWeight: '500' }}>{dept.name}</td>
                                    <td style={{ padding: '12px', textAlign: 'right' }}>
                                        <button
                                            onClick={() => handleEdit(dept)}
                                            style={{ marginRight: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#f39c12' }}
                                            title="Edit"
                                        >
                                            <FaEdit size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(dept.id)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e74c3c' }}
                                            title="Delete"
                                        >
                                            <FaTrash size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {departments.length === 0 && (
                                <tr>
                                    <td colSpan="2" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                                        No departments found. Add one to get started.
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
                            {editingDept ? 'Edit Department' : 'Add Department'}
                        </h2>
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', color: '#666' }}>Department Name</label>
                                <input
                                    type="text"
                                    value={deptName}
                                    onChange={(e) => setDeptName(e.target.value)}
                                    style={{
                                        width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd',
                                        fontSize: '1rem'
                                    }}
                                    placeholder="e.g. Computer Science"
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

export default ManageDepartments;
