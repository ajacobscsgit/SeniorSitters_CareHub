// SeniorSitters CareHub - Realtime Subscriptions
// ================================================
// Supabase realtime subscriptions for live data updates
// Integrates with CareHubState for reactive UI updates

window.CareHubRealtime = (function() {
    'use strict';

    // Subscription registry
    const channels = new Map();
    const TABLES = window.TABLES;
    let initialized = false;

    // ==================== SUBSCRIPTION MANAGEMENT ====================

    /**
     * Initialize all realtime subscriptions
     */
    function initialize() {
        // Prevent duplicate initialization
        if (initialized) {
            console.log('[CareHubRealtime] Already initialized, skipping...');
            return true;
        }
        
        console.log('[CareHubRealtime] Initializing realtime subscriptions...');
        
        if (!window.carehubSupabase) {
            console.error('[CareHubRealtime] Supabase not initialized');
            return false;
        }

        // Subscribe to all relevant tables
        subscribeToTable(TABLES.APPLICATIONS, handleApplicationChange);
        subscribeToTable(TABLES.CARE_REQUESTS, handleCareRequestChange);
        subscribeToTable(TABLES.CAREGIVERS, handleCaregiverChange);
        subscribeToTable(TABLES.CLIENTS, handleClientChange);
        subscribeToTable(TABLES.SCHEDULES, handleScheduleChange);
        subscribeToTable(TABLES.TIMESHEETS, handleTimesheetChange);
        subscribeToTable(TABLES.VISIT_UPDATES, handleVisitUpdateChange);

        initialized = true;
        console.log('[CareHubRealtime] All subscriptions initialized');
        return true;
    }

    /**
     * Subscribe to a table's changes
     * @param {string} table - Table name
     * @param {Function} handler - Change handler function
     */
    function subscribeToTable(table, handler) {
        if (!window.carehubSupabase) return;

        const channelName = `${table}-changes`;
        
        // Remove existing subscription if any
        if (channels.has(channelName)) {
            const existing = channels.get(channelName);
            window.carehubSupabase.removeChannel(existing);
        }

        const channel = window.carehubSupabase
            .channel(channelName)
            .on('postgres_changes', 
                { 
                    event: '*', 
                    schema: 'public', 
                    table: table 
                }, 
                (payload) => {
                    console.log(`[CareHubRealtime] ${table} change:`, payload.eventType, payload.new?.id || payload.old?.id);
                    handler(payload);
                }
            )
            .subscribe((status) => {
                console.log(`[CareHubRealtime] ${channelName} status:`, status);
            });

        channels.set(channelName, channel);
    }

    /**
     * Unsubscribe from all channels
     */
    function cleanup() {
        if (!window.carehubSupabase) return;
        
        channels.forEach((channel, name) => {
            window.carehubSupabase.removeChannel(channel);
            console.log(`[CareHubRealtime] Removed channel: ${name}`);
        });
        channels.clear();
    }

    // ==================== CHANGE HANDLERS ====================

    /**
     * Handle application table changes
     */
    function handleApplicationChange(payload) {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        
        // Update state
        window.CareHubState.set('applications', null); // Mark as stale
        
        // Trigger refreshes
        window.CareHubRefreshCoordinator?.trigger('applications');
        
        // Add activity log
        if (eventType === 'INSERT') {
            addActivity('application', `New application from ${newRecord.full_name}`, 'new');
        } else if (eventType === 'UPDATE' && newRecord.status !== oldRecord?.status) {
            addActivity('application', `Application ${newRecord.status}: ${newRecord.full_name}`, 
                newRecord.status === 'approved' ? 'success' : 'warning');
        }

        // Refresh dashboard stats
        refreshDashboardStats();
    }

    /**
     * Handle care request changes
     */
    function handleCareRequestChange(payload) {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        
        window.CareHubState.set('careRequests', null);
        window.CareHubRefreshCoordinator?.trigger('care-requests');
        
        if (eventType === 'INSERT') {
            addActivity('care-request', `New care request for ${newRecord.care_for}`, 'new');
        } else if (eventType === 'UPDATE' && newRecord.status !== oldRecord?.status) {
            addActivity('care-request', `Care request ${newRecord.status}`, 
                newRecord.status === 'converted_to_client' ? 'success' : 'info');
        }
        
        refreshDashboardStats();
    }

    /**
     * Handle caregiver changes
     */
    function handleCaregiverChange(payload) {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        
        window.CareHubState.set('caregivers', null);
        window.CareHubRefreshCoordinator?.trigger('caregivers');
        
        if (eventType === 'INSERT') {
            addActivity('caregiver', `New caregiver: ${newRecord.name}`, 'new');
        } else if (eventType === 'UPDATE' && newRecord.status !== oldRecord?.status) {
            if (newRecord.status === 'active') {
                addActivity('caregiver', `${newRecord.name} is now active`, 'success');
            }
        }
        
        refreshDashboardStats();
    }

    /**
     * Handle client changes
     */
    function handleClientChange(payload) {
        const { eventType, new: newRecord } = payload;
        
        window.CareHubState.set('clients', null);
        window.CareHubRefreshCoordinator?.trigger('clients');
        
        if (eventType === 'INSERT') {
            addActivity('client', `New client: ${newRecord.care_for || newRecord.name}`, 'new');
        }
        
        refreshDashboardStats();
    }

    /**
     * Handle schedule changes - CRITICAL for calendar sync
     */
    function handleScheduleChange(payload) {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        
        console.log('[CareHubRealtime] Schedule change detected:', eventType);
        
        // Mark schedules as stale
        window.CareHubState.set('schedules', null);
        window.CareHubState.set('todaysSchedule', null);
        
        // Trigger immediate refreshes
        window.CareHubRefreshCoordinator?.trigger('schedules');
        
        // If today's schedule, refresh it specifically
        const today = new Date().toISOString().split('T')[0];
        if (newRecord?.date === today || oldRecord?.date === today) {
            console.log('[CareHubRealtime] Today\'s schedule changed, refreshing...');
            window.CareHubRefreshCoordinator?.trigger('todays-schedule');
        }
        
        // Refresh mini calendar if on dashboard
        if (window.CareHubState?.get('ui.currentPage') === 'dashboard') {
            console.log('[CareHubRealtime] Refreshing mini calendar...');
            const miniCal = document.getElementById('miniCalendar');
            if (miniCal) {
                const offset = parseInt(miniCal.dataset.monthOffset || '0');
                if (typeof renderMiniCalendarV2WithOffset === 'function') {
                    renderMiniCalendarV2WithOffset(offset);
                }
            }
        }
        
        // Activity log
        if (eventType === 'INSERT') {
            addActivity('schedule', `New visit scheduled for ${newRecord.date}`, 'new');
        } else if (eventType === 'UPDATE') {
            if (newRecord.status !== oldRecord?.status) {
                addActivity('schedule', `Visit ${newRecord.status}`, 
                    newRecord.status === 'completed' ? 'success' : 
                    newRecord.status === 'cancelled' ? 'warning' : 'info');
            }
        }
        
        refreshDashboardStats();
    }

    /**
     * Handle timesheet changes
     */
    function handleTimesheetChange(payload) {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        
        window.CareHubState.set('timesheets', null);
        window.CareHubRefreshCoordinator?.trigger('timesheets');
        
        if (eventType === 'INSERT') {
            addActivity('timesheet', `New timesheet submitted`, 'new');
        } else if (eventType === 'UPDATE' && newRecord.status !== oldRecord?.status) {
            addActivity('timesheet', `Timesheet ${newRecord.status}`,
                newRecord.status === 'approved' ? 'success' : 
                newRecord.status === 'rejected' ? 'danger' : 'info');
        }
        
        refreshDashboardStats();
    }

    /**
     * Handle visit update changes
     */
    function handleVisitUpdateChange(payload) {
        const { eventType, new: newRecord, old: oldRecord } = payload;
        
        window.CareHubState.set('visitUpdates', null);
        window.CareHubRefreshCoordinator?.trigger('visit-updates');
        
        if (eventType === 'INSERT') {
            addActivity('visit-update', `New visit update submitted`, 'new');
        } else if (eventType === 'UPDATE' && newRecord.status !== oldRecord?.status) {
            addActivity('visit-update', `Visit update ${newRecord.status}`,
                newRecord.status === 'approved' ? 'success' : 'info');
        }
        
        refreshDashboardStats();
    }

    // ==================== HELPERS ====================

    /**
     * Add activity to recent activity feed
     */
    function addActivity(type, message, severity = 'info') {
        const activity = {
            id: Date.now(),
            type,
            message,
            severity,
            timestamp: new Date().toISOString()
        };
        
        // Get current activities and prepend new one
        const current = window.CareHubState.get('activities') || [];
        window.CareHubState.set('activities', [activity, ...current].slice(0, 50));
    }

    /**
     * Refresh dashboard statistics
     */
    async function refreshDashboardStats() {
        if (typeof getDashboardStats === 'function') {
            try {
                const stats = await getDashboardStats();
                window.CareHubState.updateDashboardStats(stats);
            } catch (e) {
                console.error('[CareHubRealtime] Failed to refresh dashboard stats:', e);
            }
        }
    }

    // ==================== PUBLIC API ====================

    return {
        initialize,
        subscribeToTable,
        cleanup,
        refreshDashboardStats
    };
})();

// Auto-initialize when Supabase is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for Supabase to be ready
    const checkAndInit = () => {
        if (window.carehubSupabase) {
            window.CareHubRealtime.initialize();
        } else {
            setTimeout(checkAndInit, 100);
        }
    };
    
    // Start checking after a short delay
    setTimeout(checkAndInit, 500);
});

console.log('[CareHub] Realtime module loaded');
