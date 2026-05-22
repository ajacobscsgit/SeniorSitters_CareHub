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
    
    modalTitle.textContent = 'Caregiver Profile';
    modalBody.innerHTML = renderCaregiverDetails(caregiver);
    modalFooter.innerHTML = `
        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
    `;
    
    openModal();
}

async function viewClient(id) {
    const client = await getClientById(id);
    if (!client) {
        alert('Client not found');
        return;
    }
    
    modalTitle.textContent = 'Client Profile';
    modalBody.innerHTML = renderClientDetails(client);
    modalFooter.innerHTML = `
        <button class="btn btn-secondary" onclick="closeModal()">Close</button>
    `;
    
    openModal();
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
