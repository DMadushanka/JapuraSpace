import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/auth';
import { miscService } from '../services/firestore';
import logo from '../assets/logo.png';
import { FaUser, FaLock, FaEnvelope, FaPhone, FaBuilding, FaGraduationCap } from 'react-icons/fa';

const Login = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from || '/dashboard';
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [departments, setDepartments] = useState([]);

    // Form States
    // Form States
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState('student');
    const [department, setDepartment] = useState('');
    const [departmentId, setDepartmentId] = useState('');
    const [degree, setDegree] = useState('');
    const [degrees, setDegrees] = useState([]);
    const [degreesLoading, setDegreesLoading] = useState(false);
    const [phone, setPhone] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // New Fields State
    const [afNumber, setAfNumber] = useState('');
    const [arNumber, setArNumber] = useState('');
    const [academicYear, setAcademicYear] = useState('');
    const [lecturerType, setLecturerType] = useState('internal');
    const [organization, setOrganization] = useState('');
    const [qualifications, setQualifications] = useState('');

    // Academic Year Logic
    const [years, setYears] = useState([]);
    const [emailError, setEmailError] = useState('');

    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [resetSuccess, setResetSuccess] = useState('');

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);

        // Generate Academic Years
        const currentYear = new Date().getFullYear();
        const generatedYears = [];
        for (let i = 0; i < 5; i++) {
            const startYear = currentYear - i + 1;
            generatedYears.push(`${startYear - 1}/${startYear}`);
        }
        setYears(generatedYears);

        // Fetch departments
        const loadDepts = async () => {
            const depts = await miscService.getDepartments();
            setDepartments(depts);
        };
        loadDepts();

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Fetch degrees when department changes
    useEffect(() => {
        if (departmentId) {
            const loadDegrees = async () => {
                setDegreesLoading(true);
                try {
                    const degs = await miscService.getDegrees(departmentId);
                    setDegrees(degs);
                } catch (err) {
                    console.error('Error fetching degrees:', err);
                } finally {
                    setDegreesLoading(false);
                }
            };
            loadDegrees();
        } else {
            setDegrees([]);
        }
    }, [departmentId]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const user = await authService.signIn(email, password);

            // Check if email is verified
            if (!user.emailVerified) {
                await authService.signOut();
                setError('Please verify your email address before logging in. Check your inbox.');
                setLoading(false);
                return;
            }

            // Fetch both role and permissions to ensure they're cached before navigation
            const [userRole, userPermissions] = await Promise.all([
                authService.getUserRole(user.uid),
                authService.getUserPermissions(user.uid)
            ]);

            // Check if user has admin access (role-based or permission-based)
            const hasAdminAccess =
                userRole === 'admin' ||
                userRole === 'board' ||
                userPermissions.view_dashboard ||
                userPermissions.manage_halls ||
                userPermissions.manage_users ||
                userPermissions.manage_bookings ||
                userPermissions.manage_slider ||
                userPermissions.manage_calendar ||
                userPermissions.manage_roles;

            // Navigate to appropriate dashboard
            if (hasAdminAccess) {
                navigate(from === '/dashboard' ? '/admin' : from);
            } else {
                navigate(from);
            }
        } catch (err) {
            setError(authService.getFriendlyErrorMessage ? authService.getFriendlyErrorMessage(err) : (err.message || 'Login failed'));
            setLoading(false);
        }
    };

    const handleSignUp = async (e) => {
        e.preventDefault();
        setError('');

        // Common Validation
        if (!name || !email || !password || !confirmPassword || !phone) {
            setError('Please fill in all common fields (Name, Email, Password, Phone).');
            return;
        }

        // Student Validation
        if (role === 'student') {
            if (!department || !degree || !afNumber || !arNumber || !academicYear) {
                setError('Please fill in all student details (Dept, Degree, AF, AR, Year).');
                return;
            }
        }

        // Lecturer Validation
        if (role === 'lecturer') {
            if (!organization || !lecturerType || !qualifications) {
                setError('Please fill in all lecturer details (Org, Type, Qualifications).');
                return;
            }
        }

        // Email regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError('Please enter a valid email address');
            return;
        }

        if (phone.length !== 10) {
            setError('Phone number must be exactly 10 digits');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            await authService.signUp(email, password, {
                name,
                role,
                phone,
                // Student Data
                department: role === 'student' ? department : '',
                degree: role === 'student' ? degree : '',
                afNumber: role === 'student' ? afNumber : '',
                arNumber: role === 'student' ? arNumber : '',
                academicYear: role === 'student' ? academicYear : '',
                // Lecturer Data
                lecturerType: role === 'lecturer' ? lecturerType : '',
                organization: role === 'lecturer' ? organization : '',
                qualifications: role === 'lecturer' ? qualifications : '',
            });
            alert('Account created! Please verify your email.');
            setIsLogin(true);
        } catch (err) {
            setError(authService.getFriendlyErrorMessage ? authService.getFriendlyErrorMessage(err) : err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError('');
        setResetSuccess('');

        if (!email) {
            setError('Please enter your email address');
            return;
        }

        setLoading(true);
        try {
            await authService.resetPassword(email);
            setResetSuccess('Password reset link sent! Please check your inbox.');
        } catch (err) {
            setError(err.message || 'Failed to send reset email');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glass-panel" style={{
            maxWidth: isMobile ? '100%' : '480px',
            margin: isMobile ? '20px auto' : '40px auto',
            padding: isMobile ? '30px 20px' : '40px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Decorative Top Bar */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '4px',
                background: 'linear-gradient(to right, var(--primary-maroon), var(--accent-gold))'
            }} />

            <div style={{ marginBottom: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                    width: '120px',
                    height: '120px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '10px'
                }}>
                    <img src={logo} alt="University Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 0 12px rgba(212, 175, 55, 0.3))' }} />
                </div>
                <h2 style={{ fontSize: isMobile ? '1.5rem' : '1.8rem', color: 'var(--text-main)' }}>
                    {isForgotPassword ? 'Reset Password' : (isLogin ? 'Welcome Back' : 'Join the Community')}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: isMobile ? '0.85rem' : '1rem' }}>
                    {isForgotPassword
                        ? 'Enter your email to receive a reset link'
                        : (isLogin ? 'Sign in to access your dashboard' : 'Create your account to start booking')}
                </p>
            </div>

            {!isForgotPassword && (
                /* Tabs */
                <div style={{
                    display: 'flex',
                    marginBottom: '30px',
                    background: 'rgba(255,255,255,0.05)',
                    padding: '4px',
                    borderRadius: '8px'
                }}>
                    <button
                        onClick={() => setIsLogin(true)}
                        style={{
                            flex: 1,
                            padding: '10px',
                            border: 'none',
                            background: isLogin ? 'var(--primary-maroon)' : 'transparent',
                            color: isLogin ? 'var(--accent-gold)' : 'var(--text-muted)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            transition: 'all 0.3s'
                        }}
                    >
                        Sign In
                    </button>
                    <button
                        onClick={() => setIsLogin(false)}
                        style={{
                            flex: 1,
                            padding: '10px',
                            border: 'none',
                            background: !isLogin ? 'var(--primary-maroon)' : 'transparent',
                            color: !isLogin ? 'var(--accent-gold)' : 'var(--text-muted)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            transition: 'all 0.3s'
                        }}
                    >
                        Sign Up
                    </button>
                </div>
            )}

            {resetSuccess && (
                <div style={{
                    background: 'rgba(46, 204, 113, 0.1)', border: '1px solid rgba(46, 204, 113, 0.3)',
                    color: '#2ecc71', padding: '10px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem'
                }}>
                    {resetSuccess}
                </div>
            )}

            {error && (
                <div style={{
                    background: 'rgba(231, 76, 60, 0.1)', border: '1px solid rgba(231, 76, 60, 0.3)',
                    color: '#e74c3c', padding: '10px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem'
                }}>
                    {error}
                </div>
            )}

            <form onSubmit={isForgotPassword ? handleResetPassword : (isLogin ? handleLogin : handleSignUp)} style={{ textAlign: 'left' }}>

                {!isLogin && !isForgotPassword && (
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ position: 'relative' }}>
                            <FaUser style={{ position: 'absolute', top: '14px', left: '12px', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder="Full Name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required={!isLogin && !isForgotPassword}
                                style={{
                                    width: '100%', padding: '12px 12px 12px 40px', borderRadius: '8px',
                                    border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)',
                                    color: 'white', outline: 'none'
                                }}
                            />
                        </div>
                    </div>
                )}

                <div style={{ marginBottom: '16px' }}>
                    <div style={{ position: 'relative' }}>
                        <FaEnvelope style={{ position: 'absolute', top: '14px', left: '12px', color: emailError ? 'red' : 'var(--text-muted)' }} />
                        <input
                            type="email"
                            placeholder="Email Address"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                if (e.target.value) {
                                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                                    if (!emailRegex.test(e.target.value)) {
                                        setEmailError('Please enter a valid email address');
                                    } else {
                                        setEmailError('');
                                    }
                                } else {
                                    setEmailError('');
                                }
                            }}
                            required
                            style={{
                                width: '100%', padding: '12px 12px 12px 40px', borderRadius: '8px',
                                border: `1px solid ${emailError ? 'red' : 'var(--glass-border)'}`,
                                background: 'rgba(255,255,255,0.05)',
                                color: 'white', outline: 'none'
                            }}
                        />
                    </div>
                    {emailError && <div style={{ color: 'red', fontSize: '0.8rem', marginTop: '4px', textAlign: 'left' }}>{emailError}</div>}
                </div>

                {!isLogin && !isForgotPassword && (
                    <>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Role</label>
                            <select
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                style={{
                                    width: '100%', padding: '12px', borderRadius: '8px',
                                    border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)',
                                    color: 'white', outline: 'none'
                                }}
                            >
                                <option value="student" style={{ color: 'black' }}>Student</option>
                                <option value="lecturer" style={{ color: 'black' }}>Lecturer</option>
                            </select>
                        </div>

                        {/* Student Specific Fields */}
                        {role === 'student' && (
                            <>
                                <div style={{ marginBottom: '16px' }}>
                                    <div style={{ position: 'relative' }}>
                                        <FaBuilding style={{ position: 'absolute', top: '14px', left: '12px', color: 'var(--text-muted)' }} />
                                        <select
                                            value={department}
                                            onChange={(e) => {
                                                const selectedDept = departments.find(d => d.name === e.target.value);
                                                setDepartment(e.target.value);
                                                setDepartmentId(selectedDept ? selectedDept.id : '');
                                                setDegree('');
                                            }}
                                            style={{
                                                width: '100%', padding: '12px 12px 12px 40px', borderRadius: '8px',
                                                border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)',
                                                color: department ? 'white' : '#aaa', outline: 'none', appearance: 'none'
                                            }}
                                        >
                                            <option value="" style={{ color: 'black' }}>Select Department</option>
                                            {departments.map((dept, i) => (
                                                <option key={dept.id || i} value={dept.name} style={{ color: 'black' }}>{dept.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '16px' }}>
                                    <div style={{ position: 'relative' }}>
                                        <FaGraduationCap style={{ position: 'absolute', top: '14px', left: '12px', color: 'var(--text-muted)', opacity: department ? 1 : 0.5 }} />
                                        <select
                                            value={degree}
                                            onChange={(e) => setDegree(e.target.value)}
                                            disabled={!department || degreesLoading}
                                            style={{
                                                width: '100%', padding: '12px 12px 12px 40px', borderRadius: '8px',
                                                border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)',
                                                color: degree ? 'white' : '#aaa', outline: 'none', appearance: 'none',
                                                opacity: department ? 1 : 0.5
                                            }}
                                        >
                                            <option value="" style={{ color: 'black' }}>
                                                {degreesLoading ? 'Loading degrees...' : 'Select Degree Program'}
                                            </option>
                                            {degrees.map((deg, i) => (
                                                <option key={deg.id || i} value={deg.name} style={{ color: 'black' }}>{deg.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <div style={{ marginBottom: '16px', flex: 1 }}>
                                        <input
                                            type="text"
                                            placeholder="AF Number"
                                            value={afNumber}
                                            onChange={(e) => setAfNumber(e.target.value)}
                                            style={{
                                                width: '100%', padding: '12px', borderRadius: '8px',
                                                border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)',
                                                color: 'white', outline: 'none'
                                            }}
                                        />
                                    </div>
                                    <div style={{ marginBottom: '16px', flex: 1 }}>
                                        <input
                                            type="text"
                                            placeholder="AR Number"
                                            value={arNumber}
                                            onChange={(e) => setArNumber(e.target.value)}
                                            style={{
                                                width: '100%', padding: '12px', borderRadius: '8px',
                                                border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)',
                                                color: 'white', outline: 'none'
                                            }}
                                        />
                                    </div>
                                </div>

                                <div style={{ marginBottom: '16px' }}>
                                    <select
                                        value={academicYear}
                                        onChange={(e) => setAcademicYear(e.target.value)}
                                        style={{
                                            width: '100%', padding: '12px', borderRadius: '8px',
                                            border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)',
                                            color: academicYear ? 'white' : '#aaa', outline: 'none'
                                        }}
                                    >
                                        <option value="" style={{ color: 'black' }}>Select Academic Year</option>
                                        {years.map(y => (
                                            <option key={y} value={y} style={{ color: 'black' }}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            </>
                        )}

                        {/* Lecturer Specific Fields */}
                        {role === 'lecturer' && (
                            <>
                                <div style={{ marginBottom: '16px' }}>
                                    <select
                                        value={lecturerType}
                                        onChange={(e) => setLecturerType(e.target.value)}
                                        style={{
                                            width: '100%', padding: '12px', borderRadius: '8px',
                                            border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)',
                                            color: 'white', outline: 'none'
                                        }}
                                    >
                                        <option value="internal" style={{ color: 'black' }}>Internal Lecturer</option>
                                        <option value="visiting" style={{ color: 'black' }}>Visiting Lecturer</option>
                                        <option value="assistant" style={{ color: 'black' }}>Assistant Lecturer</option>
                                    </select>
                                </div>

                                <div style={{ marginBottom: '16px' }}>
                                    <input
                                        type="text"
                                        placeholder="Organization / University"
                                        value={organization}
                                        onChange={(e) => setOrganization(e.target.value)}
                                        style={{
                                            width: '100%', padding: '12px', borderRadius: '8px',
                                            border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)',
                                            color: 'white', outline: 'none'
                                        }}
                                    />
                                </div>

                                <div style={{ marginBottom: '16px' }}>
                                    <input
                                        type="text"
                                        placeholder="Qualifications / Degrees"
                                        value={qualifications}
                                        onChange={(e) => setQualifications(e.target.value)}
                                        style={{
                                            width: '100%', padding: '12px', borderRadius: '8px',
                                            border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)',
                                            color: 'white', outline: 'none'
                                        }}
                                    />
                                </div>
                            </>
                        )}

                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ position: 'relative' }}>
                                <FaPhone style={{ position: 'absolute', top: '14px', left: '12px', color: 'var(--text-muted)' }} />
                                <input
                                    type="tel"
                                    placeholder="Phone Number (10 digits)"
                                    value={phone}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        if (val.length <= 10) setPhone(val);
                                    }}
                                    style={{
                                        width: '100%', padding: '12px 12px 12px 40px', borderRadius: '8px',
                                        border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)',
                                        color: 'white', outline: 'none'
                                    }}
                                />
                            </div>
                        </div>

                    </>
                )}

                {!isForgotPassword && (
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ position: 'relative' }}>
                            <FaLock style={{ position: 'absolute', top: '14px', left: '12px', color: 'var(--text-muted)' }} />
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                style={{
                                    width: '100%', padding: '12px 12px 12px 40px', borderRadius: '8px',
                                    border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)',
                                    color: 'white', outline: 'none'
                                }}
                            />
                        </div>
                    </div>
                )}

                {!isLogin && !isForgotPassword && (
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{ position: 'relative' }}>
                            <FaLock style={{ position: 'absolute', top: '14px', left: '12px', color: 'var(--text-muted)' }} />
                            <input
                                type="password"
                                placeholder="Confirm Password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                style={{
                                    width: '100%', padding: '12px 12px 12px 40px', borderRadius: '8px',
                                    border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)',
                                    color: 'white', outline: 'none'
                                }}
                            />
                        </div>
                    </div>
                )}

                <button
                    className="btn-primary"
                    disabled={loading}
                    type="submit"
                    style={{ width: '100%', padding: '14px', opacity: loading ? 0.7 : 1 }}
                >
                    {loading ? 'Processing...' : (isForgotPassword ? 'Send Reset Link' : (isLogin ? 'Sign In' : 'Create Account'))}
                </button>
            </form>

            {isForgotPassword ? (
                <p
                    onClick={() => {
                        setIsForgotPassword(false);
                        setError('');
                        setResetSuccess('');
                    }}
                    style={{ marginTop: '20px', fontSize: '0.9rem', color: 'var(--accent-gold)', cursor: 'pointer', fontWeight: 'bold' }}
                >
                    Back to Sign In
                </p>
            ) : (
                isLogin && (
                    <p
                        onClick={() => {
                            setIsForgotPassword(true);
                            setError('');
                            setResetSuccess('');
                        }}
                        style={{ marginTop: '20px', fontSize: '0.9rem', color: 'var(--accent-gold)', cursor: 'pointer' }}
                    >
                        Forgot Password?
                    </p>
                )
            )}
        </div>
    );
};

export default Login;
