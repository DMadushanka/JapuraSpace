const MARKERS_KEY = 'personal_calendar_markers';

export const personalMarkerService = {
    // Get all personal markers
    getMarkers: async () => {
        try {
            const jsonValue = localStorage.getItem(MARKERS_KEY);
            return jsonValue != null ? JSON.parse(jsonValue) : {};
        } catch (e) {
            console.error('Error reading personal markers:', e);
            return {};
        }
    },

    // Save a marker for a specific date
    saveMarker: async (date, markerData) => {
        try {
            const markers = await personalMarkerService.getMarkers();
            markers[date] = {
                ...markerData,
                updatedAt: new Date().toISOString()
            };
            localStorage.setItem(MARKERS_KEY, JSON.stringify(markers));
            return true;
        } catch (e) {
            console.error('Error saving personal marker:', e);
            return false;
        }
    },

    // Delete a marker for a specific date
    deleteMarker: async (date) => {
        try {
            const markers = await personalMarkerService.getMarkers();
            if (markers[date]) {
                delete markers[date];
                localStorage.setItem(MARKERS_KEY, JSON.stringify(markers));
            }
            return true;
        } catch (e) {
            console.error('Error deleting personal marker:', e);
            return false;
        }
    },

    // Clear all personal markers
    clearAllMarkers: async () => {
        try {
            localStorage.removeItem(MARKERS_KEY);
            return true;
        } catch (e) {
            console.error('Error clearing personal markers:', e);
            return false;
        }
    }
};
