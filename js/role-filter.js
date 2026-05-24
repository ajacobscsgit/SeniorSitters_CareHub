/**
 * CareHub - Role-Based Data Filtering
 * =====================================
 * Centralised module that determines what data each role may see.
 *
 * Design principle:
 *   admin_owner / co_owner  → full unfiltered access
 *   caregiver               → only records where caregiver_id === their profile id
 *   client_family           → only records where client_id  === their linked client id
 *
 * This layer sits BETWEEN the raw Supabase results and the UI renderers.
 * When real Supabase RLS is deployed these client-side filters become a
 * redundant but harmless safety net.
 *
 * Dependencies (must load before this file):
 *   config.js  – window.ROLES
 *   auth.js    – window.getCurrentRole(), window.getSession()
 */

(function () {
    'use strict';

    // =========================================================================
    // INTERNAL HELPERS
    // =========================================================================

    /**
     * Return the current role string, or null if not authenticated.
     * @returns {string|null}
     */
    function _role() {
        return typeof window.getCurrentRole === 'function' ? window.getCurrentRole() : null;
    }

    /**
     * Return the raw session object stored by auth.js.
     * @returns {Object|null}
     */
    function _session() {
        return typeof window.getSession === 'function' ? window.getSession() : null;
    }

    /**
     * Return true when the current role has unrestricted data access.
     * @returns {boolean}
     */
    function _isFullAccess() {
        const r = _role();
        return r === window.ROLES.ADMIN_OWNER || r === window.ROLES.CO_OWNER;
    }

    // =========================================================================
    // PUBLIC: PROFILE RESOLUTION
    // =========================================================================

    /**
     * Return the whole session/user-profile object for the current user.
     * Contains: { email, role, name, caregiver_id?, client_id? }
     * @returns {Object|null}
     */
    function getCurrentUserProfile() {
        return _session();
    }

    /**
     * Return the caregiver_id stored in the session for the logged-in
     * caregiver user, or null for every other role.
     * @returns {string|null}
     */
    function getCurrentCaregiverId() {
        const session = _session();
        if (!session) return null;
        if (_role() !== window.ROLES.CAREGIVER) return null;
        return session.caregiver_id || null;
    }

    /**
     * Return the client_id stored in the session for the logged-in
     * client_family user, or null for every other role.
     * @returns {string|null}
     */
    function getCurrentClientId() {
        const session = _session();
        if (!session) return null;
        if (_role() !== window.ROLES.CLIENT_FAMILY) return null;
        return session.client_id || null;
    }

    // =========================================================================
    // PUBLIC: ASSIGNMENT CHECKS
    // =========================================================================

    /**
     * Is the currently logged-in caregiver assigned to this schedule?
     * Always returns false for non-caregiver roles.
     * @param {Object} schedule – must have caregiver_id field
     * @returns {boolean}
     */
    function isAssignedCaregiver(schedule) {
        if (!schedule) return false;
        if (_role() !== window.ROLES.CAREGIVER) return false;
        const cid = getCurrentCaregiverId();
        return cid ? String(schedule.caregiver_id) === String(cid) : false;
    }

    /**
     * Is the currently logged-in client_family linked to this schedule?
     * Always returns false for non-client_family roles.
     * @param {Object} schedule – must have client_id field
     * @returns {boolean}
     */
    function isAssignedClient(schedule) {
        if (!schedule) return false;
        if (_role() !== window.ROLES.CLIENT_FAMILY) return false;
        const clid = getCurrentClientId();
        return clid ? String(schedule.client_id) === String(clid) : false;
    }

    // =========================================================================
    // PUBLIC: RECORD-LEVEL PERMISSION CHECKS
    // =========================================================================

    /**
     * Can the current user see this schedule record?
     * @param {Object} schedule – must have caregiver_id and client_id fields
     * @returns {boolean}
     */
    function canViewSchedule(schedule) {
        if (!schedule) return false;
        if (_isFullAccess()) return true;

        const role = _role();

        if (role === window.ROLES.CAREGIVER) {
            const cid = getCurrentCaregiverId();
            return cid ? String(schedule.caregiver_id) === String(cid) : false;
        }

        if (role === window.ROLES.CLIENT_FAMILY) {
            const clid = getCurrentClientId();
            return clid ? String(schedule.client_id) === String(clid) : false;
        }

        return false;
    }

    /**
     * Can the current user see this timesheet record?
     * @param {Object} timesheet – must have caregiver_id and client_id fields
     * @returns {boolean}
     */
    function canViewTimesheet(timesheet) {
        if (!timesheet) return false;
        if (_isFullAccess()) return true;

        const role = _role();

        if (role === window.ROLES.CAREGIVER) {
            const cid = getCurrentCaregiverId();
            return cid ? String(timesheet.caregiver_id) === String(cid) : false;
        }

        // client_family cannot see timesheets (internal payroll document)
        return false;
    }

    /**
     * Can the current user see this visit-update record?
     *
     * Additional rule: client_family can only see updates that are NOT
     * internal_only – i.e. status is 'approved' or 'submitted'.
     *
     * @param {Object} update – must have caregiver_id, client_id, status fields
     * @returns {boolean}
     */
    function canViewVisitUpdate(update) {
        if (!update) return false;
        if (_isFullAccess()) return true;

        const role = _role();

        if (role === window.ROLES.CAREGIVER) {
            const cid = getCurrentCaregiverId();
            return cid ? String(update.caregiver_id) === String(cid) : false;
        }

        if (role === window.ROLES.CLIENT_FAMILY) {
            const clid = getCurrentClientId();
            if (!clid) return false;
            if (String(update.client_id) !== String(clid)) return false;
            // Hide internal-only and rejected updates from families
            const hiddenStatuses = ['internal_only', 'rejected', 'draft'];
            return !hiddenStatuses.includes(update.status);
        }

        return false;
    }

    /**
     * Can the current user see this caregiver record?
     * Caregivers can only see their own profile; families cannot see any.
     * @param {Object} caregiver – must have id field
     * @returns {boolean}
     */
    function canViewCaregiver(caregiver) {
        if (!caregiver) return false;
        if (_isFullAccess()) return true;

        const role = _role();

        if (role === window.ROLES.CAREGIVER) {
            const cid = getCurrentCaregiverId();
            return cid ? String(caregiver.id) === String(cid) : false;
        }

        // client_family: show the caregiver(s) assigned to their client's schedule
        // We cannot determine that from the record alone here, so we return true
        // and let the list-level filter (filterRecordsByRole) handle it.
        if (role === window.ROLES.CLIENT_FAMILY) {
            return true; // filtered at list level via assigned schedules
        }

        return false;
    }

    /**
     * Can the current user see this client record?
     * Caregivers see clients they have a schedule with; families see only their own.
     * @param {Object} client – must have id field
     * @returns {boolean}
     */
    function canViewClient(client) {
        if (!client) return false;
        if (_isFullAccess()) return true;

        const role = _role();

        if (role === window.ROLES.CAREGIVER) {
            // Allow: caregiver sees clients on their schedules.
            // We cannot resolve that without the schedule list here,
            // so we pass true and rely on filterClientsByRole for the real cut.
            return true;
        }

        if (role === window.ROLES.CLIENT_FAMILY) {
            const clid = getCurrentClientId();
            return clid ? String(client.id) === String(clid) : false;
        }

        return false;
    }

    // =========================================================================
    // PUBLIC: BATCH FILTERS
    // =========================================================================

    /**
     * Generic batch filter. Dispatches to the appropriate per-type function.
     *
     * @param {Array}  records  – raw records from Supabase
     * @param {string} type     – 'schedules' | 'timesheets' | 'visit_updates' |
     *                            'clients' | 'caregivers' | 'activity' | 'alerts'
     * @param {Object} [ctx]    – optional context (e.g. { assignedClientIds, assignedCaregiverIds })
     * @returns {Array}
     */
    function filterRecordsByRole(records, type, ctx = {}) {
        if (!Array.isArray(records)) return [];
        if (_isFullAccess()) return records;

        switch (type) {
            case 'schedules':       return records.filter(r => canViewSchedule(r));
            case 'timesheets':      return records.filter(r => canViewTimesheet(r));
            case 'visit_updates':   return records.filter(r => canViewVisitUpdate(r));
            case 'clients':         return _filterClients(records, ctx);
            case 'caregivers':      return _filterCaregivers(records, ctx);
            case 'activity':        return _filterActivity(records);
            case 'alerts':          return _filterAlerts(records);
            default:                return records;
        }
    }

    /**
     * Filter clients list.
     * - caregiver → only clients linked via their schedules (needs ctx.assignedClientIds)
     * - client_family → only their own client
     */
    function _filterClients(clients, ctx) {
        const role = _role();

        if (role === window.ROLES.CAREGIVER) {
            const ids = ctx.assignedClientIds || [];
            if (ids.length === 0) return [];
            return clients.filter(c => ids.map(String).includes(String(c.id)));
        }

        if (role === window.ROLES.CLIENT_FAMILY) {
            const clid = getCurrentClientId();
            if (!clid) return [];
            return clients.filter(c => String(c.id) === String(clid));
        }

        return [];
    }

    /**
     * Filter caregivers list.
     * - caregiver → only their own profile
     * - client_family → only caregivers assigned to their client's schedules
     *                   (needs ctx.assignedCaregiverIds)
     */
    function _filterCaregivers(caregivers, ctx) {
        const role = _role();

        if (role === window.ROLES.CAREGIVER) {
            const cid = getCurrentCaregiverId();
            if (!cid) return [];
            return caregivers.filter(cg => String(cg.id) === String(cid));
        }

        if (role === window.ROLES.CLIENT_FAMILY) {
            const ids = ctx.assignedCaregiverIds || [];
            if (ids.length === 0) return [];
            return caregivers.filter(cg => ids.map(String).includes(String(cg.id)));
        }

        return [];
    }

    /**
     * Filter recent-activity feed.
     * Caregivers see activities related to their own timesheets / schedules.
     * Families see activities related to their client's schedules / visit updates.
     * Both roles can see generic system events (new application etc.) that are not
     * personal – those are hidden entirely since they are admin-facing.
     */
    function _filterActivity(activities) {
        const role = _role();

        if (role === window.ROLES.CAREGIVER) {
            const cid = getCurrentCaregiverId();
            if (!cid) return [];
            const caregiverTypes = ['timesheet_approved', 'timesheet_rejected', 'visit_completed', 'visit_cancelled'];
            return activities.filter(a => {
                if (!caregiverTypes.includes(a.type)) return false;
                // Only include if caregiver_id explicitly matches (never leak no-id records)
                return a.caregiver_id && String(a.caregiver_id) === String(cid);
            });
        }

        if (role === window.ROLES.CLIENT_FAMILY) {
            const clid = getCurrentClientId();
            if (!clid) return [];
            const familyTypes = ['visit_completed', 'visit_update_approved'];
            return activities.filter(a => {
                if (!familyTypes.includes(a.type)) return false;
                // Only include if client_id explicitly matches
                return a.client_id && String(a.client_id) === String(clid);
            });
        }

        return [];
    }

    /**
     * Filter dashboard alerts.
     * - caregivers see: upcoming visits without notes, rejected timesheets
     * - families see: upcoming approved visits for their loved one
     * Admin-only alerts (unassigned visits, pending applications) are stripped.
     */
    function _filterAlerts(alerts) {
        const role = _role();

        if (role === window.ROLES.CAREGIVER) {
            const allowed = ['rejected_timesheet', 'upcoming_visit', 'visit_no_show'];
            return alerts.filter(a => allowed.includes(a.type));
        }

        if (role === window.ROLES.CLIENT_FAMILY) {
            const allowed = ['upcoming_visit'];
            return alerts.filter(a => {
                if (!allowed.includes(a.type)) return false;
                const clid = getCurrentClientId();
                if (a.client_id && clid) return String(a.client_id) === String(clid);
                return false;
            });
        }

        return [];
    }

    // =========================================================================
    // PUBLIC: QUERY FILTER BUILDER
    // =========================================================================

    /**
     * Build a partial filters object suitable for passing directly to
     * getSchedules(), getTimesheets(), or getVisitUpdates() so that
     * Supabase does the heavy lifting at the query level instead of
     * post-filtering in JS.
     *
     * @param {'schedules'|'timesheets'|'visit_updates'} type
     * @returns {Object}  e.g. { caregiver_id: 'abc' } or {}
     */
    function buildQueryFilters(type) {
        if (_isFullAccess()) return {};

        const role = _role();

        if (role === window.ROLES.CAREGIVER) {
            const cid = getCurrentCaregiverId();
            if (!cid) return { caregiver_id: '__none__' }; // return nothing
            if (['schedules', 'timesheets', 'visit_updates'].includes(type)) {
                return { caregiver_id: cid };
            }
        }

        if (role === window.ROLES.CLIENT_FAMILY) {
            const clid = getCurrentClientId();
            if (!clid) return { client_id: '__none__' };
            if (['schedules', 'visit_updates'].includes(type)) {
                return { client_id: clid };
            }
            // timesheets: families cannot access at all
            if (type === 'timesheets') return { client_id: '__none__' };
        }

        return {};
    }

    /**
     * Build query filters for getSchedulesForMonth() which only accepts date
     * range but we can still inject caregiver/client id when available.
     * Returns an object to spread alongside date params.
     * @returns {Object}
     */
    function buildCalendarQueryFilters() {
        return buildQueryFilters('schedules');
    }

    // =========================================================================
    // PUBLIC: DASHBOARD STATS SCOPING
    // =========================================================================

    /**
     * For non-admin roles, replace the full global stats object with a
     * role-scoped version so KPI cards only reflect the user's own data.
     *
     * Full-access roles return the raw stats unchanged.
     *
     * @param {Object} stats      – raw stats from getDashboardStats()
     * @param {Array}  schedules  – today's schedule (already filtered)
     * @param {Array}  timesheets – all timesheets for this user (already filtered)
     * @param {Array}  updates    – all visit updates for this user (already filtered)
     * @returns {Object}
     */
    function scopeDashboardStats(stats, schedules = [], timesheets = [], updates = []) {
        if (_isFullAccess()) return stats;

        const role = _role();

        if (role === window.ROLES.CAREGIVER) {
            return {
                todaysVisits: schedules.filter(s => s.status !== 'cancelled').length,
                pendingTimesheets: timesheets.filter(t => t.status === 'pending').length,
                pendingVisitUpdates: updates.filter(u => u.status === 'pending' || u.status === 'submitted').length,
                completedVisits: schedules.filter(s => s.status === 'completed').length
            };
        }

        if (role === window.ROLES.CLIENT_FAMILY) {
            return {
                todaysVisits: schedules.filter(s => s.status !== 'cancelled').length,
                upcomingVisits: schedules.filter(s => s.status === 'scheduled').length,
                approvedUpdates: updates.filter(u => u.status === 'approved').length
            };
        }

        return stats;
    }

    // =========================================================================
    // EXPOSE GLOBALLY
    // =========================================================================

    window.RoleFilter = {
        // Profile helpers
        getCurrentUserProfile,
        getCurrentCaregiverId,
        getCurrentClientId,

        // Assignment checks
        isAssignedCaregiver,
        isAssignedClient,

        // Permission checks
        canViewSchedule,
        canViewTimesheet,
        canViewVisitUpdate,
        canViewCaregiver,
        canViewClient,

        // Batch filters
        filterRecordsByRole,

        // Query filter builders (pass to DB functions directly)
        buildQueryFilters,
        buildCalendarQueryFilters,

        // Dashboard scoping
        scopeDashboardStats,

        // Internal helpers exposed for testing
        _isFullAccess
    };

})();
