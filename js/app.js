// SeniorSitters CareHub - Main Application
// =========================================

// Debug mode - set to true for verbose logging
const DEBUG = false;

// Global State
let currentPage = 'dashboard';
let currentData = null;

// DOM Elements
const mainContent = document.getElementById('mainContent');
const navItems = document.querySelectorAll('.nav-item');
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const modalFooter = document.getElementById('modalFooter');

// Initialize App - only after auth is verified
// Note: Auth check happens in index.html, this runs after
function initApp() {
    // Guard: Check if auth system is initialized
    if (typeof isAuthenticated !== 'function') {
        console.error('[Init] Auth system not initialized. Cannot start app.');
        return;
    }
    
    if (!isAuthenticated()) {
        // Auth check failed, don't initialize
        return;
    }
    
    if (DEBUG) console.log('[CareHub] Initializing integrated operating system...');

    // Resolve real DB IDs (caregiver_id / client_id) for non-admin users.
    // Fire-and-forget: runs async in background; dashboard data fetch starts
    // immediately. If resolution completes before the first Supabase query
    // the filtered IDs will be used; otherwise the next navigation will pick them up.
    if (typeof resolveUserIds === 'function') {
        resolveUserIds().catch(e => {
            if (DEBUG) console.warn('[Init] resolveUserIds failed silently:', e);
        });
    }
    
    // Initialize navigation and UI
    initNavigation();
    initLogout();
    initModal();
    initMobileMenu();
    
    // Update sidebar based on user role (only if auth functions are ready)
    if (typeof getCurrentRole === 'function') {
        updateSidebarNavigation();
        updateUserInfo();
    } else {
        console.warn('[Init] Role functions not available, skipping role-based UI');
    }
    
    // Initialize state management subscriptions
    initStateSubscriptions();
    
    // Register refresh coordinator modules
    if (window.CareHubRefreshCoordinator) {
        window.CareHubRefreshCoordinator.registerDefaults();
        window.CareHubRefreshCoordinator.setupAutoRefresh(60000); // 1 minute auto-refresh
    }
    
    // Load initial page
    loadPage('dashboard');
    
    if (DEBUG) console.log('[CareHub] Operating system initialized');
}

// Initialize state subscriptions for reactive UI updates
function initStateSubscriptions() {
    if (!window.CareHubState) return;
    
    // Subscribe to dashboard KPI changes
    window.CareHubState.subscribe('dashboard', (newVal, oldVal) => {
        if (DEBUG) console.log('[CareHubState] Dashboard stats updated:', newVal);
        // KPI cards auto-update via renderKPIsV2 when data changes
    });
    
    // Subscribe to today's schedule changes
    window.CareHubState.subscribe('todaysSchedule', (newVal, oldVal) => {
        if (DEBUG) console.log('[CareHubState] Today\'s schedule updated');
        if (typeof renderTodaysScheduleV2 === 'function' && newVal) {
            renderTodaysScheduleV2(newVal);
        }
    });
    
    // Subscribe to activity feed changes
    window.CareHubState.subscribe('activities', (newVal, oldVal) => {
        if (DEBUG) console.log('[CareHubState] Activities updated');
        if (typeof renderActivityFeedV2 === 'function' && newVal) {
            renderActivityFeedV2(newVal);
        }
    });
    
    // Subscribe to alerts changes
    window.CareHubState.subscribe('alerts', (newVal, oldVal) => {
        if (DEBUG) console.log('[CareHubState] Alerts updated');
        if (typeof renderAlertsV2 === 'function' && newVal) {
            renderAlertsV2(newVal);
        }
    });
    
    // Subscribe to onboarding list changes
    window.CareHubState.subscribe('onboardingList', (newVal, oldVal) => {
        if (DEBUG) console.log('[CareHubState] Onboarding list updated');
        if (typeof renderOnboardingV2 === 'function' && newVal) {
            renderOnboardingV2(newVal);
        }
    });
    
    if (DEBUG) console.log('[CareHub] State subscriptions initialized');
}

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', initApp);

// ==================== NAVIGATION ====================

function initNavigation() {
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            
            // Role-based route guard
            if (typeof canAccessPage === 'function') {
                if (!canAccessPage(page)) {
                    if (DEBUG) console.log(`[Navigation] Access denied to ${page} for role ${getCurrentRole ? getCurrentRole() : 'unknown'}`);
                    showAlert('You do not have permission to access this page', 'error');
                    return;
                }
            }
            
            loadPage(page);
            
            // Update active state
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Close mobile menu
            document.getElementById('sidebar').classList.remove('open');
        });
    });
}

/**
 * Filter sidebar navigation items based on user role
 * Shows/hides nav items according to role permissions
 */
function updateSidebarNavigation() {
    // Guard: Check if auth system is initialized
    if (typeof getCurrentRole !== 'function' || typeof getAllowedPages !== 'function') {
        console.warn('[Navigation] Auth system not initialized yet');
        return;
    }
    
    const role = getCurrentRole();
    if (!role) return;
    
    const navItems = document.querySelectorAll('.nav-item');
    const allowedPages = getAllowedPages();
    
    navItems.forEach(item => {
        const page = item.dataset.page;
        if (allowedPages.includes(page)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
            item.classList.remove('active');
        }
    });
    
    if (DEBUG) console.log(`[Navigation] Sidebar updated for role: ${role}`);
}

/**
 * Update user info display in sidebar
 */
function updateUserInfo() {
    // Guard: Check if auth system is initialized
    if (typeof getSession !== 'function') {
        console.warn('[UserInfo] Auth system not initialized yet');
        return;
    }
    
    const session = getSession();
    if (!session) return;
    
    const userNameEl = document.getElementById('userName');
    const userRoleEl = document.getElementById('userRole');
    
    if (userNameEl) {
        userNameEl.textContent = session.email ? session.email.split('@')[0] : 'User';
    }
    
    if (userRoleEl && session.role) {
        const roleLabel = window.ROLE_LABELS[session.role] || session.role;
        userRoleEl.textContent = roleLabel;
    }
}

function initLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (!logoutBtn) return;
    
    logoutBtn.addEventListener('click', () => {
        if (typeof logout === 'function') {
            logout();
        } else {
            console.error('[Logout] Auth system not initialized');
        }
    });
}

function initMobileMenu() {
    const toggle  = document.getElementById('mobileMenuToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    function openSidebar() {
        sidebar.classList.add('open');
        if (overlay) overlay.style.display = 'block';
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        if (overlay) overlay.style.display = 'none';
    }

    toggle.addEventListener('click', () => {
        sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
    });

    if (overlay) {
        overlay.addEventListener('click', closeSidebar);
    }

    // Close sidebar on nav item click (mobile)
    sidebar.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 768) closeSidebar();
        });
    });
}

function loadPage(page) {
    currentPage = page;
    
    // Update state
    if (window.CareHubState) {
        window.CareHubState.setCurrentPage(page);
    }
    
    // Track page view for analytics
    if (DEBUG) console.log(`[CareHub] Navigating to: ${page}`);
    
    switch(page) {
        case 'dashboard':
            renderDashboard();
            break;
        case 'applications':
            renderApplications();
            break;
        case 'care-requests':
            renderCareRequests();
            break;
        case 'caregivers':
            renderCaregivers();
            break;
        case 'clients':
            renderClients();
            break;
        case 'schedules':
            renderSchedules();
            break;
        case 'timesheets':
            renderTimesheets();
            break;
        case 'visit-updates':
            renderVisitUpdates();
            break;
        case 'settings':
            renderSettings();
            break;
        default:
            renderDashboard();
    }
    
    // Trigger any pending refreshes for this page
    if (window.CareHubRefreshCoordinator) {
        window.CareHubRefreshCoordinator.trigger(page, { immediate: false });
    }
}

// ==================== INTEGRATED DATA OPERATIONS ====================
// These helpers ensure data changes trigger refreshes across all related modules

/**
 * Save application status change with cross-module refresh
 */
async function integratedSaveApplicationStatus(id, status, notes) {
    const result = await updateApplicationStatus(id, status, notes);
    if (result) {
        // Trigger refresh across all affected modules
        window.CareHubRefreshCoordinator?.trigger('applications', { 
            immediate: true,
            data: { id, status }
        });
    }
    return result;
}

/**
 * Create new schedule with cross-module refresh
 */
async function integratedCreateSchedule(scheduleData) {
    const result = await createSchedule(scheduleData);
    if (result) {
        window.CareHubRefreshCoordinator?.trigger('schedules', {
            immediate: true,
            data: scheduleData
        });
    }
    return result;
}

/**
 * Update schedule with cross-module refresh
 */
async function integratedUpdateSchedule(id, updates) {
    const result = await updateSchedule(id, updates);
    if (result) {
        window.CareHubRefreshCoordinator?.trigger('schedules', {
            immediate: true,
            data: { id, ...updates }
        });
    }
    return result;
}

/**
 * Cancel schedule with cross-module refresh
 */
async function integratedCancelSchedule(id, reason) {
    const result = await cancelSchedule(id, reason);
    if (result) {
        window.CareHubRefreshCoordinator?.trigger('schedules', {
            immediate: true,
            data: { id, status: 'cancelled', reason }
        });
    }
    return result;
}

/**
 * Create timesheet with cross-module refresh
 */
async function integratedCreateTimesheet(timesheetData) {
    const result = await createTimesheet(timesheetData);
    if (result) {
        window.CareHubRefreshCoordinator?.trigger('timesheets', {
            immediate: true,
            data: timesheetData
        });
    }
    return result;
}

/**
 * Approve timesheet with cross-module refresh
 */
async function integratedApproveTimesheet(id) {
    const result = await approveTimesheet(id);
    if (result) {
        window.CareHubRefreshCoordinator?.trigger('timesheets', {
            immediate: true,
            data: { id, status: 'approved' }
        });
    }
    return result;
}

/**
 * Create visit update with cross-module refresh
 */
async function integratedCreateVisitUpdate(updateData) {
    const result = await createVisitUpdate(updateData);
    if (result) {
        window.CareHubRefreshCoordinator?.trigger('visit-updates', {
            immediate: true,
            data: updateData
        });
    }
    return result;
}

/**
 * Convert care request to client with cross-module refresh
 */
async function integratedConvertCareRequest(requestId, clientData) {
    const result = await createClientFromCareRequest(requestId, clientData);
    if (result) {
        window.CareHubRefreshCoordinator?.trigger('care-requests', {
            immediate: true,
            data: { requestId, clientId: result.id }
        });
    }
    return result;
}

/**
 * Convert application to caregiver with cross-module refresh
 */
async function integratedConvertApplication(appId, caregiverData) {
    const result = await createCaregiverFromApplication(appId, caregiverData);
    if (result) {
        window.CareHubRefreshCoordinator?.trigger('applications', {
            immediate: true,
            data: { appId, caregiverId: result.id }
        });
    }
    return result;
}

// ==================== UNIFIED CALENDAR SYSTEM ====================
// Shared utilities for both mini calendar and full scheduling calendar

/**
 * Check if a date string represents today
 * @param {string} dateStr - YYYY-MM-DD format
 * @returns {boolean}
 */
function isToday(dateStr) {
    const today = new Date();
    const todayStr = formatDateForAPI(today);
    return dateStr === todayStr;
}

/**
 * Get CSS class for calendar day based on state
 * @param {Object} params
 * @returns {string}
 */
function getCalendarDayClass({ isToday, isCurrentMonth, isWeekend, isSelected, hasEvents, hasUnassigned }) {
    const classes = ['calendar-day'];
    
    if (!isCurrentMonth) classes.push('other-month');
    if (isToday) classes.push('today');
    if (isWeekend) classes.push('weekend');
    if (isSelected) classes.push('selected');
    if (hasEvents && !isToday) classes.push(hasUnassigned ? 'has-unassigned' : 'has-events');
    
    return classes.join(' ');
}

/**
 * Get CSS class for calendar event pill based on status
 * @param {string} status - Schedule status
 * @param {boolean} isUnassigned - Whether caregiver is not assigned
 * @returns {string}
 */
function getCalendarEventClass(status, isUnassigned = false) {
    if (isUnassigned) return 'calendar-event unassigned';
    
    const statusMap = {
        'scheduled': 'scheduled',
        'confirmed': 'confirmed',
        'in_progress': 'in_progress',
        'completed': 'completed',
        'cancelled': 'cancelled',
        'no_show': 'no_show'
    };
    
    return `calendar-event ${statusMap[status] || 'scheduled'}`;
}

/**
 * Get compact event dot class for mini calendar
 * @param {string} status - Schedule status
 * @param {boolean} isUnassigned - Whether caregiver is not assigned
 * @returns {string}
 */
function getCalendarEventDotClass(status, isUnassigned = false) {
    if (isUnassigned) return 'calendar-event-dot unassigned';
    
    const statusMap = {
        'scheduled': 'scheduled',
        'confirmed': 'confirmed',
        'in_progress': 'in_progress',
        'completed': 'completed',
        'cancelled': 'cancelled',
        'no_show': 'no_show'
    };
    
    return `calendar-event-dot ${statusMap[status] || 'scheduled'}`;
}

/**
 * Group schedules by date string (YYYY-MM-DD)
 * @param {Array} schedules - Array of schedule objects
 * @returns {Object} - { 'YYYY-MM-DD': [schedules] }
 */
function groupSchedulesByDate(schedules) {
    const grouped = {};
    
    schedules.forEach(schedule => {
        // schedule.date is already "YYYY-MM-DD" from Supabase
        const dateKey = schedule.date;
        if (!grouped[dateKey]) {
            grouped[dateKey] = [];
        }
        grouped[dateKey].push(schedule);
    });
    
    return grouped;
}

/**
 * Render a single calendar day cell (unified for mini and full calendar)
 * @param {Object} params
 * @returns {string} HTML string
 */
function renderCalendarDay({
    dateStr,
    dayNumber,
    isToday,
    isCurrentMonth,
    isWeekend,
    isSelected,
    events = [],
    maxEvents = 3,
    compact = false,
    onClick = ''
}) {
    const hasEvents = events.length > 0;
    const hasUnassigned = events.some(e => !e.caregiver_id);
    
    const dayClass = getCalendarDayClass({
        isToday,
        isCurrentMonth,
        isWeekend,
        isSelected,
        hasEvents,
        hasUnassigned
    });
    
    const clickHandler = onClick || `navigateToDateFromCalendar('${dateStr}')`;
    
    // For compact view (mini calendar), show dots
    if (compact) {
        const visibleEvents = events.slice(0, maxEvents);
        const moreCount = events.length - maxEvents;
        
        return `
            <div class="${dayClass} compact" onclick="${clickHandler}">
                <div class="calendar-day-number">${dayNumber}</div>
                <div class="calendar-events compact">
                    ${visibleEvents.map(e => `
                        <span class="${getCalendarEventDotClass(e.status, !e.caregiver_id)}" 
                              title="${escapeHtml(e.client?.care_for || e.client?.name || 'Visit')}"></span>
                    `).join('')}
                    ${moreCount > 0 ? `<span class="calendar-event-dot" style="background:var(--text-tertiary)"></span>` : ''}
                </div>
            </div>
        `;
    }
    
    // For full view, show event pills
    const visibleEvents = events.slice(0, maxEvents);
    const moreCount = events.length - maxEvents;
    
    return `
        <div class="${dayClass}" onclick="${clickHandler}">
            <div class="calendar-day-number">${dayNumber}</div>
            <div class="calendar-events">
                ${visibleEvents.map(e => `
                    <div class="${getCalendarEventClass(e.status, !e.caregiver_id)}"
                         onclick="event.stopPropagation(); viewSchedule('${e.id}')"
                         title="${escapeHtml(e.client?.care_for || e.client?.name || 'Client')}: ${formatTime(e.start_time)}">
                        ${formatTime(e.start_time)} ${escapeHtml(truncate(e.client?.care_for || e.client?.name || 'Client', 15))}
                    </div>
                `).join('')}
                ${moreCount > 0 ? `<div class="calendar-more-events">+${moreCount} more</div>` : ''}
            </div>
        </div>
    `;
}

/**
 * Render calendar header with navigation
 * @param {Object} params
 * @returns {string} HTML string
 */
function renderCalendarHeader({ title, onPrev, onNext, compact = false }) {
    const padding = compact ? 'var(--space-3) var(--space-4)' : 'var(--space-4) var(--space-5)';
    
    return `
        <div class="calendar-header" style="padding: ${padding};">
            <button class="calendar-nav-btn" onclick="${onPrev}" aria-label="Previous">
                <i class="ph ph-caret-left"></i>
            </button>
            <div class="calendar-title">${title}</div>
            <button class="calendar-nav-btn" onclick="${onNext}" aria-label="Next">
                <i class="ph ph-caret-right"></i>
            </button>
        </div>
    `;
}

/**
 * Render calendar day headers (Sun, Mon, etc.)
 * @param {boolean} compact - Whether to use abbreviated names
 * @returns {string} HTML string
 */
function renderCalendarDayHeaders(compact = false) {
    const dayNames = compact 
        ? ['S', 'M', 'T', 'W', 'T', 'F', 'S']
        : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    return `
        <div class="calendar-day-headers">
            ${dayNames.map((day, i) => {
                const isWeekend = i === 0 || i === 6;
                return `<div class="calendar-day-header ${isWeekend ? 'weekend' : ''}">${day}</div>`;
            }).join('')}
        </div>
    `;
}

/**
 * Navigate to specific date in schedules view
 * @param {string} dateStr - YYYY-MM-DD
 */
function navigateToDateFromCalendar(dateStr) {
    scheduleCurrentDate = parseLocalDateToDate(dateStr);
    
    // Reset mini calendar offset
    const miniCal = document.getElementById('miniCalendar');
    if (miniCal) {
        miniCal.dataset.monthOffset = '0';
    }
    
    // Navigate to schedules
    navigateTo('schedules');
}

// ==================== PAGE RENDERERS ====================

// ==================== COMMAND CENTER DASHBOARD ====================

