// SeniorSitters CareHub - Configuration
// ======================================

window.CAREHUB_CONFIG = {
  SUPABASE_URL: "https://zyoozdgdiwopgwstiugu.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5b296ZGdkaXdvcGd3c3RpdWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwMzAyNDMsImV4cCI6MjA5MzYwNjI0M30.T32uwCGaZo1YkqzIaRN_7eyjzPshXdmcHPFDdM7MH7w"
};

window.TABLES = {
  APPLICATIONS: "applications",
  CARE_REQUESTS: "care_requests",
  CAREGIVERS: "caregivers",
  CLIENTS: "clients",
  NOTIFICATIONS: "notifications",
  SCHEDULES: "schedules",
  TIMESHEETS: "timesheets",
  VISIT_UPDATES: "visit_updates",
  PAYROLL_EXPORTS: "payroll_exports"
};

// =============================================================================
// MOCK AUTHENTICATION - TEMPORARY DEMO ACCOUNTS (DO NOT USE IN PRODUCTION)
// =============================================================================
// These demo accounts are for testing role-based views before implementing
// real Supabase authentication with RLS. Remove when real auth is implemented.

window.DEMO_USERS = {
  // Admin/Owner - Full access
  'admin@ruknanalytics.com': {
    password: 'demo123',
    role: 'admin_owner',
    name: 'Admin User'
  },
  // Co-Owner - Almost full access (except sensitive ownership settings)
  'owner@seniorsittersco.com': {
    password: 'demo123',
    role: 'co_owner',
    name: 'Co-Owner User'
  },
  // Caregiver - Own schedule, timesheets, visit updates, assigned clients
  'caregiver@seniorsittersco.com': {
    password: 'demo123',
    role: 'caregiver',
    name: 'Jane Caregiver'
  },
  // Client/Family - Loved one's schedule, approved updates, family notes
  'family@seniorsittersco.com': {
    password: 'demo123',
    role: 'client_family',
    name: 'Family Member'
  }
};

// Legacy constant kept for backwards compatibility during transition
// TODO: Remove after full migration to DEMO_USERS
window.ADMIN_CREDENTIALS = {
  email: "admin@ruknanalytics.com",
  password: "demo123"
};

// Role System - Updated May 2026
// ================================
window.ROLES = {
  ADMIN_OWNER: 'admin_owner',
  CO_OWNER: 'co_owner',
  CAREGIVER: 'caregiver',
  CLIENT_FAMILY: 'client_family'
};

window.ROLE_LABELS = {
  [window.ROLES.ADMIN_OWNER]: 'Admin/Owner',
  [window.ROLES.CO_OWNER]: 'Co-Owner',
  [window.ROLES.CAREGIVER]: 'Caregiver',
  [window.ROLES.CLIENT_FAMILY]: 'Client/Family'
};

// Navigation visibility by role
// Each role array lists the pages they can see
window.NAV_VISIBILITY = {
  [window.ROLES.ADMIN_OWNER]: ['dashboard', 'applications', 'care-requests', 'caregivers', 'clients', 'schedules', 'timesheets', 'visit-updates', 'settings'],
  [window.ROLES.CO_OWNER]: ['dashboard', 'applications', 'care-requests', 'caregivers', 'clients', 'schedules', 'timesheets', 'visit-updates', 'settings'],
  [window.ROLES.CAREGIVER]: ['dashboard', 'schedules', 'timesheets', 'visit-updates', 'clients', 'settings'],
  [window.ROLES.CLIENT_FAMILY]: ['dashboard', 'schedules', 'visit-updates', 'settings']
};

// Role-based dashboard feature visibility
window.DASHBOARD_VISIBILITY = {
  [window.ROLES.ADMIN_OWNER]: {
    showKPIs: true,
    showAlerts: true,
    showQuickActions: true,
    showOnboarding: true,
    showAllActivity: true,
    showAdminFeatures: true
  },
  [window.ROLES.CO_OWNER]: {
    showKPIs: true,
    showAlerts: true,
    showQuickActions: true,
    showOnboarding: true,
    showAllActivity: true,
    showAdminFeatures: false
  },
  [window.ROLES.CAREGIVER]: {
    showKPIs: false,
    showAlerts: false,
    showQuickActions: false,
    showOnboarding: false,
    showAllActivity: false,
    showAdminFeatures: false,
    showMySchedule: true,
    showMyTimesheets: true,
    showMyUpdates: true
  },
  [window.ROLES.CLIENT_FAMILY]: {
    showKPIs: false,
    showAlerts: false,
    showQuickActions: false,
    showOnboarding: false,
    showAllActivity: false,
    showAdminFeatures: false,
    showLovedOneSchedule: true,
    showApprovedUpdates: true
  }
};

