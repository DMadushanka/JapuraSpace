import { auth, db, firebaseConfig } from './firebase';
import { initializeApp, deleteApp } from 'firebase/app';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendEmailVerification,
    updateProfile,
    sendPasswordResetEmail,
    getAuth,
    setPersistence,
    browserLocalPersistence
} from 'firebase/auth';
import { doc, getDoc, getDocFromServer, setDoc, serverTimestamp } from 'firebase/firestore';

export const authService = {
    auth, // Expose the auth object

    // Set Persistence to Local (persists even when browser/tab closes)
    initPersistence: async () => {
        try {
            await setPersistence(auth, browserLocalPersistence);
        } catch (error) {
            console.error('Persistence error:', error);
        }
    },

    // Sign in with email and password
    signIn: async (email, password) => {
        try {
            await authService.initPersistence();
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Update last active is handled by App.jsx listener separately
            // await setDoc(doc(db, 'users', user.uid), {
            //     lastActive: serverTimestamp()
            // }, { merge: true });

            return user;
        } catch (error) {
            console.error('Sign in error:', error);
            throw error;
        }
    },

    // Create new user account
    signUp: async (email, password, userData) => {
        try {
            await authService.initPersistence();
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Update display name
            if (userData.name) {
                await updateProfile(user, { displayName: userData.name });
            }

            // Save user data to Firestore
            const userDocData = {
                uid: user.uid,
                email: user.email,
                name: userData.name || '',
                role: userData.role || 'student',
                phone: userData.phone || '',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            if (userData.role === 'student') {
                Object.assign(userDocData, {
                    department: userData.department || '',
                    degree: userData.degree || '',
                    afNumber: userData.afNumber || '',
                    arNumber: userData.arNumber || '',
                    academicYear: userData.academicYear || '',
                    isVerified: true
                });
            } else if (userData.role === 'lecturer') {
                Object.assign(userDocData, {
                    lecturerType: userData.lecturerType || '',
                    organization: userData.organization || '',
                    qualifications: userData.qualifications || '',
                    isVerified: false
                });
            }

            await setDoc(doc(db, 'users', user.uid), userDocData);
            stone

            // Send verification email
            let verificationSent = false;
            try {
                await sendEmailVerification(user);
                verificationSent = true;
            } catch (err) {
                console.warn('Failed to send verification email', err);
            }

            return { user, verificationSent };
        } catch (error) {
            console.error('Sign up error:', error);
            throw error;
        }
    },

    getFriendlyErrorMessage: (error) => {
        const code = error.code || error.message;
        if (code.includes('auth/user-not-found') || code.includes('auth/invalid-credential')) {
            return 'No account found with this email. Please sign up or check your spelling.';
        } else if (code.includes('auth/wrong-password')) {
            return 'Incorrect password. Please try again.';
        } else if (code.includes('auth/email-already-in-use')) {
            return 'This email is already registered. Please log in instead.';
        } else if (code.includes('auth/invalid-email')) {
            return 'Invalid email address format.';
        } else if (code.includes('auth/weak-password')) {
            return 'Password should be at least 6 characters.';
        } else if (code.includes('auth/network-request-failed')) {
            return 'Network error. Please check your internet connection.';
        } else if (code.includes('auth/too-many-requests')) {
            return 'Too many attempts. Please try again later.';
        }
        return error.message || 'An unexpected error occurred.';
    },

    // Create staff account without logging out the current admin
    createStaffAccount: async (email, password, userData) => {
        // Initialize a temporary app instance
        const tempApp = initializeApp(firebaseConfig, "TempAdminApp");
        const tempAuth = getAuth(tempApp);

        try {
            const userCredential = await createUserWithEmailAndPassword(tempAuth, email, password);
            const user = userCredential.user;

            // Update display name on the temp account
            if (userData.name) {
                await updateProfile(user, { displayName: userData.name });
            }

            // Save user data to Firestore using the primary db instance
            await setDoc(doc(db, 'users', user.uid), {
                uid: user.uid,
                email: user.email,
                name: userData.name || '',
                role: userData.role || 'staff',
                permissions: userData.permissions || {},
                department: userData.department || 'Admin Branch',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            // Sign out the temp app to clean up
            await signOut(tempAuth);
            // Delete the temp app
            await deleteApp(tempApp);

            return user;
        } catch (error) {
            // Clean up even on error
            try {
                await deleteApp(tempApp);
            } catch (e) { }
            console.error('Create staff error:', error);
            throw error;
        }
    },

    // Sign out
    signOut: async () => {
        // Clear cached role and permissions
        const keys = Object.keys(sessionStorage);
        keys.forEach(key => {
            if (key.startsWith('userRole_') || key.startsWith('userPermissions_')) {
                sessionStorage.removeItem(key);
            }
        });
        return signOut(auth);
    },

    // Auth State Listener
    onAuthStateChanged: (callback) => onAuthStateChanged(auth, callback),

    // Get User Role
    getUserRole: async (uid) => {
        // Check sessionStorage cache first for immediate access
        const cacheKey = `userRole_${uid}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            return cached;
        }

        const fetchRole = async (attempt = 1) => {
            try {
                const docRef = doc(db, 'users', uid);
                // Force fetch from server to avoid empty/stale cache on first load
                const docSnap = await getDocFromServer(docRef);
                if (docSnap.exists()) {
                    const role = docSnap.data().role || 'student';
                    // Cache the role in sessionStorage for immediate subsequent access
                    sessionStorage.setItem(cacheKey, role);
                    return role;
                }
                return 'student'; // default if doc exists but no role (unlikely) or doc missing?
            } catch (error) {
                console.warn(`Attempt ${attempt} to fetch role failed:`, error);
                if (attempt < 5) {
                    // Exponential backoff: 300ms, 600ms, 1200ms, 2400ms
                    const delay = 300 * Math.pow(2, attempt - 1);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return fetchRole(attempt + 1);
                }
                return 'student'; // fallback after retries
            }
        };
        return fetchRole();
    },

    // Get User Permissions
    getUserPermissions: async (uid) => {
        // Check sessionStorage cache first
        const cacheKey = `userPermissions_${uid}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            try {
                return JSON.parse(cached);
            } catch (e) {
                // Invalid cache, continue to fetch
                sessionStorage.removeItem(cacheKey);
            }
        }

        try {
            const docRef = doc(db, 'users', uid);
            // Use getDocFromServer for consistent behavior with getUserRole
            const docSnap = await getDocFromServer(docRef);

            if (!docSnap.exists()) return {};

            const userData = docSnap.data();
            const role = userData.role;

            let permissions = {};

            // If the user has direct permissions assigned (for custom staff), use those
            if (userData.permissions) {
                permissions = userData.permissions;
            }
            // Full access for default admin/board roles
            else if (role === 'admin' || role === 'board') {
                permissions = {
                    manage_halls: true,
                    manage_users: true,
                    manage_bookings: true,
                    manage_slider: true,
                    manage_calendar: true,
                    manage_roles: true,
                    view_dashboard: true
                };
            }
            else {
                // Fallback: Check for custom role template permissions
                const { collection, query, where, getDocs } = await import('firebase/firestore');
                const q = query(collection(db, 'roles'), where('name', '==', role));
                const snapshot = await getDocs(q);

                if (!snapshot.empty) {
                    const roleData = snapshot.docs[0].data();
                    permissions = roleData.permissions || {};
                } else {
                    // Default permissions for regular users
                    permissions = {
                        view_dashboard: false
                    };
                }
            }

            // Cache the permissions
            sessionStorage.setItem(cacheKey, JSON.stringify(permissions));
            return permissions;
        } catch (error) {
            console.error('Error fetching permissions:', error);
            return {};
        }
    },

    // Reset password
    resetPassword: async (email) => {
        try {
            await sendPasswordResetEmail(auth, email);
        } catch (error) {
            console.error('Password reset error:', error);
            throw error;
        }
    }
};