async function renderDashboard() {
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    
    // Get role-based visibility settings
    const role = typeof getCurrentRole === 'function' ? getCurrentRole() : null;
    const visibility = role ? (window.DASHBOARD_VISIBILITY[role] || {}) : window.DASHBOARD_VISIBILITY[window.ROLES.ADMIN_OWNER];
    
    const {
        showKPIs = false,
        showAlerts = false,
        showQuickActions = false,
        showOnboarding = false,
        showAllActivity = false,
        showMySchedule = false,
        showMyTimesheets = false,
        showMyUpdates = false,
        showLovedOneSchedule = false,
        showApprovedUpdates = false
    } = visibility;
    
    // Determine dashboard title based on role
    let dashboardTitle = 'SeniorSitters Command Center';
    let scheduleLabel = showMySchedule ? 'My Schedule' : (showLovedOneSchedule ? "Loved One's Schedule" : "Today's Schedule");
    
    mainContent.innerHTML = `
        <div class="command-center animate-fade-in">
            <!-- TOP HEADER BAR -->
            <div class="cc-header">
                <div class="cc-header-left">
                    <div class="cc-welcome">
                        <h1 class="cc-title">${dashboardTitle}</h1>
                        <div class="cc-date">${dateStr}</div>
                    </div>
                </div>
                <div class="cc-header-right">
                    ${showQuickActions ? `
                    <div class="cc-quick-actions">
                        <button class="cc-action-btn cc-action-primary" onclick="openCreateScheduleModal()">
                            <i class="ph ph-calendar-plus"></i> New Visit
                        </button>
                        <button class="cc-action-btn" onclick="openCreateTimesheetModal()">
                            <i class="ph ph-clock"></i> Timesheet
                        </button>
                        <button class="cc-action-btn" onclick="openCreateVisitUpdateModal()">
                            <i class="ph ph-clipboard-text"></i> Visit Update
                        </button>
                        <button class="cc-action-btn" onclick="navigateTo('applications')">
                            <i class="ph ph-user-plus"></i> Caregiver
                        </button>
                        <button class="cc-action-btn" onclick="navigateTo('care-requests')">
                            <i class="ph ph-users"></i> Client
                        </button>
                    </div>
                    ` : ''}
                </div>
            </div>

            <!-- KPI GRID - Admin/Owner only -->
            ${showKPIs ? `
            <div class="cc-kpi-grid" id="kpiGrid">
                ${renderKPISkeleton()}
            </div>
            ` : ''}

            <!-- MAIN DASHBOARD GRID -->
            <div class="cc-main-grid">
                <!-- LEFT COLUMN -->
                <div class="cc-left-col">
                    <!-- Today's/Schedule Card - Visible to all roles with different context -->
                    <div class="cc-card cc-card-schedule">
                        <div class="cc-card-header">
                            <div class="cc-card-title">
                                <i class="ph ph-calendar-blank"></i>
                                ${scheduleLabel}
                                <span class="cc-badge" id="scheduleCount">--</span>
                            </div>
                            <button class="cc-btn-text" onclick="navigateTo('schedules')">View All <i class="ph ph-arrow-right"></i></button>
                        </div>
                        <div class="cc-card-body" id="todaysSchedule">
                            ${renderScheduleSkeleton()}
                        </div>
                    </div>

                    <!-- Recent Activity - Admin/Owner only -->
                    ${showAllActivity ? `
                    <div class="cc-card">
                        <div class="cc-card-header">
                            <div class="cc-card-title">
                                <i class="ph ph-activity"></i>
                                Recent Activity
                            </div>
                        </div>
                        <div class="cc-card-body" id="activityFeed">
                            ${renderActivitySkeleton()}
                        </div>
                    </div>
                    ` : ''}
                </div>

                <!-- RIGHT COLUMN -->
                <div class="cc-right-col">
                    <!-- Urgent Alerts - Admin/Owner only -->
                    ${showAlerts ? `
                    <div class="cc-card cc-card-alerts">
                        <div class="cc-card-header">
                            <div class="cc-card-title">
                                <i class="ph ph-bell"></i>
                                Urgent Alerts
                                <span class="cc-badge cc-badge-alert" id="alertCount" style="display: none;">0</span>
                            </div>
                        </div>
                        <div class="cc-card-body" id="alertsPanel">
                            ${renderAlertsSkeleton()}
                        </div>
                    </div>
                    ` : ''}

                    <!-- Mini Calendar - Visible to all roles -->
                    <div class="cc-card cc-card-calendar">
                        <div class="cc-card-header">
                            <div class="cc-card-title">
                                <i class="ph ph-calendar"></i>
                                Calendar
                            </div>
                            <button class="cc-btn-text" onclick="navigateTo('schedules')">Full <i class="ph ph-arrow-right"></i></button>
                        </div>
                        <div class="cc-card-body cc-calendar-body" id="miniCalendar">
                            ${renderCalendarSkeleton()}
                        </div>
                    </div>

                    <!-- Onboarding Snapshot -->
                    <div class="cc-card">
                        <div class="cc-card-header">
                            <div class="cc-card-title">
                                <i class="ph ph-student"></i>
                                Onboarding
                            </div>
                        </div>
                        <div class="cc-card-body" id="onboardingPanel">
                            ${renderOnboardingSkeleton()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // For restricted roles, also fetch their personal timesheets and visit updates
    // so scopeDashboardStats can produce accurate personal KPI counts.
    const isFullAccess = window.RoleFilter ? window.RoleFilter._isFullAccess() : true;
    const roleFilterQueries = isFullAccess ? [] : [
        getTimesheets(window.RoleFilter.buildQueryFilters('timesheets')),
        getVisitUpdates(window.RoleFilter.buildQueryFilters('visit_updates'))
    ];

    // Only fetch onboarding caregivers for admin/owner roles (admin-only widget)
    const shouldFetchOnboarding = isFullAccess || showOnboarding;

    // Load all dashboard data in parallel
    const [rawStats, todaysSchedule, activities, alerts, onboarding, personalTimesheets, personalUpdates] = await Promise.all([
        getDashboardStats(),
        getTodaysSchedule(),
        getRecentActivity(10),
        getDashboardAlerts(),
        shouldFetchOnboarding ? getOnboardingCaregivers() : Promise.resolve([]),
        ...(isFullAccess ? [Promise.resolve([]), Promise.resolve([])] : roleFilterQueries)
    ]);

    // Scope stats to current role (admins get full counts; others get personal counts)
    const stats = window.RoleFilter
        ? window.RoleFilter.scopeDashboardStats(rawStats, todaysSchedule, personalTimesheets, personalUpdates)
        : rawStats;

    // Save to shared state for other modules to access
    if (window.CareHubState) {
        window.CareHubState.updateDashboardStats(stats);
        window.CareHubState.set('todaysSchedule', todaysSchedule, true); // silent
        window.CareHubState.set('activities', activities, true);
        window.CareHubState.set('alerts', alerts, true);
        window.CareHubState.set('onboardingList', onboarding, true);
    }

    // Render all sections
    renderKPIsV2(stats);
    renderTodaysScheduleV2(todaysSchedule);
    renderActivityFeedV2(activities);
    renderAlertsV2(alerts);
    
    // Reset mini calendar offset and render
    const miniCal = document.getElementById('miniCalendar');
    if (miniCal) {
        miniCal.dataset.monthOffset = '0';
    }
    renderMiniCalendarV2();
    
    renderOnboardingV2(onboarding);
}

// Skeleton renderers for loading states
function renderKPISkeleton() {
    const kpis = [
        { icon: 'ph-user-plus', label: 'Applications', color: 'orange' },
        { icon: 'ph-handshake', label: 'Care Requests', color: 'orange' },
        { icon: 'ph-calendar', label: "Today's Visits", color: 'purple' },
        { icon: 'ph-clock', label: 'Pending Timesheets', color: 'yellow' },
        { icon: 'ph-clipboard-text', label: 'Pending Updates', color: 'yellow' },
        { icon: 'ph-stethoscope', label: 'Active Caregivers', color: 'blue' },
        { icon: 'ph-users', label: 'Active Clients', color: 'green' }
    ];
    return kpis.map(k => `
        <div class="cc-kpi cc-kpi-${k.color}">
            <div class="cc-kpi-icon"><i class="ph ${k.icon}"></i></div>
            <div class="cc-kpi-content">
                <div class="cc-kpi-value cc-skeleton">--</div>
                <div class="cc-kpi-label">${k.label}</div>
            </div>
        </div>
    `).join('');
}

function renderScheduleSkeleton() {
    return `
        <div class="cc-schedule-list">
            ${[1, 2, 3].map(() => `
                <div class="cc-schedule-item cc-skeleton-row">
                    <div class="cc-schedule-time cc-skeleton"></div>
                    <div class="cc-schedule-info">
                        <div class="cc-skeleton-line" style="width: 60%;"></div>
                        <div class="cc-skeleton-line" style="width: 40%;"></div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderActivitySkeleton() {
    return `
        <div class="cc-activity-list">
            ${[1, 2, 3, 4].map(() => `
                <div class="cc-activity-item cc-skeleton-row">
                    <div class="cc-activity-icon cc-skeleton" style="width: 24px; height: 24px; border-radius: 50%;"></div>
                    <div class="cc-activity-content" style="flex: 1;">
                        <div class="cc-skeleton-line" style="width: 50%;"></div>
                        <div class="cc-skeleton-line" style="width: 80%; height: 12px;"></div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderAlertsSkeleton() {
    return `
        <div class="cc-alerts-list">
            <div class="cc-alert cc-skeleton-row" style="padding: var(--spacing-md);">
                <div class="cc-skeleton-line" style="width: 100%;"></div>
            </div>
        </div>
    `;
}

function renderCalendarSkeleton() {
    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    return `
        <div class="cc-calendar">
            <div class="cc-calendar-header">
                <button class="cc-cal-nav" disabled><i class="ph ph-caret-left"></i></button>
                <span class="cc-skeleton" style="width: 80px; height: 18px; display: inline-block;"></span>
                <button class="cc-cal-nav" disabled><i class="ph ph-caret-right"></i></button>
            </div>
            <div class="cc-calendar-days">
                ${dayNames.map(d => `<div class="cc-day-header">${d}</div>`).join('')}
            </div>
            <div class="cc-calendar-grid">
                ${Array(31).fill(0).map(() => `
                    <div class="cc-calendar-day">
                        <span class="cc-skeleton" style="width: 16px; height: 16px; display: inline-block;"></span>
                    </div>
                `).join('')}
            </div>
            <div class="cc-calendar-legend" style="opacity: 0.5;">
                <div class="cc-legend-item"><span class="cc-legend-dot cc-dot-blue"></span> Today</div>
                <div class="cc-legend-item"><span class="cc-legend-dot"></span> Has visits</div>
                <div class="cc-legend-item"><span class="cc-legend-dot cc-dot-warning"></span> Unassigned</div>
            </div>
        </div>
    `;
}

function renderOnboardingSkeleton() {
    return `
        <div class="cc-onboarding-list">
            <div class="cc-onboarding-item cc-skeleton-row">
                <div class="cc-skeleton-line" style="width: 70%;"></div>
            </div>
        </div>
    `;
}

// Helper to get onboarding caregivers
async function getOnboardingCaregivers() {
    if (!supabaseClient) return [];
    const { data } = await supabaseClient
        .from(TABLES.CAREGIVERS)
        .select('id, name, email, created_at')
        .eq('status', 'onboarding')
        .order('created_at', { ascending: false })
        .limit(5);
    return data || [];
}

// Real render functions
function renderKPIsV2(stats) {
    const kpiGrid = document.getElementById('kpiGrid');
    if (!kpiGrid) return;

    const role = typeof getCurrentRole === 'function' ? getCurrentRole() : 'admin_owner';

    let kpis;

    if (role === 'caregiver') {
        kpis = [
            { icon: 'ph-calendar', value: stats.todaysVisits ?? 0, label: "Today's Visits", color: 'purple', page: 'schedules', pulse: (stats.todaysVisits ?? 0) > 0 },
            { icon: 'ph-clock', value: stats.pendingTimesheets ?? 0, label: 'Pending Timesheets', color: 'yellow', page: 'timesheets', pulse: (stats.pendingTimesheets ?? 0) > 0 },
            { icon: 'ph-clipboard-text', value: stats.pendingVisitUpdates ?? 0, label: 'Pending Updates', color: 'yellow', page: 'visit-updates', pulse: (stats.pendingVisitUpdates ?? 0) > 0 },
            { icon: 'ph-check-circle', value: stats.completedVisits ?? 0, label: 'Completed Visits', color: 'green', page: 'schedules', pulse: false }
        ];
    } else if (role === 'client_family') {
        kpis = [
            { icon: 'ph-calendar', value: stats.todaysVisits ?? 0, label: "Today's Visits", color: 'purple', page: 'schedules', pulse: (stats.todaysVisits ?? 0) > 0 },
            { icon: 'ph-calendar-blank', value: stats.upcomingVisits ?? 0, label: 'Upcoming Visits', color: 'blue', page: 'schedules', pulse: false },
            { icon: 'ph-clipboard-check', value: stats.approvedUpdates ?? 0, label: 'Approved Updates', color: 'green', page: 'visit-updates', pulse: false }
        ];
    } else {
        // admin_owner / co_owner — full set
        kpis = [
            { icon: 'ph-user-plus', value: stats.newApplications ?? 0, label: 'New Applications', color: 'orange', page: 'applications', pulse: (stats.newApplications ?? 0) > 0 },
            { icon: 'ph-handshake', value: stats.pendingCareRequests ?? 0, label: 'Care Requests', color: 'orange', page: 'care-requests', pulse: (stats.pendingCareRequests ?? 0) > 0 },
            { icon: 'ph-calendar', value: stats.todaysVisits ?? 0, label: "Today's Visits", color: 'purple', page: 'schedules', pulse: (stats.todaysVisits ?? 0) > 0 },
            { icon: 'ph-clock', value: stats.pendingTimesheets ?? 0, label: 'Pending Timesheets', color: 'yellow', page: 'timesheets', pulse: (stats.pendingTimesheets ?? 0) > 0 },
            { icon: 'ph-clipboard-text', value: stats.pendingVisitUpdates ?? 0, label: 'Pending Updates', color: 'yellow', page: 'visit-updates', pulse: (stats.pendingVisitUpdates ?? 0) > 0 },
            { icon: 'ph-stethoscope', value: stats.activeCaregivers ?? 0, label: 'Active Caregivers', color: 'blue', page: 'caregivers', pulse: false },
            { icon: 'ph-users', value: stats.activeClients ?? 0, label: 'Active Clients', color: 'green', page: 'clients', pulse: false }
        ];
    }

    kpiGrid.innerHTML = kpis.map(k => `
        <div class="cc-kpi cc-kpi-${k.color} ${k.pulse ? 'cc-kpi-pulse' : ''}" onclick="navigateTo('${k.page}')">
            <div class="cc-kpi-icon"><i class="ph ${k.icon}"></i></div>
            <div class="cc-kpi-content">
                <div class="cc-kpi-value">${k.value}</div>
                <div class="cc-kpi-label">${k.label}</div>
            </div>
        </div>
    `).join('');
}

function renderTodaysScheduleV2(schedules) {
    const container = document.getElementById('todaysSchedule');
    const countBadge = document.getElementById('scheduleCount');
    if (!container) return;

    if (countBadge) countBadge.textContent = schedules.length;

    if (schedules.length === 0) {
        container.innerHTML = `
            <div class="cc-empty-state">
                <div class="cc-empty-icon"><i class="ph ph-coffee"></i></div>
                <div class="cc-empty-title">No visits today</div>
                <div class="cc-empty-text">
                    <a href="#" onclick="openCreateScheduleModal(); return false;" class="cc-link">Schedule a visit</a> to get started
                </div>
            </div>
        `;
        return;
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    container.innerHTML = `
        <div class="cc-schedule-list">
            ${schedules.map((sch, i) => {
                const startMins = parseInt(sch.start_time?.split(':')[0]) * 60 + parseInt(sch.start_time?.split(':')[1] || 0);
                const isPast = startMins < currentMinutes && sch.status !== 'completed';
                const isCurrent = Math.abs(startMins - currentMinutes) < 60 && sch.status !== 'completed';
                const isCompleted = sch.status === 'completed';

                let statusClass = '';
                let statusBadge = '';
                if (isCompleted) {
                    statusClass = 'cc-schedule-completed';
                    statusBadge = '<span class="cc-status cc-status-success"><i class="ph ph-check"></i> Done</span>';
                } else if (isCurrent) {
                    statusClass = 'cc-schedule-current';
                    statusBadge = '<span class="cc-status cc-status-active"><i class="ph ph-play"></i> Now</span>';
                } else if (isPast) {
                    statusClass = 'cc-schedule-overdue';
                    statusBadge = '<span class="cc-status cc-status-warning"><i class="ph ph-clock"></i> Overdue</span>';
                } else {
                    statusBadge = `<span class="cc-status cc-status-${sch.status}">${sch.status}</span>`;
                }

                return `
                    <div class="cc-schedule-item ${statusClass}" onclick="viewScheduleDetail('${sch.id}')" style="animation-delay: ${i * 0.05}s">
                        <div class="cc-schedule-time">
                            <div class="cc-time-start">${formatTime(sch.start_time)}</div>
                            <div class="cc-time-end">${formatTime(sch.end_time)}</div>
                        </div>
                        <div class="cc-schedule-info">
                            <div class="cc-schedule-client">${escapeHtml(sch.client?.care_for || sch.client?.name || 'Unknown')}</div>
                            <div class="cc-schedule-caregiver">
                                ${sch.caregiver?.name
                                    ? `<span class="cc-caregiver-name">${escapeHtml(sch.caregiver.name)}</span>`
                                    : '<span class="cc-unassigned"><i class="ph ph-warning-circle"></i> Unassigned</span>'
                                }
                            </div>
                        </div>
                        <div class="cc-schedule-status">${statusBadge}</div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderActivityFeedV2(activities) {
    const container = document.getElementById('activityFeed');
    if (!container) return;

    if (activities.length === 0) {
        container.innerHTML = `
            <div class="cc-empty-state cc-empty-small">
                <div class="cc-empty-text">No recent activity</div>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="cc-activity-list">
            ${activities.map((act, i) => `
                <div class="cc-activity-item" style="animation-delay: ${i * 0.05}s">
                    <div class="cc-activity-icon cc-activity-${act.color}"><i class="ph ${act.icon}"></i></div>
                    <div class="cc-activity-content">
                        <div class="cc-activity-title">${act.title}</div>
                        <div class="cc-activity-desc">${act.message}</div>
                        <div class="cc-activity-time">${formatTimeAgo(act.timestamp)}</div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderAlertsV2(alerts) {
    const container = document.getElementById('alertsPanel');
    const countBadge = document.getElementById('alertCount');
    if (!container) return;

    const urgentAlerts = alerts.filter(a => a.severity === 'urgent' || a.severity === 'warning');

    if (countBadge) {
        countBadge.textContent = urgentAlerts.length;
        countBadge.style.display = urgentAlerts.length > 0 ? 'inline-flex' : 'none';
    }

    if (alerts.length === 0) {
        container.innerHTML = `
            <div class="cc-empty-state cc-empty-small">
                <div class="cc-empty-icon"><i class="ph ph-check-circle"></i></div>
                <div class="cc-empty-title" style="font-size: 0.9rem;">All caught up!</div>
                <div class="cc-empty-text">No urgent items requiring attention</div>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="cc-alerts-list">
            ${alerts.slice(0, 5).map((alert, i) => {
                const severityClass = alert.severity === 'urgent' ? 'cc-alert-urgent'
                    : alert.severity === 'warning' ? 'cc-alert-warning'
                    : 'cc-alert-info';
                return `
                    <div class="cc-alert ${severityClass}" style="animation-delay: ${i * 0.05}s">
                        <div class="cc-alert-icon"><i class="ph ${alert.icon}"></i></div>
                        <div class="cc-alert-content">
                            <div class="cc-alert-title">${alert.title}</div>
                            <div class="cc-alert-message">${alert.message}</div>
                        </div>
                        <button class="cc-alert-action" onclick="handleAlertAction('${alert.type}', '${alert.link}')">${alert.action}</button>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

/**
 * Render unified mini calendar using shared calendar system
 */
async function renderMiniCalendarV2() {
    const container = document.getElementById('miniCalendar');
    if (!container) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];

    // Fetch schedules for this month
    const monthSchedules = await getSchedulesForMonth(year, month);
    const schedulesByDate = groupSchedulesByDate(monthSchedules);

    // Build calendar grid
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = formatDateForAPI(now);
    
    let calendarGridHTML = Array(firstDay).fill('<div></div>').join('');
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayIsToday = dateStr === todayStr;
        const dayEvents = schedulesByDate[dateStr] || [];
        const dayOfWeek = (firstDay + day - 1) % 7;
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        calendarGridHTML += renderCalendarDay({
            dateStr,
            dayNumber: day,
            isToday: dayIsToday,
            isCurrentMonth: true,
            isWeekend,
            isSelected: false,
            events: dayEvents,
            maxEvents: 4,
            compact: true
        });
    }

    container.innerHTML = `
        <div class="calendar-container compact">
            ${renderCalendarHeader({
                title: `${monthNames[month]} ${year}`,
                onPrev: 'changeMiniCalendarMonth(-1)',
                onNext: 'changeMiniCalendarMonth(1)',
                compact: true
            })}
            ${renderCalendarDayHeaders(true)}
            <div class="calendar-grid">
                ${calendarGridHTML}
            </div>
            <div class="calendar-legend" style="padding: var(--space-3);">
                <div class="calendar-legend-item">
                    <span class="calendar-legend-dot" style="background: var(--brand-primary);"></span>
                    Today
                </div>
                <div class="calendar-legend-item">
                    <span class="calendar-legend-dot" style="background: var(--info);"></span>
                    Scheduled
                </div>
                <div class="calendar-legend-item">
                    <span class="calendar-legend-dot" style="background: var(--warning);"></span>
                    Unassigned
                </div>
            </div>
        </div>
    `;
}

/**
 * Navigate mini calendar to different month
 */
function changeMiniCalendarMonth(direction) {
    // Store the offset from current month in a data attribute
    const container = document.getElementById('miniCalendar');
    let monthOffset = parseInt(container?.dataset?.monthOffset || '0');
    monthOffset += direction;
    
    if (container) {
        container.dataset.monthOffset = monthOffset;
    }
    
    // Re-render with offset
    renderMiniCalendarV2WithOffset(monthOffset);
}

/**
 * Render mini calendar with month offset using unified system
 */
async function renderMiniCalendarV2WithOffset(monthOffset = 0) {
    const container = document.getElementById('miniCalendar');
    if (!container) return;

    const now = new Date();
    const targetDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const isCurrentMonth = monthOffset === 0;
    const todayStr = formatDateForAPI(now);

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];

    // Fetch schedules for this month
    const monthSchedules = await getSchedulesForMonth(year, month);
    const schedulesByDate = groupSchedulesByDate(monthSchedules);

    // Build calendar grid
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let calendarGridHTML = Array(firstDay).fill('<div></div>').join('');
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayIsToday = isCurrentMonth && dateStr === todayStr;
        const dayEvents = schedulesByDate[dateStr] || [];
        const dayOfWeek = (firstDay + day - 1) % 7;
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        calendarGridHTML += renderCalendarDay({
            dateStr,
            dayNumber: day,
            isToday: dayIsToday,
            isCurrentMonth: true,
            isWeekend,
            isSelected: false,
            events: dayEvents,
            maxEvents: 4,
            compact: true
        });
    }

    container.innerHTML = `
        <div class="calendar-container compact">
            ${renderCalendarHeader({
                title: `${monthNames[month]} ${year}`,
                onPrev: 'changeMiniCalendarMonth(-1)',
                onNext: 'changeMiniCalendarMonth(1)',
                compact: true
            })}
            ${renderCalendarDayHeaders(true)}
            <div class="calendar-grid">
                ${calendarGridHTML}
            </div>
            <div class="calendar-legend" style="padding: var(--space-3);">
                <div class="calendar-legend-item">
                    <span class="calendar-legend-dot" style="background: var(--brand-primary);"></span>
                    Today
                </div>
                <div class="calendar-legend-item">
                    <span class="calendar-legend-dot" style="background: var(--info);"></span>
                    Scheduled
                </div>
                <div class="calendar-legend-item">
                    <span class="calendar-legend-dot" style="background: var(--warning);"></span>
                    Unassigned
                </div>
            </div>
        </div>
    `;
}

function renderOnboardingV2(caregivers) {
    const container = document.getElementById('onboardingPanel');
    if (!container) return;

    if (caregivers.length === 0) {
        container.innerHTML = `
            <div class="cc-empty-state cc-empty-small">
                <div class="cc-empty-text">No caregivers in onboarding</div>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="cc-onboarding-list">
            ${caregivers.map((cg, i) => `
                <div class="cc-onboarding-item" style="animation-delay: ${i * 0.05}s" onclick="navigateTo('caregivers')">
                    <div class="cc-onboarding-avatar">${(cg.name || '?').charAt(0).toUpperCase()}</div>
                    <div class="cc-onboarding-info">
                        <div class="cc-onboarding-name">${escapeHtml(cg.name || 'Unknown')}</div>
                        <div class="cc-onboarding-meta">Added ${formatTimeAgo(cg.created_at)}</div>
                    </div>
                    <div class="cc-onboarding-arrow"><i class="ph ph-caret-right"></i></div>
                </div>
            `).join('')}
        </div>
    `;
}

async function handleAlertAction(type, link) {
    // Extract the page from link and navigate
    const page = link.replace('/', '');
    navigateTo(page);
}

async function navigateToDate(year, month, day) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    scheduleCurrentDate = new Date(year, month, day);
    
    // Reset mini calendar offset when navigating
    const miniCal = document.getElementById('miniCalendar');
    if (miniCal) {
        miniCal.dataset.monthOffset = '0';
    }
    
    // Navigate to schedules page
    navigateTo('schedules');
}

function formatTimeAgo(timestamp) {
    if (!timestamp) return '';

    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(timestamp);
}

function navigateTo(page) {
    // Route guard - check if user can access this page
    if (typeof canAccessPage === 'function' && !canAccessPage(page)) {
        if (DEBUG) console.log(`[Navigation] Access denied to ${page}, redirecting to dashboard`);
        page = 'dashboard'; // Fall back to dashboard
    }
    
    // Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    // Load the page
    loadPage(page);
}

async function renderApplications() {
    mainContent.innerHTML = `
        <div class="page-header animate-fade-in">
            <h1>Applications</h1>
            <p>Review and manage caregiver applications</p>
        </div>
        
        <div class="filter-tabs">
            <button class="filter-tab active" data-filter="all">All</button>
            <button class="filter-tab" data-filter="new">New</button>
            <button class="filter-tab" data-filter="pending">Pending</button>
            <button class="filter-tab" data-filter="approved">Approved</button>
            <button class="filter-tab" data-filter="denied">Denied</button>
        </div>
        
        <div class="card">
            <div class="card-header">
                <span class="card-title">Caregiver Applications</span>
            </div>
            <div class="card-body">
                <div id="applicationsContent">
                    <div class="loading-state">
                        <div class="spinner"></div>
                        <p>Loading applications...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Setup filter tabs
    setupFilterTabs('applications');
    
    // Load data
    await loadApplications('all');
}

async function loadApplications(filter = 'all') {
    if (DEBUG) console.log('[CareHub] === loadApplications START ===');
    if (DEBUG) console.log('[CareHub] Filter:', filter);
    
    const filters = filter !== 'all' ? { status: filter } : {};
    const applications = await getApplications(filters);
    
    if (DEBUG) console.log('[CareHub] loadApplications received:', applications ? applications.length : 0, 'applications');
    
    const container = document.getElementById('applicationsContent');
    
    // Only show empty state if data is actually empty array
    if (!applications || applications.length === 0) {
        if (DEBUG) console.log('[CareHub] Showing empty state - data is empty or null');
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon"><i class="ph ph-user-plus"></i></div>
                <h3>No applications found</h3>
                <p>There are no ${filter !== 'all' ? filter + ' ' : ''}applications at this time.</p>
                <p style="font-size: 0.85rem; color: var(--warm-muted); margin-top: 1rem;">
                    Try running: await testDirectQuery() in console
                </p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Applicant</th>
                        <th>Email</th>
                        <th>City</th>
                        <th>Availability</th>
                        <th>Date Applied</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${applications.map(app => `
                        <tr data-id="${app.id}">
                            <td><strong>${escapeHtml(app.full_name)}</strong></td>
                            <td>${escapeHtml(app.email)}</td>
                            <td>${escapeHtml(app.city || 'N/A')}</td>
                            <td>${escapeHtml(app.availability || 'N/A')}</td>
                            <td>${formatDate(app.created_at)}</td>
                            <td>${renderStatusBadge(app.status)}</td>
                            <td class="actions">
                                <button class="btn btn-sm btn-secondary" onclick="viewApplication('${app.id}')">
                                    View
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    if (DEBUG) console.log('[CareHub] === loadApplications END ===');
    if (DEBUG) console.log('[CareHub] Rendered', applications.length, 'applications in table');
}

async function renderCareRequests() {
    mainContent.innerHTML = `
        <div class="page-header animate-fade-in">
            <h1>Care Requests</h1>
            <p>Review and manage client care requests</p>
        </div>
        
        <div class="filter-tabs">
            <button class="filter-tab active" data-filter="all">All</button>
            <button class="filter-tab" data-filter="new">New</button>
            <button class="filter-tab" data-filter="reviewing">Reviewing</button>
            <button class="filter-tab" data-filter="onboarding">Onboarding</button>
            <button class="filter-tab" data-filter="approved">Approved</button>
            <button class="filter-tab" data-filter="denied">Denied</button>
            <button class="filter-tab" data-filter="converted_to_client">Converted</button>
        </div>
        
        <div class="card">
            <div class="card-header">
                <span class="card-title">Client Care Requests</span>
            </div>
            <div class="card-body">
                <div id="careRequestsContent">
                    <div class="loading-state">
                        <div class="spinner"></div>
                        <p>Loading care requests...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    setupFilterTabs('care-requests');
    await loadCareRequests('all');
}

async function loadCareRequests(filter = 'all') {
    const filters = filter !== 'all' ? { status: filter } : {};
    const requests = await getCareRequests(filters);
    
    const container = document.getElementById('careRequestsContent');
    
    if (requests.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon"><i class="ph ph-handshake"></i></div>
                <h3>No care requests found</h3>
                <p>There are no ${filter !== 'all' ? filter + ' ' : ''}care requests at this time.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Requester</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Care For</th>
                        <th>Location</th>
                        <th>Date Requested</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${requests.map(req => `
                        <tr data-id="${req.id}">
                            <td><strong>${escapeHtml(req.requester_name || 'N/A')}</strong></td>
                            <td>${escapeHtml(req.email || 'N/A')}</td>
                            <td>${escapeHtml(req.phone || 'N/A')}</td>
                            <td>${escapeHtml(req.care_for || 'N/A')}</td>
                            <td>${escapeHtml(req.location || 'N/A')}</td>
                            <td>${formatDate(req.created_at)}</td>
                            <td>${renderStatusBadge(req.status)}</td>
                            <td class="actions">
                                <button class="btn btn-sm btn-secondary" onclick="viewCareRequest('${req.id}')">
                                    View
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function renderCaregivers() {
    mainContent.innerHTML = `
        <div class="page-header animate-fade-in">
            <h1>Caregivers</h1>
            <p>Manage caregiver profiles and status</p>
        </div>
        
        <div class="filter-tabs">
            <button class="filter-tab active" data-filter="all">All</button>
            <button class="filter-tab" data-filter="onboarding">Onboarding</button>
            <button class="filter-tab" data-filter="active">Active</button>
            <button class="filter-tab" data-filter="inactive">Inactive</button>
        </div>
        
        <div class="card">
            <div class="card-header">
                <span class="card-title">Caregiver Directory</span>
            </div>
            <div class="card-body">
                <div id="caregiversContent">
                    <div class="loading-state">
                        <div class="spinner"></div>
                        <p>Loading caregivers...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    setupFilterTabs('caregivers');
    await loadCaregivers('all');
}

async function loadCaregivers(filter = 'all') {
    const filters = filter !== 'all' ? { status: filter } : {};
    let caregivers = await getCaregivers(filters);

    // Role filtering: caregivers see only themselves; families see their assigned caregivers
    if (window.RoleFilter && !window.RoleFilter._isFullAccess()) {
        // Resolve which caregiver IDs are assigned to this user's client (for client_family)
        let ctx = {};
        if (window.getCurrentRole && window.getCurrentRole() === 'client_family') {
            const clientId = window.RoleFilter.getCurrentClientId();
            if (clientId) {
                const assignedSchedules = await getSchedules({ client_id: clientId });
                ctx.assignedCaregiverIds = [...new Set(assignedSchedules.map(s => s.caregiver_id).filter(Boolean))];
            }
        }
        caregivers = window.RoleFilter.filterRecordsByRole(caregivers, 'caregivers', ctx);
    }
    
    const role = typeof getCurrentRole === 'function' ? getCurrentRole() : null;
    const container = document.getElementById('caregiversContent');

    if (caregivers.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon"><i class="ph ph-stethoscope"></i></div>
                <h3>No caregivers found</h3>
                <p>There are no ${filter !== 'all' ? filter + ' ' : ''}caregivers at this time.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>City</th>
                        <th>Onboarding Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${caregivers.map(cg => `
                        <tr data-id="${cg.id}">
                            <td><strong>${escapeHtml(cg.name || 'N/A')}</strong></td>
                            <td>${escapeHtml(cg.email || 'N/A')}</td>
                            <td>${escapeHtml(cg.phone || 'N/A')}</td>
                            <td>${escapeHtml(cg.city || 'N/A')}</td>
                            <td>${renderStatusBadge(cg.status)}</td>
                            <td class="actions">
                                <button class="btn btn-sm btn-secondary" onclick="viewCaregiver('${cg.id}')">
                                    View
                                </button>
                                ${(role === 'admin_owner' || role === 'co_owner') && cg.account_status !== 'active' ? `
                                <button class="btn btn-sm btn-invite" data-invite-id="${cg.id}" onclick="sendCaregiverInvite('${cg.id}')" title="${cg.account_status === 'invite_sent' ? 'Resend portal invite' : 'Send portal invite'}">
                                    <i class="ph ph-envelope"></i> ${cg.account_status === 'invite_sent' ? 'Resend' : 'Invite'}
                                </button>` : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function renderClients() {
    mainContent.innerHTML = `
        <div class="page-header animate-fade-in">
            <h1>Clients</h1>
            <p>Manage client profiles and care details</p>
        </div>
        
        <div class="filter-tabs">
            <button class="filter-tab active" data-filter="all">All</button>
            <button class="filter-tab" data-filter="active">Active</button>
            <button class="filter-tab" data-filter="inactive">Inactive</button>
        </div>
        
        <div class="card">
            <div class="card-header">
                <span class="card-title">Client Directory</span>
            </div>
            <div class="card-body">
                <div id="clientsContent">
                    <div class="loading-state">
                        <div class="spinner"></div>
                        <p>Loading clients...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    setupFilterTabs('clients');
    await loadClients('all');
}

async function loadClients(filter = 'all') {
    const filters = filter !== 'all' ? { status: filter } : {};
    let clients = await getClients(filters);

    // Role filtering: caregivers see only their assigned clients; families see only their own
    if (window.RoleFilter && !window.RoleFilter._isFullAccess()) {
        let ctx = {};
        if (window.getCurrentRole && window.getCurrentRole() === 'caregiver') {
            const caregiverId = window.RoleFilter.getCurrentCaregiverId();
            if (caregiverId) {
                const assignedSchedules = await getSchedules({ caregiver_id: caregiverId });
                ctx.assignedClientIds = [...new Set(assignedSchedules.map(s => s.client_id).filter(Boolean))];
            }
        }
        clients = window.RoleFilter.filterRecordsByRole(clients, 'clients', ctx);
    }
    
    const container = document.getElementById('clientsContent');
    
    if (clients.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon"><i class="ph ph-users"></i></div>
                <h3>No clients found</h3>
                <p>There are no ${filter !== 'all' ? filter + ' ' : ''}clients at this time.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Location</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${clients.map(client => `
                        <tr data-id="${client.id}">
                            <td><strong>${escapeHtml(client.name || client.care_for || 'N/A')}</strong></td>
                            <td>${escapeHtml(client.email || 'N/A')}</td>
                            <td>${escapeHtml(client.phone || 'N/A')}</td>
                            <td>${escapeHtml(client.location || client.address || 'N/A')}</td>
                            <td>${renderStatusBadge(client.status)}</td>
                            <td class="actions">
                                <button class="btn btn-sm btn-secondary" onclick="viewClient('${client.id}')">
                                    View
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// ==================== TIMESHEETS ====================

let currentTimesheetFilter = 'all';
let currentTimesheetTab = 'entries'; // 'entries' or 'payroll'

async function renderTimesheets() {
    mainContent.innerHTML = `
        <div class="page-header animate-fade-in">
            <h1>Timesheets</h1>
            <p>Manage caregiver time tracking, mileage, and payroll</p>
        </div>

        <div class="filter-tabs" style="margin-bottom: var(--spacing-lg);">
            <button class="filter-tab ${currentTimesheetTab === 'entries' ? 'active' : ''}" onclick="switchTimesheetTab('entries')">Timesheet Entries</button>
            <button class="filter-tab ${currentTimesheetTab === 'payroll' ? 'active' : ''}" onclick="switchTimesheetTab('payroll')">Payroll Export</button>
        </div>

        <div id="timesheetsTabContent">
            ${currentTimesheetTab === 'entries' ? renderTimesheetEntriesTab() : renderPayrollExportTab()}
        </div>
    `;

    if (currentTimesheetTab === 'entries') {
        await loadTimesheets(currentTimesheetFilter);
    }
}

function renderTimesheetEntriesTab() {
    return `
        <div class="filter-tabs" style="margin-bottom: var(--spacing-md);">
            <button class="filter-tab ${currentTimesheetFilter === 'all' ? 'active' : ''}" data-filter="all" onclick="switchTimesheetFilter('all')">All</button>
            <button class="filter-tab ${currentTimesheetFilter === 'pending' ? 'active' : ''}" data-filter="pending" onclick="switchTimesheetFilter('pending')">Pending</button>
            <button class="filter-tab ${currentTimesheetFilter === 'approved' ? 'active' : ''}" data-filter="approved" onclick="switchTimesheetFilter('approved')">Approved</button>
            <button class="filter-tab ${currentTimesheetFilter === 'rejected' ? 'active' : ''}" data-filter="rejected" onclick="switchTimesheetFilter('rejected')">Rejected</button>
        </div>

        <div class="card">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                <span class="card-title">Timesheet Entries</span>
                <button class="btn btn-success" onclick="openCreateTimesheetModal()">+ New Timesheet</button>
            </div>
            <div class="card-body" id="timesheetsContent">
                <div class="loading-state">
                    <div class="spinner"></div>
                    <p>Loading timesheets...</p>
                </div>
            </div>
        </div>
    `;
}

function renderPayrollExportTab() {
    return `
        <div class="card">
            <div class="card-header">
                <span class="card-title">Payroll Export</span>
            </div>
            <div class="card-body" id="payrollExportContent">
                <div class="detail-section">
                    <h4>Pay Period</h4>
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="payroll-start-date">Start Date *</label>
                            <input type="date" id="payroll-start-date" class="form-input" required>
                        </div>
                        <div class="form-group">
                            <label for="payroll-end-date">End Date *</label>
                            <input type="date" id="payroll-end-date" class="form-input" required>
                        </div>
                    </div>
                </div>

                <div class="detail-section">
                    <h4>Reimbursement Rate</h4>
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="mileage-rate">Mileage Rate ($/mile) *</label>
                            <input type="number" id="mileage-rate" class="form-input" value="0.67" min="0" step="0.01" required>
                            <small style="color: var(--warm-muted);">Default: 2024 IRS rate $0.67/mile</small>
                        </div>
                    </div>
                </div>

                <div class="detail-section">
                    <button class="btn btn-primary" onclick="previewPayroll()">Preview Payroll</button>
                </div>

                <div id="payrollPreviewSection" style="display: none;">
                    <div class="detail-section" style="background: var(--warm-bg); padding: var(--spacing-md); border-radius: var(--radius-md);">
                        <h4>Payroll Summary</h4>
                        <div id="payrollSummaryStats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--spacing-md); margin-bottom: var(--spacing-md);">
                        </div>
                    </div>

                    <div id="payrollPreviewTable" style="margin-top: var(--spacing-lg);">
                    </div>

                    <div class="detail-section" style="margin-top: var(--spacing-lg);">
                        <h4>Export Options</h4>
                        <div style="display: flex; gap: var(--spacing-md); flex-wrap: wrap;">
                            <button class="btn btn-success" onclick="exportPayrollCSV()"><i class="ph ph-download"></i> Export CSV</button>
                            <button class="btn btn-secondary" onclick="savePayrollExport()"><i class="ph ph-floppy-disk"></i> Save Export History</button>
                        </div>
                    </div>
                </div>

                <div id="payrollExportHistory" style="margin-top: var(--spacing-xl);">
                    <h4 style="margin-bottom: var(--spacing-md);">Export History</h4>
                    <div id="payrollHistoryContent">
                        <div class="loading-state">
                            <div class="spinner"></div>
                            <p>Loading history...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function switchTimesheetTab(tab) {
    currentTimesheetTab = tab;
    await renderTimesheets();
}

async function switchTimesheetFilter(filter) {
    currentTimesheetFilter = filter;
    await renderTimesheets();
}

async function loadTimesheets(filter = 'all') {
    const container = document.getElementById('timesheetsContent');
    if (!container) return;

    container.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading timesheets...</p>
        </div>
    `;

    const filters = {};
    if (filter !== 'all') {
        filters.status = filter;
    }

    const timesheets = await getTimesheets(filters);

    if (timesheets.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon"><i class="ph ph-clock"></i></div>
                <h3>No timesheets found</h3>
                <p>${filter !== 'all' ? `No ${filter} timesheets.` : 'Create a timesheet from a completed visit.'}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Caregiver</th>
                        <th>Client</th>
                        <th>Hours</th>
                        <th>Mileage</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${timesheets.map(ts => `
                        <tr data-id="${ts.id}">
                            <td>${formatDate(ts.date)}</td>
                            <td><strong>${escapeHtml(ts.caregiver?.name || 'N/A')}</strong></td>
                            <td>${escapeHtml(ts.client?.care_for || ts.client?.name || 'N/A')}</td>
                            <td>${ts.hours || '0'}</td>
                            <td>${ts.mileage ? ts.mileage + ' mi' : '-'}</td>
                            <td>${renderStatusBadge(ts.status)}</td>
                            <td class="actions">
                                <button class="btn btn-sm btn-secondary" onclick="viewTimesheet('${ts.id}')">View</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// ==================== VISIT UPDATES ====================

let currentVisitUpdateFilter = 'all';

async function renderVisitUpdates() {
    mainContent.innerHTML = `
        <div class="page-header animate-fade-in">
            <h1>Visit Updates</h1>
            <p>Manage caregiver visit reports and notes</p>
        </div>

        <div class="filter-tabs">
            <button class="filter-tab active" data-filter="all" onclick="switchVisitUpdateFilter('all')">All</button>
            <button class="filter-tab" data-filter="pending" onclick="switchVisitUpdateFilter('pending')">Pending</button>
            <button class="filter-tab" data-filter="approved" onclick="switchVisitUpdateFilter('approved')">Approved</button>
            <button class="filter-tab" data-filter="internal_only" onclick="switchVisitUpdateFilter('internal_only')">Internal</button>
        </div>

        <div class="card">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                <span class="card-title">Visit Reports</span>
                <button class="btn btn-success" onclick="openCreateVisitUpdateModal()">+ New Update</button>
            </div>
            <div class="card-body" id="visitUpdatesContent">
                <div class="loading-state">
                    <div class="spinner"></div>
                    <p>Loading visit updates...</p>
                </div>
            </div>
        </div>
    `;

    await loadVisitUpdates(currentVisitUpdateFilter);
}

async function switchVisitUpdateFilter(filter) {
    currentVisitUpdateFilter = filter;
    
    // Update active tab
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.filter === filter);
    });
    
    await loadVisitUpdates(filter);
}

async function loadVisitUpdates(filter = 'all') {
    const container = document.getElementById('visitUpdatesContent');
    if (!container) return;

    container.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading visit updates...</p>
        </div>
    `;

    const filters = {};
    if (filter !== 'all') {
        filters.status = filter;
    }

    const updates = await getVisitUpdates(filters);

    if (updates.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon"><i class="ph ph-clipboard-text"></i></div>
                <h3>No visit updates found</h3>
                <p>${filter !== 'all' ? `No ${filter} updates.` : 'Create a visit update from a scheduled visit.'}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Visit Date</th>
                        <th>Caregiver</th>
                        <th>Client</th>
                        <th>Summary</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${updates.map(update => `
                        <tr data-id="${update.id}">
                            <td>${formatDate(update.visit_date)}</td>
                            <td><strong>${escapeHtml(update.caregiver?.name || 'N/A')}</strong></td>
                            <td>${escapeHtml(update.client?.care_for || update.client?.name || 'N/A')}</td>
                            <td>${escapeHtml(truncate(update.visit_summary, 50))}</td>
                            <td>${renderStatusBadge(update.status)}</td>
                            <td class="actions">
                                <button class="btn btn-sm btn-secondary" onclick="viewVisitUpdate('${update.id}')">View</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderSettings() {
    const session  = typeof getSession      === 'function' ? getSession()      : null;
    const role     = typeof getCurrentRole  === 'function' ? getCurrentRole()  : null;
    const canInvite = role === 'admin_owner' || role === 'co_owner';

    const roleDisplayMap = {
        admin_owner:   'Admin / Owner',
        co_owner:      'Co-Owner',
        caregiver:     'Caregiver',
        client_family: 'Client / Family'
    };
    const roleDisplay = roleDisplayMap[role] || 'User';
    const userEmail   = session?.email || (typeof ADMIN_CREDENTIALS !== 'undefined' ? ADMIN_CREDENTIALS.email : '');
    const userName    = session?.name  || userEmail;

    mainContent.innerHTML = `
        <div class="page-header animate-fade-in">
            <h1>Settings</h1>
            <p>Configure your CareHub account and team</p>
        </div>

        <div class="card">
            <div class="card-header">
                <span class="card-title">Account Information</span>
            </div>
            <div class="card-body">
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">Name</div>
                        <div class="detail-value">${escapeHtml(userName)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Email</div>
                        <div class="detail-value">${escapeHtml(userEmail)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Role</div>
                        <div class="detail-value">${escapeHtml(roleDisplay)}</div>
                    </div>
                </div>
            </div>
        </div>

        ${canInvite ? '<div id="inviteUserSection"></div>' : ''}

        <div class="card">
            <div class="card-header">
                <span class="card-title">General Settings</span>
            </div>
            <div class="card-body">
                <p style="color: var(--warm-muted);">
                    Additional settings will be available in future phases.
                </p>
            </div>
        </div>
    `;

    // Mount invite section for admin roles
    if (canInvite && window.CareHubInvite) {
        const inviteContainer = document.getElementById('inviteUserSection');
        if (inviteContainer) {
            window.CareHubInvite.renderInviteSection(inviteContainer);
        }
    }
}

// Schedule View State
let scheduleViewMode = 'month'; // 'month', 'week', 'day', 'list'
let scheduleCurrentDate = new Date(); // Currently selected date for navigation — MUST always be a Date object

/**
 * Guard: ensure scheduleCurrentDate is always a valid Date.
 * Call at the top of every view renderer and navigation function.
 */
function ensureScheduleDateIsDate() {
    if (!(scheduleCurrentDate instanceof Date) || isNaN(scheduleCurrentDate.getTime())) {
        scheduleCurrentDate = new Date();
    }
}

let scheduleListFilters = {
    dateFrom: '',
    dateTo: '',
    status: '',
    caregiverId: '',
    clientId: '',
    serviceType: ''
};

async function renderSchedules() {
    mainContent.innerHTML = `
        <div class="page-header animate-fade-in">
            <h1>Schedules</h1>
            <p>Manage caregiver visits and appointments</p>
        </div>

        <div class="schedule-controls">
            <!-- View Mode Toggle -->
            <div class="view-mode-tabs">
                <button class="view-tab ${scheduleViewMode === 'month' ? 'active' : ''}" onclick="switchScheduleMode('month')">
                    <i class="ph ph-calendar"></i> Month
                </button>
                <button class="view-tab ${scheduleViewMode === 'week' ? 'active' : ''}" onclick="switchScheduleMode('week')">
                    <i class="ph ph-calendar-blank"></i> Week
                </button>
                <button class="view-tab ${scheduleViewMode === 'day' ? 'active' : ''}" onclick="switchScheduleMode('day')">
                    <i class="ph ph-list-dashes"></i> Day
                </button>
                <button class="view-tab ${scheduleViewMode === 'list' ? 'active' : ''}" onclick="switchScheduleMode('list')">
                    <i class="ph ph-list"></i> List
                </button>
            </div>

            <!-- Navigation -->
            <div class="schedule-navigation">
                <button class="btn btn-secondary btn-sm" onclick="navigateSchedule('prev')"><i class="ph ph-caret-left"></i> Previous</button>
                <button class="btn btn-primary btn-sm" onclick="navigateSchedule('today')">Today</button>
                <button class="btn btn-secondary btn-sm" onclick="navigateSchedule('next')">Next <i class="ph ph-caret-right"></i></button>
            </div>

            <!-- Date Range Display -->
            <div class="schedule-range-display" id="scheduleRangeDisplay">
                Loading...
            </div>
        </div>

        <div class="card schedule-card">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                <span class="card-title">Visits</span>
                <button class="btn btn-success" onclick="openCreateScheduleModal()">+ New Visit</button>
            </div>
            <div class="card-body" id="schedulesContainer">
                <div class="loading-state">
                    <div class="spinner"></div>
                    <p>Loading schedules...</p>
                </div>
            </div>
        </div>
    `;

    await loadScheduleView();
}

async function switchScheduleMode(mode) {
    scheduleViewMode = mode;
    await renderSchedules();
}

function navigateSchedule(direction) {
    ensureScheduleDateIsDate();
    const current = new Date(scheduleCurrentDate);

    switch(direction) {
        case 'prev':
            if (scheduleViewMode === 'month') {
                current.setMonth(current.getMonth() - 1);
            } else if (scheduleViewMode === 'week') {
                current.setDate(current.getDate() - 7);
            } else if (scheduleViewMode === 'day') {
                current.setDate(current.getDate() - 1);
            } else if (scheduleViewMode === 'list') {
                // For list view, shift date range by 7 days
                const days = getDateRangeDays();
                current.setDate(current.getDate() - days);
            }
            break;
        case 'next':
            if (scheduleViewMode === 'month') {
                current.setMonth(current.getMonth() + 1);
            } else if (scheduleViewMode === 'week') {
                current.setDate(current.getDate() + 7);
            } else if (scheduleViewMode === 'day') {
                current.setDate(current.getDate() + 1);
            } else if (scheduleViewMode === 'list') {
                const days = getDateRangeDays();
                current.setDate(current.getDate() + days);
            }
            break;
        case 'today':
            current.setTime(new Date().getTime());
            if (scheduleViewMode === 'list') {
                // Reset list filters to default range
                scheduleListFilters.dateFrom = '';
                scheduleListFilters.dateTo = '';
            }
            break;
    }

    scheduleCurrentDate = current;
    loadScheduleView();
}

function getDateRangeDays() {
    // Calculate days in current list view range (default 30)
    // Use parseLocalDateToDate to avoid timezone-shift when converting YYYY-MM-DD strings
    if (scheduleListFilters.dateFrom && scheduleListFilters.dateTo) {
        const from = parseLocalDateToDate(scheduleListFilters.dateFrom);
        const to = parseLocalDateToDate(scheduleListFilters.dateTo);
        return Math.max(1, Math.round((to - from) / (1000 * 60 * 60 * 24)));
    }
    return 30;
}

async function loadScheduleView() {
    updateScheduleRangeDisplay();
    switch(scheduleViewMode) {
        case 'month':
            await renderMonthView();
            break;
        case 'week':
            await renderWeekView();
            break;
        case 'day':
            await renderDayView();
            break;
        case 'list':
            await renderListView();
            break;
    }
}

function updateScheduleRangeDisplay() {
    const display = document.getElementById('scheduleRangeDisplay');
    if (!display) return;

    ensureScheduleDateIsDate();
    const current = new Date(scheduleCurrentDate);
    const options = { year: 'numeric', month: 'long' };

    switch(scheduleViewMode) {
        case 'month':
            display.textContent = current.toLocaleDateString('en-US', options);
            break;
        case 'week': {
            const weekStart = new Date(current);
            weekStart.setDate(current.getDate() - current.getDay());
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            const startStr = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const endStr = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            display.textContent = `Week of ${startStr}–${endStr}`;
            break;
        }
        case 'day':
            display.textContent = current.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            break;
        case 'list':
            display.textContent = 'List View';
            break;
    }
}

// ==================== MONTH VIEW ====================

/**
 * Render unified month view using shared calendar system
 */
async function renderMonthView() {
    const container = document.getElementById('schedulesContainer');
    if (!container) return;

    ensureScheduleDateIsDate();

    container.innerHTML = `
        <div class="calendar-empty-state">
            <div class="spinner"></div>
            <div class="calendar-empty-state-text">Loading calendar...</div>
        </div>
    `;

    // Calculate month boundaries
    const year = scheduleCurrentDate.getFullYear();
    const month = scheduleCurrentDate.getMonth();
    const selectedDateStr = formatDateForAPI(scheduleCurrentDate);
    
    // First day of the month
    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay();
    
    // Calculate start of calendar (previous month days to show)
    const calendarStart = new Date(year, month, 1 - firstDayOfWeek);
    const calendarEnd = new Date(calendarStart);
    calendarEnd.setDate(calendarStart.getDate() + 41);

    // Format dates for API
    const startStr = formatDateForAPI(calendarStart);
    const endStr = formatDateForAPI(calendarEnd);

    // Fetch schedules for the calendar range
    const schedules = await getSchedules({
        date_from: startStr,
        date_to: endStr
    });

    // Group schedules by date using shared utility
    const schedulesByDate = groupSchedulesByDate(schedules);

    // Build calendar grid using shared renderCalendarDay function
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const todayStr = formatDateForAPI(new Date());
    
    let calendarGridHTML = '';
    
    // Generate 42 days (6 weeks) using string-based date math
    let currentYear = calendarStart.getFullYear();
    let currentMonth = calendarStart.getMonth();
    let currentDay = calendarStart.getDate();
    
    for (let i = 0; i < 42; i++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
        const dayIsToday = dateStr === todayStr;
        const isCurrentMonth = currentMonth === month;
        const dayOfWeek = (calendarStart.getDay() + i) % 7;
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isSelected = dateStr === selectedDateStr;
        const dayEvents = schedulesByDate[dateStr] || [];
        
        calendarGridHTML += renderCalendarDay({
            dateStr,
            dayNumber: currentDay,
            isToday: dayIsToday,
            isCurrentMonth,
            isWeekend,
            isSelected,
            events: dayEvents,
            maxEvents: 3,
            compact: false,
            onClick: `openCreateScheduleModalForDate('${dateStr}')`
        });

        // Increment to next day
        currentDay++;
        const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        if (currentDay > daysInCurrentMonth) {
            currentDay = 1;
            currentMonth++;
            if (currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
            }
        }
    }

    container.innerHTML = `
        <div class="calendar-container">
            ${renderCalendarHeader({
                title: `${monthNames[month]} ${year}`,
                onPrev: 'navigateSchedule("prev")',
                onNext: 'navigateSchedule("next")'
            })}
            ${renderCalendarDayHeaders(false)}
            <div class="calendar-grid">
                ${calendarGridHTML}
            </div>
        </div>
    `;
}

// ==================== WEEK VIEW ====================

async function renderWeekView() {
    const container = document.getElementById('schedulesContainer');
    if (!container) return;

    ensureScheduleDateIsDate();

    container.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading week view...</p>
        </div>
    `;

    // Calculate week boundaries
    const current = new Date(scheduleCurrentDate);
    const dayOfWeek = current.getDay(); // 0 = Sunday
    
    // Start of week (Sunday)
    const weekStart = new Date(current);
    weekStart.setDate(current.getDate() - dayOfWeek);
    
    // End of week (Saturday)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    // Format dates for API
    const startStr = formatDateForAPI(weekStart);
    const endStr = formatDateForAPI(weekEnd);

    // Fetch schedules
    const schedules = await getSchedules({
        date_from: startStr,
        date_to: endStr
    });

    // Group schedules by day
    const schedulesByDay = {};
    const todayStr = formatDateForAPI(new Date());
    
    for (let i = 0; i < 7; i++) {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + i);
        const dayStr = formatDateForAPI(day);
        schedulesByDay[i] = {
            date: day,
            dateStr: dayStr,
            isToday: dayStr === todayStr,
            schedules: []
        };
    }

    // Group schedules by day using string date comparison
    schedules.forEach(schedule => {
        // Find which day this schedule belongs to by comparing date strings
        for (let i = 0; i < 7; i++) {
            if (schedulesByDay[i].dateStr === schedule.date) {
                schedulesByDay[i].schedules.push(schedule);
                break;
            }
        }
    });

    // Sort schedules within each day by start time
    Object.values(schedulesByDay).forEach(day => {
        day.schedules.sort((a, b) => a.start_time.localeCompare(b.start_time));
    });

    // Build week view
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    let weekHTML = `
        <div class="calendar-week-container">
            <div class="calendar-week-header">
                ${Object.values(schedulesByDay).map(day => `
                    <div class="calendar-week-day-header ${day.isToday ? 'today' : ''}">
                        <div>${dayNames[day.date.getDay()]}</div>
                        <div style="font-size: 0.85rem; opacity: 0.7;">${day.date.getMonth() + 1}/${day.date.getDate()}</div>
                    </div>
                `).join('')}
            </div>
            <div class="calendar-week-grid">
                ${Object.values(schedulesByDay).map(day => `
                    <div class="calendar-week-day ${day.isToday ? 'today' : ''} ${day.schedules.length === 0 ? 'empty' : ''}">
                        <div class="week-day-number">${day.date.getDate()}</div>
                        <div class="week-day-visits">
                            ${day.schedules.map(schedule => `
                                <div class="week-visit-card ${schedule.status}" onclick="viewSchedule('${schedule.id}')">
                                    <div class="week-visit-time">${formatTime(schedule.start_time)} - ${formatTime(schedule.end_time)}</div>
                                    <div class="week-visit-client">${escapeHtml(schedule.client?.care_for || schedule.client?.name || 'Client')}</div>
                                    <div class="week-visit-caregiver">${escapeHtml(schedule.caregiver?.name || 'Caregiver')}</div>
                                    <div style="margin-top: 4px;">${renderStatusBadge(schedule.status)}</div>
                                </div>
                            `).join('')}
                            ${day.schedules.length === 0 ? `
                                <div style="text-align: center; padding: 2rem 0; color: var(--warm-muted); font-size: 0.85rem;">
                                    No visits
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    container.innerHTML = weekHTML;
}

// ==================== DAY VIEW ====================

async function renderDayView() {
    const container = document.getElementById('schedulesContainer');
    if (!container) return;

    ensureScheduleDateIsDate();

    container.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading day view...</p>
        </div>
    `;

    const dayStr = formatDateForAPI(scheduleCurrentDate);
    
    // Fetch schedules for this day
    const schedules = await getSchedules({
        date_from: dayStr,
        date_to: dayStr
    });

    // Sort by start time
    schedules.sort((a, b) => a.start_time.localeCompare(b.start_time));

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const isToday = dayStr === formatDateForAPI(new Date());

    let dayHTML = `
        <div class="calendar-day-container">
            <div class="calendar-day-header">
                <h3>${isToday ? 'Today' : dayNames[scheduleCurrentDate.getDay()]}</h3>
                <div class="day-date">${scheduleCurrentDate.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                })}</div>
            </div>
            <div class="calendar-day-timeline">
    `;

    if (schedules.length === 0) {
        dayHTML += `
            <div class="schedule-empty-state">
                <div class="schedule-empty-state-icon"><i class="ph ph-calendar-blank"></i></div>
                <h3>No visits scheduled</h3>
                <p>Click "New Visit" to schedule a visit for this day.</p>
            </div>
        `;
    } else {
        dayHTML += schedules.map(schedule => `
            <div class="day-visit-card ${schedule.status}" onclick="viewSchedule('${schedule.id}')">
                <div class="day-visit-time">
                    <div class="time-start">${formatTime(schedule.start_time)}</div>
                    <div class="time-end">to ${formatTime(schedule.end_time)}</div>
                </div>
                <div class="day-visit-details">
                    <div class="day-visit-client">${escapeHtml(schedule.client?.care_for || schedule.client?.name || 'Client')}</div>
                    <div class="day-visit-caregiver"><i class="ph ph-user"></i> ${escapeHtml(schedule.caregiver?.name || 'Caregiver')}</div>
                    ${schedule.service_type ? `<div class="day-visit-service">${escapeHtml(schedule.service_type)}</div>` : ''}
                    <div class="day-visit-status">${renderStatusBadge(schedule.status)}</div>
                </div>
            </div>
        `).join('');
    }

    dayHTML += `
            </div>
        </div>
    `;

    container.innerHTML = dayHTML;
}

// ==================== LIST VIEW ====================

async function renderListView() {
    const container = document.getElementById('schedulesContainer');
    if (!container) return;

    ensureScheduleDateIsDate();

    // Fetch caregivers and clients for filter dropdowns
    const [caregivers, clients] = await Promise.all([
        getCaregivers(),
        getClients()
    ]);

    // Build filters HTML
    const filterHTML = `
        <div class="list-filters">
            <div class="list-filter-group">
                <label>From Date</label>
                <input type="date" id="list-filter-from" value="${scheduleListFilters.dateFrom || ''}" 
                       onchange="updateListFilter('dateFrom', this.value)">
            </div>
            <div class="list-filter-group">
                <label>To Date</label>
                <input type="date" id="list-filter-to" value="${scheduleListFilters.dateTo || ''}"
                       onchange="updateListFilter('dateTo', this.value)">
            </div>
            <div class="list-filter-group">
                <label>Status</label>
                <select id="list-filter-status" onchange="updateListFilter('status', this.value)">
                    <option value="">All Statuses</option>
                    <option value="scheduled" ${scheduleListFilters.status === 'scheduled' ? 'selected' : ''}>Scheduled</option>
                    <option value="in_progress" ${scheduleListFilters.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                    <option value="completed" ${scheduleListFilters.status === 'completed' ? 'selected' : ''}>Completed</option>
                    <option value="cancelled" ${scheduleListFilters.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                    <option value="no_show" ${scheduleListFilters.status === 'no_show' ? 'selected' : ''}>No Show</option>
                </select>
            </div>
            <div class="list-filter-group">
                <label>Caregiver</label>
                <select id="list-filter-caregiver" onchange="updateListFilter('caregiverId', this.value)">
                    <option value="">All Caregivers</option>
                    ${caregivers.map(cg => `<option value="${cg.id}" ${scheduleListFilters.caregiverId === cg.id ? 'selected' : ''}>${escapeHtml(cg.name)}</option>`).join('')}
                </select>
            </div>
            <div class="list-filter-group">
                <label>Client</label>
                <select id="list-filter-client" onchange="updateListFilter('clientId', this.value)">
                    <option value="">All Clients</option>
                    ${clients.map(client => `<option value="${client.id}" ${scheduleListFilters.clientId === client.id ? 'selected' : ''}>${escapeHtml(client.care_for || client.name || 'N/A')}</option>`).join('')}
                </select>
            </div>
            <div class="list-filter-group" style="align-self: flex-end;">
                <button class="btn btn-primary btn-sm" onclick="applyListFilters()">Apply Filters</button>
                <button class="btn btn-secondary btn-sm" onclick="clearListFilters()">Clear</button>
            </div>
        </div>
    `;

    // Build filters for API
    const filters = {};
    if (scheduleListFilters.dateFrom) filters.date_from = scheduleListFilters.dateFrom;
    if (scheduleListFilters.dateTo) filters.date_to = scheduleListFilters.dateTo;
    if (scheduleListFilters.status) filters.status = scheduleListFilters.status;
    if (scheduleListFilters.caregiverId) filters.caregiver_id = scheduleListFilters.caregiverId;
    if (scheduleListFilters.clientId) filters.client_id = scheduleListFilters.clientId;

    // Set default date range if not specified
    if (!filters.date_from && !filters.date_to) {
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        const thirtyDaysAhead = new Date(today);
        thirtyDaysAhead.setDate(today.getDate() + 30);
        
        filters.date_from = formatDateForAPI(thirtyDaysAgo);
        filters.date_to = formatDateForAPI(thirtyDaysAhead);
    }

    // Fetch schedules
    const schedules = await getSchedules(filters);

    // Build results HTML
    let resultsHTML = `
        <div class="calendar-list-container">
            ${filterHTML}
            <div class="list-results">
                <div class="list-result-header">
                    <div>Date/Time</div>
                    <div>Client</div>
                    <div>Caregiver</div>
                    <div>Service Type</div>
                    <div>Status</div>
                </div>
    `;

    if (schedules.length === 0) {
        resultsHTML += `
            <div class="schedule-empty-state" style="padding: 3rem;">
                <div class="schedule-empty-state-icon"><i class="ph ph-calendar-blank"></i></div>
                <h3>No visits found</h3>
                <p>Try adjusting your filters or date range.</p>
            </div>
        `;
    } else {
        resultsHTML += schedules.map(schedule => `
            <div class="list-result-item" onclick="viewSchedule('${schedule.id}')">
                <div>
                    <div style="font-weight: 600;">${formatDate(schedule.date)}</div>
                    <div style="font-size: 0.8rem; color: var(--warm-muted);">
                        ${formatTime(schedule.start_time)} - ${formatTime(schedule.end_time)}
                    </div>
                </div>
                <div>${escapeHtml(schedule.client?.care_for || schedule.client?.name || 'N/A')}</div>
                <div>${escapeHtml(schedule.caregiver?.name || 'N/A')}</div>
                <div>${escapeHtml(schedule.service_type || 'N/A')}</div>
                <div>${renderStatusBadge(schedule.status)}</div>
            </div>
        `).join('');
    }

    resultsHTML += `
            </div>
        </div>
    `;

    container.innerHTML = resultsHTML;
}

function updateListFilter(key, value) {
    scheduleListFilters[key] = value;
}

async function applyListFilters() {
    await renderListView();
}

async function clearListFilters() {
    scheduleListFilters = {
        dateFrom: '',
        dateTo: '',
        status: '',
        caregiverId: '',
        clientId: '',
        serviceType: ''
    };
    scheduleCurrentDate = new Date();
    await renderListView();
}

function formatDateForAPI(date) {
    // Format as YYYY-MM-DD without timezone shifting
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ==================== CREATE VISIT MODAL ====================

async function openCreateScheduleModalForDate(dateStr) {
    // Fetch active caregivers and clients for dropdowns
    const caregivers = await getCaregivers({ status: 'active' });
    const clients = await getClients({ status: 'active' });

    // Format the date for display using string parsing (no Date object to avoid timezone shift)
    const parsed = parseLocalDate(dateStr);
    const dateDisplay = parsed 
        ? new Date(parsed.year, parsed.month - 1, parsed.day).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
        : dateStr;

    modalTitle.textContent = 'Schedule New Visit';
    modalBody.innerHTML = `
        <div class="create-visit-date-display">
            <h4><i class="ph ph-calendar"></i> Selected Date</h4>
            <p>${dateDisplay}</p>
        </div>
        <form id="scheduleForm" class="edit-form">
            <input type="hidden" name="date" value="${dateStr}">
            <div class="detail-section">
                <h4>Visit Time</h4>
                <div class="form-grid">
                    <div class="form-group">
                        <label for="schedule-start_time">Start Time *</label>
                        <input type="time" id="schedule-start_time" name="start_time" class="form-input" required>
                    </div>
                    <div class="form-group">
                        <label for="schedule-end_time">End Time *</label>
                        <input type="time" id="schedule-end_time" name="end_time" class="form-input" required>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h4>Visit Details</h4>
                <div class="form-grid">
                    <div class="form-group">
                        <label for="schedule-service_type">Service Type</label>
                        <input type="text" id="schedule-service_type" name="service_type" class="form-input" placeholder="e.g., Personal Care, Companionship">
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h4>Caregiver & Client *</h4>
                <div class="form-grid">
                    <div class="form-group">
                        <label for="schedule-caregiver_id">Caregiver</label>
                        <select id="schedule-caregiver_id" name="caregiver_id" class="form-select" required>
                            <option value="">Select a caregiver...</option>
                            ${caregivers.map(cg => `<option value="${cg.id}">${escapeHtml(cg.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="schedule-client_id">Client</label>
                        <select id="schedule-client_id" name="client_id" class="form-select" required>
                            <option value="">Select a client...</option>
                            ${clients.map(client => `<option value="${client.id}">${escapeHtml(client.care_for || client.name || 'N/A')}</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h4>Additional Information</h4>
                <div class="form-group">
                    <label for="schedule-location">Location</label>
                    <input type="text" id="schedule-location" name="location" class="form-input" placeholder="Client address or visit location">
                </div>
                <div class="form-group">
                    <label for="schedule-notes">Notes</label>
                    <textarea id="schedule-notes" name="notes" rows="3" class="form-textarea" placeholder="Special instructions or notes..."></textarea>
                </div>
            </div>
        </form>
    `;

    modalFooter.innerHTML = `
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-success" onclick="saveSchedule()">Create Visit</button>
    `;

    openModal();
}

// ==================== DETAIL VIEWS ====================

async function viewApplication(id) {
    const application = await getApplicationById(id);
    if (!application) {
        CareHubToast.error('Application not found');
        return;
    }
    
    currentData = application;
    
    modalTitle.textContent = 'Application Details';
    modalBody.innerHTML = renderApplicationDetails(application);
    
    // Show action buttons only for new/pending applications
    if (application.status === 'new' || application.status === 'pending') {
        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="closeModal()">Close</button>
            <button class="btn btn-danger" onclick="denyApplication('${id}')">Deny</button>
            <button class="btn btn-success" onclick="approveApplication('${id}')">Approve</button>
        `;
    } else {
        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="closeModal()">Close</button>
        `;
    }
    
    openModal();
}

async function viewCareRequest(id) {
    const request = await getCareRequestById(id);
    if (!request) {
        CareHubToast.error('Care request not found');
        return;
    }

    currentData = request;

    modalTitle.textContent = 'Care Request Details';
    modalBody.innerHTML = renderCareRequestDetails(request);

    // Build action buttons based on workflow status
    // Workflow: new → reviewing → onboarding → approved → converted_to_client
    let actionButtons = '<button class="btn btn-secondary" onclick="closeModal()">Close</button>';

    if (request.status === 'new') {
        actionButtons += `
            <button class="btn btn-secondary" onclick="addCareRequestAdminNotes('${id}')">Add Notes</button>
            <button class="btn btn-danger" onclick="denyCareRequest('${id}')">Deny</button>
            <button class="btn btn-warning" onclick="updateCareRequestStatusUI('${id}', 'reviewing')">Start Review</button>
        `;
    } else if (request.status === 'reviewing') {
        actionButtons += `
            <button class="btn btn-secondary" onclick="addCareRequestAdminNotes('${id}')">Add Notes</button>
            <button class="btn btn-danger" onclick="denyCareRequest('${id}')">Deny</button>
            <button class="btn btn-success" onclick="updateCareRequestStatusUI('${id}', 'onboarding')">Approve for Onboarding</button>
        `;
    } else if (request.status === 'onboarding') {
        actionButtons += `
            <button class="btn btn-secondary" onclick="addCareRequestAdminNotes('${id}')">Add Notes</button>
            <button class="btn btn-success" onclick="convertCareRequestToClient('${id}')">Convert to Client</button>
            <button class="btn btn-success" onclick="updateCareRequestStatusUI('${id}', 'approved')">Complete Onboarding</button>
        `;
    } else if (request.status === 'approved') {
        actionButtons += `
            <button class="btn btn-secondary" onclick="addCareRequestAdminNotes('${id}')">Add Notes</button>
            <button class="btn btn-success" onclick="convertCareRequestToClient('${id}')">Convert to Client</button>
        `;
    } else if (request.status !== 'converted_to_client') {
        actionButtons += `
            <button class="btn btn-secondary" onclick="addCareRequestAdminNotes('${id}')">Add Notes</button>
        `;
    }

    modalFooter.innerHTML = actionButtons;
    openModal();
}

async function viewCaregiver(id) {
    const caregiver = await getCaregiverById(id);
    if (!caregiver) {
        CareHubToast.error('Caregiver not found');
        return;
    }
    
    currentData = caregiver;
    
    modalTitle.textContent = 'Caregiver Profile';
    modalBody.innerHTML = renderCaregiverDetails(caregiver);

    const acctStatus = caregiver.account_status || 'approved_no_invite';
    const canSendInvite   = ['approved_no_invite', 'pending_invite'].includes(acctStatus);
    const canResendInvite = acctStatus === 'invite_sent';
    const isActive        = acctStatus === 'active';
    const modalRole = typeof getCurrentRole === 'function' ? getCurrentRole() : null;
    const isAdmin = modalRole === 'admin_owner' || modalRole === 'co_owner';

    modalFooter.innerHTML = `
        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
        ${isAdmin && isActive ? `
            <button class="btn btn-secondary" disabled title="This caregiver already has an active portal account" style="cursor:default;opacity:0.7;">
                <i class="ph ph-check-circle"></i> Account Active
            </button>` : ''}
        ${isAdmin && canSendInvite ? `
            <button class="btn btn-invite" id="modalInviteBtn" onclick="sendCaregiverInvite('${id}')">
                <i class="ph ph-envelope"></i> Send Portal Invite
            </button>` : ''}
        ${isAdmin && canResendInvite ? `
            <button class="btn btn-invite" id="modalInviteBtn" onclick="sendCaregiverInvite('${id}')">
                <i class="ph ph-envelope"></i> Resend Invite
            </button>` : ''}
        <button class="btn btn-primary" onclick="openCaregiverEditModal('${id}')">Edit Profile</button>
    `;

    openModal();
}

async function viewClient(id) {
    const client = await getClientById(id);
    if (!client) {
        CareHubToast.error('Client not found');
        return;
    }
    
    currentData = client;
    
    modalTitle.textContent = 'Client Profile';
    modalBody.innerHTML = renderClientDetails(client);
    modalFooter.innerHTML = `
        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
        <button class="btn btn-primary" onclick="openClientEditModal('${id}')">Edit Profile</button>
    `;
    
    openModal();
}

async function viewSchedule(id) {
    const schedule = await getScheduleById(id);
    if (!schedule) {
        CareHubToast.error('Schedule not found');
        return;
    }

    currentData = schedule;

    modalTitle.textContent = 'Visit Details';
    modalBody.innerHTML = renderScheduleDetails(schedule);

    // Build action buttons based on status
    let actionButtons = '<button class="btn btn-secondary" onclick="closeModal()">Close</button>';

    if (schedule.status === 'scheduled') {
        actionButtons += `
            <button class="btn btn-primary" onclick="openEditScheduleModal('${id}')">Edit</button>
            <button class="btn btn-danger" onclick="cancelScheduleUI('${id}')">Cancel</button>
        `;
    } else if (schedule.status === 'in_progress') {
        actionButtons += `
            <button class="btn btn-success" onclick="completeSchedule('${id}')">Mark Complete</button>
        `;
    }

    modalFooter.innerHTML = actionButtons;
    openModal();
}

function renderScheduleDetails(schedule) {
    return `
        <div class="detail-section">
            <h4>Visit Information</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Date</div>
                    <div class="detail-value">${formatDate(schedule.date)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Time</div>
                    <div class="detail-value">${formatTime(schedule.start_time)} - ${formatTime(schedule.end_time)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Status</div>
                    <div class="detail-value">${renderStatusBadge(schedule.status)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Service Type</div>
                    <div class="detail-value">${escapeHtml(schedule.service_type || 'N/A')}</div>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h4>Caregiver & Client</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Caregiver</div>
                    <div class="detail-value">${escapeHtml(schedule.caregiver?.name || 'N/A')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Client</div>
                    <div class="detail-value">${escapeHtml(schedule.client?.care_for || schedule.client?.name || 'N/A')}</div>
                </div>
            </div>
        </div>

        ${schedule.location ? `
        <div class="detail-section">
            <h4>Location</h4>
            <p style="background: var(--warm-bg); padding: var(--spacing-md); border-radius: var(--radius-md);">${escapeHtml(schedule.location)}</p>
        </div>
        ` : ''}

        ${schedule.notes ? `
        <div class="detail-section">
            <h4>Notes</h4>
            <p style="white-space: pre-wrap; background: var(--warm-bg); padding: var(--spacing-md); border-radius: var(--radius-md);">${escapeHtml(schedule.notes)}</p>
        </div>
        ` : ''}
    `;
}

// ==================== APPROVAL/DENY ACTIONS ====================

async function approveApplication(id) {
    // ── Step 1: Confirm profile creation ─────────────────────────────────────
    const confirmApprove = await CareHubConfirm.confirm({
        title:       'Approve Application',
        message:     'Approve this applicant and create their caregiver profile?',
        confirmText: 'Approve',
        cancelText:  'Cancel',
        icon:        'ph-check-circle',
        iconColor:   '#10B981'
    });
    if (!confirmApprove) return;

    // Mark application approved
    const appUpdated = await updateApplicationStatus(id, 'approved');
    if (!appUpdated) {
        CareHubToast.error('Failed to update application status.');
        return;
    }

    // Create caregiver profile (account_status starts as 'approved_no_invite')
    const caregiver = await createCaregiverFromApplication(currentData);
    if (!caregiver) {
        CareHubToast.error('Application approved but caregiver profile could not be created. Check the console for details.');
        closeModal();
        loadPage('applications');
        return;
    }

    // ── Step 2: Ask whether to send the portal invite now ────────────────────
    const sendNow = await CareHubConfirm.confirm({
        title:       'Send Portal Invite?',
        message:     `Caregiver profile created for ${caregiver.name}.\n\nSend a portal invite to ${caregiver.email} now so they can set up their account?`,
        confirmText: 'Send Invite Now',
        cancelText:  'Save for Later',
        icon:        'ph-envelope',
        iconColor:   '#6366F1'
    });

    if (!sendNow) {
        // Admin chose to send later — profile stays at 'approved_no_invite'
        CareHubToast.success(`Caregiver profile created for ${caregiver.name}. You can send the invite later from their profile.`);
        closeModal();
        loadPage('applications');
        return;
    }

    // ── Step 3: Send or queue invite ─────────────────────────────────────────
    if (!window.SupabaseAuth) {
        CareHubToast.warning('Auth system not available. Invite could not be sent.');
        closeModal();
        loadPage('applications');
        return;
    }

    const edgeDeployed = !!(window.CAREHUB_CONFIG && window.CAREHUB_CONFIG.EDGE_FUNCTION_DEPLOYED);

    const invite = await window.SupabaseAuth.inviteUser({
        email:        caregiver.email,
        role:         'caregiver',
        full_name:    caregiver.name,
        caregiver_id: caregiver.id
    });

    if (edgeDeployed) {
        // ── Live invite path ──────────────────────────────────────────────────
        if (invite.success) {
            await updateCaregiverAccountStatus(caregiver.id, 'invite_sent');
            CareHubToast.success(`Caregiver profile created and portal invite sent to ${caregiver.email}.`);
        } else if (invite.code === 'RATE_LIMIT') {
            CareHubToast.warning('Too many email links were sent. Please wait before retrying the invite.');
        } else if (invite.code === 'EMAIL_EXISTS') {
            await updateCaregiverAccountStatus(caregiver.id, 'invite_sent');
            CareHubToast.info(`${caregiver.email} already has a CareHub account. Profile linked.`);
        } else {
            CareHubToast.error(`Caregiver profile created, but invite failed: ${invite.error || 'Unknown error.'}`);
        }
    } else {
        // ── Placeholder path (Edge Function not deployed) ─────────────────────
        if (invite.pending) {
            await updateCaregiverAccountStatus(caregiver.id, 'pending_invite');
            CareHubToast.warning(`Caregiver profile created. Invite queued for ${caregiver.email} — email will not be sent until the Edge Function is deployed.`);
        } else if (invite.code === 'EMAIL_EXISTS') {
            CareHubToast.info(`${caregiver.email} already has a pending invite or account.`);
        } else {
            CareHubToast.error(`Caregiver profile created, but invite queue failed: ${invite.error || 'Unknown error.'}`);
        }
    }

    closeModal();
    loadPage('applications');
}

/**
 * Send or resend a portal invite to a caregiver.
 * Can be called from the caregiver table row OR from the detail modal.
 * Fetches fresh caregiver data itself — does NOT rely on currentData.
 * @param {string} caregiverId
 */
async function sendCaregiverInvite(caregiverId) {
    // ── Double-click / in-flight guard ───────────────────────────────────────
    if (sendCaregiverInvite._pending) return;

    // ── Fetch fresh caregiver data (never trust stale currentData) ────────────
    const cg = await getCaregiverById(caregiverId);
    if (!cg) {
        CareHubToast.error('Caregiver not found.');
        return;
    }

    if (window.DEBUG === true) console.log('[CareHub] sendCaregiverInvite:', cg.name, '| account_status:', cg.account_status);

    // ── Already has active account ────────────────────────────────────────────
    if (cg.account_status === 'active') {
        CareHubToast.info(`${cg.name} already has an active portal account.`);
        return;
    }

    // ── Email guard ───────────────────────────────────────────────────────────
    if (!cg.email || !cg.email.trim()) {
        CareHubToast.error(`Cannot send invite — ${cg.name} has no email address on file.`);
        return;
    }

    // ── Auth system guard ─────────────────────────────────────────────────────
    if (!window.SupabaseAuth) {
        CareHubToast.warning('Auth system not available. Reload the page and try again.');
        return;
    }

    const isResend = cg.account_status === 'invite_sent';
    const confirmed = await CareHubConfirm.confirm({
        title:       isResend ? 'Resend Portal Invite?' : 'Send Portal Invite?',
        message:     `${isResend ? 'Resend' : 'Send'} a portal invite to ${cg.email} so they can set up their CareHub account?`,
        confirmText: isResend ? 'Resend Invite' : 'Send Invite',
        cancelText:  'Cancel',
        icon:        'ph-envelope',
        iconColor:   '#6366F1'
    });
    if (!confirmed) return;

    // ── Loading state — lock all invite buttons for this caregiver ────────────
    sendCaregiverInvite._pending = true;
    const allBtns = document.querySelectorAll(`[data-invite-id="${caregiverId}"], #modalInviteBtn`);
    const savedLabels = [];
    allBtns.forEach((btn, i) => {
        savedLabels[i] = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="ph ph-circle-notch" style="animation:spin .8s linear infinite"></i> Sending…';
    });

    const restoreBtns = () => {
        allBtns.forEach((btn, i) => {
            btn.disabled = false;
            btn.innerHTML = savedLabels[i];
        });
        sendCaregiverInvite._pending = false;
    };

    const edgeDeployed = !!(window.CAREHUB_CONFIG && window.CAREHUB_CONFIG.EDGE_FUNCTION_DEPLOYED);

    if (window.DEBUG === true) console.log('[CareHub] inviteUser payload:', { email: cg.email, role: 'caregiver', caregiver_id: cg.id, edgeDeployed });

    let invite;
    try {
        invite = await window.SupabaseAuth.inviteUser({
            email:        cg.email,
            role:         'caregiver',
            full_name:    cg.name,
            caregiver_id: cg.id
        });
    } catch (err) {
        if (window.DEBUG === true) console.error('[CareHub] sendCaregiverInvite unexpected error:', err);
        CareHubToast.error('An unexpected error occurred. Please try again.');
        restoreBtns();
        return;
    }

    if (window.DEBUG === true) console.log('[CareHub] inviteUser result:', invite);

    if (edgeDeployed) {
        if (invite.success) {
            await updateCaregiverAccountStatus(cg.id, 'invite_sent');
            CareHubToast.success(`Portal invite sent to ${cg.email}.`);
        } else if (invite.code === 'RATE_LIMIT') {
            CareHubToast.warning('Too many email links were sent. Please wait before retrying.');
            restoreBtns();
            return;
        } else if (invite.code === 'EMAIL_EXISTS') {
            await updateCaregiverAccountStatus(cg.id, 'invite_sent');
            CareHubToast.info(`${cg.email} already has a CareHub account. Status updated.`);
        } else {
            CareHubToast.error(`Invite failed: ${invite.error || 'Unknown error.'}`);
            restoreBtns();
            return;
        }
    } else {
        if (invite.pending) {
            await updateCaregiverAccountStatus(cg.id, 'pending_invite');
            CareHubToast.warning(`Invite queued for ${cg.email}. No email will be sent until the Edge Function is deployed.`);
        } else if (invite.code === 'EMAIL_EXISTS') {
            CareHubToast.info(`An invite for ${cg.email} is already queued.`);
        } else if (invite.code === 'INSERT_FAILED') {
            CareHubToast.error(`Invite queue failed — pending_invites table may not exist yet. Run the migration SQL.`);
            restoreBtns();
            return;
        } else {
            CareHubToast.error(`Invite queue failed: ${invite.error || 'Unknown error.'}`);
            restoreBtns();
            return;
        }
    }

    sendCaregiverInvite._pending = false;

    // ── Refresh: modal (if open) + caregiver list ─────────────────────────────
    if (currentData && currentData.id === caregiverId) {
        await viewCaregiver(caregiverId);
    }
    if (document.getElementById('caregiversContent')) {
        await loadCaregivers('all');
    }
}

async function denyApplication(id) {
    const notes = await CareHubConfirm.prompt({
        title: 'Deny Application',
        message: 'Optional: Add a note for why this application was denied:',
        placeholder: 'Enter denial reason...',
        required: false,
        icon: 'ph-x-circle',
        iconColor: '#EF4444'
    });
    if (notes === null) return; // User cancelled
    
    const success = await updateApplicationStatus(id, 'denied', notes);
    if (success) {
        CareHubToast.success('Application has been denied.');
        closeModal();
        loadPage('applications');
    } else {
        CareHubToast.error('Failed to deny application');
    }
}

async function denyCareRequest(id) {
    const notes = await CareHubConfirm.prompt({
        title: 'Deny Care Request',
        message: 'Add a denial reason:',
        placeholder: 'Enter reason for denial...',
        required: true,
        icon: 'ph-warning',
        iconColor: '#F59E0B'
    });
    if (notes === null) return;
    if (!notes.trim()) {
        CareHubToast.error('Denial reason is required.');
        return;
    }

    const success = await updateCareRequestStatus(id, 'denied', notes);
    if (success) {
        CareHubToast.success('Care request has been denied.');
        closeModal();
        loadPage('care-requests');
    } else {
        CareHubToast.error('Failed to deny care request');
    }
}

async function addCareRequestAdminNotes(id) {
    const currentNotes = currentData && currentData.admin_notes ? currentData.admin_notes : '';
    const notes = await CareHubConfirm.prompt({
        title: 'Admin Notes',
        message: 'Add notes for this care request:',
        placeholder: 'Enter admin notes...',
        defaultValue: currentNotes,
        required: false,
        icon: 'ph-notebook',
        iconColor: '#6366F1'
    });
    if (notes === null) return;

    const success = await updateCareRequestAdminNotes(id, notes);
    if (success) {
        CareHubToast.success('Admin notes saved.');
        closeModal();
        loadPage('care-requests');
    } else {
        CareHubToast.error('Failed to save admin notes');
    }
}

async function updateCareRequestStatusUI(id, status) {
    const success = await updateCareRequestStatus(id, status);
    if (success) {
        CareHubToast.success(`Care request marked as ${status}.`);
        closeModal();
        loadPage('care-requests');
    } else {
        CareHubToast.error('Failed to update care request status');
    }
}

async function convertCareRequestToClient(id) {
    if (!currentData || currentData.id !== id) {
        currentData = await getCareRequestById(id);
    }

    if (!currentData) {
        CareHubToast.error('Care request not found');
        return;
    }

    if (currentData.status !== 'approved' && currentData.status !== 'onboarding') {
        CareHubToast.warning('Only approved or onboarding care requests can be converted to clients.');
        return;
    }

    const confirmed = await CareHubConfirm.confirm({
        title: 'Convert to Client',
        message: 'Are you sure you want to convert this care request to a client?',
        confirmText: 'Convert',
        icon: 'ph-arrow-circle-right'
    });
    if (!confirmed) return;

    const client = await createClientFromCareRequest(currentData);
    if (client) {
        CareHubToast.success(`Client "${client.name || client.care_for || client.requester_name || 'New client'}" has been created.`);

        // Invite family member to create their CareHub account
        const familyEmail = currentData.email || currentData.requester_email || null;
        if (window.SupabaseAuth && familyEmail) {
            const invite = await window.SupabaseAuth.inviteUser({
                email:     familyEmail,
                role:      'client_family',
                full_name: currentData.requester_name || familyEmail,
                client_id: client.id
            });
            if (invite.pending) {
                CareHubToast.warning('Account invite queued — deploy the invite-user Edge Function to send the email.');
            } else if (invite.success) {
                CareHubToast.info(`Invite email sent to ${familyEmail}.`);
            }
        }
    } else {
        CareHubToast.error('Failed to create client profile. Check console for errors.');
        return;
    }

    closeModal();
    const refreshes = [];
    if (document.getElementById('careRequestsContent')) {
        refreshes.push(loadCareRequests('all'));
    }
    if (document.getElementById('clientsContent')) {
        refreshes.push(loadClients('all'));
    }
    if (refreshes.length === 0) {
        refreshes.push(currentPage === 'clients' ? loadClients('all') : loadCareRequests('all'));
    }
    await Promise.all(refreshes);
}

// ==================== MODAL FUNCTIONS ====================

function initModal() {
    document.getElementById('modalClose').addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

function openModal() {
    modalOverlay.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    modalOverlay.classList.remove('show');
    document.body.style.overflow = '';
    currentData = null;
}

// ==================== HELPER FUNCTIONS ====================

function setupFilterTabs(pageType) {
    const tabs = document.querySelectorAll('.filter-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const filter = tab.dataset.filter;
            switch(pageType) {
                case 'applications':
                    loadApplications(filter);
                    break;
                case 'care-requests':
                    loadCareRequests(filter);
                    break;
                case 'caregivers':
                    loadCaregivers(filter);
                    break;
                case 'clients':
                    loadClients(filter);
                    break;
            }
        });
    });
}

function renderStatusBadge(status) {
    const config = window.STATUS_CONFIG[status] || { label: status, class: '', icon: '' };
    return `<span class="status-badge ${config.class}">${config.icon} ${config.label}</span>`;
}

// Helper to format boolean values as Yes/No
function formatBoolean(value) {
    if (value === true || value === 'true' || value === 'yes' || value === 'Yes') return 'Yes';
    if (value === false || value === 'false' || value === 'no' || value === 'No') return 'No';
    return 'Not specified';
}

function renderApplicationDetails(app) {
    return `
        <div class="detail-section">
            <h4>Personal Information</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Full Name</div>
                    <div class="detail-value">${escapeHtml(app.full_name || 'N/A')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Email</div>
                    <div class="detail-value">${escapeHtml(app.email || 'N/A')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Phone</div>
                    <div class="detail-value">${escapeHtml(app.phone || 'N/A')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">City</div>
                    <div class="detail-value">${escapeHtml(app.city || 'N/A')}</div>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h4>Availability & Preferences</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Availability</div>
                    <div class="detail-value">${escapeHtml(app.availability || 'Not specified')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Has Transportation</div>
                    <div class="detail-value">${formatBoolean(app.transportation)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Willing to do Outings</div>
                    <div class="detail-value">${formatBoolean(app.willing_outings)}</div>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h4>Experience & Motivation</h4>
            <div class="detail-grid">
                <div class="detail-item" style="grid-column: 1 / -1;">
                    <div class="detail-label">Relevant Experience</div>
                    <div class="detail-value" style="white-space: pre-wrap;">${escapeHtml(app.experience || 'Not provided')}</div>
                </div>
                <div class="detail-item" style="grid-column: 1 / -1;">
                    <div class="detail-label">Why Work with Seniors</div>
                    <div class="detail-value" style="white-space: pre-wrap;">${escapeHtml(app.why_work_with_seniors || 'Not provided')}</div>
                </div>
                <div class="detail-item" style="grid-column: 1 / -1;">
                    <div class="detail-label">Resume</div>
                    <div class="detail-value">
                        ${app.resume_url
                            ? `<a href="${escapeHtml(app.resume_url)}" target="_blank" class="btn btn-sm btn-secondary"><i class="ph ph-file-text"></i> View Resume</a>`
                            : 'Not provided'}
                    </div>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h4>Application Review</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Status</div>
                    <div class="detail-value">${renderStatusBadge(app.status)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Applied</div>
                    <div class="detail-value">${formatDateTime(app.created_at)}</div>
                </div>
                ${app.admin_notes ? `
                <div class="detail-item" style="grid-column: 1 / -1;">
                    <div class="detail-label">Admin Notes</div>
                    <div class="detail-value" style="white-space: pre-wrap; background: var(--warm-bg); padding: var(--spacing-sm); border-radius: var(--radius-sm);">${escapeHtml(app.admin_notes)}</div>
                </div>
                ` : ''}
                ${app.denial_reason ? `
                <div class="detail-item" style="grid-column: 1 / -1;">
                    <div class="detail-label">Denial Reason</div>
                    <div class="detail-value" style="white-space: pre-wrap; background: #FEE2E2; padding: var(--spacing-sm); border-radius: var(--radius-sm); color: #991B1B;">${escapeHtml(app.denial_reason)}</div>
                </div>
                ` : ''}
                ${app.interview_datetime ? `
                <div class="detail-item">
                    <div class="detail-label">Interview Scheduled</div>
                    <div class="detail-value">${formatDateTime(app.interview_datetime)}</div>
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

function renderCareRequestDetails(req) {
    return `
        <div class="detail-section">
            <h4>Contact Information</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Full Name</div>
                    <div class="detail-value">${escapeHtml(req.requester_name || 'N/A')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Email</div>
                    <div class="detail-value">${escapeHtml(req.email || 'N/A')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Phone</div>
                    <div class="detail-value">${escapeHtml(req.phone || 'N/A')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Location</div>
                    <div class="detail-value">${escapeHtml(req.location || 'N/A')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Best Time to Contact</div>
                    <div class="detail-value">${escapeHtml(req.best_time_to_contact || 'Not specified')}</div>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h4>Care Details</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Who Care Is For</div>
                    <div class="detail-value">${escapeHtml(req.care_for || 'Not specified')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Start Timeframe</div>
                    <div class="detail-value">${escapeHtml(req.start_timeframe || 'Not specified')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Preferred Days</div>
                    <div class="detail-value">${escapeHtml(formatListValue(req.preferred_days) || 'Not specified')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Preferred Time Window</div>
                    <div class="detail-value">${escapeHtml(req.preferred_time || 'Not specified')}</div>
                </div>
                <div class="detail-item" style="grid-column: 1 / -1;">
                    <div class="detail-label">Type of Support Needed</div>
                    <div class="detail-value" style="white-space: pre-wrap;">${escapeHtml(formatListValue(req.support_types) || 'Not specified')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Level of Support Needed</div>
                    <div class="detail-value">${escapeHtml(req.level_of_care || 'Not specified')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Lives Alone</div>
                    <div class="detail-value">${formatBoolean(req.lives_alone)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Pets in Home</div>
                    <div class="detail-value">${formatBoolean(req.pets_in_home)}</div>
                </div>
                <div class="detail-item" style="grid-column: 1 / -1;">
                    <div class="detail-label">Mobility / Safety Notes</div>
                    <div class="detail-value" style="white-space: pre-wrap;">${escapeHtml(req.mobility_notes || 'Not provided')}</div>
                </div>
                <div class="detail-item" style="grid-column: 1 / -1;">
                    <div class="detail-label">Main Concern or Goal</div>
                    <div class="detail-value" style="white-space: pre-wrap;">${escapeHtml(req.main_concern || 'Not provided')}</div>
                </div>
            </div>
        </div>

        ${req.notes ? `
        <div class="detail-section">
            <h4>Additional Notes</h4>
            <p style="white-space: pre-wrap; background: var(--warm-bg); padding: var(--spacing-md); border-radius: var(--radius-md);">${escapeHtml(req.notes)}</p>
        </div>
        ` : ''}

        <div class="detail-section">
            <h4>Request Status History</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Current Status</div>
                    <div class="detail-value">${renderStatusBadge(req.status)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Submitted</div>
                    <div class="detail-value">${formatDateTime(req.created_at)}</div>
                </div>
                ${req.converted_at ? `
                <div class="detail-item">
                    <div class="detail-label">Converted to Client</div>
                    <div class="detail-value">${formatDateTime(req.converted_at)}</div>
                </div>
                ` : ''}
            </div>
        </div>

        ${req.admin_notes ? `
        <div class="detail-section">
            <h4>Admin Notes</h4>
            <p style="white-space: pre-wrap; background: var(--warm-bg); padding: var(--spacing-md); border-radius: var(--radius-md);">${escapeHtml(req.admin_notes)}</p>
        </div>
        ` : ''}

        ${req.denial_reason ? `
        <div class="detail-section">
            <h4>Denial Reason</h4>
            <p style="white-space: pre-wrap; background: #FEE2E2; padding: var(--spacing-md); border-radius: var(--radius-md); color: #991B1B;">${escapeHtml(req.denial_reason)}</p>
        </div>
        ` : ''}
    `;
}

function renderCaregiverDetails(cg) {
    return `
        <div class="detail-section">
            <h4>Personal Information</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Full Name</div>
                    <div class="detail-value">${escapeHtml(cg.name || 'N/A')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Email</div>
                    <div class="detail-value">${escapeHtml(cg.email || 'N/A')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Phone</div>
                    <div class="detail-value">${escapeHtml(cg.phone || 'N/A')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">City</div>
                    <div class="detail-value">${escapeHtml(cg.city || 'N/A')}</div>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h4>Availability & Capabilities</h4>
            <div class="detail-grid">
                <div class="detail-item" style="grid-column: 1 / -1;">
                    <div class="detail-label">Availability</div>
                    <div class="detail-value">${escapeHtml(cg.availability || 'Not specified')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Has Transportation</div>
                    <div class="detail-value">${formatBoolean(cg.transportation)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Willing to do Outings</div>
                    <div class="detail-value">${formatBoolean(cg.willing_outings)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Pay Rate</div>
                    <div class="detail-value">$${cg.pay_rate || 17}/hour</div>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h4>Experience & Motivation</h4>
            <div class="detail-grid">
                <div class="detail-item" style="grid-column: 1 / -1;">
                    <div class="detail-label">Relevant Experience</div>
                    <div class="detail-value" style="white-space: pre-wrap;">${escapeHtml(cg.experience || 'Not provided')}</div>
                </div>
                <div class="detail-item" style="grid-column: 1 / -1;">
                    <div class="detail-label">Why Work with Seniors</div>
                    <div class="detail-value" style="white-space: pre-wrap;">${escapeHtml(cg.why_work_with_seniors || 'Not provided')}</div>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h4>Onboarding Checklist</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Caregiver Status</div>
                    <div class="detail-value">${renderStatusBadge(cg.status)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Background Check</div>
                    <div class="detail-value">${renderStatusBadge(cg.background_check_status || 'pending')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Training</div>
                    <div class="detail-value">${renderStatusBadge(cg.training_status || 'pending')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Documents</div>
                    <div class="detail-value">${renderStatusBadge(cg.documents_status || 'pending')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Welcome Package</div>
                    <div class="detail-value">${renderStatusBadge(cg.welcome_package_status || 'not_sent')}</div>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h4>Portal Account</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Account Status</div>
                    <div class="detail-value">${renderStatusBadge(cg.account_status || 'approved_no_invite')}</div>
                </div>
                ${cg.account_status === 'active' ? `
                <div class="detail-item">
                    <div class="detail-label">Portal Access</div>
                    <div class="detail-value" style="color:var(--success,#16a34a);font-weight:600;">Active</div>
                </div>` : ''}
            </div>
        </div>

        ${cg.notes ? `
        <div class="detail-section">
            <h4>Admin Notes</h4>
            <p style="white-space: pre-wrap; background: var(--warm-bg); padding: var(--spacing-md); border-radius: var(--radius-md);">${escapeHtml(cg.notes)}</p>
        </div>
        ` : ''}
    `;
}

function renderClientDetails(client) {
    return `
        <div class="detail-section">
            <h4>Personal Information</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Full Name</div>
                    <div class="detail-value">${escapeHtml(client.name || client.care_for || 'N/A')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Email</div>
                    <div class="detail-value">${escapeHtml(client.email || 'N/A')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Phone</div>
                    <div class="detail-value">${escapeHtml(client.phone || 'N/A')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Status</div>
                    <div class="detail-value">${renderStatusBadge(client.status)}</div>
                </div>
            </div>
        </div>
        
        <div class="detail-section">
            <h4>Address</h4>
            <div class="detail-grid">
                <div class="detail-item" style="grid-column: 1 / -1;">
                    <div class="detail-value">${escapeHtml(client.location || client.address || 'Not provided')}</div>
                </div>
            </div>
        </div>
        
        ${client.main_concern ? `
        <div class="detail-section">
            <h4>Main Concern</h4>
            <p style="white-space: pre-wrap; background: var(--warm-bg); padding: var(--spacing-md); border-radius: var(--radius-md);">${escapeHtml(client.main_concern)}</p>
        </div>
        ` : ''}
        
        ${client.notes ? `
        <div class="detail-section">
            <h4>Notes</h4>
            <p style="white-space: pre-wrap; background: var(--warm-bg); padding: var(--spacing-md); border-radius: var(--radius-md);">${escapeHtml(client.notes)}</p>
        </div>
        ` : ''}
    `;
}

// Utility Functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function parseLocalDate(dateString) {
    // Parse YYYY-MM-DD string into {year, month, day} without timezone conversion
    // Returns null if invalid format
    if (!dateString || typeof dateString !== 'string') return null;
    const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return {
        year: parseInt(match[1], 10),
        month: parseInt(match[2], 10), // 1-12
        day: parseInt(match[3], 10)
    };
}

/**
 * Convert a YYYY-MM-DD string to a local Date object without timezone shifting.
 * Use this everywhere scheduleCurrentDate needs to be set from a string.
 * @param {string} dateString - YYYY-MM-DD
 * @returns {Date} Local midnight Date, or today's date if invalid
 */
function parseLocalDateToDate(dateString) {
    const parsed = parseLocalDate(dateString);
    if (!parsed) return new Date();
    return new Date(parsed.year, parsed.month - 1, parsed.day);
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    // Handle YYYY-MM-DD format without timezone conversion
    const parsed = parseLocalDate(dateString);
    if (parsed) {
        // Format directly from parsed components
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${monthNames[parsed.month - 1]} ${parsed.day}, ${parsed.year}`;
    }
    
    // Fallback for other formats (ISO timestamps, etc.)
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

function truncate(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function formatListValue(value) {
    if (Array.isArray(value)) return value.join(', ');
    return value || '';
}

// ==================== PROFILE EDIT MODALS ====================

async function openCaregiverEditModal(id) {
    if (!currentData || currentData.id !== id) {
        currentData = await getCaregiverById(id);
    }
    
    if (!currentData) {
        CareHubToast.error('Caregiver not found');
        return;
    }
    
    const cg = currentData;
    
    modalTitle.textContent = 'Edit Caregiver Profile';
    modalBody.innerHTML = `
        <form id="caregiverEditForm" class="edit-form">
            <div class="detail-section">
                <h4>Status & Pay</h4>
                <div class="form-grid">
                    <div class="form-group">
                        <label for="edit-status">Caregiver Status</label>
                        <select id="edit-status" name="status" class="form-select">
                            <option value="onboarding" ${cg.status === 'onboarding' ? 'selected' : ''}>Onboarding</option>
                            <option value="active" ${cg.status === 'active' ? 'selected' : ''}>Active</option>
                            <option value="inactive" ${cg.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="edit-pay_rate">Pay Rate ($/hour)</label>
                        <input type="number" id="edit-pay_rate" name="pay_rate" value="${cg.pay_rate || 17}" min="0" step="0.50" class="form-input">
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h4>Onboarding Checklist</h4>
                <div class="form-grid">
                    <div class="form-group">
                        <label for="edit-background_check_status">Background Check</label>
                        <select id="edit-background_check_status" name="background_check_status" class="form-select">
                            <option value="pending" ${cg.background_check_status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="in_progress" ${cg.background_check_status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                            <option value="approved" ${cg.background_check_status === 'approved' ? 'selected' : ''}>Approved</option>
                            <option value="rejected" ${cg.background_check_status === 'rejected' ? 'selected' : ''}>Rejected</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="edit-training_status">Training Status</label>
                        <select id="edit-training_status" name="training_status" class="form-select">
                            <option value="pending" ${cg.training_status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="in_progress" ${cg.training_status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                            <option value="completed" ${cg.training_status === 'completed' ? 'selected' : ''}>Completed</option>
                            <option value="exempt" ${cg.training_status === 'exempt' ? 'selected' : ''}>Exempt</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="edit-documents_status">Documents Status</label>
                        <select id="edit-documents_status" name="documents_status" class="form-select">
                            <option value="pending" ${cg.documents_status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="in_progress" ${cg.documents_status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                            <option value="completed" ${cg.documents_status === 'completed' ? 'selected' : ''}>Completed</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="edit-welcome_package_status">Welcome Package</label>
                        <select id="edit-welcome_package_status" name="welcome_package_status" class="form-select">
                            <option value="not_sent" ${cg.welcome_package_status === 'not_sent' ? 'selected' : ''}>Not Sent</option>
                            <option value="sent" ${cg.welcome_package_status === 'sent' ? 'selected' : ''}>Sent</option>
                            <option value="received" ${cg.welcome_package_status === 'received' ? 'selected' : ''}>Received</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h4>Admin Notes</h4>
                <div class="form-group">
                    <label for="edit-notes">Notes</label>
                    <textarea id="edit-notes" name="notes" rows="4" class="form-textarea" placeholder="Add admin notes about this caregiver...">${escapeHtml(cg.notes || '')}</textarea>
                </div>
            </div>
        </form>
    `;
    
    modalFooter.innerHTML = `
        <button class="btn btn-secondary" onclick="viewCaregiver('${id}')">Cancel</button>
        <button class="btn btn-success" onclick="saveCaregiverEdit('${id}')">Save Changes</button>
    `;
}

async function saveCaregiverEdit(id) {
    const form = document.getElementById('caregiverEditForm');
    if (!form) return;
    
    const formData = new FormData(form);
    const updates = {
        status: formData.get('status'),
        pay_rate: parseFloat(formData.get('pay_rate')) || 17,
        background_check_status: formData.get('background_check_status'),
        training_status: formData.get('training_status'),
        documents_status: formData.get('documents_status'),
        welcome_package_status: formData.get('welcome_package_status'),
        notes: formData.get('notes')
    };
    
    const success = await updateCaregiver(id, updates);
    
    if (success) {
        CareHubToast.success('Caregiver profile updated successfully.');
        await viewCaregiver(id);
        if (document.getElementById('caregiversContent')) {
            await loadCaregivers('all');
        }
    } else {
        CareHubToast.error('Failed to update caregiver profile. Check console for errors.');
    }
}

async function openClientEditModal(id) {
    if (!currentData || currentData.id !== id) {
        currentData = await getClientById(id);
    }
    
    if (!currentData) {
        CareHubToast.error('Client not found');
        return;
    }
    
    const client = currentData;
    
    modalTitle.textContent = 'Edit Client Profile';
    modalBody.innerHTML = `
        <form id="clientEditForm" class="edit-form">
            <div class="detail-section">
                <h4>Status & Service</h4>
                <div class="form-grid">
                    <div class="form-group">
                        <label for="edit-client-status">Client Status</label>
                        <select id="edit-client-status" name="status" class="form-select">
                            <option value="active" ${client.status === 'active' ? 'selected' : ''}>Active</option>
                            <option value="inactive" ${client.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="edit-service_package">Service Package</label>
                        <input type="text" id="edit-service_package" name="service_package" value="${escapeHtml(Array.isArray(client.service_package) ? client.service_package.join(', ') : (client.service_package || ''))}" class="form-input" placeholder="e.g., Daily Check-ins, Personal Care">
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h4>Care Details</h4>
                <div class="form-grid">
                    <div class="form-group" style="grid-column: 1 / -1;">
                        <label for="edit-support_types">Support Types (comma-separated)</label>
                        <input type="text" id="edit-support_types" name="support_types" value="${escapeHtml(Array.isArray(client.support_types) ? client.support_types.join(', ') : (client.support_types || ''))}" class="form-input" placeholder="e.g., Companionship, Meal Prep, Transportation">
                    </div>
                    <div class="form-group">
                        <label for="edit-level_of_care">Level of Care</label>
                        <select id="edit-level_of_care" name="level_of_care" class="form-select">
                            <option value="" ${!client.level_of_care ? 'selected' : ''}>Select...</option>
                            <option value="light" ${client.level_of_care === 'light' ? 'selected' : ''}>Light - Minimal assistance</option>
                            <option value="moderate" ${client.level_of_care === 'moderate' ? 'selected' : ''}>Moderate - Regular help needed</option>
                            <option value="heavy" ${client.level_of_care === 'heavy' ? 'selected' : ''}>Heavy - Extensive care required</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h4>Notes</h4>
                <div class="form-group">
                    <label for="edit-admin_notes">Admin Notes</label>
                    <textarea id="edit-admin_notes" name="admin_notes" rows="3" class="form-textarea" placeholder="Internal admin notes...">${escapeHtml(client.admin_notes || '')}</textarea>
                </div>
                <div class="form-group">
                    <label for="edit-notes">General Notes</label>
                    <textarea id="edit-notes" name="notes" rows="3" class="form-textarea" placeholder="General notes about this client...">${escapeHtml(client.notes || '')}</textarea>
                </div>
            </div>
        </form>
    `;
    
    modalFooter.innerHTML = `
        <button class="btn btn-secondary" onclick="viewClient('${id}')">Cancel</button>
        <button class="btn btn-success" onclick="saveClientEdit('${id}')">Save Changes</button>
    `;
}

async function saveClientEdit(id) {
    const form = document.getElementById('clientEditForm');
    if (!form) return;
    
    const formData = new FormData(form);
    
    // Parse comma-separated arrays
    const supportTypesValue = formData.get('support_types');
    const supportTypes = supportTypesValue ? supportTypesValue.split(',').map(s => s.trim()).filter(Boolean) : null;
    
    const servicePackageValue = formData.get('service_package');
    const servicePackage = servicePackageValue ? servicePackageValue.split(',').map(s => s.trim()).filter(Boolean) : null;
    
    const updates = {
        status: formData.get('status'),
        service_package: servicePackage,
        support_types: supportTypes,
        level_of_care: formData.get('level_of_care'),
        admin_notes: formData.get('admin_notes'),
        notes: formData.get('notes')
    };
    
    const success = await updateClient(id, updates);
    
    if (success) {
        CareHubToast.success('Client profile updated successfully.');
        await viewClient(id);
        if (document.getElementById('clientsContent')) {
            await loadClients('all');
        }
    } else {
        CareHubToast.error('Failed to update client profile. Check console for errors.');
    }
}

// ==================== SCHEDULE MODAL FUNCTIONS ====================

async function openCreateScheduleModal() {
    // Fetch active caregivers and clients for dropdowns
    const caregivers = await getCaregivers({ status: 'active' });
    const clients = await getClients({ status: 'active' });

    modalTitle.textContent = 'Schedule New Visit';
    modalBody.innerHTML = `
        <form id="scheduleForm" class="edit-form">
            <div class="detail-section">
                <h4>Visit Details</h4>
                <div class="form-grid">
                    <div class="form-group">
                        <label for="schedule-date">Date *</label>
                        <input type="date" id="schedule-date" name="date" class="form-input" required min="${formatDateForAPI(new Date())}">
                    </div>
                    <div class="form-group">
                        <label for="schedule-service_type">Service Type</label>
                        <input type="text" id="schedule-service_type" name="service_type" class="form-input" placeholder="e.g., Personal Care, Companionship">
                    </div>
                </div>
                <div class="form-grid" style="margin-top: var(--spacing-md);">
                    <div class="form-group">
                        <label for="schedule-start_time">Start Time *</label>
                        <input type="time" id="schedule-start_time" name="start_time" class="form-input" required>
                    </div>
                    <div class="form-group">
                        <label for="schedule-end_time">End Time *</label>
                        <input type="time" id="schedule-end_time" name="end_time" class="form-input" required>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h4>Caregiver & Client *</h4>
                <div class="form-grid">
                    <div class="form-group">
                        <label for="schedule-caregiver_id">Caregiver</label>
                        <select id="schedule-caregiver_id" name="caregiver_id" class="form-select" required>
                            <option value="">Select a caregiver...</option>
                            ${caregivers.map(cg => `<option value="${cg.id}">${escapeHtml(cg.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="schedule-client_id">Client</label>
                        <select id="schedule-client_id" name="client_id" class="form-select" required>
                            <option value="">Select a client...</option>
                            ${clients.map(client => `<option value="${client.id}">${escapeHtml(client.care_for || client.name || 'N/A')}</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h4>Additional Information</h4>
                <div class="form-group">
                    <label for="schedule-location">Location</label>
                    <input type="text" id="schedule-location" name="location" class="form-input" placeholder="Client address or visit location">
                </div>
                <div class="form-group">
                    <label for="schedule-notes">Notes</label>
                    <textarea id="schedule-notes" name="notes" rows="3" class="form-textarea" placeholder="Special instructions or notes..."></textarea>
                </div>
            </div>
        </form>
    `;

    modalFooter.innerHTML = `
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-success" onclick="saveSchedule()">Create Visit</button>
    `;

    openModal();
}

async function openEditScheduleModal(id) {
    if (!currentData || currentData.id !== id) {
        currentData = await getScheduleById(id);
    }

    if (!currentData) {
        CareHubToast.error('Schedule not found');
        return;
    }

    const schedule = currentData;

    // Fetch active caregivers and clients for dropdowns
    const caregivers = await getCaregivers({ status: 'active' });
    const clients = await getClients({ status: 'active' });

    modalTitle.textContent = 'Edit Visit';
    modalBody.innerHTML = `
        <form id="scheduleForm" class="edit-form">
            <input type="hidden" name="id" value="${schedule.id}">
            <div class="detail-section">
                <h4>Visit Details</h4>
                <div class="form-grid">
                    <div class="form-group">
                        <label for="schedule-date">Date *</label>
                        <input type="date" id="schedule-date" name="date" class="form-input" required value="${schedule.date}">
                    </div>
                    <div class="form-group">
                        <label for="schedule-service_type">Service Type</label>
                        <input type="text" id="schedule-service_type" name="service_type" class="form-input" value="${escapeHtml(schedule.service_type || '')}" placeholder="e.g., Personal Care, Companionship">
                    </div>
                </div>
                <div class="form-grid" style="margin-top: var(--spacing-md);">
                    <div class="form-group">
                        <label for="schedule-start_time">Start Time *</label>
                        <input type="time" id="schedule-start_time" name="start_time" class="form-input" required value="${schedule.start_time}">
                    </div>
                    <div class="form-group">
                        <label for="schedule-end_time">End Time *</label>
                        <input type="time" id="schedule-end_time" name="end_time" class="form-input" required value="${schedule.end_time}">
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h4>Caregiver & Client *</h4>
                <div class="form-grid">
                    <div class="form-group">
                        <label for="schedule-caregiver_id">Caregiver</label>
                        <select id="schedule-caregiver_id" name="caregiver_id" class="form-select" required>
                            <option value="">Select a caregiver...</option>
                            ${caregivers.map(cg => `<option value="${cg.id}" ${cg.id === schedule.caregiver_id ? 'selected' : ''}>${escapeHtml(cg.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="schedule-client_id">Client</label>
                        <select id="schedule-client_id" name="client_id" class="form-select" required>
                            <option value="">Select a client...</option>
                            ${clients.map(client => `<option value="${client.id}" ${client.id === schedule.client_id ? 'selected' : ''}>${escapeHtml(client.care_for || client.name || 'N/A')}</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h4>Additional Information</h4>
                <div class="form-group">
                    <label for="schedule-location">Location</label>
                    <input type="text" id="schedule-location" name="location" class="form-input" value="${escapeHtml(schedule.location || '')}" placeholder="Client address or visit location">
                </div>
                <div class="form-group">
                    <label for="schedule-notes">Notes</label>
                    <textarea id="schedule-notes" name="notes" rows="3" class="form-textarea" placeholder="Special instructions or notes...">${escapeHtml(schedule.notes || '')}</textarea>
                </div>
            </div>
        </form>
    `;

    modalFooter.innerHTML = `
        <button class="btn btn-secondary" onclick="viewSchedule('${id}')">Cancel</button>
        <button class="btn btn-success" onclick="saveSchedule('${id}')">Save Changes</button>
    `;
}

async function saveSchedule(id = null) {
    const form = document.getElementById('scheduleForm');
    if (!form) return;

    const formData = new FormData(form);

    const scheduleData = {
        date: formData.get('date'),
        start_time: formData.get('start_time'),
        end_time: formData.get('end_time'),
        caregiver_id: formData.get('caregiver_id'),
        client_id: formData.get('client_id'),
        service_type: formData.get('service_type'),
        location: formData.get('location'),
        notes: formData.get('notes')
    };

    // Validation
    if (!scheduleData.date || !scheduleData.start_time || !scheduleData.end_time || !scheduleData.caregiver_id || !scheduleData.client_id) {
        CareHubToast.error('Please fill in all required fields (Date, Time, Caregiver, Client)');
        return;
    }

    let success;
    if (id) {
        // Update existing
        success = await updateSchedule(id, scheduleData);
        if (success) {
            CareHubToast.success('Visit updated successfully.');
            await viewSchedule(id);
        }
    } else {
        // Create new
        const newSchedule = await createSchedule(scheduleData);
        success = !!newSchedule;
        if (success) {
            CareHubToast.success('Visit scheduled successfully.');
            closeModal();
        }
    }

    if (success && document.getElementById('schedulesContent')) {
        await loadSchedules('upcoming');
    } else if (!success) {
        CareHubToast.error('Failed to save schedule. Check console for errors.');
    }
}

async function cancelScheduleUI(id) {
    const reason = await CareHubConfirm.prompt({
        title: 'Cancel Visit',
        message: 'Enter cancellation reason (optional):',
        placeholder: 'Enter reason...',
        required: false,
        icon: 'ph-calendar-x',
        iconColor: '#F59E0B'
    });
    if (reason === null) return; // User cancelled

    const confirmed = await CareHubConfirm.confirm({
        title: 'Confirm Cancellation',
        message: 'Are you sure you want to cancel this visit?',
        confirmText: 'Cancel Visit',
        cancelText: 'Keep Visit',
        danger: true,
        icon: 'ph-warning'
    });
    if (!confirmed) return;

    const success = await cancelSchedule(id, reason);
    if (success) {
        CareHubToast.success('Visit cancelled successfully.');
        closeModal();
        if (document.getElementById('schedulesContent')) {
            await loadSchedules('upcoming');
        }
    } else {
        CareHubToast.error('Failed to cancel visit. Check console for errors.');
    }
}

async function completeSchedule(id) {
    const confirmed = await CareHubConfirm.confirm({
        title: 'Complete Visit',
        message: 'Mark this visit as completed?',
        confirmText: 'Complete',
        cancelText: 'Cancel',
        icon: 'ph-check-circle',
        iconColor: '#10B981'
    });
    if (!confirmed) return;

    const success = await updateSchedule(id, { status: 'completed' });
    if (success) {
        CareHubToast.success('Visit marked as completed.');
        await viewSchedule(id);
        if (document.getElementById('schedulesContent')) {
            await loadSchedules('upcoming');
        }
    } else {
        CareHubToast.error('Failed to update visit status. Check console for errors.');
    }
}

// ==================== TIMESHEET DETAIL & MODALS ====================

async function viewTimesheet(id) {
    const timesheet = await getTimesheetById(id);
    if (!timesheet) {
        CareHubToast.error('Timesheet not found');
        return;
    }

    currentData = timesheet;
    const isEditable = timesheet.status !== 'approved';

    modalTitle.textContent = 'Timesheet Details';
    modalBody.innerHTML = renderTimesheetDetails(timesheet);

    if (isEditable) {
        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="closeModal()">Close</button>
            ${timesheet.status === 'pending' ? `
                <button class="btn btn-danger" onclick="rejectTimesheetUI('${id}')">Reject</button>
                <button class="btn btn-success" onclick="approveTimesheetUI('${id}')">Approve</button>
            ` : ''}
            ${timesheet.status === 'rejected' ? `
                <button class="btn btn-secondary" onclick="openEditTimesheetModal('${id}')">Edit</button>
                <button class="btn btn-success" onclick="approveTimesheetUI('${id}')">Approve</button>
            ` : ''}
        `;
    } else {
        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="closeModal()">Close</button>
        `;
    }

    openModal();
}

function renderTimesheetDetails(timesheet) {
    const isApproved = timesheet.status === 'approved';
    const isRejected = timesheet.status === 'rejected';

    return `
        <div class="detail-section">
            <h4>Timesheet Information</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Date</div>
                    <div class="detail-value">${formatDate(timesheet.date)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Status</div>
                    <div class="detail-value">${renderStatusBadge(timesheet.status)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Hours Worked</div>
                    <div class="detail-value">${timesheet.hours || '0'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Mileage</div>
                    <div class="detail-value">${timesheet.mileage ? timesheet.mileage + ' miles' : '-'}</div>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h4>Caregiver & Client</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Caregiver</div>
                    <div class="detail-value">${escapeHtml(timesheet.caregiver?.name || 'N/A')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Client</div>
                    <div class="detail-value">${escapeHtml(timesheet.client?.care_for || timesheet.client?.name || 'N/A')}</div>
                </div>
            </div>
        </div>

        ${timesheet.rejection_reason ? `
        <div class="detail-section" style="border-left: 4px solid var(--brand-danger);">
            <h4><i class="ph ph-x-circle"></i> Rejection Reason</h4>
            <p style="white-space: pre-wrap; background: #ffe6e6; padding: var(--spacing-md); border-radius: var(--radius-md);">${escapeHtml(timesheet.rejection_reason)}</p>
        </div>
        ` : ''}

        ${timesheet.notes && !timesheet.rejection_reason ? `
        <div class="detail-section">
            <h4>Notes</h4>
            <p style="white-space: pre-wrap; background: var(--warm-bg); padding: var(--spacing-md); border-radius: var(--radius-md);">${escapeHtml(timesheet.notes)}</p>
        </div>
        ` : ''}

        ${timesheet.reviewed_at ? `
        <div class="detail-section">
            <h4>Review Information</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Reviewed At</div>
                    <div class="detail-value">${formatDateTime(timesheet.reviewed_at)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Reviewed By</div>
                    <div class="detail-value">${escapeHtml(timesheet.reviewed_by || 'N/A')}</div>
                </div>
            </div>
        </div>
        ` : ''}
    `;
}

async function openCreateTimesheetModal() {
    // Fetch completed and scheduled visits for selection
    const schedules = await getSchedules({ status: 'completed' });
    const scheduledVisits = await getSchedules({ status: 'scheduled' });
    const allVisits = [...schedules, ...scheduledVisits];

    if (allVisits.length === 0) {
        CareHubToast.error('No completed or scheduled visits found. Create a visit first.');
        return;
    }

    modalTitle.textContent = 'Create Timesheet';
    modalBody.innerHTML = `
        <form id="timesheetForm" class="edit-form">
            <div class="detail-section">
                <h4>Select Visit *</h4>
                <div class="form-group">
                    <select id="timesheet-schedule_id" name="schedule_id" class="form-select" required onchange="onTimesheetVisitSelect(this.value)">
                        <option value="">Select a visit...</option>
                        ${allVisits.map(visit => `
                            <option value="${visit.id}" 
                                    data-caregiver="${visit.caregiver_id}"
                                    data-client="${visit.client_id}"
                                    data-date="${visit.date}">
                                ${formatDate(visit.date)} - ${escapeHtml(visit.caregiver?.name || 'N/A')} → ${escapeHtml(visit.client?.care_for || visit.client?.name || 'N/A')}
                            </option>
                        `).join('')}
                    </select>
                </div>
                <input type="hidden" id="timesheet-caregiver_id" name="caregiver_id">
                <input type="hidden" id="timesheet-client_id" name="client_id">
                <input type="hidden" id="timesheet-date" name="date">
            </div>

            <div class="detail-section">
                <h4>Time & Mileage</h4>
                <div class="form-grid">
                    <div class="form-group">
                        <label for="timesheet-hours">Hours Worked *</label>
                        <input type="number" id="timesheet-hours" name="hours" class="form-input" required min="0" step="0.25" placeholder="e.g., 4.5">
                    </div>
                    <div class="form-group">
                        <label for="timesheet-mileage">Mileage (miles)</label>
                        <input type="number" id="timesheet-mileage" name="mileage" class="form-input" min="0" step="0.1" placeholder="e.g., 12.5">
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h4>Notes</h4>
                <div class="form-group">
                    <textarea id="timesheet-notes" name="notes" rows="3" class="form-textarea" placeholder="Additional notes..."></textarea>
                </div>
            </div>
        </form>
    `;

    modalFooter.innerHTML = `
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-success" onclick="saveTimesheet()">Create Timesheet</button>
    `;

    openModal();
}

function onTimesheetVisitSelect(scheduleId) {
    const select = document.getElementById('timesheet-schedule_id');
    const option = select.options[select.selectedIndex];
    if (option && option.value) {
        document.getElementById('timesheet-caregiver_id').value = option.dataset.caregiver;
        document.getElementById('timesheet-client_id').value = option.dataset.client;
        document.getElementById('timesheet-date').value = option.dataset.date;
    }
}

async function saveTimesheet(id = null) {
    const form = document.getElementById('timesheetForm');
    if (!form) return;

    const formData = new FormData(form);

    const timesheetData = {
        schedule_id: formData.get('schedule_id'),
        caregiver_id: formData.get('caregiver_id'),
        client_id: formData.get('client_id'),
        date: formData.get('date'),
        hours: parseFloat(formData.get('hours')) || 0,
        mileage: parseFloat(formData.get('mileage')) || null,
        notes: formData.get('notes'),
        status: 'pending'
    };

    // Validation
    if (!timesheetData.schedule_id || !timesheetData.caregiver_id || !timesheetData.client_id || !timesheetData.date) {
        CareHubToast.warning('Please select a visit');
        return;
    }
    if (!timesheetData.hours || timesheetData.hours <= 0) {
        CareHubToast.warning('Please enter valid hours worked');
        return;
    }

    let success;
    if (id) {
        success = await updateTimesheet(id, timesheetData);
        if (success) {
            CareHubToast.success('Timesheet updated successfully.');
            await viewTimesheet(id);
        }
    } else {
        const newTimesheet = await createTimesheet(timesheetData);
        success = !!newTimesheet;
        if (success) {
            CareHubToast.success('Timesheet created successfully.');
            closeModal();
        }
    }

    if (success && document.getElementById('timesheetsContent')) {
        await loadTimesheets(currentTimesheetFilter);
    } else if (!success) {
        CareHubToast.error('Failed to save timesheet. Check console for errors.');
    }
}

async function openEditTimesheetModal(id) {
    if (!currentData || currentData.id !== id) {
        currentData = await getTimesheetById(id);
    }

    if (!currentData) {
        CareHubToast.error('Timesheet not found');
        return;
    }

    const ts = currentData;

    modalTitle.textContent = 'Edit Timesheet';
    modalBody.innerHTML = `
        <form id="timesheetForm" class="edit-form">
            <input type="hidden" name="id" value="${ts.id}">
            <input type="hidden" name="schedule_id" value="${ts.schedule_id}">
            <input type="hidden" name="caregiver_id" value="${ts.caregiver_id}">
            <input type="hidden" name="client_id" value="${ts.client_id}">
            <input type="hidden" name="date" value="${ts.date}">

            <div class="detail-section">
                <h4>Visit Information</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">Date</div>
                        <div class="detail-value">${formatDate(ts.date)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Caregiver</div>
                        <div class="detail-value">${escapeHtml(ts.caregiver?.name || 'N/A')}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Client</div>
                        <div class="detail-value">${escapeHtml(ts.client?.care_for || ts.client?.name || 'N/A')}</div>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h4>Time & Mileage</h4>
                <div class="form-grid">
                    <div class="form-group">
                        <label for="timesheet-hours">Hours Worked *</label>
                        <input type="number" id="timesheet-hours" name="hours" class="form-input" required min="0" step="0.25" value="${ts.hours || ''}">
                    </div>
                    <div class="form-group">
                        <label for="timesheet-mileage">Mileage (miles)</label>
                        <input type="number" id="timesheet-mileage" name="mileage" class="form-input" min="0" step="0.1" value="${ts.mileage || ''}">
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h4>Notes</h4>
                <div class="form-group">
                    <textarea id="timesheet-notes" name="notes" rows="3" class="form-textarea">${escapeHtml(ts.notes || '')}</textarea>
                </div>
            </div>
        </form>
    `;

    modalFooter.innerHTML = `
        <button class="btn btn-secondary" onclick="viewTimesheet('${id}')">Cancel</button>
        <button class="btn btn-success" onclick="saveTimesheet('${id}')">Save Changes</button>
    `;
}

async function approveTimesheetUI(id) {
    const confirmed = await CareHubConfirm.confirm({
        title: 'Approve Timesheet',
        message: 'Approve this timesheet for payroll?',
        confirmText: 'Approve',
        icon: 'ph-check-circle',
        iconColor: '#22C55E'
    });
    if (!confirmed) return;

    const success = await approveTimesheet(id, 'admin');
    if (success) {
        CareHubToast.success('Timesheet approved successfully.');
        await viewTimesheet(id);
        if (document.getElementById('timesheetsContent')) {
            await loadTimesheets(currentTimesheetFilter);
        }
    } else {
        CareHubToast.error('Failed to approve timesheet.');
    }
}

async function rejectTimesheetUI(id) {
    const reason = await CareHubConfirm.prompt({
        title: 'Reject Timesheet',
        message: 'Enter a reason for rejection:',
        placeholder: 'Enter rejection reason...',
        required: true,
        icon: 'ph-x-circle',
        iconColor: '#EF4444'
    });
    if (reason === null) return;

    const success = await rejectTimesheet(id, reason, 'admin');
    if (success) {
        CareHubToast.warning('Timesheet rejected.');
        await viewTimesheet(id);
        if (document.getElementById('timesheetsContent')) {
            await loadTimesheets(currentTimesheetFilter);
        }
    } else {
        CareHubToast.error('Failed to reject timesheet.');
    }
}

// ==================== PAYROLL EXPORT ====================

let currentPayrollData = null;

async function previewPayroll() {
    const startDate = document.getElementById('payroll-start-date').value;
    const endDate = document.getElementById('payroll-end-date').value;
    const mileageRate = parseFloat(document.getElementById('mileage-rate').value) || 0.67;

    if (!startDate || !endDate) {
        CareHubToast.warning('Please select both start and end dates');
        return;
    }

    if (startDate > endDate) {
        CareHubToast.warning('Start date must be before end date');
        return;
    }

    // Show loading
    document.getElementById('payrollPreviewSection').style.display = 'block';
    document.getElementById('payrollPreviewTable').innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Calculating payroll...</p>
        </div>
    `;

    // Fetch approved timesheets for the period
    const timesheets = await getApprovedTimesheetsForPayroll(startDate, endDate);

    if (timesheets.length === 0) {
        document.getElementById('payrollPreviewTable').innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon"><i class="ph ph-currency-dollar"></i></div>
                <h3>No approved timesheets found</h3>
                <p>No approved timesheets for ${formatDate(startDate)} to ${formatDate(endDate)}</p>
            </div>
        `;
        document.getElementById('payrollSummaryStats').innerHTML = '';
        currentPayrollData = null;
        return;
    }

    // Group by caregiver and calculate totals
    const caregiverData = {};
    let totalHours = 0;
    let totalMileage = 0;
    let totalGrossPay = 0;
    let totalMileageReimbursement = 0;

    timesheets.forEach(ts => {
        const cg = ts.caregiver;
        if (!cg || !cg.id) return;

        const cgId = cg.id;
        const payRate = cg.pay_rate || 0;
        const hours = ts.hours || 0;
        const mileage = ts.mileage || 0;
        const grossPay = hours * payRate;
        const mileageReimbursement = mileage * mileageRate;

        if (!caregiverData[cgId]) {
            caregiverData[cgId] = {
                caregiver: cg,
                timesheets: [],
                totalHours: 0,
                totalMileage: 0,
                grossPay: 0,
                mileageReimbursement: 0
            };
        }

        caregiverData[cgId].timesheets.push(ts);
        caregiverData[cgId].totalHours += hours;
        caregiverData[cgId].totalMileage += mileage;
        caregiverData[cgId].grossPay += grossPay;
        caregiverData[cgId].mileageReimbursement += mileageReimbursement;

        totalHours += hours;
        totalMileage += mileage;
        totalGrossPay += grossPay;
        totalMileageReimbursement += mileageReimbursement;
    });

    const grandTotal = totalGrossPay + totalMileageReimbursement;

    // Store data for export
    currentPayrollData = {
        startDate,
        endDate,
        mileageRate,
        timesheets,
        caregiverData,
        totalHours,
        totalMileage,
        totalGrossPay,
        totalMileageReimbursement,
        grandTotal
    };

    // Update summary stats
    document.getElementById('payrollSummaryStats').innerHTML = `
        <div style="text-align: center; padding: var(--spacing-md); background: white; border-radius: var(--radius-md);">
            <div style="font-size: 1.5rem; font-weight: 600; color: var(--brand-primary);">${Object.keys(caregiverData).length}</div>
            <div style="font-size: 0.85rem; color: var(--warm-muted);">Caregivers</div>
        </div>
        <div style="text-align: center; padding: var(--spacing-md); background: white; border-radius: var(--radius-md);">
            <div style="font-size: 1.5rem; font-weight: 600; color: var(--brand-primary);">${totalHours.toFixed(2)}</div>
            <div style="font-size: 0.85rem; color: var(--warm-muted);">Total Hours</div>
        </div>
        <div style="text-align: center; padding: var(--spacing-md); background: white; border-radius: var(--radius-md);">
            <div style="font-size: 1.5rem; font-weight: 600; color: var(--brand-primary);">${totalMileage.toFixed(1)} mi</div>
            <div style="font-size: 0.85rem; color: var(--warm-muted);">Total Mileage</div>
        </div>
        <div style="text-align: center; padding: var(--spacing-md); background: white; border-radius: var(--radius-md);">
            <div style="font-size: 1.5rem; font-weight: 600; color: var(--brand-success);">$${totalGrossPay.toFixed(2)}</div>
            <div style="font-size: 0.85rem; color: var(--warm-muted);">Gross Pay</div>
        </div>
        <div style="text-align: center; padding: var(--spacing-md); background: white; border-radius: var(--radius-md);">
            <div style="font-size: 1.5rem; font-weight: 600; color: var(--brand-info);">$${totalMileageReimbursement.toFixed(2)}</div>
            <div style="font-size: 0.85rem; color: var(--warm-muted);">Mileage Reimb.</div>
        </div>
        <div style="text-align: center; padding: var(--spacing-md); background: var(--brand-success); color: white; border-radius: var(--radius-md);">
            <div style="font-size: 1.5rem; font-weight: 600;">$${grandTotal.toFixed(2)}</div>
            <div style="font-size: 0.85rem;">Grand Total</div>
        </div>
    `;

    // Build preview table
    const caregiverRows = Object.values(caregiverData).map(data => {
        const cg = data.caregiver;
        const totalDue = data.grossPay + data.mileageReimbursement;

        return `
            <tr>
                <td><strong>${escapeHtml(cg.name || 'N/A')}</strong></td>
                <td>${escapeHtml(cg.email || 'N/A')}</td>
                <td>${data.totalHours.toFixed(2)}</td>
                <td>$${(cg.pay_rate || 0).toFixed(2)}/hr</td>
                <td>$${data.grossPay.toFixed(2)}</td>
                <td>${data.totalMileage.toFixed(1)} mi</td>
                <td>$${data.mileageReimbursement.toFixed(2)}</td>
                <td><strong>$${totalDue.toFixed(2)}</strong></td>
            </tr>
        `;
    }).join('');

    document.getElementById('payrollPreviewTable').innerHTML = `
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Caregiver</th>
                        <th>Email</th>
                        <th>Hours</th>
                        <th>Pay Rate</th>
                        <th>Gross Pay</th>
                        <th>Mileage</th>
                        <th>Mileage Reimb.</th>
                        <th>Total Due</th>
                    </tr>
                </thead>
                <tbody>
                    ${caregiverRows}
                </tbody>
            </table>
        </div>
    `;

    // Load export history
    await loadPayrollExportHistory();
}

async function loadPayrollExportHistory() {
    const container = document.getElementById('payrollHistoryContent');
    if (!container) return;

    const exports = await getPayrollExports();

    if (exports.length === 0) {
        container.innerHTML = `<p style="color: var(--warm-muted);">No export history yet.</p>`;
        return;
    }

    container.innerHTML = `
        <div class="table-container">
            <table class="data-table" style="font-size: 0.9rem;">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Pay Period</th>
                        <th>Exported By</th>
                        <th>Hours</th>
                        <th>Mileage</th>
                        <th>Gross Pay</th>
                    </tr>
                </thead>
                <tbody>
                    ${exports.map(exp => `
                        <tr>
                            <td>${formatDateTime(exp.created_at)}</td>
                            <td>${formatDate(exp.pay_period_start)} - ${formatDate(exp.pay_period_end)}</td>
                            <td>${escapeHtml(exp.exported_by_email || 'N/A')}</td>
                            <td>${exp.total_hours?.toFixed(2) || '0'}</td>
                            <td>${exp.total_mileage?.toFixed(1) || '0'} mi</td>
                            <td>$${exp.total_gross_pay?.toFixed(2) || '0.00'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function exportPayrollCSV() {
    if (!currentPayrollData) {
        CareHubToast.warning('Please preview payroll first');
        return;
    }

    const { startDate, endDate, mileageRate, caregiverData } = currentPayrollData;
    const exportedAt = new Date().toISOString();
    const exportedBy = 'admin@seniorsittersco.com'; // TODO: use actual logged-in user

    // Build CSV content
    const headers = [
        'Pay Period Start',
        'Pay Period End',
        'Caregiver Name',
        'Email',
        'Pay Rate',
        'Total Hours',
        'Gross Pay',
        'Total Mileage',
        'Mileage Rate',
        'Mileage Reimbursement',
        'Total Due',
        'Approved Timesheet Count',
        'Exported At',
        'Exported By'
    ];

    const rows = Object.values(caregiverData).map(data => {
        const cg = data.caregiver;
        const totalDue = data.grossPay + data.mileageReimbursement;
        return [
            startDate,
            endDate,
            cg.name || '',
            cg.email || '',
            cg.pay_rate || 0,
            data.totalHours.toFixed(2),
            data.grossPay.toFixed(2),
            data.totalMileage.toFixed(1),
            mileageRate.toFixed(2),
            data.mileageReimbursement.toFixed(2),
            totalDue.toFixed(2),
            data.timesheets.length,
            exportedAt,
            exportedBy
        ];
    });

    // Add totals row
    const totals = [
        startDate,
        endDate,
        'TOTAL',
        '',
        '',
        currentPayrollData.totalHours.toFixed(2),
        currentPayrollData.totalGrossPay.toFixed(2),
        currentPayrollData.totalMileage.toFixed(1),
        '',
        currentPayrollData.totalMileageReimbursement.toFixed(2),
        currentPayrollData.grandTotal.toFixed(2),
        currentPayrollData.timesheets.length,
        exportedAt,
        exportedBy
    ];
    rows.push(totals);

    // Convert to CSV
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll_${startDate}_to_${endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

async function savePayrollExport() {
    if (!currentPayrollData) {
        CareHubToast.warning('Please preview payroll first');
        return;
    }

    const { startDate, endDate, totalHours, totalMileage, totalGrossPay } = currentPayrollData;

    const exportData = {
        pay_period_start: startDate,
        pay_period_end: endDate,
        exported_by_email: 'admin@seniorsittersco.com', // TODO: use actual logged-in user
        total_hours: totalHours,
        total_mileage: totalMileage,
        total_gross_pay: totalGrossPay,
        notes: `Mileage rate: $${currentPayrollData.mileageRate}/mile`
    };

    const result = await createPayrollExport(exportData);
    if (result) {
        CareHubToast.success('Payroll export saved to history.');
        await loadPayrollExportHistory();
    } else {
        CareHubToast.error('Failed to save export history.');
    }
}

// ==================== VISIT UPDATE DETAIL & MODALS ====================

async function viewVisitUpdate(id) {
    const update = await getVisitUpdateById(id);
    if (!update) {
        CareHubToast.error('Visit update not found');
        return;
    }

    currentData = update;
    const isEditable = update.status !== 'approved';

    modalTitle.textContent = 'Visit Update Details';
    modalBody.innerHTML = renderVisitUpdateDetails(update);

    if (isEditable) {
        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="closeModal()">Close</button>
            <button class="btn btn-warning" onclick="markVisitUpdateInternalUI('${id}')">Mark Internal</button>
            <button class="btn btn-danger" onclick="rejectVisitUpdateUI('${id}')">Reject</button>
            <button class="btn btn-success" onclick="approveVisitUpdateUI('${id}')">Approve</button>
        `;
    } else {
        modalFooter.innerHTML = `
            <button class="btn btn-secondary" onclick="closeModal()">Close</button>
        `;
    }

    openModal();
}

function renderVisitUpdateDetails(update) {
    const sections = [];

    // Basic Info
    sections.push(`
        <div class="detail-section">
            <h4>Visit Information</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Visit Date</div>
                    <div class="detail-value">${formatDate(update.visit_date)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Status</div>
                    <div class="detail-value">${renderStatusBadge(update.status)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Caregiver</div>
                    <div class="detail-value">${escapeHtml(update.caregiver?.name || 'N/A')}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Client</div>
                    <div class="detail-value">${escapeHtml(update.client?.care_for || update.client?.name || 'N/A')}</div>
                </div>
            </div>
        </div>
    `);

    // Visit Summary (Family-facing)
    if (update.visit_summary) {
        sections.push(`
            <div class="detail-section" style="border-left: 4px solid var(--brand-success);">
                <h4><i class="ph ph-clipboard-text"></i> Visit Summary (Family-Facing)</h4>
                <p style="white-space: pre-wrap; background: var(--warm-bg); padding: var(--spacing-md); border-radius: var(--radius-md);">${escapeHtml(update.visit_summary)}</p>
            </div>
        `);
    }

    // Mood & Engagement
    if (update.mood_engagement) {
        sections.push(`
            <div class="detail-section">
                <h4>Mood & Engagement</h4>
                <p style="white-space: pre-wrap; background: var(--warm-bg); padding: var(--spacing-md); border-radius: var(--radius-md);">${escapeHtml(update.mood_engagement)}</p>
            </div>
        `);
    }

    // Meals & Hydration
    if (update.meals_hydration) {
        sections.push(`
            <div class="detail-section">
                <h4>Meals & Hydration</h4>
                <p style="white-space: pre-wrap; background: var(--warm-bg); padding: var(--spacing-md); border-radius: var(--radius-md);">${escapeHtml(update.meals_hydration)}</p>
            </div>
        `);
    }

    // Activities Completed
    if (update.activities_completed) {
        sections.push(`
            <div class="detail-section">
                <h4>Activities Completed</h4>
                <p style="white-space: pre-wrap; background: var(--warm-bg); padding: var(--spacing-md); border-radius: var(--radius-md);">${escapeHtml(update.activities_completed)}</p>
            </div>
        `);
    }

    // Concerns
    if (update.concerns) {
        sections.push(`
            <div class="detail-section" style="border-left: 4px solid var(--brand-warning);">
                <h4><i class="ph ph-warning-circle"></i> Concerns</h4>
                <p style="white-space: pre-wrap; background: #fff8e6; padding: var(--spacing-md); border-radius: var(--radius-md);">${escapeHtml(update.concerns)}</p>
            </div>
        `);
    }

    // Family Update (explicitly family-facing)
    if (update.family_update) {
        sections.push(`
            <div class="detail-section" style="border-left: 4px solid var(--brand-info);">
                <h4><i class="ph ph-users-three"></i> Family Update</h4>
                <p style="white-space: pre-wrap; background: #e8f4fd; padding: var(--spacing-md); border-radius: var(--radius-md);">${escapeHtml(update.family_update)}</p>
            </div>
        `);
    }

    // Internal Notes (Admin-only)
    if (update.internal_notes) {
        sections.push(`
            <div class="detail-section" style="border-left: 4px solid var(--brand-danger);">
                <h4><i class="ph ph-lock-key"></i> Internal Notes</h4>
                <p style="white-space: pre-wrap; background: #ffe6e6; padding: var(--spacing-md); border-radius: var(--radius-md);">${escapeHtml(update.internal_notes)}</p>
            </div>
        `);
    }

    // Admin Notes
    if (update.admin_notes) {
        sections.push(`
            <div class="detail-section" style="border-left: 4px solid var(--brand-secondary);">
                <h4><i class="ph ph-notebook"></i> Admin Notes</h4>
                <p style="white-space: pre-wrap; background: #f0f0f0; padding: var(--spacing-md); border-radius: var(--radius-md);">${escapeHtml(update.admin_notes)}</p>
            </div>
        `);
    }

    // Review Info
    if (update.reviewed_at) {
        sections.push(`
            <div class="detail-section">
                <h4>Review Information</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">Reviewed At</div>
                        <div class="detail-value">${formatDateTime(update.reviewed_at)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Reviewed By</div>
                        <div class="detail-value">${escapeHtml(update.reviewed_by || 'N/A')}</div>
                    </div>
                </div>
            </div>
        `);
    }

    return sections.join('');
}

async function openCreateVisitUpdateModal() {
    // Fetch scheduled and completed visits for selection
    const schedules = await getSchedules({ status: 'scheduled' });
    const completed = await getSchedules({ status: 'completed' });
    const allVisits = [...schedules, ...completed];

    if (allVisits.length === 0) {
        CareHubToast.warning('No scheduled or completed visits found. Create a visit first.');
        return;
    }

    modalTitle.textContent = 'Create Visit Update';
    modalBody.innerHTML = `
        <form id="visitUpdateForm" class="edit-form">
            <div class="detail-section">
                <h4>Select Visit *</h4>
                <div class="form-group">
                    <select id="visit-update-schedule_id" name="schedule_id" class="form-select" required onchange="onVisitUpdateVisitSelect(this.value)">
                        <option value="">Select a visit...</option>
                        ${allVisits.map(visit => `
                            <option value="${visit.id}" 
                                    data-caregiver="${visit.caregiver_id}"
                                    data-client="${visit.client_id}"
                                    data-date="${visit.date}">
                                ${formatDate(visit.date)} - ${escapeHtml(visit.caregiver?.name || 'N/A')} → ${escapeHtml(visit.client?.care_for || visit.client?.name || 'N/A')}
                            </option>
                        `).join('')}
                    </select>
                </div>
                <input type="hidden" id="visit-update-caregiver_id" name="caregiver_id">
                <input type="hidden" id="visit-update-client_id" name="client_id">
                <input type="hidden" id="visit-update-visit_date" name="visit_date">
            </div>

            <div class="detail-section">
                <h4>Visit Summary (Family-Facing) *</h4>
                <div class="form-group">
                    <textarea id="visit-update-summary" name="visit_summary" rows="3" class="form-textarea" required placeholder="Brief summary for the family..."></textarea>
                </div>
            </div>

            <div class="detail-section">
                <h4>Detailed Information</h4>
                <div class="form-group">
                    <label>Mood & Engagement</label>
                    <textarea name="mood_engagement" rows="2" class="form-textarea" placeholder="How was the client's mood?"></textarea>
                </div>
                <div class="form-group">
                    <label>Meals & Hydration</label>
                    <textarea name="meals_hydration" rows="2" class="form-textarea" placeholder="What did they eat/drink?"></textarea>
                </div>
                <div class="form-group">
                    <label>Activities Completed</label>
                    <textarea name="activities_completed" rows="2" class="form-textarea" placeholder="What activities were done?"></textarea>
                </div>
                <div class="form-group">
                    <label>Concerns</label>
                    <textarea name="concerns" rows="2" class="form-textarea" placeholder="Any concerns to note?"></textarea>
                </div>
            </div>

            <div class="detail-section">
                <h4>Family Communication</h4>
                <div class="form-group">
                    <label>Family Update</label>
                    <textarea name="family_update" rows="3" class="form-textarea" placeholder="Specific message for the family..."></textarea>
                </div>
            </div>

            <div class="detail-section" style="border-left: 4px solid var(--brand-danger);">
                <h4><i class="ph ph-lock-key"></i> Internal Use Only</h4>
                <div class="form-group">
                    <label>Internal Notes</label>
                    <textarea name="internal_notes" rows="3" class="form-textarea" placeholder="Internal notes - not visible to family..."></textarea>
                </div>
            </div>
        </form>
    `;

    modalFooter.innerHTML = `
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-success" onclick="saveVisitUpdate()">Create Update</button>
    `;

    openModal();
}

function onVisitUpdateVisitSelect(scheduleId) {
    const select = document.getElementById('visit-update-schedule_id');
    const option = select.options[select.selectedIndex];
    if (option && option.value) {
        document.getElementById('visit-update-caregiver_id').value = option.dataset.caregiver;
        document.getElementById('visit-update-client_id').value = option.dataset.client;
        document.getElementById('visit-update-visit_date').value = option.dataset.date;
    }
}

async function saveVisitUpdate(id = null) {
    const form = document.getElementById('visitUpdateForm');
    if (!form) return;

    const formData = new FormData(form);

    const updateData = {
        schedule_id: formData.get('schedule_id'),
        caregiver_id: formData.get('caregiver_id'),
        client_id: formData.get('client_id'),
        visit_date: formData.get('visit_date'),
        visit_summary: formData.get('visit_summary'),
        mood_engagement: formData.get('mood_engagement') || null,
        meals_hydration: formData.get('meals_hydration') || null,
        activities_completed: formData.get('activities_completed') || null,
        concerns: formData.get('concerns') || null,
        family_update: formData.get('family_update') || null,
        internal_notes: formData.get('internal_notes') || null,
        status: 'pending'
    };

    // Validation
    if (!updateData.schedule_id || !updateData.caregiver_id || !updateData.client_id || !updateData.visit_date) {
        CareHubToast.warning('Please select a visit');
        return;
    }
    if (!updateData.visit_summary || !updateData.visit_summary.trim()) {
        CareHubToast.warning('Please enter a visit summary');
        return;
    }

    let success;
    if (id) {
        success = await updateVisitUpdate(id, updateData);
        if (success) {
            CareHubToast.success('Visit update saved successfully.');
            await viewVisitUpdate(id);
        }
    } else {
        const newUpdate = await createVisitUpdate(updateData);
        success = !!newUpdate;
        if (success) {
            CareHubToast.success('Visit update created successfully.');
            closeModal();
        }
    }

    if (success && document.getElementById('visitUpdatesContent')) {
        await loadVisitUpdates(currentVisitUpdateFilter);
    } else if (!success) {
        CareHubToast.error('Failed to save visit update. Check console for errors.');
    }
}

async function approveVisitUpdateUI(id) {
    const confirmed = await CareHubConfirm.confirm({
        title: 'Approve Visit Update',
        message: 'Approve this visit update and make it visible to the family?',
        confirmText: 'Approve',
        icon: 'ph-check-circle',
        iconColor: '#22C55E'
    });
    if (!confirmed) return;

    const success = await approveVisitUpdate(id, 'admin');
    if (success) {
        CareHubToast.success('Visit update approved successfully.');
        await viewVisitUpdate(id);
        if (document.getElementById('visitUpdatesContent')) {
            await loadVisitUpdates(currentVisitUpdateFilter);
        }
    } else {
        CareHubToast.error('Failed to approve visit update.');
    }
}

async function rejectVisitUpdateUI(id) {
    const reason = await CareHubConfirm.prompt({
        title: 'Reject Visit Update',
        message: 'Enter a reason for rejection:',
        placeholder: 'Enter rejection reason...',
        required: true,
        icon: 'ph-x-circle',
        iconColor: '#EF4444'
    });
    if (reason === null) return;

    const success = await rejectVisitUpdate(id, reason, 'admin');
    if (success) {
        CareHubToast.warning('Visit update rejected.');
        await viewVisitUpdate(id);
        if (document.getElementById('visitUpdatesContent')) {
            await loadVisitUpdates(currentVisitUpdateFilter);
        }
    } else {
        CareHubToast.error('Failed to reject visit update.');
    }
}

async function markVisitUpdateInternalUI(id) {
    const confirmed = await CareHubConfirm.confirm({
        title: 'Mark as Internal',
        message: 'Mark this update as internal-only? It will not be visible to families.',
        confirmText: 'Mark Internal',
        icon: 'ph-lock',
        iconColor: '#6B7280'
    });
    if (!confirmed) return;

    const success = await markVisitUpdateInternal(id);
    if (success) {
        CareHubToast.info('Visit update marked as internal.');
        await viewVisitUpdate(id);
        if (document.getElementById('visitUpdatesContent')) {
            await loadVisitUpdates(currentVisitUpdateFilter);
        }
    } else {
        CareHubToast.error('Failed to update visit update.');
    }
}

// ==================== UTILITY FUNCTIONS ====================

function formatTime(timeString) {
    if (!timeString) return 'N/A';
    // Handle both HH:MM and HH:MM:SS formats
    const time = timeString.split(':');
    const hours = parseInt(time[0], 10);
    const minutes = time[1];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes} ${ampm}`;
}

// Export for use in HTML onclick handlers
window.viewApplication = viewApplication;
window.viewCareRequest = viewCareRequest;
window.viewCaregiver = viewCaregiver;
window.viewClient = viewClient;
window.approveApplication = approveApplication;
window.sendCaregiverInvite = sendCaregiverInvite;
window.denyApplication = denyApplication;
window.denyCareRequest = denyCareRequest;
window.addCareRequestAdminNotes = addCareRequestAdminNotes;
window.updateCareRequestStatusUI = updateCareRequestStatusUI;
window.convertCareRequestToClient = convertCareRequestToClient;
window.closeModal = closeModal;
window.testDirectQuery = testDirectQuery;
window.openCaregiverEditModal = openCaregiverEditModal;
window.saveCaregiverEdit = saveCaregiverEdit;
window.openClientEditModal = openClientEditModal;
window.saveClientEdit = saveClientEdit;
window.viewSchedule = viewSchedule;
window.openCreateScheduleModal = openCreateScheduleModal;
window.openCreateScheduleModalForDate = openCreateScheduleModalForDate;
window.openEditScheduleModal = openEditScheduleModal;
window.saveSchedule = saveSchedule;
window.cancelScheduleUI = cancelScheduleUI;
window.completeSchedule = completeSchedule;
window.switchScheduleMode = switchScheduleMode;
window.navigateSchedule = navigateSchedule;
window.updateListFilter = updateListFilter;
window.applyListFilters = applyListFilters;
window.clearListFilters = clearListFilters;
window.parseLocalDate = parseLocalDate;
window.parseLocalDateToDate = parseLocalDateToDate;
window.ensureScheduleDateIsDate = ensureScheduleDateIsDate;
window.formatDateForAPI = formatDateForAPI;

// Timesheets
window.renderTimesheets = renderTimesheets;
window.switchTimesheetFilter = switchTimesheetFilter;
window.loadTimesheets = loadTimesheets;
window.viewTimesheet = viewTimesheet;
window.openCreateTimesheetModal = openCreateTimesheetModal;
window.onTimesheetVisitSelect = onTimesheetVisitSelect;
window.saveTimesheet = saveTimesheet;
window.openEditTimesheetModal = openEditTimesheetModal;
window.approveTimesheetUI = approveTimesheetUI;
window.rejectTimesheetUI = rejectTimesheetUI;

// Payroll Export
window.switchTimesheetTab = switchTimesheetTab;
window.previewPayroll = previewPayroll;
window.exportPayrollCSV = exportPayrollCSV;
window.savePayrollExport = savePayrollExport;
window.loadPayrollExportHistory = loadPayrollExportHistory;

// Visit Updates
window.renderVisitUpdates = renderVisitUpdates;
window.switchVisitUpdateFilter = switchVisitUpdateFilter;
window.loadVisitUpdates = loadVisitUpdates;
window.viewVisitUpdate = viewVisitUpdate;
window.openCreateVisitUpdateModal = openCreateVisitUpdateModal;
window.onVisitUpdateVisitSelect = onVisitUpdateVisitSelect;
window.saveVisitUpdate = saveVisitUpdate;
window.approveVisitUpdateUI = approveVisitUpdateUI;
window.rejectVisitUpdateUI = rejectVisitUpdateUI;
window.markVisitUpdateInternalUI = markVisitUpdateInternalUI;

// Command Center Dashboard
window.navigateTo = navigateTo;
window.renderKPIsV2 = renderKPIsV2;
window.renderTodaysScheduleV2 = renderTodaysScheduleV2;
window.renderActivityFeedV2 = renderActivityFeedV2;
window.renderMiniCalendarV2 = renderMiniCalendarV2;
window.renderMiniCalendarV2WithOffset = renderMiniCalendarV2WithOffset;
window.changeMiniCalendarMonth = changeMiniCalendarMonth;
window.renderAlertsV2 = renderAlertsV2;
window.renderOnboardingV2 = renderOnboardingV2;
window.handleAlertAction = handleAlertAction;
window.navigateToDate = navigateToDate;
window.navigateToDateFromCalendar = navigateToDateFromCalendar;
window.formatTimeAgo = formatTimeAgo;
window.getOnboardingCaregivers = getOnboardingCaregivers;

// Unified Calendar System
window.isToday = isToday;
window.getCalendarDayClass = getCalendarDayClass;
window.getCalendarEventClass = getCalendarEventClass;
window.getCalendarEventDotClass = getCalendarEventDotClass;
window.groupSchedulesByDate = groupSchedulesByDate;
window.renderCalendarDay = renderCalendarDay;
window.renderCalendarHeader = renderCalendarHeader;
window.renderCalendarDayHeaders = renderCalendarDayHeaders;

// Integrated Data Operations (with cross-module sync)
window.integratedSaveApplicationStatus = integratedSaveApplicationStatus;
window.integratedCreateSchedule = integratedCreateSchedule;
window.integratedUpdateSchedule = integratedUpdateSchedule;
window.integratedCancelSchedule = integratedCancelSchedule;
window.integratedCreateTimesheet = integratedCreateTimesheet;
window.integratedApproveTimesheet = integratedApproveTimesheet;
window.integratedCreateVisitUpdate = integratedCreateVisitUpdate;
window.integratedConvertCareRequest = integratedConvertCareRequest;
window.integratedConvertApplication = integratedConvertApplication;