// Status Configurations for UI
window.STATUS_CONFIG = {
  // Application statuses
  pending: { label: 'Pending', class: 'status-pending', icon: '⏳' },
  approved: { label: 'Approved', class: 'status-approved', icon: '✓' },
  denied: { label: 'Denied', class: 'status-denied', icon: '✕' },

  // Caregiver statuses
  onboarding: { label: 'Onboarding', class: 'status-onboarding', icon: '📋' },
  active: { label: 'Active', class: 'status-active', icon: '●' },
  inactive: { label: 'Inactive', class: 'status-inactive', icon: '○' },

  // Client statuses
  // active and inactive reused from above

  // Care request statuses
  new: { label: 'New', class: 'status-new', icon: '★' },
  reviewing: { label: 'Reviewing', class: 'status-reviewing', icon: '👁️' },
  onboarding: { label: 'Onboarding', class: 'status-onboarding', icon: '📋' },
  approved: { label: 'Approved', class: 'status-approved', icon: '✓' },
  denied: { label: 'Denied', class: 'status-denied', icon: '✕' },
  converted_to_client: { label: 'Converted', class: 'status-converted', icon: '✅' },

  // Schedule statuses
  scheduled: { label: 'Scheduled', class: 'status-scheduled', icon: '📅' },
  in_progress: { label: 'In Progress', class: 'status-in-progress', icon: '🔄' },
  completed: { label: 'Completed', class: 'status-completed', icon: '✓' },
  cancelled: { label: 'Cancelled', class: 'status-cancelled', icon: '✕' },
  no_show: { label: 'No Show', class: 'status-no-show', icon: '⚠️' },

  // Timesheet statuses
  pending: { label: 'Pending', class: 'status-pending', icon: '⏳' },
  approved: { label: 'Approved', class: 'status-approved', icon: '✓' },
  rejected: { label: 'Rejected', class: 'status-rejected', icon: '✕' },

  // Visit update statuses
  draft: { label: 'Draft', class: 'status-draft', icon: '📝' },
  submitted: { label: 'Submitted', class: 'status-submitted', icon: '📤' },
  internal_only: { label: 'Internal', class: 'status-internal', icon: '🔒' }
};

// Navigation Items with icons (Phosphor)
window.NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'ph-squares-four' },
  { id: 'applications', label: 'Applications', icon: 'ph-user-plus' },
  { id: 'care-requests', label: 'Care Requests', icon: 'ph-handshake' },
  { id: 'caregivers', label: 'Caregivers', icon: 'ph-stethoscope' },
  { id: 'clients', label: 'Clients', icon: 'ph-users' },
  { id: 'schedules', label: 'Schedules', icon: 'ph-calendar' },
  { id: 'timesheets', label: 'Timesheets', icon: 'ph-clock' },
  { id: 'visit-updates', label: 'Visit Updates', icon: 'ph-clipboard-text' },
  { id: 'settings', label: 'Settings', icon: 'ph-gear' }
];

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SUPABASE_URL: window.CAREHUB_CONFIG.SUPABASE_URL,
    SUPABASE_ANON_KEY: window.CAREHUB_CONFIG.SUPABASE_ANON_KEY,
    TABLES: window.TABLES,
    ADMIN_CREDENTIALS: window.ADMIN_CREDENTIALS,
    STATUS_CONFIG: window.STATUS_CONFIG,
    NAV_ITEMS: window.NAV_ITEMS,
    ROLES: window.ROLES,
    ROLE_LABELS: window.ROLE_LABELS,
    NAV_VISIBILITY: window.NAV_VISIBILITY,
    DASHBOARD_VISIBILITY: window.DASHBOARD_VISIBILITY
  };
}
