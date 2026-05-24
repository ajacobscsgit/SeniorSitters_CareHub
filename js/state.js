// SeniorSitters CareHub - Shared State Management
// ================================================
// Central state store for all CareHub modules
// Provides reactive state management with subscription pattern

window.CareHubState = (function() {
    'use strict';

    // Internal state storage
    const state = {
        // Dashboard KPIs
        dashboard: {
            newApplications: 0,
            pendingCareRequests: 0,
            todaysVisits: 0,
            pendingTimesheets: 0,
            pendingVisitUpdates: 0,
            activeCaregivers: 0,
            activeClients: 0,
            unassignedVisits: 0,
            cancelledVisits: 0,
            onboardingCaregivers: 0,
            lastUpdated: null
        },

        // Live collections
        applications: [],
        careRequests: [],
        caregivers: [],
        clients: [],
        schedules: [],
        timesheets: [],
        visitUpdates: [],
        alerts: [],
        activities: [],
        todaysSchedule: [],
        onboardingList: [],

        // UI State
        ui: {
            currentPage: 'dashboard',
            isLoading: false,
            lastError: null,
            sidebarOpen: false,
            modalOpen: false,
            activeFilters: {}
        },

        // Cache metadata
        cache: {
            lastFetch: {},
            isStale: {}
        }
    };

    // Subscription registry
    const subscribers = new Map();
    let subscriberId = 0;

    // ==================== CORE STATE METHODS ====================

    /**
     * Get current state (or slice of state)
     * @param {string} path - Dot-notation path (e.g., 'dashboard.todaysVisits')
     * @returns {any}
     */
    function get(path) {
        if (!path) return { ...state };
        
        const keys = path.split('.');
        let value = state;
        
        for (const key of keys) {
            if (value === null || value === undefined) return undefined;
            value = value[key];
        }
        
        // Return deep copy for objects/arrays to prevent mutations
        if (typeof value === 'object' && value !== null) {
            return JSON.parse(JSON.stringify(value));
        }
        return value;
    }

    /**
     * Set state value (triggers subscribers)
     * @param {string} path - Dot-notation path
     * @param {any} value - New value
     * @param {boolean} silent - Don't notify subscribers
     */
    function set(path, value, silent = false) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let target = state;
        
        // Navigate to parent object
        for (const key of keys) {
            if (!(key in target) || typeof target[key] !== 'object') {
                target[key] = {};
            }
            target = target[key];
        }
        
        // Get old value for change detection
        const oldValue = target[lastKey];
        
        // Only update if changed
        if (JSON.stringify(oldValue) !== JSON.stringify(value)) {
            target[lastKey] = value;
            
            // Update cache metadata
            state.cache.lastFetch[path] = new Date().toISOString();
            state.cache.isStale[path] = false;
            
            if (!silent) {
                notifySubscribers(path, value, oldValue);
            }
        }
    }

    /**
     * Update multiple state values at once
     * @param {Object} updates - Object with path keys and values
     * @param {boolean} silent - Don't notify subscribers
     */
    function batchUpdate(updates, silent = false) {
        const changedPaths = [];
        
        for (const [path, value] of Object.entries(updates)) {
            const keys = path.split('.');
            const lastKey = keys.pop();
            let target = state;
            
            for (const key of keys) {
                if (!(key in target) || typeof target[key] !== 'object') {
                    target[key] = {};
                }
                target = target[key];
            }
            
            const oldValue = target[lastKey];
            if (JSON.stringify(oldValue) !== JSON.stringify(value)) {
                target[lastKey] = value;
                changedPaths.push({ path, newValue: value, oldValue });
            }
        }
        
        if (!silent && changedPaths.length > 0) {
            // Notify for each changed path
            changedPaths.forEach(({ path, newValue, oldValue }) => {
                notifySubscribers(path, newValue, oldValue);
            });
            
            // Also notify global subscribers
            notifyGlobalSubscribers(changedPaths);
        }
    }

    /**
     * Subscribe to state changes
     * @param {string|Function} path - Path to watch, or callback for all changes
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    function subscribe(path, callback) {
        // Allow subscribe(callback) to watch all changes
        if (typeof path === 'function') {
            callback = path;
            path = '*';
        }
        
        const id = ++subscriberId;
        
        if (!subscribers.has(path)) {
            subscribers.set(path, new Map());
        }
        
        subscribers.get(path).set(id, callback);
        
        // Return unsubscribe function
        return function unsubscribe() {
            const pathSubs = subscribers.get(path);
            if (pathSubs) {
                pathSubs.delete(id);
                if (pathSubs.size === 0) {
                    subscribers.delete(path);
                }
            }
        };
    }

    /**
     * Notify subscribers of a state change
     */
    function notifySubscribers(changedPath, newValue, oldValue) {
        // Notify exact path subscribers
        const exactSubs = subscribers.get(changedPath);
        if (exactSubs) {
            exactSubs.forEach(callback => {
                try {
                    callback(newValue, oldValue, changedPath);
                } catch (e) {
                    console.error('[CareHubState] Subscriber error:', e);
                }
            });
        }
        
        // Notify parent path subscribers
        const pathParts = changedPath.split('.');
        for (let i = 1; i < pathParts.length; i++) {
            const parentPath = pathParts.slice(0, i).join('.');
            const parentSubs = subscribers.get(parentPath);
            if (parentSubs) {
                const parentValue = get(parentPath);
                parentSubs.forEach(callback => {
                    try {
                        callback(parentValue, null, changedPath);
                    } catch (e) {
                        console.error('[CareHubState] Parent subscriber error:', e);
                    }
                });
            }
        }
        
        // Notify wildcard subscribers
        const wildcardSubs = subscribers.get('*');
        if (wildcardSubs) {
            wildcardSubs.forEach(callback => {
                try {
                    callback({ path: changedPath, newValue, oldValue }, state);
                } catch (e) {
                    console.error('[CareHubState] Wildcard subscriber error:', e);
                }
            });
        }
    }

    /**
     * Notify global subscribers of batch changes
     */
    function notifyGlobalSubscribers(changedPaths) {
        const wildcardSubs = subscribers.get('*');
        if (wildcardSubs) {
            wildcardSubs.forEach(callback => {
                try {
                    callback({ batch: changedPaths }, state);
                } catch (e) {
                    console.error('[CareHubState] Global subscriber error:', e);
                }
            });
        }
    }

    // ==================== CONVENIENCE METHODS ====================

    /**
     * Reset state to defaults
     */
    function reset() {
        state.dashboard = {
            newApplications: 0,
            pendingCareRequests: 0,
            todaysVisits: 0,
            pendingTimesheets: 0,
            pendingVisitUpdates: 0,
            activeCaregivers: 0,
            activeClients: 0,
            unassignedVisits: 0,
            cancelledVisits: 0,
            onboardingCaregivers: 0,
            lastUpdated: null
        };
        state.applications = [];
        state.careRequests = [];
        state.caregivers = [];
        state.clients = [];
        state.schedules = [];
        state.timesheets = [];
        state.visitUpdates = [];
        state.alerts = [];
        state.activities = [];
        state.todaysSchedule = [];
        state.onboardingList = [];
        state.ui = {
            currentPage: 'dashboard',
            isLoading: false,
            lastError: null,
            sidebarOpen: false,
            modalOpen: false,
            activeFilters: {}
        };
        state.cache = {
            lastFetch: {},
            isStale: {}
        };
        
        notifySubscribers('*', null, null);
    }

    /**
     * Mark a path as stale (needs refresh)
     * @param {string} path
     */
    function markStale(path) {
        state.cache.isStale[path] = true;
        notifySubscribers(`stale:${path}`, true, false);
    }

    /**
     * Check if path is stale
     * @param {string} path
     * @returns {boolean}
     */
    function isStale(path) {
        return !!state.cache.isStale[path];
    }

    /**
     * Get cache age in milliseconds
     * @param {string} path
     * @returns {number}
     */
    function getCacheAge(path) {
        const lastFetch = state.cache.lastFetch[path];
        if (!lastFetch) return Infinity;
        return Date.now() - new Date(lastFetch).getTime();
    }

    /**
     * Set current page
     * @param {string} page
     */
    function setCurrentPage(page) {
        set('ui.currentPage', page);
    }

    /**
     * Update dashboard KPIs from stats object
     * @param {Object} stats
     */
    function updateDashboardStats(stats) {
        batchUpdate({
            'dashboard.newApplications': stats.newApplications || 0,
            'dashboard.pendingCareRequests': stats.pendingCareRequests || 0,
            'dashboard.todaysVisits': stats.todaysVisits || 0,
            'dashboard.pendingTimesheets': stats.pendingTimesheets || 0,
            'dashboard.pendingVisitUpdates': stats.pendingVisitUpdates || 0,
            'dashboard.activeCaregivers': stats.activeCaregivers || 0,
            'dashboard.activeClients': stats.activeClients || 0,
            'dashboard.unassignedVisits': stats.unassignedVisits || 0,
            'dashboard.cancelledVisits': stats.cancelledVisits || 0,
            'dashboard.onboardingCaregivers': stats.onboardingCaregivers || 0,
            'dashboard.lastUpdated': new Date().toISOString()
        });
    }

    // ==================== DEBUGGING ====================

    /**
     * Get state snapshot for debugging
     */
    function debug() {
        return {
            state: JSON.parse(JSON.stringify(state)),
            subscriberCount: Array.from(subscribers.values()).reduce((sum, map) => sum + map.size, 0),
            subscriberPaths: Array.from(subscribers.keys())
        };
    }

    // Expose public API
    return {
        get,
        set,
        batchUpdate,
        subscribe,
        reset,
        markStale,
        isStale,
        getCacheAge,
        setCurrentPage,
        updateDashboardStats,
        debug
    };
})();

console.log('[CareHub] State Manager initialized');
