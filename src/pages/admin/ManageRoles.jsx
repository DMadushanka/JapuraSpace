import React, { useEffect, useState } from 'react';
import { firestoreService, roleService, userService } from '../../services/firestore';
import { authService } from '../../services/auth';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaPlus, FaTrash, FaEdit, FaCheck, FaTimes } from 'react-icons/fa';

const STANDARD_ROLES = [
    'Hall_Manager',
    'Booking_Manager',
    'Slider_manager',
    'Department_Admin',
    'Admin_Assistant'
];

const ManageRoles = () => {
    const navigate = useNavigate();
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [editingRole, setEditingRole] = useState(null);
    const [showModal, setShowModal] = useState(false);

    const [roleData, setRoleData] = useState({
        fullName: '',
        roleTitle: '',
        email: '',
        password: '',
        permissions: {
            manage_bookings: false,
            manage_halls: false,
            manage_degrees: false,
            manage_users: false,
            manage_lecturers: false,
            manage_departments: false,
            manage_courses: false,
            manage_timetable: false,
            manage_maintenance: false,
            manage_holidays: false,
            manage_slider: false,
            access_tester: false,
            view_dashboard: true
        }
    });

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);

        const checkPerms = async () => {
            const user = authService.auth.currentUser;
            if (!user) {
                navigate('/login');
                return;
            }
            const perms = await authService.getUserPermissions(user.uid);
            if (!perms.manage_roles) {
                alert('You do not have permission to manage roles.');
                navigate('/admin');
                return;
            }
            loadRoles();
        };

        checkPerms();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const loadRoles = async () => {
        setLoading(true);
        try {
            // Fetch role templates and all staff users
            const [roleTemplates, allUsers] = await Promise.all([
                roleService.getAllRoles(),
                userService.getAllUsers()
            ]);

            // Filter for staff/admin users (Case-insensitive check)
            const staffUsers = allUsers.filter(u => {
                const r = (u.role || '').toLowerCase();
                return r !== 'student' && r !== 'guest';
            });

            // Merge: For each staff user, show their status. 
            // Also include roles that might not have a user yet if they are just templates.
            const mergedRoles = [...roleTemplates.map(r => ({ ...r, isTemplate: true }))];

            staffUsers.forEach(user => {
                // Try to match by email or by specific ID if available
                const existingIndex = mergedRoles.findIndex(r =>
                    (r.email && r.email.toLowerCase() === user.email?.toLowerCase()) ||
                    (r.uid === user.uid)
                );

                if (existingIndex > -1) {
                    mergedRoles[existingIndex] = { ...mergedRoles[existingIndex], ...user, isTemplate: false };
                } else {
                    mergedRoles.push({ ...user, isTemplate: false });
                }
            });

            setRoles(mergedRoles);
        } catch (error) {
            console.error(error);
        }
        setLoading(false);
    };

    const getStatus = (lastActive) => {
        if (!lastActive) return { label: 'Inactive', color: '#888' };
        const now = new Date();
        const activeDate = lastActive.toDate ? lastActive.toDate() : new Date(lastActive);
        const diffMs = now - activeDate;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 5) return { label: 'Online', color: '#2ecc71', active: true };
        if (diffMins < 60) return { label: `${diffMins}m ago`, color: '#f39c12' };
        if (diffMins < 1440) return { label: `${Math.floor(diffMins / 60)}h ago`, color: 'var(--text-muted)' };
        return { label: activeDate.toLocaleDateString(), color: 'var(--text-muted)' };
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!roleData.fullName || !roleData.roleTitle) {
            alert('Full Name and Role Title are required.');
            return;
        }

        setLoading(true);
        try {
            if (editingRole) {
                // For existing roles, we update the template
                await roleService.updateRole(editingRole.id || editingRole.uid, {
                    name: roleData.roleTitle, // The template name is the title
                    fullName: roleData.fullName,
                    permissions: roleData.permissions
                });
            } else {
                // For new roles, we create a User Account AND a Role definition
                if (!roleData.email || !roleData.password) {
                    alert('Email and Password are required for new roles.');
                    setLoading(false);
                    return;
                }

                // 1. Create the Auth User with permissions
                await authService.createStaffAccount(roleData.email, roleData.password, {
                    name: roleData.fullName, // Actual person's name
                    role: roleData.roleTitle, // EXACT string for role (e.g. Hall Manager)
                    permissions: roleData.permissions
                });

                // 2. Also save the role definition for future use (as a template)
                await roleService.createRole({
                    name: roleData.roleTitle,
                    fullName: roleData.fullName,
                    permissions: roleData.permissions,
                    email: roleData.email // Store for record
                });
            }

            setShowModal(false);
            setEditingRole(null);
            setRoleData({
                fullName: '',
                roleTitle: '',
                email: '',
                password: '',
                permissions: {
                    manage_bookings: false,
                    manage_halls: false,
                    manage_degrees: false,
                    manage_users: false,
                    manage_lecturers: false,
                    manage_departments: false,
                    manage_courses: false,
                    manage_timetable: false,
                    manage_maintenance: false,
                    manage_holidays: false,
                    manage_slider: false,
                    access_tester: false,
                    view_dashboard: true
                }
            });
            loadRoles();
            alert(editingRole ? 'Role updated!' : 'Staff account and role created successfully!');
        } catch (error) {
            alert('Error saving: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (role) => {
        setEditingRole(role);
        setRoleData({
            fullName: role.name || role.fullName || '',
            roleTitle: role.role || role.name || '',
            email: role.email || '',
            password: '',
            permissions: { ...role.permissions }
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this?')) return;
        if (id) await roleService.deleteRole(id);
        loadRoles();
    };

    const togglePermission = (perm) => {
        setRoleData(prev => ({
            ...prev,
            permissions: {
                ...prev.permissions,
                [perm]: !prev.permissions[perm]
            }
        }));
    };

    const permissionLabels = {
        manage_bookings: 'Manage Bookings',
        manage_halls: 'Manage Halls',
        manage_degrees: 'Manage Degrees',
        manage_users: 'Manage Users/Roles',
        manage_lecturers: 'Manage Lecturers',
        manage_departments: 'Manage Departments',
        manage_courses: 'Manage Courses',
        manage_timetable: 'Manage Timetable',
        manage_maintenance: 'Manage Maintenance',
        manage_holidays: 'Manage Holidays',
        manage_slider: 'Manage Home Slider',
        access_tester: 'Access Tester',
        view_dashboard: 'View Admin Dashboard'
    };

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: isMobile ? '10px' : '20px' }}>
            <div style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between',
                alignItems: isMobile ? 'flex-start' : 'center',
                marginBottom: '30px',
                gap: isMobile ? '15px' : '0'
            }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-main)', margin: 0 }}>
                    <button onClick={() => navigate('/admin')} style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', display: 'flex' }}><FaArrowLeft /></button>
                    Staff & Role Management
                </h2>
                <button
                    className="btn-primary"
                    onClick={() => {
                        setEditingRole(null);
                        setRoleData({
                            fullName: '',
                            roleTitle: '',
                            email: '',
                            password: '',
                            permissions: {
                                manage_bookings: false,
                                manage_halls: false,
                                manage_degrees: false,
                                manage_users: false,
                                manage_lecturers: false,
                                manage_departments: false,
                                manage_courses: false,
                                manage_timetable: false,
                                manage_maintenance: false,
                                manage_holidays: false,
                                manage_slider: false,
                                access_tester: false,
                                view_dashboard: true
                            }
                        });
                        setShowModal(true);
                    }}
                    style={{ width: isMobile ? '100%' : 'auto', justifyContent: 'center' }}
                >
                    <FaPlus /> Create Staff Account
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                {roles.map(role => {
                    const status = getStatus(role.lastActive);
                    return (
                        <div key={role.id || role.uid} className="glass-panel" style={{
                            padding: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '15px',
                            border: status.active ? '1px solid rgba(46, 204, 113, 0.3)' : '1px solid var(--glass-border)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    <div style={{
                                        width: '10px', height: '10px', borderRadius: '50%', background: status.color,
                                        boxShadow: status.active ? `0 0 10px ${status.color}` : 'none'
                                    }} />
                                    <div>
                                        <h3 style={{ margin: 0, color: 'var(--accent-gold)', fontSize: '1.1rem' }}>{role.role || role.name}</h3>
                                        <div style={{ fontSize: '0.8rem', color: status.color, fontWeight: 'bold' }}>{status.label}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    {role.isTemplate ? (
                                        <>
                                            <button onClick={() => handleEdit(role)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}><FaEdit /></button>
                                            <button onClick={() => handleDelete(role.id)} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer' }}><FaTrash /></button>
                                        </>
                                    ) : (
                                        <div style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '10px', color: '#aaa' }}>Live Account</div>
                                    )}
                                </div>
                            </div>

                            <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '8px' }}>{role.name || role.fullName || 'No Name Set'}</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    <div>📧 {role.email}</div>
                                    {role.phone && <div>📞 {role.phone}</div>}
                                    {role.department && <div>🏢 {role.department}</div>}
                                </div>
                            </div>

                            <div>
                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,215,0,0.5)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Active Permissions</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {Object.entries(role.permissions || {}).map(([key, value]) => value && (
                                        <div key={key} style={{
                                            display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem',
                                            padding: '4px 8px', background: 'rgba(46, 204, 113, 0.1)', color: '#2ecc71',
                                            borderRadius: '4px', border: '1px solid rgba(46, 204, 113, 0.2)'
                                        }}>
                                            <FaCheck size={8} /> {permissionLabels[key]?.split('(')[0]}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {showModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000,
                    padding: '20px'
                }}>
                    <form onSubmit={handleSave} className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '30px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '20px' }}>{editingRole ? 'Edit Staff Template' : 'Add New Staff Member'}</h3>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem' }}>Full Name *</label>
                                <input
                                    required
                                    value={roleData.fullName}
                                    onChange={(e) => setRoleData({ ...roleData, fullName: e.target.value })}
                                    style={inputStyle}
                                    placeholder="e.g., Gayan"
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem' }}>Role *</label>
                                <select
                                    required
                                    value={roleData.roleTitle}
                                    onChange={(e) => setRoleData({ ...roleData, roleTitle: e.target.value })}
                                    style={inputStyle}
                                >
                                    <option value="" disabled>Select Role</option>
                                    {STANDARD_ROLES.map(role => (
                                        <option key={role} value={role} style={{ color: 'black' }}>{role}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {!editingRole && (
                            <>
                                <div style={{ marginBottom: '15px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem' }}>Login Email *</label>
                                    <input
                                        required
                                        type="email"
                                        value={roleData.email}
                                        onChange={(e) => setRoleData({ ...roleData, email: e.target.value })}
                                        style={inputStyle}
                                        placeholder="Enter staff email"
                                    />
                                </div>
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem' }}>Login Password *</label>
                                    <input
                                        required
                                        type="password"
                                        value={roleData.password}
                                        onChange={(e) => setRoleData({ ...roleData, password: e.target.value })}
                                        style={inputStyle}
                                        placeholder="Minimum 6 characters"
                                    />
                                </div>
                            </>
                        )}

                        <div style={{ marginBottom: '25px' }}>
                            <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.9rem' }}>Set Permissions</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {Object.keys(roleData.permissions).map(perm => (
                                    <div
                                        key={perm}
                                        onClick={() => togglePermission(perm)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '10px',
                                            borderRadius: '8px',
                                            background: roleData.permissions[perm] ? 'rgba(255,255,255,0.1)' : 'transparent',
                                            border: '1px solid var(--glass-border)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            fontSize: '0.85rem'
                                        }}
                                    >
                                        <div style={{
                                            width: '16px',
                                            height: '16px',
                                            borderRadius: '4px',
                                            border: '2px solid var(--accent-gold)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            marginRight: '12px',
                                            background: roleData.permissions[perm] ? 'var(--accent-gold)' : 'transparent',
                                            flexShrink: 0
                                        }}>
                                            {roleData.permissions[perm] && <FaCheck style={{ color: 'var(--primary-maroon)', fontSize: '10px' }} />}
                                        </div>
                                        {permissionLabels[perm]}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '15px' }}>
                            <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'white', cursor: 'pointer' }}>Cancel</button>
                            <button type="submit" className="btn-primary" style={{ flex: 2, padding: '12px' }} disabled={loading}>
                                {loading ? 'Processing...' : (editingRole ? 'Update Role' : 'Create Staff Account')}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

const inputStyle = {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid var(--glass-border)',
    background: 'rgba(255,255,255,0.05)',
    color: 'white',
    boxSizing: 'border-box',
    outline: 'none'
};

export default ManageRoles;
