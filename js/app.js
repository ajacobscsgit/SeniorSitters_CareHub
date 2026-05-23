// SeniorSitters CareHub - Main Application
// =========================================

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
    if (!isAuthenticated()) {
        // Auth check failed, don't initialize
        return;
    }
    
    initNavigation();
    initLogout();
    initModal();
    initMobileMenu();
    loadPage('dashboard');
}

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', initApp);

// ==================== NAVIGATION ====================

function initNavigation() {
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            loadPage(page);
            
            // Update active state
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Close mobile menu
            document.getElementById('sidebar').classList.remove('open');
        });
    });
}

function initLogout() {
    document.getElementById('logoutBtn').addEventListener('click', logout);
}

function initMobileMenu() {
    const toggle = document.getElementById('mobileMenuToggle');
    const sidebar = document.getElementById('sidebar');
    
    toggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });
}

function loadPage(page) {
    currentPage = page;
    
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
        case 'settings':
            renderSettings();
            break;
        default:
            renderDashboard();
    }
}

// ==================== PAGE RENDERERS ====================

async function renderDashboard() {
    mainContent.innerHTML = `
        <div class="page-header animate-fade-in">
            <h1>Dashboard</h1>
            <p>Overview of your CareHub activity</p>
        </div>
        
        <div class="stats-grid" id="statsGrid">
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Loading statistics...</p>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <span class="card-title">Recent Activity</span>
            </div>
            <div class="card-body">
                <p class="text-center" style="color: var(--warm-muted);">
                    Welcome to SeniorSitters CareHub! Use the sidebar to manage applications, care requests, caregivers, and clients.
                </p>
            </div>
        </div>
    `;
    
    // Load stats
    const stats = await getDashboardStats();
    
    document.getElementById('statsGrid').innerHTML = `
        <div class="stat-card animate-fade-in">
            <div class="stat-icon orange">📝</div>
            <div class="stat-content">
                <h3>${stats.newApplications}</h3>
                <p>New Applications</p>
            </div>
        </div>
        <div class="stat-card animate-fade-in">
            <div class="stat-icon orange">🤝</div>
            <div class="stat-content">
                <h3>${stats.pendingCareRequests}</h3>
                <p>New Care Requests</p>
            </div>
        </div>
        <div class="stat-card animate-fade-in">
            <div class="stat-icon blue">👩‍⚕️</div>
            <div class="stat-content">
                <h3>${stats.totalCaregivers}</h3>
                <p>Total Caregivers</p>
            </div>
        </div>
        <div class="stat-card animate-fade-in">
            <div class="stat-icon green">👥</div>
            <div class="stat-content">
                <h3>${stats.totalClients}</h3>
                <p>Total Clients</p>
            </div>
        </div>
        <div class="stat-card animate-fade-in">
            <div class="stat-icon purple">📋</div>
            <div class="stat-content">
                <h3>${stats.onboardingCaregivers}</h3>
                <p>Onboarding</p>
            </div>
        </div>
    `;
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
    console.log('[CareHub] === loadApplications START ===');
    console.log('[CareHub] Filter:', filter);
    
    // Run direct query test for comparison
    console.log('[CareHub] Running testDirectQuery for comparison...');
    testDirectQuery().then(result => {
        console.log('[CareHub] Direct query result:', result);
    });
    
    const filters = filter !== 'all' ? { status: filter } : {};
    const applications = await getApplications(filters);
    
    console.log('[CareHub] loadApplications received:', applications ? applications.length : 0, 'applications');
    
    const container = document.getElementById('applicationsContent');
    
    // Only show empty state if data is actually empty array
    if (!applications || applications.length === 0) {
        console.log('[CareHub] Showing empty state - data is empty or null');
        console.log('[CareHub] applications value:', applications);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📝</div>
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
    
    console.log('[CareHub] === loadApplications END ===');
    console.log('[CareHub] Rendered', applications.length, 'applications in table');
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
                <div class="empty-state-icon">🤝</div>
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
    const caregivers = await getCaregivers(filters);
    
    const container = document.getElementById('caregiversContent');
    
    if (caregivers.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">👩‍⚕️</div>
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
    const clients = await getClients(filters);
    
    const container = document.getElementById('clientsContent');
    
    if (clients.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">👥</div>
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

function renderSettings() {
    mainContent.innerHTML = `
        <div class="page-header animate-fade-in">
            <h1>Settings</h1>
            <p>Configure your CareHub preferences</p>
        </div>
        
        <div class="card">
            <div class="card-header">
                <span class="card-title">General Settings</span>
            </div>
            <div class="card-body">
                <p style="color: var(--warm-muted);">
                    Settings functionality will be expanded in future phases.
                </p>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <span class="card-title">Account Information</span>
            </div>
            <div class="card-body">
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">Email</div>
                        <div class="detail-value">${escapeHtml(ADMIN_CREDENTIALS.email)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Role</div>
                        <div class="detail-value">Administrator</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Schedule View State
let scheduleViewMode = 'month'; // 'month', 'week', 'day', 'list'
let scheduleCurrentDate = new Date(); // Currently selected date for navigation
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
                    📅 Month
                </button>
                <button class="view-tab ${scheduleViewMode === 'week' ? 'active' : ''}" onclick="switchScheduleMode('week')">
                    📆 Week
                </button>
                <button class="view-tab ${scheduleViewMode === 'day' ? 'active' : ''}" onclick="switchScheduleMode('day')">
                    📋 Day
                </button>
                <button class="view-tab ${scheduleViewMode === 'list' ? 'active' : ''}" onclick="switchScheduleMode('list')">
                    📃 List
                </button>
            </div>

            <!-- Navigation -->
            <div class="schedule-navigation">
                <button class="btn btn-secondary btn-sm" onclick="navigateSchedule('prev')">← Previous</button>
                <button class="btn btn-primary btn-sm" onclick="navigateSchedule('today')">Today</button>
                <button class="btn btn-secondary btn-sm" onclick="navigateSchedule('next')">Next →</button>
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
    if (scheduleListFilters.dateFrom && scheduleListFilters.dateTo) {
        const from = new Date(scheduleListFilters.dateFrom);
        const to = new Date(scheduleListFilters.dateTo);
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

async function renderMonthView() {
    const container = document.getElementById('schedulesContainer');
    if (!container) return;

    container.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading calendar...</p>
        </div>
    `;

    // Calculate month boundaries
    const year = scheduleCurrentDate.getFullYear();
    const month = scheduleCurrentDate.getMonth();
    
    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);
    
    // Get day of week for first day (0 = Sunday, 6 = Saturday)
    const firstDayOfWeek = firstDay.getDay();
    
    // Calculate start of calendar (previous month days to show)
    const calendarStart = new Date(year, month, 1 - firstDayOfWeek);
    
    // Calculate end of calendar (42 cells = 6 weeks)
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

    // Group schedules by date
    const schedulesByDate = {};
    schedules.forEach(schedule => {
        if (!schedulesByDate[schedule.date]) {
            schedulesByDate[schedule.date] = [];
        }
        schedulesByDate[schedule.date].push(schedule);
    });

    // Build calendar grid
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const todayStr = formatDateForAPI(new Date());
    const currentMonthStr = String(month + 1).padStart(2, '0');

    let calendarHTML = `
        <div class="calendar-month-container">
            <div class="calendar-month-header">
                ${dayNames.map(day => `<div class="calendar-month-header-day">${day}</div>`).join('')}
            </div>
            <div class="calendar-month-grid">
    `;

    // Generate 42 days (6 weeks)
    const currentDate = new Date(calendarStart);
    for (let i = 0; i < 42; i++) {
        const dateStr = formatDateForAPI(currentDate);
        const isToday = dateStr === todayStr;
        const isCurrentMonth = currentDate.getMonth() === month;
        const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
        const daySchedules = schedulesByDate[dateStr] || [];
        
        const dayClass = [
            'calendar-month-day',
            !isCurrentMonth ? 'other-month' : '',
            isToday ? 'today' : '',
            isWeekend ? 'weekend' : ''
        ].filter(Boolean).join(' ');

        // Show max 3 visits per day, then "+X more"
        const visibleVisits = daySchedules.slice(0, 3);
        const moreCount = daySchedules.length - 3;

        calendarHTML += `
            <div class="${dayClass}" onclick="openCreateScheduleModalForDate('${dateStr}')">
                <div class="calendar-day-number">${currentDate.getDate()}</div>
                <div class="calendar-day-visits">
                    ${visibleVisits.map(schedule => `
                        <div class="calendar-visit-pill ${schedule.status}" 
                             onclick="event.stopPropagation(); viewSchedule('${schedule.id}')"
                             title="${escapeHtml(schedule.client?.care_for || schedule.client?.name || 'Client')}: ${formatTime(schedule.start_time)}">
                            ${formatTime(schedule.start_time)} ${escapeHtml(truncate(schedule.client?.care_for || schedule.client?.name || 'Client', 15))}
                        </div>
                    `).join('')}
                    ${moreCount > 0 ? `<div class="calendar-more-visits">+${moreCount} more</div>` : ''}
                </div>
            </div>
        `;

        currentDate.setDate(currentDate.getDate() + 1);
    }

    calendarHTML += `
            </div>
        </div>
    `;

    container.innerHTML = calendarHTML;
}

// ==================== WEEK VIEW ====================

async function renderWeekView() {
    const container = document.getElementById('schedulesContainer');
    if (!container) return;

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

    schedules.forEach(schedule => {
        const scheduleDate = new Date(schedule.date + 'T00:00:00');
        const dayDiff = Math.floor((scheduleDate - weekStart) / (1000 * 60 * 60 * 24));
        if (dayDiff >= 0 && dayDiff < 7) {
            schedulesByDay[dayDiff].schedules.push(schedule);
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
                <div class="schedule-empty-state-icon">📅</div>
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
                    <div class="day-visit-caregiver">👤 ${escapeHtml(schedule.caregiver?.name || 'Caregiver')}</div>
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
                <div class="schedule-empty-state-icon">📅</div>
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

    // Parse the selected date
    const selectedDate = new Date(dateStr + 'T00:00:00');
    const dateDisplay = selectedDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });

    modalTitle.textContent = 'Schedule New Visit';
    modalBody.innerHTML = `
        <div class="create-visit-date-display">
            <h4>📅 Selected Date</h4>
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
        alert('Application not found');
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
        alert('Care request not found');
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
        alert('Caregiver not found');
        return;
    }
    
    currentData = caregiver;
    
    modalTitle.textContent = 'Caregiver Profile';
    modalBody.innerHTML = renderCaregiverDetails(caregiver);
    modalFooter.innerHTML = `
        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
        <button class="btn btn-primary" onclick="openCaregiverEditModal('${id}')">Edit Profile</button>
    `;
    
    openModal();
}

async function viewClient(id) {
    const client = await getClientById(id);
    if (!client) {
        alert('Client not found');
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
        alert('Schedule not found');
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
    if (!confirm('Are you sure you want to approve this application? This will create a new caregiver profile.')) {
        return;
    }
    
    const success = await updateApplicationStatus(id, 'approved');
    if (!success) {
        alert('Failed to approve application');
        return;
    }
    
    // Create caregiver from application
    const caregiver = await createCaregiverFromApplication(currentData);
    if (caregiver) {
        alert(`Application approved! Caregiver "${caregiver.name}" has been created with status 'onboarding'.`);
    } else {
        alert('Application approved, but failed to create caregiver profile. Check console for errors.');
    }
    
    closeModal();
    loadPage('applications');
}

async function denyApplication(id) {
    const notes = prompt('Optional: Add a note for why this application was denied:');
    if (notes === null) return; // User cancelled
    
    const success = await updateApplicationStatus(id, 'denied', notes);
    if (success) {
        alert('Application has been denied.');
        closeModal();
        loadPage('applications');
    } else {
        alert('Failed to deny application');
    }
}

async function denyCareRequest(id) {
    const notes = prompt('Add a denial reason for this care request:');
    if (notes === null) return;
    if (!notes.trim()) {
        alert('Denial reason is required.');
        return;
    }

    const success = await updateCareRequestStatus(id, 'denied', notes);
    if (success) {
        alert('Care request has been denied.');
        closeModal();
        loadPage('care-requests');
    } else {
        alert('Failed to deny care request');
    }
}

async function addCareRequestAdminNotes(id) {
    const currentNotes = currentData && currentData.admin_notes ? currentData.admin_notes : '';
    const notes = prompt('Admin notes for this care request:', currentNotes);
    if (notes === null) return;

    const success = await updateCareRequestAdminNotes(id, notes);
    if (success) {
        alert('Admin notes saved.');
        closeModal();
        loadPage('care-requests');
    } else {
        alert('Failed to save admin notes');
    }
}

async function updateCareRequestStatusUI(id, status) {
    const success = await updateCareRequestStatus(id, status);
    if (success) {
        alert(`Care request marked as ${status}.`);
        closeModal();
        loadPage('care-requests');
    } else {
        alert('Failed to update care request status');
    }
}

async function convertCareRequestToClient(id) {
    if (!currentData || currentData.id !== id) {
        currentData = await getCareRequestById(id);
    }

    if (!currentData) {
        alert('Care request not found');
        return;
    }

    if (currentData.status !== 'approved' && currentData.status !== 'onboarding') {
        alert('Only approved or onboarding care requests can be converted to clients.');
        return;
    }

    if (!confirm('Are you sure you want to convert this care request to a client?')) {
        return;
    }

    const client = await createClientFromCareRequest(currentData);
    if (client) {
        alert(`Care request converted! Client "${client.name || client.care_for || client.requester_name || 'New client'}" has been created.`);
    } else {
        alert('Failed to create client profile. Check console for errors.');
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
                            ? `<a href="${escapeHtml(app.resume_url)}" target="_blank" class="btn btn-sm btn-secondary">📄 View Resume</a>`
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

function formatDate(dateString) {
    if (!dateString) return 'N/A';
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
        alert('Caregiver not found');
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
        alert('Caregiver profile updated successfully.');
        await viewCaregiver(id);
        if (document.getElementById('caregiversContent')) {
            await loadCaregivers('all');
        }
    } else {
        alert('Failed to update caregiver profile. Check console for errors.');
    }
}

async function openClientEditModal(id) {
    if (!currentData || currentData.id !== id) {
        currentData = await getClientById(id);
    }
    
    if (!currentData) {
        alert('Client not found');
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
        alert('Client profile updated successfully.');
        await viewClient(id);
        if (document.getElementById('clientsContent')) {
            await loadClients('all');
        }
    } else {
        alert('Failed to update client profile. Check console for errors.');
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
                        <input type="date" id="schedule-date" name="date" class="form-input" required min="${new Date().toISOString().split('T')[0]}">
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
        alert('Schedule not found');
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
        alert('Please fill in all required fields (Date, Time, Caregiver, Client)');
        return;
    }

    let success;
    if (id) {
        // Update existing
        success = await updateSchedule(id, scheduleData);
        if (success) {
            alert('Visit updated successfully.');
            await viewSchedule(id);
        }
    } else {
        // Create new
        const newSchedule = await createSchedule(scheduleData);
        success = !!newSchedule;
        if (success) {
            alert('Visit scheduled successfully.');
            closeModal();
        }
    }

    if (success && document.getElementById('schedulesContent')) {
        await loadSchedules('upcoming');
    } else if (!success) {
        alert('Failed to save schedule. Check console for errors.');
    }
}

async function cancelScheduleUI(id) {
    const reason = prompt('Enter cancellation reason (optional):');
    if (reason === null) return; // User cancelled

    if (!confirm('Are you sure you want to cancel this visit?')) {
        return;
    }

    const success = await cancelSchedule(id, reason);
    if (success) {
        alert('Visit cancelled successfully.');
        closeModal();
        if (document.getElementById('schedulesContent')) {
            await loadSchedules('upcoming');
        }
    } else {
        alert('Failed to cancel visit. Check console for errors.');
    }
}

async function completeSchedule(id) {
    if (!confirm('Mark this visit as completed?')) {
        return;
    }

    const success = await updateSchedule(id, { status: 'completed' });
    if (success) {
        alert('Visit marked as completed.');
        await viewSchedule(id);
        if (document.getElementById('schedulesContent')) {
            await loadSchedules('upcoming');
        }
    } else {
        alert('Failed to update visit status. Check console for errors.');
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
