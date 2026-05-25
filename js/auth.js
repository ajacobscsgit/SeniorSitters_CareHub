// SeniorSitters CareHub - Authentication
// ======================================

// =========================================================================
// MODE FLAG
// =========================================================================
//
// DEV_MODE = true  → demo/mock login is available (development only).
// DEV_MODE = false → only real Supabase Auth is accepted.
//
// Set via config.js: window.DEV_MODE = true;
// DO NOT set DEV_MODE = true in production.
//
const DEV_MODE = typeof window !== 'undefined' && window.DEV_MODE === true;

// Session Management
const AUTH_KEY = 'carehub_session';

// =========================================================================
// SESSION HELPERS
// =========================================================================

/**
 * Check if user is authenticated (session exists and is < 24 h old).
 * @returns {boolean}
 */
function isAuthenticated() {
    const raw = sessionStorage.getItem(AUTH_KEY);
    if (!raw) return false;
    try {
        const parsed = JSON.parse(raw);
        const age = Date.now() - (parsed.timestamp || 0);
        if (age > 24 * 60 * 60 * 1000) {
            logout();
            return false;
        }
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Login with email and password.
 *
 * Routing:
 *   DEV_MODE = true  → mock login via DEMO_USERS (development only).
 *   DEV_MODE = false → real Supabase Auth via SupabaseAuth.signIn().
 *
 * Always returns a Promise so callers can await it regardless of mode.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function login(email, password) {
    // ── Real Supabase Auth (production) ─────────────────────────────────────
    if (!DEV_MODE) {
        if (typeof window.SupabaseAuth === 'undefined') {
            return { success: false, error: 'Auth system not ready. Please reload and try again.' };
        }
        return window.SupabaseAuth.signIn(email, password);
    }

    // ── Demo / Mock Auth (DEV_MODE only) ────────────────────────────────────
    const users = window.DEMO_USERS || {};
    const match = users[email.trim().toLowerCase()];

    if (match && match.password === password) {
        const session = {
            email:        email.trim().toLowerCase(),
            role:         match.role,
            name:         match.name || email,
            caregiver_id: match.caregiver_id || null,
            client_id:    match.client_id    || null,
            timestamp:    Date.now()
        };
        sessionStorage.setItem(AUTH_KEY, JSON.stringify(session));
        return { success: true };
    }

    // Legacy fallback — kept for backwards-compat during transition
    const legacy = window.ADMIN_CREDENTIALS || {};
    if (email === legacy.email && password === legacy.password) {
        const session = {
            email:        email,
            role:         'admin_owner',
            name:         'Admin User',
            caregiver_id: null,
            client_id:    null,
            timestamp:    Date.now()
        };
        sessionStorage.setItem(AUTH_KEY, JSON.stringify(session));
        return { success: true };
    }

    return { success: false, error: 'Invalid email or password' };
}

/**
 * Logout: sign out from Supabase Auth (real mode) and clear local session.
 * @returns {Promise<void>}
 */
async function logout() {
    if (!DEV_MODE && window.SupabaseAuth) {
        await window.SupabaseAuth.signOut();
        return; // signOut handles redirect
    }
    sessionStorage.removeItem(AUTH_KEY);
    window.location.href = 'login.html';
}

/**
 * Redirect to login.html if not authenticated.
 * Synchronous check against sessionStorage (sufficient for route-guarding).
 * For real-auth mode, hydrateSession() should run on app init to keep the
 * local session fresh from the live Supabase Auth token.
 * @returns {boolean}
 */
function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

/**
 * Initialise authentication on app load.
 * In real-auth mode, hydrates the local session from the live Supabase token
 * so page reloads don't lose the session.
 * Safe to call in both modes (no-op in DEV_MODE).
 * @returns {Promise<void>}
 */
async function initAuth() {
    if (DEV_MODE) return;
    if (window.SupabaseAuth) {
        await window.SupabaseAuth.hydrateSession();
    }
}

/**
 * Return the parsed session object, or null.
 * @returns {Object|null}
 */
function getSession() {
    if (!isAuthenticated()) return null;
    try {
        return JSON.parse(sessionStorage.getItem(AUTH_KEY));
    } catch (e) {
        return null;
    }
}

/**
 * Bump the session timestamp to extend its life.
 */
function updateActivity() {
    const session = getSession();
    if (session) {
        session.timestamp = Date.now();
        sessionStorage.setItem(AUTH_KEY, JSON.stringify(session));
    }
}

// Auto-extend session on user interaction
document.addEventListener('click', updateActivity);
document.addEventListener('keypress', updateActivity);

// =========================================================================
// ROLE HELPERS
// =========================================================================

/**
 * Normalise legacy role strings to the current role constants.
 * @param {string} role
 * @returns {string}
 */
function normalizeRole(role) {
    if (!role) return window.ROLES ? window.ROLES.ADMIN_OWNER : 'admin_owner';
    const map = {
        'admin':        'admin_owner',
        'owner':        'admin_owner',
        'co_owner':     'co_owner',
        'caregiver':    'caregiver',
        'client':       'client_family',
        'client_family':'client_family',
        'family':       'client_family'
    };
    return map[role] || role;
}

/**
 * Return the current user's normalised role string, or null.
 * @returns {string|null}
 */
function getCurrentRole() {
    const session = getSession();
    if (!session) return null;
    return normalizeRole(session.role);
}

/**
 * Return true if the current user has exactly this role.
 * @param {string} role
 * @returns {boolean}
 */
function hasRole(role) {
    return getCurrentRole() === role;
}

/** Convenience role checks */
function isAdminOwner()  { return hasRole('admin_owner'); }
function isCoOwner()     { return hasRole('co_owner'); }
function isOwner()       { return isAdminOwner() || isCoOwner(); }
function isCaregiver()   { return hasRole('caregiver'); }
function isClientFamily(){ return hasRole('client_family'); }

// =========================================================================
// REAL-ID RESOLUTION
// =========================================================================

/**
 * After login, attempt to resolve the user's real caregiver_id or client_id
 * from the Supabase database by matching on email address.
 *
 * This bridges mock auth (where DEMO_USERS may have null IDs) with the real
 * Supabase tables so that role-based data filtering works immediately.
 *
 * Safe to call repeatedly — skips resolution if IDs are already set.
 *
 * @returns {Promise<void>}
 */
async function resolveUserIds() {
    const session = getSession();
    if (!session) return;

    const role = normalizeRole(session.role);
    const email = session.email;

    // Already resolved — nothing to do
    if (role === 'caregiver' && session.caregiver_id) return;
    if (role === 'client_family' && session.client_id) return;
    if (role === 'admin_owner' || role === 'co_owner') return;

    // Supabase client may not be ready yet — wait for it
    const db = window.carehubSupabase || (window.supabase && window.CAREHUB_CONFIG
        ? window.supabase.createClient(window.CAREHUB_CONFIG.SUPABASE_URL, window.CAREHUB_CONFIG.SUPABASE_ANON_KEY)
        : null);

    if (!db) {
        if (window.DEBUG) console.warn('[Auth] resolveUserIds: Supabase client not ready, skipping ID resolution');
        return;
    }

    try {
        if (role === 'caregiver') {
            const { data, error } = await db
                .from('caregivers')
                .select('id')
                .eq('email', email)
                .limit(1)
                .single();
            if (!error && data) {
                session.caregiver_id = data.id;
                sessionStorage.setItem(AUTH_KEY, JSON.stringify(session));
                if (window.DEBUG) console.log('[Auth] Resolved caregiver_id:', data.id);
            } else if (window.DEBUG) {
                console.warn('[Auth] Could not resolve caregiver_id for', email, error?.message);
            }
        }

        if (role === 'client_family') {
            // Clients may be identified by either the family requester email or the care_for email.
            // We check both email and requester_name columns.
            const { data, error } = await db
                .from('clients')
                .select('id')
                .eq('email', email)
                .limit(1)
                .single();
            if (!error && data) {
                session.client_id = data.id;
                sessionStorage.setItem(AUTH_KEY, JSON.stringify(session));
                if (window.DEBUG) console.log('[Auth] Resolved client_id:', data.id);
            } else if (window.DEBUG) {
                console.warn('[Auth] Could not resolve client_id for', email, error?.message);
            }
        }
    } catch (e) {
        if (window.DEBUG) console.warn('[Auth] resolveUserIds error:', e);
    }
}

// =========================================================================
// TESTING / DEV HELPERS
// =========================================================================

/**
 * Manually inject a real caregiver_id or client_id into the current session.
 * Use this in the browser console during development to test role-based filtering
 * without needing to set up real Supabase auth.
 *
 * Usage (browser console):
 *   seedDemoIds({ caregiver_id: 'uuid-from-caregivers-table' })
 *   seedDemoIds({ client_id: 'uuid-from-clients-table' })
 *   seedDemoIds({ caregiver_id: null })  // clear it
 *
 * After calling, reload the current page:
 *   navigateTo('dashboard')
 *
 * @param {Object} ids - { caregiver_id?: string|null, client_id?: string|null }
 */
function seedDemoIds(ids = {}) {
    const raw = sessionStorage.getItem(AUTH_KEY);
    if (!raw) {
        console.warn('[seedDemoIds] No active session. Log in first.');
        return;
    }
    try {
        const session = JSON.parse(raw);
        if ('caregiver_id' in ids) session.caregiver_id = ids.caregiver_id;
        if ('client_id' in ids) session.client_id = ids.client_id;
        sessionStorage.setItem(AUTH_KEY, JSON.stringify(session));
        console.log('[seedDemoIds] Session updated:', session);
        console.log('[seedDemoIds] Call navigateTo("dashboard") or reload to apply.');
    } catch (e) {
        console.error('[seedDemoIds] Failed to update session:', e);
    }
}

/**
 * Print the current session to the console for inspection.
 * Usage: debugSession()
 */
function debugSession() {
    const session = getSession();
    if (!session) {
        console.log('[debugSession] No active session.');
        return;
    }
    console.table({
        email:        session.email,
        role:         session.role,
        name:         session.name,
        caregiver_id: session.caregiver_id || '(not set)',
        client_id:    session.client_id    || '(not set)',
        age_minutes:  Math.round((Date.now() - session.timestamp) / 60000)
    });
    if (window.RoleFilter) {
        console.log('[debugSession] isFullAccess:', window.RoleFilter._isFullAccess());
        console.log('[debugSession] buildQueryFilters("schedules"):', window.RoleFilter.buildQueryFilters('schedules'));
    }
}

// =========================================================================
// ACCESS CONTROL
// =========================================================================

/**
 * Return the list of page ids the current user is allowed to visit.
 * Falls back to admin_owner visibility when role is unknown.
 * @returns {string[]}
 */
function getAllowedPages() {
    const role = getCurrentRole();
    const visibility = window.NAV_VISIBILITY || {};
    if (role && visibility[role]) return visibility[role];
    return visibility['admin_owner'] || [];
}

/**
 * Return true if the current user is allowed to visit the given page id.
 * @param {string} pageId
 * @returns {boolean}
 */
function canAccessPage(pageId) {
    return getAllowedPages().includes(pageId);
}

/**
 * Redirect to dashboard if the current user is NOT one of the allowed roles.
 * @param {string[]} roles - array of allowed role strings
 * @returns {boolean} true if access is granted
 */
function requireRole(roles) {
    const role = getCurrentRole();
    if (!role || !roles.includes(role)) {
        // Redirect to dashboard rather than login
        if (typeof navigateTo === 'function') navigateTo('dashboard');
        return false;
    }
    return true;
}

// =========================================================================
// MODULE EXPORTS (Node / CommonJS – not used in browser)
// =========================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        isAuthenticated, login, logout, requireAuth, getSession,
        updateActivity, normalizeRole, getCurrentRole, hasRole,
        isAdminOwner, isCoOwner, isOwner, isCaregiver, isClientFamily,
        canAccessPage, getAllowedPages, requireRole, initAuth
    };
}

// =========================================================================
// GLOBAL WINDOW EXPORTS – required by app.js and other browser modules
// =========================================================================

window.isAuthenticated  = isAuthenticated;
window.login            = login;
window.logout           = logout;
window.requireAuth      = requireAuth;
window.getSession       = getSession;
window.updateActivity   = updateActivity;

window.normalizeRole    = normalizeRole;
window.getCurrentRole   = getCurrentRole;
window.hasRole          = hasRole;
window.isAdminOwner     = isAdminOwner;
window.isCoOwner        = isCoOwner;
window.isOwner          = isOwner;
window.isCaregiver      = isCaregiver;
window.isClientFamily   = isClientFamily;

window.canAccessPage    = canAccessPage;
window.getAllowedPages  = getAllowedPages;
window.requireRole      = requireRole;
window.resolveUserIds   = resolveUserIds;
window.seedDemoIds      = seedDemoIds;
window.debugSession     = debugSession;
window.initAuth         = initAuth;
window.DEV_MODE_ACTIVE  = DEV_MODE; // expose read-only flag for login.html
