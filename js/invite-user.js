/**
 * CareHub — Invite User Module
 * =============================
 * Provides the invite form UI and submit logic used in the Settings page.
 *
 * Permission matrix:
 *   admin_owner → can invite: co_owner, caregiver, client_family
 *   co_owner    → can invite: caregiver, client_family
 *   caregiver   → cannot invite anyone
 *   client_family → cannot invite anyone
 *
 * Wiring:
 *   renderSettings() in app.js calls CareHubInvite.renderInviteSection(containerEl)
 *   to inject the invite card into the Settings page.
 *
 * Dependencies:
 *   supabase-auth.js  (window.SupabaseAuth.inviteUser)
 *   auth.js           (window.getSession, window.getCurrentRole)
 *   toast.js          (window.CareHubToast)
 */

(function () {
    'use strict';

    // =========================================================================
    // CONSTANTS
    // =========================================================================

    const ROLE_LABELS = {
        co_owner:      'Co-Owner',
        caregiver:     'Caregiver',
        client_family: 'Client / Family'
    };

    const ROLE_DESCRIPTIONS = {
        co_owner:      'Full admin access except cannot manage other owners.',
        caregiver:     'Can view assigned schedules, submit timesheets, and post visit updates.',
        client_family: 'Can view their own schedules and approved visit updates.'
    };

    // Roles each caller level may invite
    const CAN_INVITE = {
        admin_owner:   ['co_owner', 'caregiver', 'client_family'],
        co_owner:      ['caregiver', 'client_family'],
        caregiver:     [],
        client_family: []
    };

    // =========================================================================
    // MAIN RENDER
    // =========================================================================

    /**
     * Render the invite section into the given container element.
     * Call from renderSettings() after the container is in the DOM.
     *
     * @param {HTMLElement} container  - element to inject the invite card into
     */
    function renderInviteSection(container) {
        if (!container) return;

        const role = typeof window.getCurrentRole === 'function'
            ? window.getCurrentRole()
            : null;

        const allowedRoles = CAN_INVITE[role] || [];

        if (allowedRoles.length === 0) {
            // Non-admin roles: render nothing
            return;
        }

        const edgeDeployed = !!(
            window.CAREHUB_CONFIG &&
            window.CAREHUB_CONFIG.EDGE_FUNCTION_DEPLOYED === true
        );

        const roleOptions = allowedRoles.map(r =>
            `<option value="${r}">${ROLE_LABELS[r]}</option>`
        ).join('');

        container.innerHTML = `
            <div class="card" id="inviteUserCard">
                <div class="card-header">
                    <span class="card-title">
                        <i class="ph ph-user-plus" style="margin-right:6px;"></i>
                        Invite Team Member
                    </span>
                    <span class="card-subtitle">Send an account invite to a new CareHub user</span>
                </div>
                <div class="card-body">

                    ${!edgeDeployed ? `
                    <div class="invite-notice" id="edgeFunctionNotice">
                        <div class="invite-notice-icon">
                            <i class="ph ph-warning"></i>
                        </div>
                        <div class="invite-notice-body">
                            <strong>Invite emails not yet active.</strong>
                            The Edge Function has not been deployed. Submitting this form will
                            queue the invite (status: <code>pending_invite</code>) but
                            <strong>will not send an email</strong>.
                            See <code>ACCOUNT_CREATION_FLOW.md</code> for deployment steps.
                        </div>
                    </div>
                    ` : ''}

                    <form id="inviteUserForm" class="invite-form" novalidate autocomplete="off">

                        <div class="invite-form-grid">

                            <div class="form-field">
                                <label for="inviteFullName">Full name <span class="required">*</span></label>
                                <div class="input-row">
                                    <span class="input-icon"><i class="ph ph-user"></i></span>
                                    <input type="text" id="inviteFullName" class="form-input"
                                           placeholder="Jane Doe" maxlength="100" required>
                                </div>
                            </div>

                            <div class="form-field">
                                <label for="inviteEmail">Email address <span class="required">*</span></label>
                                <div class="input-row">
                                    <span class="input-icon"><i class="ph ph-envelope"></i></span>
                                    <input type="email" id="inviteEmail" class="form-input"
                                           placeholder="user@example.com" maxlength="254" required>
                                </div>
                            </div>

                            <div class="form-field">
                                <label for="inviteRole">Role <span class="required">*</span></label>
                                <div class="input-row">
                                    <span class="input-icon"><i class="ph ph-identification-badge"></i></span>
                                    <select id="inviteRole" class="form-input form-select" required>
                                        <option value="">— Select role —</option>
                                        ${roleOptions}
                                    </select>
                                </div>
                                <div class="role-description" id="roleDescription"></div>
                            </div>

                        </div><!-- /.invite-form-grid -->

                        <div class="invite-alert" id="inviteAlert" style="display:none;" role="alert"></div>

                        <div class="invite-form-footer">
                            <div class="invite-permission-note" id="invitePermNote">
                                ${_permissionNote(role)}
                            </div>
                            <button type="submit" class="btn btn-primary" id="inviteSubmitBtn">
                                <i class="ph ph-paper-plane-tilt"></i>
                                ${edgeDeployed ? 'Send Invite' : 'Queue Invite'}
                            </button>
                        </div>

                    </form>

                    <!-- Pending invites list -->
                    <div id="pendingInvitesList" style="margin-top:24px;"></div>

                </div>
            </div>
        `;

        _bindFormEvents();
        _loadPendingInvites();
    }

    // =========================================================================
    // RATE-LIMIT COUNTDOWN
    // =========================================================================

    /**
     * Disable a button for `seconds` seconds, showing a live countdown.
     * Re-enables and restores original label when the timer expires.
     *
     * @param {HTMLElement} btn
     * @param {number}      seconds   60–120 recommended
     * @param {string}      restoreLabel  HTML to restore on the button when done
     */
    function _rateLimitCountdown(btn, seconds, restoreLabel) {
        if (!btn) return;
        btn.disabled = true;
        let remaining = seconds;

        function tick() {
            btn.innerHTML =
                `<i class="ph ph-clock"></i> Wait ${remaining}s before retrying`;
            if (remaining <= 0) {
                btn.disabled = false;
                btn.innerHTML = restoreLabel;
                return;
            }
            remaining--;
            setTimeout(tick, 1000);
        }
        tick();
    }

    // =========================================================================
    // FORM EVENTS
    // =========================================================================

    function _bindFormEvents() {
        const form      = document.getElementById('inviteUserForm');
        const roleSelect = document.getElementById('inviteRole');

        if (!form || !roleSelect) return;

        // Live role description
        roleSelect.addEventListener('change', function () {
            const desc = document.getElementById('roleDescription');
            if (desc) {
                desc.textContent = ROLE_DESCRIPTIONS[this.value] || '';
                desc.style.display = this.value ? 'block' : 'none';
            }
        });

        // Form submit
        form.addEventListener('submit', async function (e) {
            e.preventDefault();
            await _handleSubmit();
        });
    }

    async function _handleSubmit() {
        const fullNameEl = document.getElementById('inviteFullName');
        const emailEl    = document.getElementById('inviteEmail');
        const roleEl     = document.getElementById('inviteRole');
        const submitBtn  = document.getElementById('inviteSubmitBtn');

        _hideAlert();

        const full_name = (fullNameEl?.value || '').trim();
        const email     = (emailEl?.value    || '').trim().toLowerCase();
        const role      = (roleEl?.value     || '').trim();

        // ── Client-side validation ────────────────────────────────────────────
        if (!full_name) {
            _showAlert('Full name is required.', 'error');
            fullNameEl?.focus();
            return;
        }
        if (!email) {
            _showAlert('Email address is required.', 'error');
            emailEl?.focus();
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            _showAlert('Please enter a valid email address.', 'error');
            emailEl?.focus();
            return;
        }
        if (!role) {
            _showAlert('Please select a role.', 'error');
            roleEl?.focus();
            return;
        }

        // ── Permission check (frontend guard) ────────────────────────────────
        const callerRole   = typeof window.getCurrentRole === 'function' ? window.getCurrentRole() : null;
        const allowedRoles = CAN_INVITE[callerRole] || [];
        if (!allowedRoles.includes(role)) {
            _showAlert('Your role does not have permission to invite a ' + (ROLE_LABELS[role] || role) + '.', 'error');
            return;
        }

        // ── Check SupabaseAuth is available ───────────────────────────────────
        if (!window.SupabaseAuth) {
            _showAlert('Auth system not ready. Please reload the page.', 'error');
            return;
        }

        // ── Loading state ─────────────────────────────────────────────────────
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="btn-spinner-sm"></span> Sending\u2026';
        }

        try {
            const result = await window.SupabaseAuth.inviteUser({
                email,
                role,
                full_name,
                caregiver_id: null,
                client_id:    null
            });

            if (result.success) {
                _showAlert(
                    `Invite sent to <strong>${_esc(email)}</strong> as ${ROLE_LABELS[role]}.`,
                    'success'
                );
                _resetForm();
                await _loadPendingInvites();
                if (window.CareHubToast) {
                    CareHubToast.success(`Invite sent to ${email}`);
                }
            } else if (result.pending) {
                // Edge Function not yet deployed — queued successfully
                _showAlert(
                    `Invite queued for <strong>${_esc(email)}</strong> as ${ROLE_LABELS[role]}. ` +
                    `No email will be sent until the Edge Function is deployed.`,
                    'warning'
                );
                _resetForm();
                await _loadPendingInvites();
            } else if (result.code === 'RATE_LIMIT') {
                _showAlert(
                    'Too many email links were sent. Please wait before trying again.',
                    'error'
                );
                const edgeDeployed = !!(window.CAREHUB_CONFIG?.EDGE_FUNCTION_DEPLOYED);
                const btnLabel = `<i class="ph ph-paper-plane-tilt"></i> ${edgeDeployed ? 'Send Invite' : 'Queue Invite'}`;
                _rateLimitCountdown(submitBtn, 120, btnLabel);
                return; // skip the finally re-enable
            } else if (result.code === 'EMAIL_EXISTS') {
                _showAlert(
                    `<strong>${_esc(email)}</strong> already has a CareHub account or pending invite.`,
                    'error'
                );
            } else if (result.code === 'INSERT_FAILED') {
                _showAlert(
                    (result.error || 'Failed to queue the invite.') +
                    ' Check that the <code>pending_invites</code> table exists and RLS policies are applied.',
                    'error'
                );
            } else {
                _showAlert(result.error || 'Invite failed. Please try again.', 'error');
            }
        } catch (err) {
            if (window.DEBUG === true) console.error('[CareHubInvite] Unexpected error:', err);
            _showAlert('An unexpected error occurred. Please try again.', 'error');
        } finally {
            // Only restore the button if _rateLimitCountdown() hasn't already taken over
            if (submitBtn && submitBtn.disabled && !submitBtn.innerHTML.includes('Wait')) {
                const edgeDeployed = !!(window.CAREHUB_CONFIG?.EDGE_FUNCTION_DEPLOYED);
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="ph ph-paper-plane-tilt"></i> ${edgeDeployed ? 'Send Invite' : 'Queue Invite'}`;
            }
        }
    }

    // =========================================================================
    // PENDING INVITES LIST
    // =========================================================================

    async function _loadPendingInvites() {
        const container = document.getElementById('pendingInvitesList');
        if (!container) return;

        // Only load if Supabase is available (not in DEV_MODE mock-only)
        if (!window.carehubSupabase && !window.supabase) {
            container.innerHTML = '';
            return;
        }

        const db = window.carehubSupabase || (
            window.supabase && window.CAREHUB_CONFIG
                ? window.supabase.createClient(window.CAREHUB_CONFIG.SUPABASE_URL, window.CAREHUB_CONFIG.SUPABASE_ANON_KEY)
                : null
        );

        if (!db) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = `<div style="color:var(--warm-muted);font-size:13px;">Loading pending invites\u2026</div>`;

        // Read from pending_invites — dedicated staging table with its own RLS.
        // profiles is NOT queried here; it only ever contains real auth users.
        const { data, error } = await db
            .from('pending_invites')
            .select('id, email, full_name, role, status, created_at')
            .in('status', ['pending', 'sent'])
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            if (window.DEBUG === true) console.warn('[CareHubInvite] pending_invites load error:', error.message);
            container.innerHTML = '';
            return;
        }

        if (!data || data.length === 0) {
            container.innerHTML = '';
            return;
        }

        const STATUS_LABELS  = { pending: 'Queued', sent: 'Sent', cancelled: 'Cancelled' };
        const STATUS_CLASSES = { pending: 'status-pending', sent: 'status-approved', cancelled: 'status-denied' };

        const rows = data.map(p => `
            <tr>
                <td>${_esc(p.full_name || '—')}</td>
                <td>${_esc(p.email)}</td>
                <td><span class="role-badge role-${(p.role || '').replace('_','-')}">${ROLE_LABELS[p.role] || p.role}</span></td>
                <td>${_formatDate(p.created_at)}</td>
                <td><span class="status-badge ${STATUS_CLASSES[p.status] || 'status-pending'}">${STATUS_LABELS[p.status] || p.status}</span></td>
            </tr>
        `).join('');

        container.innerHTML = `
            <div class="card-sub-section">
                <div class="card-sub-header">
                    <i class="ph ph-clock" style="margin-right:6px;color:var(--warm-accent);"></i>
                    Pending Invites (${data.length})
                </div>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Queued</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // =========================================================================
    // UI HELPERS
    // =========================================================================

    function _showAlert(html, type) {
        const el = document.getElementById('inviteAlert');
        if (!el) return;
        const icon = type === 'success'
            ? '<i class="ph ph-check-circle"></i>'
            : type === 'warning'
                ? '<i class="ph ph-warning"></i>'
                : '<i class="ph ph-x-circle"></i>';
        el.className = `invite-alert invite-alert-${type}`;
        el.innerHTML = `<span class="invite-alert-icon">${icon}</span><span>${html}</span>`;
        el.style.display = 'flex';
    }

    function _hideAlert() {
        const el = document.getElementById('inviteAlert');
        if (el) { el.style.display = 'none'; el.className = 'invite-alert'; el.innerHTML = ''; }
    }

    function _resetForm() {
        const form = document.getElementById('inviteUserForm');
        if (form) form.reset();
        const desc = document.getElementById('roleDescription');
        if (desc) { desc.textContent = ''; desc.style.display = 'none'; }
    }

    function _permissionNote(role) {
        const allowed = CAN_INVITE[role] || [];
        if (allowed.length === 0) return '';
        const names = allowed.map(r => ROLE_LABELS[r]).join(', ');
        return `<i class="ph ph-info"></i> As ${_roleName(role)}, you can invite: ${names}.`;
    }

    function _roleName(role) {
        const map = { admin_owner: 'Admin/Owner', co_owner: 'Co-Owner', caregiver: 'Caregiver', client_family: 'Client/Family' };
        return map[role] || role;
    }

    function _esc(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function _formatDate(iso) {
        if (!iso) return '—';
        try {
            return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch { return iso; }
    }

    // =========================================================================
    // GLOBAL EXPORT
    // =========================================================================

    window.CareHubInvite = {
        renderInviteSection,
        loadPendingInvites: _loadPendingInvites
    };

})();
