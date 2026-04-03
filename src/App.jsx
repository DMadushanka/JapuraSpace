import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { authService } from './services/auth';
import useInactivityTimeout from './hooks/useInactivityTimeout';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import HallList from './pages/HallList';
import HallDetails from './pages/HallDetails';
import BookingCalendar from './pages/BookingCalendar';
import BookingForm from './pages/BookingForm';
import BookingFlow from './pages/BookingFlow';
import MyBookings from './pages/MyBookings';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import SliderDetail from './pages/SliderDetail';
import UserTimetable from './pages/UserTimetable';
import AttendanceSession from './pages/lecturer/AttendanceSession';
import VenueAvailability from './pages/VenueAvailability';
import StudentAttendance from './pages/StudentAttendance';
import LectureDetails from './pages/LectureDetails';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import ManageHalls from './pages/admin/ManageHalls';
import HallForm from './pages/admin/HallForm';
import ManageUsers from './pages/admin/ManageUsers';
import ManageSlider from './pages/admin/ManageSlider';
import ManageRoles from './pages/admin/ManageRoles';
import BookingDetail from './pages/admin/BookingDetail';
import AdminCalendar from './pages/admin/AdminCalendar';
import TimetableManagement from './pages/admin/TimetableManagement';
import ManageDepartments from './pages/admin/ManageDepartments';
import ManageCourses from './pages/admin/ManageCourses';
import ManageDegrees from './pages/admin/ManageDegrees';
import ManageHolidays from './pages/admin/ManageHolidays';
import MaintenanceDashboard from './pages/admin/MaintenanceDashboard';
import ManageLecturers from './pages/admin/ManageLecturers';
import AttendanceManagement from './pages/admin/AttendanceManagement';

function App() {
  const [user, setUser] = useState(null);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    // Initialize persistence
    authService.initPersistence();

    const unsubscribe = authService.onAuthStateChanged(async (u) => {
      if (u) {
        setUser(u);
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Update last active status
  useEffect(() => {
    if (!user) return;

    const updateActivity = async () => {
      try {
        const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
        const { db } = await import('./services/firebase');
        await setDoc(doc(db, 'users', user.uid), {
          lastActive: serverTimestamp()
        }, { merge: true });
      } catch (e) {
        console.error("Activity update failed", e);
      }
    };

    updateActivity();
    const interval = setInterval(updateActivity, 120000); // Every 2 minutes
    return () => clearInterval(interval);
  }, [user]);

  // Use inactivity timeout (10 minutes) when user is logged in
  useInactivityTimeout(10, !!user);

  // Maintenance Alerts for Admin
  useEffect(() => {
    if (!user) return;

    let isSubscribed = true;
    let unsubscribe = null;

    const setupListener = async () => {
      try {
        const [perms, role] = await Promise.all([
          authService.getUserPermissions(user.uid),
          authService.getUserRole(user.uid)
        ]);

        if ((perms.view_dashboard || role === 'admin' || role === 'board') && isSubscribed) {
          const { reportingService } = await import('./services/firestore');
          unsubscribe = reportingService.subscribeToReports((reports) => {
            if (!isSubscribed) return;
            const now = new Date().getTime();
            // Find reports created in the last 10 seconds
            const recent = reports.find(r => {
              const rTime = r.createdAt?.toDate ? r.createdAt.toDate().getTime() : now;
              return (now - rTime) < 10000;
            });

            if (recent && recent.status === 'pending') {
              setAlert({
                title: '🚨 Maintenance Alert',
                message: `${recent.category} problem reported in ${recent.hallName}`,
                id: recent.id
              });
              // Auto-hide alert after 5 seconds
              setTimeout(() => setAlert(null), 5000);
            }
          });
        }
      } catch (e) {
        console.error("Admin listener setup failed", e);
      }
    };

    setupListener();
    return () => {
      isSubscribed = false;
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="login" element={<Login />} />
          <Route path="dashboard" element={<Dashboard />} />

          <Route path="halls" element={<HallList />} />
          <Route path="hall/:id" element={<HallDetails />} />
          <Route path="hall/:id/book" element={<BookingCalendar />} />
          <Route path="hall/:id/confirm" element={<BookingForm />} />

          <Route path="booking" element={<BookingFlow />} />
          <Route path="my-bookings" element={<MyBookings />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<Profile />} />
          <Route path="booking/:id" element={<BookingDetail />} />
          <Route path="slider/:id" element={<SliderDetail />} />
          <Route path="my-timetable" element={<UserTimetable />} />
          <Route path="lecture/:id" element={<LectureDetails />} />
          <Route path="lecturer/attendance" element={<AttendanceSession />} />
          <Route path="student/attendance" element={<StudentAttendance />} />

          <Route path="halls/availability" element={<VenueAvailability />} />

          {/* Admin Routes */}
          <Route path="admin" element={<AdminDashboard />} />
          <Route path="admin/halls" element={<ManageHalls />} />
          <Route path="admin/halls/add" element={<HallForm />} />
          <Route path="admin/halls/edit/:id" element={<HallForm />} />
          <Route path="admin/users" element={<ManageUsers />} />
          <Route path="admin/slider" element={<ManageSlider />} />
          <Route path="admin/roles" element={<ManageRoles />} />
          <Route path="admin/booking/:id" element={<BookingDetail />} />
          <Route path="admin/calendar" element={<AdminCalendar />} />
          <Route path="admin/timetables" element={<TimetableManagement />} />
          <Route path="admin/departments" element={<ManageDepartments />} />
          <Route path="admin/courses" element={<ManageCourses />} />
          <Route path="admin/degrees" element={<ManageDegrees />} />
          <Route path="admin/holidays" element={<ManageHolidays />} />
          <Route path="admin/maintenance" element={<MaintenanceDashboard />} />
          <Route path="admin/lecturers" element={<ManageLecturers />} />
          <Route path="admin/attendance" element={<AttendanceManagement />} />
        </Route>
      </Routes>

      {/* Admin Popup Notification */}
      {alert && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          backgroundColor: '#e74c3c',
          color: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          gap: '5px',
          cursor: 'pointer',
          border: '1px solid rgba(255,255,255,0.2)',
          animation: 'slideIn 0.3s ease-out'
        }} onClick={() => {
          setAlert(null);
          window.location.href = '/admin/maintenance';
        }}>
          <strong style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span role="img" aria-label="alert">🚨</span> {alert.title}
          </strong>
          <span style={{ fontSize: '0.9rem', opacity: 0.9 }}>{alert.message}</span>
          <div style={{ fontSize: '0.8rem', marginTop: '5px', fontWeight: 'bold', textDecoration: 'underline' }}>
            Click to view details
          </div>
          <style>{`
            @keyframes slideIn {
              from { transform: translateX(100%); opacity: 0; }
              to { transform: translateX(0); opacity: 1; }
            }
          `}</style>
        </div>
      )}
    </Router>
  );
}

export default App;
