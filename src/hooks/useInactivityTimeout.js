import { useEffect, useCallback } from 'react';
import { authService } from '../services/auth';

/**
 * Hook to automatically log out the user after a period of inactivity.
 * @param {number} timeoutInMinutes - Minutes of inactivity before logout.
 * @param {boolean} isActive - Whether the inactivity listener should be active.
 */
const useInactivityTimeout = (timeoutInMinutes = 10, isActive = false) => {
    const handleLogout = useCallback(async () => {
        try {
            await authService.signOut();
            window.location.href = '/login'; // Force redirect to login
        } catch (error) {
            console.error('Auto logout error:', error);
        }
    }, []);

    useEffect(() => {
        if (!isActive) return;

        let timeoutId;

        const resetTimer = () => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(handleLogout, timeoutInMinutes * 60 * 1000);
        };

        // Events to track user activity
        const events = [
            'mousedown',
            'mousemove',
            'keypress',
            'scroll',
            'touchstart',
            'click'
        ];

        // Initial set of the timer
        resetTimer();

        // Add event listeners to reset the timer on any activity
        events.forEach(event => {
            window.addEventListener(event, resetTimer);
        });

        // Cleanup function
        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            events.forEach(event => {
                window.removeEventListener(event, resetTimer);
            });
        };
    }, [handleLogout, timeoutInMinutes, isActive]);
};

export default useInactivityTimeout;
