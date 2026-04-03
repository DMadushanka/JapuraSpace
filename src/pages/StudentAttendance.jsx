import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaCheckCircle, FaExclamationTriangle, FaMapMarkerAlt, FaVideo } from 'react-icons/fa';
import { attendanceService } from '../services/attendance';
import '../styles/StudentAttendance.css';

export default function StudentAttendance() {
    const navigate = useNavigate();
    const [scanned, setScanned] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [locPermission, setLocPermission] = useState(false);
    const [userLocation, setUserLocation] = useState(null);
    const scannerRef = useRef(null);

    useEffect(() => {
        // Request Location
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setLocPermission(true);
                    setUserLocation({
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude,
                        accuracy: pos.coords.accuracy
                    });
                },
                (err) => {
                    console.warn(err);
                    setError("Location permission is required for attendance.");
                },
                { enableHighAccuracy: true }
            );
        } else {
            setError("Geolocation is not supported by your browser.");
        }

        // Initialize Scanner
        const scanner = new Html5QrcodeScanner(
            "reader",
            { fps: 10, qrbox: { width: 250, height: 250 } },
            /* verbose= */ false
        );

        scanner.render(onScanSuccess, onScanFailure);
        scannerRef.current = scanner;

        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(e => console.error(e));
            }
        };
    }, []);

    const onScanSuccess = async (decodedText) => {
        if (scanned || submitting || success) return;
        
        try {
            if (!decodedText.includes(':')) {
                throw new Error('Invalid QR Code format.');
            }

            setScanned(true);
            setSubmitting(true);
            setError(null);

            const [sessionId, token] = decodedText.split(':');
            
            // Generate a primitive device ID for web
            const deviceId = `WEB-${navigator.userAgent.substring(0, 50)}-${screen.width}x${screen.height}`;

            // Get fresh location if possible
            let loc = userLocation;
            try {
                const pos = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 });
                });
                loc = {
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    accuracy: pos.coords.accuracy
                };
            } catch (e) {
                console.warn("Could not get fresh loc, using cached", e);
            }

            if (!loc) {
                throw new Error("Unable to determine your location. Please enable GPS.");
            }

            await attendanceService.submitAttendance(
                sessionId,
                token,
                loc,
                deviceId
            );

            setSuccess(true);
            if (scannerRef.current) {
                scannerRef.current.clear().catch(e => console.error(e));
            }

        } catch (err) {
            console.error(err);
            let msg = err.message || 'Failed to mark attendance.';
            if (err.code === 'permission-denied') msg = err.message;
            if (err.code === 'invalid-argument') msg = 'Invalid or expired QR code.';
            if (err.code === 'already-exists') msg = 'You have already marked attendance.';
            if (err.code === 'resource-exhausted') msg = 'This device has already been used.';
            
            setError(msg);
            setScanned(false);
        } finally {
            setSubmitting(false);
        }
    };

    const onScanFailure = (error) => {
        // Many failures are normal as it looks for codes
        // console.warn(`Code scan error = ${error}`);
    };

    if (success) {
        return (
            <div className="attendance-result success">
                <FaCheckCircle className="icon" />
                <h2>Attendance Verified!</h2>
                <p>Your presence has been recorded in the digital ledger.</p>
                <button onClick={() => navigate('/dashboard')} className="finish-btn">Done</button>
            </div>
        );
    }

    return (
        <div className="student-attendance-page">
            <header className="page-header-premium">
                <button onClick={() => navigate(-1)} className="back-button">
                    <FaArrowLeft />
                </button>
                <div className="header-content">
                    <h1>Scan Attendance</h1>
                    <p>Mark your presence via QR</p>
                </div>
            </header>

            <div className="scanner-container">
                <div className="scanner-box">
                    <div id="reader"></div>
                    
                    {submitting && (
                        <div className="scan-overlay">
                            <div className="loader"></div>
                            <p>Verifying Location & Identity...</p>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="error-card">
                        <FaExclamationTriangle />
                        <p>{error}</p>
                        <button onClick={() => setError(null)}>Try Again</button>
                    </div>
                )}

                <div className="attendance-tips">
                    <div className="tip">
                        <FaVideo />
                        <span>Ensure the QR code is clearly visible in the frame.</span>
                    </div>
                    <div className="tip">
                        <FaMapMarkerAlt />
                        <span>You must be inside the venue to mark attendance.</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
