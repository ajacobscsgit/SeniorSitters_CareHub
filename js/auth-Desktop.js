// SeniorSitters CareHub - Authentication
// ======================================

// Session Management
const AUTH_KEY = 'carehub_session';

// Legacy role migration mapping
const LEGACY_ROLE_MAP = {
  'admin': 'admin_owner',
  'manager': 'co_owner',
  'caregiver': 'caregiver',
  'client': 'client_family',
  'family': 'client_family'
};

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
function isAuthenticated() {
    const session = sessionStorage.getItem(AUTH_KEY);
    if (!session) return false;
    
    try {
        const parsed = JSON.parse(session);
        // Check if session is still valid (24 hours)
        const sessionAge = Date.now() - (parsed.timestamp || 0);
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        if (sessionAge > maxAge) {
            logout();
            return false;
        }
        
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Login with email and password
 * @param {string} email 
 * @param {string} password 
 * @returns {Object} - { success: boolean, error?: string }
 */
/**
 * Normalize legacy role to new role system
 * @param {string} role - Legacy or new role
 * @returns {string} - Normalized new role
 */
function normalizeRole(role) {
  if (!role) return 'client_family';
  // If it's already a new role, return as-is
  const newRoles = ['admin_owner', 'co_owner', 'caregiver', 'client_family'];
  if (newRoles.includes(role)) return role;
  // Map legacy roles
  return LEGACY_ROLE_MAP[role] || 'client_family';
}

function login(email, password) {
    // Phase 1: Mock authentication with demo users
    const user = window.DEMO_USERS[email];
    
    if (user && user.password === password) {
        const session = {
            email: email,
            role: user.role,
            name: user.name,
            timestamp: Date.now()
        };
        sessionStorage.setItem(AUTH_KEY, JSON.stringify(session));
        return { success: true };
    }
    
    return { success: false, error: 'Invalid email or password' };
}

/**
 * Logout and clear session
 */
function logout() {
    sessionStorage.removeItem(AUTH_KEY);
    window.location.href = 'login.html';
}

/**
 * Require authentication - redirect to login if not authenticated
 * Use this on protected pages
 */
function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

/**
 * Get current session info with normalized role
 * @returns {Object|null}
 */
function getSession() {
    if (!isAuthenticated()) return null;
    
    try {
        const session = JSON.parse(sessionStorage.getItem(AUTH_KEY));
        // Normalize legacy roles
        if (session && session.role) {
            session.role = normalizeRole(session.role);
        }
        return session;
    } catch (e) {
        return null;
    }
}

/**
 * Get current user role
 * @returns {string|null} - Current user role or null if not authenticated
 */
function getCurrentRole() {
    const session = getSession();
    return session ? session.role : null;
}

/**
 * Check if user has a specific role
 * @param {string} role - Role to check
 * @returns {boolean}
 */
function hasRole(role) {
    const currentRole = getCurrentRole();
    return currentRole === role;
}

/**
 * Check if user has admin/owner role
 * @returns {boolean}
 */
function isAdminOwner() {
    return hasRole(window.ROLES.ADMIN_OWNER);
}

/**
 * Check if user has co-owner role
 * @returns {boolean}
 */
function isCoOwner() {
    return hasRole(window.ROLES.CO_OWNER);
}

/**
 * Check if user is any type of owner/admin (admin_owner or co_owner)
 * @returns {boolean}
 */
function isOwner() {
    return isAdminOwner() || isCoOwner();
}

/**
 * Check if user has caregiver role
 * @returns {boolean}
 */
function isCaregiver() {
    return hasRole(window.ROLES.CAREGIVER);
}

/**
 * Check if user has client/family role
 * @returns {boolean}
 */
function isClientFamily() {
    return hasRole(window.ROLES.CLIENT_FAMILY);
}

/**
 * Check if user can access a specific page
 * @param {string} page - Page ID to check
 * @returns {boolean}
 */
function canAccessPage(page) {
    const role = getCurrentRole();
    if (!role) return false;
    
    const visibility = window.NAV_VISIBILITY[role];
    if (!visibility) return false;
    
    return visibility.includes(page);
}

/**
 * Get allowed pages for current user
 * @returns {string[]}
 */
function getAllowedPages() {
    const role = getCurrentRole();
    if (!role) return [];
    return window.NAV_VISIBILITY[role] || [];
}

/**
 * Require role - redirect if user doesn't have required role
 * @param {string|string[]} requiredRoles - Single role or array of allowed roles
 * @returns {boolean}
 */
function requireRole(requiredRoles) {
    if (!requireAuth()) return false;
    
    const currentRole = getCurrentRole();
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    
    if (!roles.includes(currentRole)) {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

/**
 * Update last activity timestamp
 */
function updateActivity() {
    const session = getSession();
    if (session) {
        session.timestamp = Date.now();
        sessionStorage.setItem(AUTH_KEY, JSON.stringify(session));
    }
}

// Auto-update activity on user interaction
document.addEventListener('click', updateActivity);
document.addEventListener('keypress', updateActivity);

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        isAuthenticated, 
        login, 
        logout, 
        requireAuth, 
        getSession,
        normalizeRole,
        getCurrentRole,
        hasRole,
        isAdminOwner,
        isCoOwner,
        isOwner,
        isCaregiver,
        isClientFamily,
        canAccessPage,
        getAllowedPages,
        requireRole
    };
}
