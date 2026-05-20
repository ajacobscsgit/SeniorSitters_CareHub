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
  NOTIFICATIONS: "notifications"
};

window.ADMIN_CREDENTIALS = {
  email: "admin@seniorsittersco.com",
  password: "demo123"
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
  new: { label: 'New', class: 'status-new', icon: '★' }
};

// Navigation Items
window.NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'applications', label: 'Applications', icon: '📝' },
  { id: 'care-requests', label: 'Care Requests', icon: '🤝' },
  { id: 'caregivers', label: 'Caregivers', icon: '👩‍⚕️' },
  { id: 'clients', label: 'Clients', icon: '👥' },
  { id: 'settings', label: 'Settings', icon: '⚙️' }
];

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SUPABASE_URL: window.CAREHUB_CONFIG.SUPABASE_URL,
    SUPABASE_ANON_KEY: window.CAREHUB_CONFIG.SUPABASE_ANON_KEY,
    TABLES: window.TABLES,
    ADMIN_CREDENTIALS: window.ADMIN_CREDENTIALS,
    STATUS_CONFIG: window.STATUS_CONFIG,
    NAV_ITEMS: window.NAV_ITEMS
  };
}
