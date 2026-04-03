import React, { useEffect, useState } from 'react';
import { userService, roleService } from '../../services/firestore';
import { authService } from '../../services/auth';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaUserEdit } from 'react-icons/fa';

const ManageUsers = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState(['student', 'lecturer', 'board', 'admin']);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

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
            if (!perms.manage_users) {
                alert('You do not have permission to manage users.');
                navigate('/admin');
                return;
            }
            loadUsers();
        };

        checkPerms();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        const [userData, roleData] = await Promise.all([
            userService.getAllUsers(),
            roleService.getAllRoles()
        ]);
        setUsers(userData);
        if (roleData.length > 0) {
            const customRoleNames = roleData.map(r => r.name.toLowerCase());
            // Combine default roles with custom roles, ensuring unique
            const allRoles = Array.from(new Set(['student', 'lecturer', 'board', 'admin', ...customRoleNames]));
            setRoles(allRoles);
        }
        setLoading(false);
    };

    const handleRoleChange = async (uid, newRole) => {
        if (!window.confirm(`Change user role to ${newRole}?`)) return;
        await userService.updateUserRole(uid, newRole);
        loadUsers();
    };

    const filteredUsers = users.filter(u =>
        (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );



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
                    User Management
                </h2>
                <input
                    placeholder="Search name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                        padding: '10px 20px',
                        borderRadius: '25px',
                        border: '1px solid var(--glass-border)',
                        background: 'rgba(255,255,255,0.08)',
                        color: 'white',
                        width: isMobile ? '100%' : '300px',
                        outline: 'none'
                    }}
                />
            </div>

            {isMobile ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {filteredUsers.map(user => (
                        <div key={user.uid || user.id} className="glass-panel" style={{ padding: '20px' }}>
                            <div style={{ marginBottom: '10px' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Name</div>
                                <div style={{ fontWeight: 'bold' }}>{user.name}</div>
                            </div>
                            <div style={{ marginBottom: '10px' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Email</div>
                                <div>{user.email}</div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                <div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Department</div>
                                    <div style={{ fontSize: '0.9rem' }}>{user.department || 'N/A'}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Role</div>
                                    <select
                                        value={user.role}
                                        onChange={(e) => handleRoleChange(user.uid || user.id, e.target.value)}
                                        style={{ padding: '6px', borderRadius: '4px', background: 'var(--primary-maroon)', color: 'var(--accent-gold)', border: '1px solid var(--accent-gold)', fontSize: '0.85rem' }}
                                    >
                                        {roles.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="glass-panel" style={{ padding: '0', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.05)', textAlign: 'left' }}>
                                <th style={{ padding: '15px' }}>Name</th>
                                <th style={{ padding: '15px' }}>Email</th>
                                <th style={{ padding: '15px' }}>Department</th>
                                <th style={{ padding: '15px', textAlign: 'center' }}>Role</th>
                                <th style={{ padding: '15px', textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(user => (
                                <tr key={user.uid || user.id} style={{ borderTop: '1px solid var(--glass-border)' }}>
                                    <td style={{ padding: '15px' }}>{user.name}</td>
                                    <td style={{ padding: '15px' }}>{user.email}</td>
                                    <td style={{ padding: '15px' }}>{user.department || 'N/A'}</td>
                                    <td style={{ padding: '15px', textAlign: 'center' }}>
                                        <span style={{
                                            padding: '4px 12px',
                                            borderRadius: '20px',
                                            background: user.role === 'admin' ? 'var(--primary-maroon)' : 'rgba(255,255,255,0.1)',
                                            color: user.role === 'admin' ? 'var(--accent-gold)' : 'white',
                                            fontSize: '0.8rem',
                                            fontWeight: 'bold',
                                            textTransform: 'uppercase'
                                        }}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td style={{ padding: '15px', textAlign: 'center' }}>
                                        <select
                                            value={user.role}
                                            onChange={(e) => handleRoleChange(user.uid || user.id, e.target.value)}
                                            style={{ padding: '6px', borderRadius: '4px', background: 'white', border: '1px solid #ccc', fontSize: '0.9rem' }}
                                        >
                                            {roles.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ManageUsers;
