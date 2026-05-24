/**
 * CareHub – Real Supabase Authentication Layer
 * =============================================
 * Handles sign-in, sign-out, session hydration, and profile fetching
 * using Supabase Auth + a public `profiles` table.
 *
 * This module is the ONLY place that calls supabase.auth.*
 * auth.js delegates to it when DEV_MODE is false.
 *
 * Profiles table schema (must exist in Supabase):
 *   profiles (
 *     id           uuid primary key references auth.users(id),
 *     email        text unique not null,
 *     full_name    text,
 *     role         text not null,          -- 'admin_owner'|'co_owner'|'caregiver'|'client_family'
 *     caregiver_id uuid references caregivers(id),
 *     client_id    uuid references clients(id),
 *     status       text default 'active',
 *     created_at   timestamptz default now(),
 *     updated_at   timestamptz default now()
 *   )
 *
 * Dependencies:
 *   config.js  – window.CAREHUB_CONFIG (SUPABASE_URL, SUPABASE_ANON_KEY)
 *   Supabase JS CDN must be loaded before this file.
 */

(function () {
    'use strict';

    // =========================================================================
    // UTILITIES
    // =========================================================================

    /**
     * Log only when window.DEBUG is true.
     */
    function _debugLog(...args) {
        if (window.DEBUG === true) console.log('[SupabaseAuth]', ...args);
    }

    /**
     * Detect Supabase email rate-limit errors from a message string.
     * Supabase uses multiple phrasings across versions.
     * @param {string} msg
     * @returns {boolean}
     */
    function _isRateLimit(msg) {
        if (!msg) return false;
        const m = msg.toLowerCase();
        return (
            m.includes('rate limit') ||
            m.includes('too many requests') ||
            m.includes('email rate limit exceeded') ||
            m.includes('for security purposes') ||
            m.includes('over_email_send_rate_limit')
        );
    }

    // =========================================================================
    // CLIENT REFERENCE
    // =========================================================================

    /**
     * Return the shared Supabase client (created by database.js or config.js).
     * Falls back to creating a dedicated client for the auth module if needed.
     * @returns {Object|null}
     */
    function _db() {
        if (window.carehubSupabase) return window.carehubSupabase;
        if (window.supabase && window.CAREHUB_CONFIG) {
            window.carehubSupabase = window.supabase.createClient(
                window.CAREHUB_CONFIG.SUPABASE_URL,
                window.CAREHUB_CONFIG.SUPABASE_ANON_KEY
            );
            return window.carehubSupabase;
        }
        return null;
    }

    // =========================================================================
    // SIGN IN
    // =========================================================================

    /**
     * Sign in with email + password via Supabase Auth.
     * On success, fetches the matching profiles row and builds a CareHub session
     * object compatible with auth.js getSession() format.
     *
     * @param {string} email
     * @param {string} password
     * @returns {Promise<{ success: boolean, error?: string }>}
     */
    async function signIn(email, password) {
        const db = _db();
        if (!db) return { success: false, error: 'Supabase client not available.' };

        const { data, error } = await db.auth.signInWithPassword({ email, password });

        if (error) {
            console.warn('[SupabaseAuth] signIn error:', error.message);
            return { success: false, error: _friendlyError(error.message) };
        }

        const profile = await _fetchProfile(data.user.id);
        if (!profile) {
            // Auth succeeded but no profile row — still allow access as admin_owner
            // so the first admin can log in and configure the system.
            console.warn('[SupabaseAuth] No profile found for user', data.user.id, '— defaulting to admin_owner');
            _storeSession({
                id:           data.user.id,
                email:        data.user.email,
                role:         'admin_owner',
                name:         data.user.email,
                caregiver_id: null,
                client_id:    null
            });
            return { success: true };
        }

        _storeSession({
            id:           data.user.id,
            email:        profile.email || data.user.email,
            role:         profile.role,
            name:         profile.full_name || data.user.email,
            caregiver_id: profile.caregiver_id || null,
            client_id:    profile.client_id    || null
        });

        return { success: true };
    }

    // =========================================================================
    // SIGN OUT
    // =========================================================================

    /**
     * Sign out from Supabase Auth and clear the local session.
     * @returns {Promise<void>}
     */
    async function signOut() {
        const db = _db();
        if (db) await db.auth.signOut();
        localStorage.removeItem('carehub_session');
        window.location.href = 'login.html';
    }

    // =========================================================================
    // SESSION CHECK
    // =========================================================================

    /**
     * Returns true if there is an active Supabase Auth session AND a valid
     * carehub_session in localStorage.
     * @returns {Promise<boolean>}
     */
    async function checkSession() {
        const db = _db();
        if (!db) return false;

        const { data } = await db.auth.getSession();
        if (!data?.session) return false;

        // Cross-check with localStorage session
        const raw = localStorage.getItem('carehub_session');
        if (!raw) return false;

        try {
            const session = JSON.parse(raw);
            return !!(session && session.email);
        } catch {
            return false;
        }
    }

    /**
     * Hydrate the local session from the active Supabase Auth session.
     * Call this on app init to handle page-reload scenarios where
     * localStorage session may be stale.
     * @returns {Promise<void>}
     */
    async function hydrateSession() {
        const db = _db();
        if (!db) return;

        const { data } = await db.auth.getSession();
        if (!data?.session?.user) return;

        const user = data.session.user;
        const profile = await _fetchProfile(user.id);
        if (!profile) return;

        _storeSession({
            id:           user.id,
            email:        profile.email || user.email,
            role:         profile.role,
            name:         profile.full_name || user.email,
            caregiver_id: profile.caregiver_id || null,
            client_id:    profile.client_id    || null
        });
    }

    // =========================================================================
    // USER INVITE
    // =========================================================================

    /**
     * Invite a user to CareHub.
     *
     * Routing:
     *   EDGE_FUNCTION_DEPLOYED = true  → calls supabase/functions/invite-user
     *                                    (creates real auth account + sends email)
     *   EDGE_FUNCTION_DEPLOYED = false → inserts a pending_invite profile row
     *                                    only (no email sent; safe for dev)
     *
     * The flag is read from window.CAREHUB_CONFIG.EDGE_FUNCTION_DEPLOYED.
     * Set it to true in config.js ONLY after the function has been deployed.
     *
     * Permission enforcement is also done server-side in the Edge Function.
     * The frontend layer here is an additional UX guard only.
     *
     * @param {Object}      opts
     * @param {string}      opts.email
     * @param {string}      opts.role          'caregiver' | 'client_family' | 'co_owner'
     * @param {string}      opts.full_name
     * @param {string|null} [opts.caregiver_id]
     * @param {string|null} [opts.client_id]
     * @returns {Promise<{
     *   success:  boolean,
     *   pending?: boolean,
     *   code?:    string,
     *   error?:   string,
     *   message?: string
     * }>}
     */
    async function inviteUser({ email, role, full_name, caregiver_id = null, client_id = null }) {
        const db = _db();
        if (!db) return { success: false, error: 'Supabase client not available.' };

        // ── Input validation (frontend guard) ─────────────────────────────────
        if (!email || !email.trim()) {
            return { success: false, error: 'Email address is required.' };
        }
        if (!role) {
            return { success: false, error: 'Role is required.' };
        }
        if (!full_name || !full_name.trim()) {
            return { success: false, error: 'Full name is required.' };
        }

        const INVITABLE_ROLES = ['co_owner', 'caregiver', 'client_family'];
        if (!INVITABLE_ROLES.includes(role)) {
            return { success: false, error: `Invalid role: "${role}".` };
        }

        const normalizedEmail = email.trim().toLowerCase();

        // ── Route: Edge Function (production) ────────────────────────────────
        const edgeDeployed = !!(
            window.CAREHUB_CONFIG &&
            window.CAREHUB_CONFIG.EDGE_FUNCTION_DEPLOYED === true
        );

        if (edgeDeployed) {
            return _inviteViaEdgeFunction(db, { email: normalizedEmail, role, full_name, caregiver_id, client_id });
        }

        // ── Route: Placeholder (pre-deployment) ───────────────────────────────
        return _invitePlaceholder(db, { email: normalizedEmail, role, full_name, caregiver_id, client_id });
    }

    /**
     * Call the deployed invite-user Edge Function.
     * @private
     */
    async function _inviteViaEdgeFunction(db, { email, role, full_name, caregiver_id, client_id }) {
        const { data: { session } } = await db.auth.getSession();
        if (!session) {
            return { success: false, error: 'Not authenticated. Please sign in again.' };
        }

        let response, result;
        try {
            response = await fetch(
                `${window.CAREHUB_CONFIG.SUPABASE_URL}/functions/v1/invite-user`,
                {
                    method:  'POST',
                    headers: {
                        'Content-Type':  'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({ email, role, full_name, caregiver_id, client_id })
                }
            );
            result = await response.json();
        } catch (err) {
            console.error('[SupabaseAuth] Edge Function fetch error:', err);
            return { success: false, error: 'Could not reach the invite service. Check your connection.' };
        }

        if (!response.ok) {
            const code = result?.code || null;
            const msg  = result?.error || `Invite failed (HTTP ${response.status}).`;

            _debugLog('Edge Function error response:', { status: response.status, code, msg });

            // Map specific codes to friendly messages
            if (code === 'RATE_LIMIT' || response.status === 429 || _isRateLimit(msg)) {
                return {
                    success: false,
                    code:    'RATE_LIMIT',
                    error:   'Too many email links were sent. Please wait before trying again.'
                };
            }
            if (code === 'EMAIL_EXISTS' || response.status === 409) {
                return {
                    success: false,
                    code:    'EMAIL_EXISTS',
                    error:   `${email} already has a CareHub account.`
                };
            }
            if (response.status === 403) {
                return {
                    success: false,
                    code:    'FORBIDDEN',
                    error:   'Your role does not have permission to invite this user type.'
                };
            }

            return { success: false, code, error: msg };
        }

        return { success: true, user_id: result.user_id };
    }

    /**
     * Placeholder path — inserts a row into pending_invites (NOT profiles).
     *
     * Rationale: profiles requires a real auth.users id and is protected by RLS.
     * pending_invites is a staging table with its own RLS that allows admin/co_owner
     * to insert without a real auth account existing yet.
     *
     * Duplicate check order:
     *   1. profiles.email  — already has a real account
     *   2. pending_invites.email — already queued
     *
     * No email is sent. Safe to run before the Edge Function is deployed.
     * @private
     */
    async function _invitePlaceholder(db, { email, role, full_name, caregiver_id, client_id }) {
        _debugLog('inviteUser — PLACEHOLDER mode (EDGE_FUNCTION_DEPLOYED = false)', { email, role, full_name });

        // ── 1. Check profiles for existing real account ───────────────────────
        const { data: existingProfile } = await db
            .from('profiles')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        if (existingProfile) {
            return {
                success: false,
                code:    'EMAIL_EXISTS',
                error:   `${email} already has a CareHub account.`
            };
        }

        // ── 2. Check pending_invites for an existing queued invite ─────────────
        const { data: existingInvite } = await db
            .from('pending_invites')
            .select('id, status')
            .eq('email', email)
            .maybeSingle();

        if (existingInvite) {
            return {
                success: false,
                code:    'EMAIL_EXISTS',
                error:   `An invite for ${email} is already queued (status: ${existingInvite.status}).`
            };
        }

        // ── 3. Get current user id to record invited_by ───────────────────────
        let invitedBy = null;
        try {
            const { data: { session } } = await db.auth.getSession();
            invitedBy = session?.user?.id || null;
        } catch (_) { /* non-fatal */ }

        // ── 4. Insert into pending_invites ────────────────────────────────────
        const { error: insertError } = await db
            .from('pending_invites')
            .insert({
                email,
                full_name:    full_name || email,
                role,
                caregiver_id: caregiver_id || null,
                client_id:    client_id    || null,
                invited_by:   invitedBy,
                status:       'pending'
            });

        if (insertError) {
            // 23505 = unique_violation — race condition, already inserted
            if (insertError.code === '23505') {
                return {
                    success: false,
                    code:    'EMAIL_EXISTS',
                    error:   `An invite for ${email} was already queued.`
                };
            }
            _debugLog('pending_invites insert error:', insertError.message, insertError.code);
            return {
                success: false,
                code:    'INSERT_FAILED',
                error:   'Failed to queue the invite. ' + insertError.message
            };
        }

        return {
            success: false,
            pending: true,
            code:    'EDGE_NOT_DEPLOYED',
            message: `Invite queued for ${email}. ` +
                     `Deploy the invite-user Edge Function and set EDGE_FUNCTION_DEPLOYED = true to send the real email.`
        };
    }

    // =========================================================================
    // PROFILE MANAGEMENT
    // =========================================================================

    /**
     * Fetch a profile row by auth user id.
     * @param {string} userId
     * @returns {Promise<Object|null>}
     */
    async function _fetchProfile(userId) {
        const db = _db();
        if (!db) return null;

        const { data, error } = await db
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .limit(1)
            .single();

        if (error) {
            if (error.code !== 'PGRST116') { // PGRST116 = no rows
                console.warn('[SupabaseAuth] _fetchProfile error:', error.message);
            }
            return null;
        }

        return data;
    }

    /**
     * Create or update a profile row. Called after caregiver/client record creation.
     * @param {Object} profile
     * @returns {Promise<boolean>}
     */
    async function upsertProfile(profile) {
        const db = _db();
        if (!db) return false;

        const { error } = await db
            .from('profiles')
            .upsert({
                ...profile,
                updated_at: new Date().toISOString()
            }, { onConflict: 'id' });

        if (error) {
            console.error('[SupabaseAuth] upsertProfile error:', error);
            return false;
        }

        return true;
    }

    /**
     * Fetch a profile by email (used during ID resolution and admin lookups).
     * @param {string} email
     * @returns {Promise<Object|null>}
     */
    async function getProfileByEmail(email) {
        const db = _db();
        if (!db) return null;

        const { data, error } = await db
            .from('profiles')
            .select('*')
            .eq('email', email.trim().toLowerCase())
            .limit(1)
            .single();

        if (error) return null;
        return data;
    }

    // =========================================================================
    // INTERNAL HELPERS
    // =========================================================================

    /**
     * Write a CareHub-format session object to localStorage.
     * @param {Object} session
     */
    function _storeSession(session) {
        const payload = {
            ...session,
            timestamp: Date.now()
        };
        localStorage.setItem('carehub_session', JSON.stringify(payload));
    }

    /**
     * Convert raw Supabase auth error messages to user-friendly strings.
     * @param {string} msg
     * @returns {string}
     */
    function _friendlyError(msg) {
        if (!msg) return 'Sign-in failed. Please try again.';
        const m = msg.toLowerCase();
        if (m.includes('invalid login credentials') || m.includes('invalid email or password'))
            return 'Invalid email or password.';
        if (m.includes('email not confirmed'))
            return 'Please confirm your email address before signing in.';
        if (m.includes('too many requests'))
            return 'Too many login attempts. Please wait a moment and try again.';
        if (m.includes('user not found'))
            return 'No account found with that email address.';
        return msg;
    }

    /**
     * Generate a random UUID v4 (used for sentinel profile IDs).
     * @returns {string}
     */
    function _uuidv4() {
        if (crypto && crypto.randomUUID) return crypto.randomUUID();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    }

    // =========================================================================
    // GLOBAL EXPORTS
    // =========================================================================

    window.SupabaseAuth = {
        signIn,
        signOut,
        checkSession,
        hydrateSession,
        inviteUser,
        upsertProfile,
        getProfileByEmail
    };

})();
