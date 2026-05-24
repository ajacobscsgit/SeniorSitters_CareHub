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
    // USER INVITE (PLACEHOLDER — requires Edge Function / service-role key)
    // =========================================================================

    /**
     * Invite a user to CareHub by creating a Supabase Auth account and
     * a matching profiles row.
     *
     * IMPORTANT: The Supabase JS client's anon key CANNOT create auth users
     * via admin APIs. This function is a documented placeholder.
     *
     * Production implementation options:
     *   A) Supabase Edge Function (recommended):
     *      POST /functions/v1/invite-user
     *      { email, role, full_name, caregiver_id?, client_id? }
     *      The Edge Function uses the SERVICE_ROLE key to call
     *      supabase.auth.admin.inviteUserByEmail() and inserts the profile row.
     *
     *   B) Server-side API route (Node/Express):
     *      Same logic, using @supabase/supabase-js with service role key.
     *
     * For now, this function:
     *   1. Logs the invite payload to the console.
     *   2. Returns { success: false, pending: true } so the caller can show
     *      a "Invite pending — implement Edge Function" message.
     *   3. Inserts the profile row WITHOUT creating the auth user, so the
     *      admin can see the pending account and retry when the Edge Function
     *      is deployed.
     *
     * @param {Object} opts
     * @param {string} opts.email
     * @param {string} opts.role         – 'caregiver' | 'client_family' | 'co_owner'
     * @param {string} opts.full_name
     * @param {string|null} [opts.caregiver_id]
     * @param {string|null} [opts.client_id]
     * @returns {Promise<{ success: boolean, pending?: boolean, error?: string }>}
     */
    async function inviteUser({ email, role, full_name, caregiver_id = null, client_id = null }) {
        const db = _db();
        if (!db) return { success: false, error: 'Supabase client not available.' };

        console.log('[SupabaseAuth] inviteUser called (placeholder):', { email, role, full_name, caregiver_id, client_id });

        // ── Step 1: Insert a pending profile row ─────────────────────────────
        // We use a sentinel id (random UUID v4 substitute) so the row exists
        // even before auth.users has a matching entry.
        // When the Edge Function is implemented, it should UPDATE this row with
        // the real auth.users id after creating the auth account.
        const sentinelId = _uuidv4();

        const profilePayload = {
            id:           sentinelId,
            email:        email.trim().toLowerCase(),
            full_name:    full_name || email,
            role:         role,
            caregiver_id: caregiver_id,
            client_id:    client_id,
            status:       'pending_invite',
            created_at:   new Date().toISOString(),
            updated_at:   new Date().toISOString()
        };

        const { error: profileError } = await db
            .from('profiles')
            .upsert(profilePayload, { onConflict: 'email' });

        if (profileError) {
            console.error('[SupabaseAuth] Failed to insert pending profile:', profileError);
            // Non-fatal — still return pending so caller can inform admin
        }

        // ── Step 2: Document what the Edge Function needs to do ───────────────
        console.info(
            '[SupabaseAuth] TODO — deploy Edge Function to complete invite.\n' +
            'Payload for supabase.auth.admin.inviteUserByEmail():\n',
            JSON.stringify({ email, data: { role, full_name, caregiver_id, client_id } }, null, 2)
        );

        return {
            success: false,
            pending: true,
            message: `Invite queued for ${email}. Deploy the invite-user Edge Function to send the email.`
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
