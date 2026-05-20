// SeniorSitters CareHub - Authentication
// ======================================

// Session Management
const AUTH_KEY = 'carehub_session';

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
function isAuthenticated() {
    const session = localStorage.getItem(AUTH_KEY);
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
function login(email, password) {
    // Phase 1: Mock authentication
    if (email === window.ADMIN_CREDENTIALS.email && password === window.ADMIN_CREDENTIALS.password) {
        const session = {
            email: email,
            role: 'admin',
            timestamp: Date.now()
        };
        localStorage.setItem(AUTH_KEY, JSON.stringify(session));
        return { success: true };
    }
    
    return { success: false, error: 'Invalid email or password' };
}

/**
 * Logout and clear session
 */
function logout() {
    localStorage.removeItem(AUTH_KEY);
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
 * Get current session info
 * @returns {Object|null}
 */
function getSession() {
    if (!isAuthenticated()) return null;
    
    try {
        return JSON.parse(localStorage.getItem(AUTH_KEY));
    } catch (e) {
        return null;
    }
}

/**
 * Update last activity timestamp
 */
function updateActivity() {
    const session = getSession();
    if (session) {
        session.timestamp = Date.now();
        localStorage.setItem(AUTH_KEY, JSON.stringify(session));
    }
}

// Auto-update activity on user interaction
document.addEventListener('click', updateActivity);
document.addEventListener('keypress', updateActivity);

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { isAuthenticated, login, logout, requireAuth, getSession };
}
