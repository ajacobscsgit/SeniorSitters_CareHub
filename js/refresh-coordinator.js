// SeniorSitters CareHub - Refresh Coordinator
// ===========================================
// Manages cross-module data refreshing and synchronization
// Ensures all related modules update when data changes

window.CareHubRefreshCoordinator = (function() {
    'use strict';

    // Module registry
    const modules = new Map();
    const refreshQueue = new Set();
    let refreshTimeout = null;
    let defaultsRegistered = false;

    // Dependency map - which modules affect which other modules
    const dependencies = {
        'applications': ['dashboard', 'caregivers', 'onboarding'],
        'care-requests': ['dashboard', 'clients', 'onboarding'],
        'caregivers': ['dashboard', 'schedules', 'timesheets', 'visit-updates', 'onboarding'],
        'clients': ['dashboard', 'schedules', 'care-requests'],
        'schedules': ['dashboard', 'todays-schedule', 'timesheets', 'visit-updates', 'calendar-admin', 'calendar-caregiver', 'calendar-client'],
        'timesheets': ['dashboard', 'payroll', 'caregivers'],
        'visit-updates': ['dashboard', 'schedules', 'clients'],
        'settings': ['dashboard', 'all']
    };

    // ==================== MODULE REGISTRATION ====================

    /**
     * Register a module with the coordinator
     * @param {string} name - Module name
     * @param {Object} config - Module configuration
     */
    function register(name, config) {
        modules.set(name, {
            name,
            refreshFn: config.refresh,
            isActive: config.isActive || (() => false),
            priority: config.priority || 0,
            lastRefresh: null,
            debounceMs: config.debounceMs || 100
        });
        
        console.log(`[CareHubRefresh] Registered module: ${name}`);
    }

    /**
     * Unregister a module
     * @param {string} name
     */
    function unregister(name) {
        modules.delete(name);
    }

    // ==================== REFRESH TRIGGERS ====================

    /**
     * Trigger a refresh for a module and its dependencies
     * @param {string} sourceModule - Module that triggered the change
     * @param {Object} options - Refresh options
     */
    function trigger(sourceModule, options = {}) {
        const { immediate = false, force = false, data = null } = options;
        
        console.log(`[CareHubRefresh] Trigger: ${sourceModule}`, options);
        
        // Add to queue
        refreshQueue.add(sourceModule);
        
        // Add dependent modules
        const affectedModules = dependencies[sourceModule] || [];
        affectedModules.forEach(mod => refreshQueue.add(mod));
        
        // If immediate, process now
        if (immediate) {
            processQueue({ force, data });
        } else {
            // Debounce multiple rapid changes
            clearTimeout(refreshTimeout);
            refreshTimeout = setTimeout(() => {
                processQueue({ force, data });
            }, 100);
        }
    }

    /**
     * Process the refresh queue
     */
    async function processQueue(options = {}) {
        const { force = false, data = null } = options;
        
        // Sort by priority
        const sorted = Array.from(refreshQueue)
            .map(name => modules.get(name))
            .filter(Boolean)
            .sort((a, b) => b.priority - a.priority);
        
        refreshQueue.clear();
        
        console.log(`[CareHubRefresh] Processing queue:`, sorted.map(m => m.name));
        
        // Execute refreshes
        for (const module of sorted) {
            // Skip if not active and not forced
            if (!force && !module.isActive()) {
                continue;
            }
            
            try {
                console.log(`[CareHubRefresh] Refreshing: ${module.name}`);
                await module.refreshFn(data);
                module.lastRefresh = Date.now();
            } catch (e) {
                console.error(`[CareHubRefresh] Failed to refresh ${module.name}:`, e);
            }
        }
        
        // Update state
        window.CareHubState?.set('ui.lastRefresh', new Date().toISOString());
    }

    /**
     * Force refresh all modules
     */
    async function refreshAll() {
        const allModules = Array.from(modules.values())
            .sort((a, b) => b.priority - a.priority);
        
        for (const module of allModules) {
            try {
                await module.refreshFn();
                module.lastRefresh = Date.now();
            } catch (e) {
                console.error(`[CareHubRefresh] Failed to refresh ${module.name}:`, e);
            }
        }
    }

    /**
     * Refresh specific module if active
     * @param {string} name
     */
    async function refreshOne(name) {
        const module = modules.get(name);
        if (module && module.isActive()) {
            await module.refreshFn();
            module.lastRefresh = Date.now();
        }
    }

    // ==================== SMART REFRESH ====================

    /**
     * Smart refresh that only updates visible/active modules
     */
    async function smartRefresh() {
        const activeModules = Array.from(modules.values())
            .filter(m => m.isActive())
            .sort((a, b) => b.priority - a.priority);
        
        for (const module of activeModules) {
            try {
                // Check cache age
                const cacheAge = window.CareHubState?.getCacheAge(module.name);
                if (cacheAge > 30000) { // Older than 30 seconds
                    await module.refreshFn();
                    module.lastRefresh = Date.now();
                }
            } catch (e) {
                console.error(`[CareHubRefresh] Smart refresh failed for ${module.name}:`, e);
            }
        }
    }

    // ==================== UTILITY FUNCTIONS ====================

    /**
     * Get refresh status for all modules
     */
    function getStatus() {
        const status = {};
        modules.forEach((module, name) => {
            status[name] = {
                registered: true,
                lastRefresh: module.lastRefresh,
                isActive: module.isActive(),
                age: module.lastRefresh ? Date.now() - module.lastRefresh : null
            };
        });
        return status;
    }

    /**
     * Setup auto-refresh interval
     * @param {number} intervalMs - Refresh interval in milliseconds
     */
    function setupAutoRefresh(intervalMs = 60000) {
        setInterval(() => {
            console.log('[CareHubRefresh] Auto-refresh triggered');
            smartRefresh();
        }, intervalMs);
        
        console.log(`[CareHubRefresh] Auto-refresh set to ${intervalMs}ms`);
    }

    // ==================== MODULE-SPECIFIC REFRESHERS ====================

    /**
     * Register default module refreshers
     * Call this after all render functions are available
     */
    function registerDefaults() {
        // Prevent duplicate registrations
        if (defaultsRegistered) {
            console.log('[CareHubRefreshCoordinator] Defaults already registered, skipping...');
            return;
        }
        
        // Dashboard
        register('dashboard', {
            refresh: async () => {
                if (typeof renderDashboard === 'function' && 
                    window.CareHubState?.get('ui.currentPage') === 'dashboard') {
                    await renderDashboard();
                }
            },
            isActive: () => window.CareHubState?.get('ui.currentPage') === 'dashboard',
            priority: 10
        });

        // Today's Schedule (embedded in dashboard)
        register('todays-schedule', {
            refresh: async () => {
                if (typeof getTodaysSchedule === 'function') {
                    const schedule = await getTodaysSchedule();
                    window.CareHubState?.set('todaysSchedule', schedule);
                    
                    // If on dashboard, re-render just the schedule
                    const currentPage = window.CareHubState?.get('ui.currentPage');
                    if (currentPage === 'dashboard' && typeof renderTodaysScheduleV2 === 'function') {
                        renderTodaysScheduleV2(schedule);
                    }
                }
            },
            isActive: () => true, // Always check, may be visible
            priority: 9
        });

        // Applications
        register('applications', {
            refresh: async () => {
                if (typeof renderApplications === 'function' && 
                    window.CareHubState?.get('ui.currentPage') === 'applications') {
                    await renderApplications();
                }
            },
            isActive: () => window.CareHubState?.get('ui.currentPage') === 'applications',
            priority: 5
        });

        // Care Requests
        register('care-requests', {
            refresh: async () => {
                if (typeof renderCareRequests === 'function' && 
                    window.CareHubState?.get('ui.currentPage') === 'care-requests') {
                    await renderCareRequests();
                }
            },
            isActive: () => window.CareHubState?.get('ui.currentPage') === 'care-requests',
            priority: 5
        });

        // Caregivers
        register('caregivers', {
            refresh: async () => {
                if (typeof renderCaregivers === 'function' && 
                    window.CareHubState?.get('ui.currentPage') === 'caregivers') {
                    await renderCaregivers();
                }
            },
            isActive: () => window.CareHubState?.get('ui.currentPage') === 'caregivers',
            priority: 5
        });

        // Clients
        register('clients', {
            refresh: async () => {
                if (typeof renderClients === 'function' && 
                    window.CareHubState?.get('ui.currentPage') === 'clients') {
                    await renderClients();
                }
            },
            isActive: () => window.CareHubState?.get('ui.currentPage') === 'clients',
            priority: 5
        });

        // Schedules
        register('schedules', {
            refresh: async () => {
                const currentPage = window.CareHubState?.get('ui.currentPage');
                if (typeof renderSchedules === 'function' && currentPage === 'schedules') {
                    await renderSchedules();
                }
                // Also refresh calendar views
                if (typeof renderCalendarViews === 'function') {
                    renderCalendarViews();
                }
            },
            isActive: () => {
                const page = window.CareHubState?.get('ui.currentPage');
                return page === 'schedules' || page === 'dashboard';
            },
            priority: 8
        });

        // Timesheets
        register('timesheets', {
            refresh: async () => {
                if (typeof renderTimesheets === 'function' && 
                    window.CareHubState?.get('ui.currentPage') === 'timesheets') {
                    await renderTimesheets();
                }
            },
            isActive: () => window.CareHubState?.get('ui.currentPage') === 'timesheets',
            priority: 5
        });

        // Visit Updates
        register('visit-updates', {
            refresh: async () => {
                if (typeof renderVisitUpdates === 'function' && 
                    window.CareHubState?.get('ui.currentPage') === 'visit-updates') {
                    await renderVisitUpdates();
                }
            },
            isActive: () => window.CareHubState?.get('ui.currentPage') === 'visit-updates',
            priority: 5
        });

        // Onboarding
        register('onboarding', {
            refresh: async () => {
                if (typeof getOnboardingCaregivers === 'function') {
                    const list = await getOnboardingCaregivers();
                    window.CareHubState?.set('onboardingList', list);
                    
                    // If on dashboard, update the view
                    if (window.CareHubState?.get('ui.currentPage') === 'dashboard' &&
                        typeof renderOnboardingV2 === 'function') {
                        renderOnboardingV2(list);
                    }
                }
            },
            isActive: () => true,
            priority: 4
        });

        // Payroll
        register('payroll', {
            refresh: async () => {
                // Payroll is within timesheets tab
                if (window.CareHubState?.get('ui.currentPage') === 'timesheets') {
                    // Trigger payroll preview refresh if active
                    if (typeof loadPayrollExportHistory === 'function') {
                        loadPayrollExportHistory();
                    }
                }
            },
            isActive: () => window.CareHubState?.get('ui.currentPage') === 'timesheets',
            priority: 3
        });

        defaultsRegistered = true;
        console.log('[CareHubRefresh] Default modules registered');
    }

    // ==================== PUBLIC API ====================

    return {
        register,
        unregister,
        trigger,
        refreshAll,
        refreshOne,
        smartRefresh,
        setupAutoRefresh,
        registerDefaults,
        getStatus
    };
})();

console.log('[CareHub] Refresh Coordinator loaded');
