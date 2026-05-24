/**
 * CareHub — Password Reset / Invite Accept Module
 * ================================================
 * Handles two Supabase Auth flows that both land on a "set password" page:
 *
 *   1. Invite flow   (type=invite)   — new user accepting an invite link
 *   2. Recovery flow (type=recovery) — existing user resetting their password
 *
 * Supabase encodes the session tokens in the URL hash fragment:
 *   #access_token=...&refresh_token=...&type=invite
 *   #access_token=...&refresh_token=...&type=recovery
 *
 * This module:
 *   - Parses the hash on load
 *   - Establishes the Supabase session from the tokens
 *   - Shows the correct form UI based on flow type
 *   - Validates password strength and match
 *   - Calls supabase.auth.updateUser({ password })
 *   - Redirects to login.html on success
 *
 * Used by: accept-invite.html, reset-password.html
 *
 * Dependencies:
 *   - Supabase JS CDN (window.supabase)
 *   - js/config.js    (window.CAREHUB_CONFIG)
 */

(function () {
    'use strict';

    // =========================================================================
    // CONSTANTS
    // =========================================================================

    const MIN_LENGTH    = 8;
    const REDIRECT_MS   = 3000;
    const LOGIN_URL     = 'login.html';

    // =========================================================================
    // SUPABASE CLIENT
    // =========================================================================

    let _client = null;

    function getClient() {
        if (_client) return _client;
        if (!window.supabase || !window.CAREHUB_CONFIG) {
            console.error('[PasswordReset] Supabase or CAREHUB_CONFIG not available.');
            return null;
        }
        _client = window.supabase.createClient(
            window.CAREHUB_CONFIG.SUPABASE_URL,
            window.CAREHUB_CONFIG.SUPABASE_ANON_KEY
        );
        return _client;
    }

    // =========================================================================
    // TOKEN PARSING
    // =========================================================================

    /**
     * Parse both token formats Supabase may send:
     *
     *   Legacy (implicit flow, older Supabase):
     *     #access_token=...&refresh_token=...&type=invite
     *
     *   Modern (PKCE flow, Supabase default since ~2024):
     *     ?token_hash=...&type=invite
     *     (Supabase exchanges this internally on verifyOtp())
     *
     * Returns a unified object with all found params from both sources.
     * @returns {Object}
     */
    function parseTokens() {
        const result = {};

        // ── 1. Query string params (?token_hash=...&type=...) ────────────────
        const search = window.location.search.replace(/^\?/, '');
        if (search) {
            search.split('&').forEach(part => {
                const [key, ...rest] = part.split('=');
                if (key) result[decodeURIComponent(key)] = decodeURIComponent(rest.join('='));
            });
        }

        // ── 2. Hash fragment params (#access_token=...&refresh_token=...) ───
        const hash = window.location.hash.replace(/^#/, '');
        if (hash) {
            hash.split('&').forEach(part => {
                const [key, ...rest] = part.split('=');
                if (key) result[decodeURIComponent(key)] = decodeURIComponent(rest.join('='));
            });
        }

        return result;
    }

    // =========================================================================
    // STRENGTH HELPERS
    // =========================================================================

    const STRENGTH_LEVELS = [
        { min: 0,  max: 0,  label: '',           color: '',          width: '0%'   },
        { min: 1,  max: 1,  label: 'Too short',  color: '#EF4444',   width: '20%'  },
        { min: 2,  max: 2,  label: 'Weak',       color: '#F97316',   width: '40%'  },
        { min: 3,  max: 3,  label: 'Fair',       color: '#EAB308',   width: '65%'  },
        { min: 4,  max: 4,  label: 'Good',       color: '#22C55E',   width: '82%'  },
        { min: 5,  max: 5,  label: 'Strong',     color: '#16A34A',   width: '100%' }
    ];

    /**
     * Score a password (0–5) and return requirements check.
     * @param {string} pwd
     * @returns {{ score: number, hasLength: boolean, hasUpper: boolean, hasNumber: boolean }}
     */
    function scorePwd(pwd) {
        const hasLength  = pwd.length >= MIN_LENGTH;
        const hasUpper   = /[A-Z]/.test(pwd);
        const hasLower   = /[a-z]/.test(pwd);
        const hasNumber  = /[0-9]/.test(pwd);
        const hasSpecial = /[^A-Za-z0-9]/.test(pwd);

        let score = 0;
        if (hasLength)  score++;
        if (hasUpper)   score++;
        if (hasLower)   score++;
        if (hasNumber)  score++;
        if (hasSpecial) score++;

        return { score, hasLength, hasUpper, hasNumber };
    }

    // =========================================================================
    // UI HELPERS
    // =========================================================================

    function showState(id) {
        ['tokenCheckState', 'formState', 'successState'].forEach(s => {
            const el = document.getElementById(s);
            if (el) el.style.display = s === id ? '' : 'none';
        });
    }

    function showAlert(msg, type) {
        const el  = document.getElementById('authAlert');
        const txt = document.getElementById('authAlertMsg');
        if (!el || !txt) return;
        const icons = {
            error:   '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
            success: '<polyline points="20 6 9 17 4 12"/>',
            warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
        };
        const iconSvg = el.querySelector('svg');
        if (iconSvg) iconSvg.innerHTML = icons[type] || icons.error;
        el.className = `auth-alert is-${type}`;
        txt.textContent = msg;
    }

    function hideAlert() {
        const el = document.getElementById('authAlert');
        if (el) el.className = 'auth-alert';
    }

    function toggleEye(inputId, svgId) {
        const input = document.getElementById(inputId);
        const icon  = document.getElementById(svgId);
        if (!input || !icon) return;
        if (input.type === 'password') {
            input.type = 'text';
            icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';
        } else {
            input.type = 'password';
            icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
        }
    }

    function updateRequirement(reqId, met) {
        const el = document.getElementById(reqId);
        if (!el) return;
        el.className = 'pwd-req ' + (met ? 'met' : 'unmet');
        const svg = el.querySelector('svg');
        if (!svg) return;
        svg.innerHTML = met
            ? '<polyline points="20 6 9 17 4 12"/>'
            : '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>';
    }

    function updateStrength(pwd) {
        const fill  = document.getElementById('strengthFill');
        const label = document.getElementById('strengthLabel');
        if (!fill || !label) return;

        const { score, hasLength, hasUpper, hasNumber } = scorePwd(pwd);

        const level = STRENGTH_LEVELS[Math.min(score, STRENGTH_LEVELS.length - 1)];
        fill.style.width      = pwd.length === 0 ? '0%' : level.width;
        fill.style.background = level.color;
        label.textContent     = pwd.length === 0 ? '' : level.label;
        label.style.color     = level.color;

        updateRequirement('req-length', hasLength);
        updateRequirement('req-upper',  hasUpper);
        updateRequirement('req-number', hasNumber);
    }

    function startRedirectCountdown() {
        let count = Math.round(REDIRECT_MS / 1000);
        const numEl = document.getElementById('countdownNum');
        const interval = setInterval(() => {
            count--;
            if (numEl) numEl.textContent = count;
            if (count <= 0) {
                clearInterval(interval);
                window.location.href = LOGIN_URL;
            }
        }, 1000);

        // Immediate redirect fallback
        setTimeout(() => { window.location.href = LOGIN_URL; }, REDIRECT_MS + 200);
    }

    // =========================================================================
    // MAIN INIT
    // =========================================================================

    async function init() {
        const db = getClient();
        if (!db) {
            showState('formState');
            showAlert('Authentication system unavailable. Please reload the page.', 'error');
            console.error('[PasswordReset] window.supabase or CAREHUB_CONFIG missing.');
            return;
        }

        // ── Step 1: Parse tokens from URL (both formats) ───────────────────
        const params = parseTokens();

        // Debug: always log what was found so we can diagnose in DevTools
        console.log('[PasswordReset] URL params found:', {
            has_token_hash:   !!params['token_hash'],
            has_access_token: !!params['access_token'],
            type:             params['type'],
            error:            params['error'] || null
        });

        const tokenHash    = params['token_hash'];           // PKCE / modern flow
        const accessToken  = params['access_token'];         // Legacy / implicit flow
        const refreshToken = params['refresh_token'];
        const flowType     = params['type'] || 'invite';     // 'invite' | 'recovery'
        const errorDesc    = params['error_description'];

        // Handle Supabase error embedded in URL (e.g. expired link)
        if (params['error']) {
            showState('formState');
            showAlert(
                errorDesc
                    ? decodeURIComponent(errorDesc.replace(/\+/g, ' '))
                    : 'This link has expired or is invalid. Please request a new one.',
                'error'
            );
            return;
        }

        // ── Step 2: Establish session — two paths ──────────────────────────

        let sessionEstablished = false;

        // PATH A: Modern PKCE flow — token_hash in query string
        if (tokenHash) {
            console.log('[PasswordReset] Using PKCE token_hash path (verifyOtp)');
            const { error: otpErr } = await db.auth.verifyOtp({
                token_hash: tokenHash,
                type:       flowType === 'recovery' ? 'recovery' : 'invite'
            });

            if (otpErr) {
                console.error('[PasswordReset] verifyOtp error:', otpErr.message);
                showState('formState');
                showAlert(
                    'This invite link has expired or has already been used. ' +
                    'Please ask an admin to resend the invite.',
                    'error'
                );
                const btn = document.getElementById('submitBtn');
                if (btn) btn.disabled = true;
                return;
            }
            sessionEstablished = true;
        }

        // PATH B: Legacy implicit flow — access_token + refresh_token in hash
        else if (accessToken && refreshToken) {
            console.log('[PasswordReset] Using legacy access_token/refresh_token path (setSession)');
            const { error: sessionErr } = await db.auth.setSession({
                access_token:  accessToken,
                refresh_token: refreshToken
            });

            if (sessionErr) {
                console.error('[PasswordReset] setSession error:', sessionErr.message);
                showState('formState');
                showAlert(
                    'This link has expired or has already been used. ' +
                    'Please request a new one.',
                    'error'
                );
                const btn = document.getElementById('submitBtn');
                if (btn) btn.disabled = true;
                return;
            }
            sessionEstablished = true;
        }

        // PATH C: No tokens at all
        if (!sessionEstablished) {
            showState('formState');
            showAlert(
                'No invite or recovery token found in this URL. ' +
                'Please use the exact link from your invite email.',
                'warning'
            );
            const btn = document.getElementById('submitBtn');
            if (btn) btn.disabled = true;
            return;
        }

        // ── Step 3: Show form with correct copy ────────────────────────────
        const titleEl    = document.getElementById('formTitle');
        const subtitleEl = document.getElementById('formSubtitle');
        const submitBtn  = document.getElementById('submitBtn');

        if (flowType === 'recovery') {
            if (titleEl)    titleEl.textContent = 'Reset your password';
            if (subtitleEl) subtitleEl.textContent = 'Enter a new password for your CareHub account.';
            if (submitBtn)  submitBtn.innerHTML =
                '<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Set New Password';
        }

        // Clear URL tokens so they aren't accidentally reused or visible
        history.replaceState(null, '', window.location.pathname);

        showState('formState');

        // ── Step 4: Wire up form ───────────────────────────────────────────
        bindFormEvents(db, flowType);
    }

    // =========================================================================
    // FORM EVENTS
    // =========================================================================

    function bindFormEvents(db, flowType) {
        const newPwdInput = document.getElementById('newPassword');
        const conPwdInput = document.getElementById('confirmPassword');

        // Live strength/requirements feedback
        if (newPwdInput) {
            newPwdInput.addEventListener('input', () => {
                updateStrength(newPwdInput.value);
                newPwdInput.classList.remove('is-error', 'is-valid');
                if (conPwdInput && conPwdInput.value) {
                    conPwdInput.classList.toggle('is-error', newPwdInput.value !== conPwdInput.value);
                    conPwdInput.classList.toggle('is-valid', newPwdInput.value === conPwdInput.value && newPwdInput.value.length > 0);
                }
            });
        }

        if (conPwdInput) {
            conPwdInput.addEventListener('input', () => {
                if (!newPwdInput) return;
                const match = conPwdInput.value === newPwdInput.value;
                conPwdInput.classList.toggle('is-error', !match && conPwdInput.value.length > 0);
                conPwdInput.classList.toggle('is-valid', match && conPwdInput.value.length > 0);
            });
        }

        // Eye toggles
        const toggleNew     = document.getElementById('toggleNew');
        const toggleConfirm = document.getElementById('toggleConfirm');
        if (toggleNew)     toggleNew.addEventListener('click',     () => toggleEye('newPassword',     'eyeNew'));
        if (toggleConfirm) toggleConfirm.addEventListener('click', () => toggleEye('confirmPassword', 'eyeConfirm'));

        // Form submit
        const form = document.getElementById('pwdForm');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await handleSubmit(db);
            });
        }
    }

    // =========================================================================
    // SUBMIT HANDLER
    // =========================================================================

    async function handleSubmit(db) {
        hideAlert();

        const newPwd = (document.getElementById('newPassword')?.value    || '').trim();
        const conPwd = (document.getElementById('confirmPassword')?.value || '').trim();
        const btn    = document.getElementById('submitBtn');
        const newEl  = document.getElementById('newPassword');
        const conEl  = document.getElementById('confirmPassword');

        // ── Validation ────────────────────────────────────────────────────
        if (!newPwd) {
            newEl?.classList.add('is-error');
            showAlert('Please enter a new password.', 'error');
            newEl?.focus();
            return;
        }

        if (newPwd.length < MIN_LENGTH) {
            newEl?.classList.add('is-error');
            showAlert(`Password must be at least ${MIN_LENGTH} characters long.`, 'error');
            newEl?.focus();
            return;
        }

        if (!conPwd) {
            conEl?.classList.add('is-error');
            showAlert('Please confirm your password.', 'error');
            conEl?.focus();
            return;
        }

        if (newPwd !== conPwd) {
            conEl?.classList.add('is-error');
            showAlert('Passwords do not match. Please try again.', 'error');
            conEl?.focus();
            return;
        }

        // ── Call Supabase ─────────────────────────────────────────────────
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<div class="btn-spinner"></div> Saving password\u2026';
        }

        const { error } = await db.auth.updateUser({ password: newPwd });

        if (error) {
            if (btn) {
                btn.disabled  = false;
                btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Activate Account';
            }
            const msg = _friendlyError(error.message);
            showAlert(msg, 'error');
            return;
        }

        // ── Success ───────────────────────────────────────────────────────
        // Sign out so the user lands on a clean login page
        await db.auth.signOut();

        showState('successState');
        startRedirectCountdown();
    }

    // =========================================================================
    // ERROR MESSAGES
    // =========================================================================

    function _friendlyError(msg) {
        if (!msg) return 'Something went wrong. Please try again.';
        const m = msg.toLowerCase();
        if (m.includes('same password'))
            return 'New password must be different from your current password.';
        if (m.includes('password should be'))
            return `Password must be at least ${MIN_LENGTH} characters.`;
        if (m.includes('session') || m.includes('token') || m.includes('expired'))
            return 'Your session has expired. Please use the link from your email again.';
        return msg;
    }

    // =========================================================================
    // BOOT
    // =========================================================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
