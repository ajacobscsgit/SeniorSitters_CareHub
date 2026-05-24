# CareHub – Role-Based Data Filtering

**Implemented:** May 24, 2026  
**Updated:** Phase 2 — Relationship-Based Access complete  
**Module:** `js/role-filter.js`, `js/database.js`, `js/auth.js`  
**Status:** Frontend filtering + DB query scoping complete. Supabase RLS pending.

---

## Overview

Every database call now respects the current user's role. Filtering is applied
at **two levels**:

1. **Query level** – Supabase `WHERE` clauses injected before the request is
   sent, so the database only returns rows the user is allowed to see.
2. **JS safety net** – Post-fetch `Array.filter()` using `canView*()` helpers,
   catching any edge cases the query filter may miss.

This two-layer approach ensures correctness today and makes it trivial to add
Supabase Row Level Security (RLS) later — the client-side filters become
redundant but harmless.

---

## Access Matrix

| Data Type       | admin_owner | co_owner | caregiver         | client_family         |
|-----------------|:-----------:|:--------:|:-----------------:|:---------------------:|
| Applications    | All         | All      | Hidden            | Hidden                |
| Care Requests   | All         | All      | Hidden            | Hidden                |
| Caregivers      | All         | All      | Own profile only  | Assigned to them only |
| Clients         | All         | All      | Assigned only     | Own profile only      |
| Schedules       | All         | All      | Own caregiver_id  | Own client_id         |
| Timesheets      | All         | All      | Own caregiver_id  | Hidden                |
| Visit Updates   | All         | All      | Own caregiver_id  | Own client_id (approved/submitted only) |
| Dashboard Stats | Global KPIs | Global   | Personal counts   | Personal counts       |
| Alerts          | All types   | All      | Own rejected TS + today's visits | Upcoming visits only |
| Recent Activity | All types   | All      | Own TS + visits   | Own visit updates     |
| Calendar        | All visits  | All      | Own schedule      | Own loved one's schedule |

---

## Architecture

### `js/role-filter.js`

Central module exposing `window.RoleFilter`. Loaded after `auth.js`,
before `database.js`.

```
config.js → auth.js → role-filter.js → database.js → app.js
```

#### Key Functions

```js
// Identity resolution
RoleFilter.getCurrentUserProfile()   // Full session object
RoleFilter.getCurrentCaregiverId()   // caregiver_id from session (caregiver role only)
RoleFilter.getCurrentClientId()      // client_id from session (client_family role only)

// Permission checks (single record)
RoleFilter.canViewSchedule(schedule)
RoleFilter.canViewTimesheet(timesheet)
RoleFilter.canViewVisitUpdate(update)
RoleFilter.canViewCaregiver(caregiver)
RoleFilter.canViewClient(client)

// Batch filters (array of records)
RoleFilter.filterRecordsByRole(records, type, ctx)
// type: 'schedules' | 'timesheets' | 'visit_updates' | 'clients' | 'caregivers' | 'activity' | 'alerts'
// ctx: { assignedClientIds?, assignedCaregiverIds? } — for resolving cross-table relationships

// Query filter builder (inject into DB functions)
RoleFilter.buildQueryFilters('schedules')   // → { caregiver_id: 'abc' } or { client_id: 'xyz' } or {}
RoleFilter.buildCalendarQueryFilters()      // Same as above but for calendar queries

// Dashboard stats scoping
RoleFilter.scopeDashboardStats(rawStats, schedules, timesheets, updates)
// Returns personal counts for caregiver/family; full global counts for admins
```

---

## Database Functions Modified

| Function | Change |
|----------|--------|
| `getSchedules()` | Merges `buildQueryFilters('schedules')` into query |
| `getSchedulesForMonth()` | Merges `buildCalendarQueryFilters()` |
| `getTodaysSchedule()` | Injects caregiver_id or client_id filter |
| `getTimesheets()` | Merges `buildQueryFilters('timesheets')`; blocks client_family entirely |
| `getVisitUpdates()` | Merges `buildQueryFilters('visit_updates')`; strips internal_only for families; JS safety net applied |
| `getRecentActivity()` | Skips admin tables for restricted roles; scopes timesheets/schedules/updates queries |
| `getDashboardAlerts()` | Three branches: admin (full), caregiver (own TS + today's visits), client_family (upcoming visits) |

---

## App.js Functions Modified

| Function | Change |
|----------|--------|
| `renderDashboard()` | Passes stats through `scopeDashboardStats()` before rendering KPIs |
| `loadCaregivers()` | Resolves assigned caregiver IDs for client_family; applies `filterRecordsByRole('caregivers')` |
| `loadClients()` | Resolves assigned client IDs for caregiver; applies `filterRecordsByRole('clients')` |

---

## Session Structure

`auth.js` now stores these fields in `localStorage`:

```json
{
  "email": "caregiver@seniorsittersco.com",
  "role": "caregiver",
  "name": "Jane Caregiver",
  "caregiver_id": "uuid-from-caregivers-table",
  "client_id": null,
  "timestamp": 1234567890000
}
```

- `caregiver_id` is used by `RoleFilter.getCurrentCaregiverId()` for caregiver filtering.
- `client_id` is used by `RoleFilter.getCurrentClientId()` for family filtering.

### Setting IDs for Production

When real Supabase auth is implemented, update `auth.js` `login()` to:

```js
// After Supabase login, look up the linked profile:
const { data: caregiver } = await supabaseClient
    .from('caregivers')
    .select('id')
    .eq('auth_user_id', supabaseUser.id)
    .single();

session.caregiver_id = caregiver?.id || null;
```

For demo/testing, set IDs directly in `config.js` `DEMO_USERS`:

```js
'caregiver@seniorsittersco.com': {
    password: 'demo123',
    role: 'caregiver',
    name: 'Jane Caregiver',
    caregiver_id: 'PASTE-UUID-FROM-CAREGIVERS-TABLE-HERE',
    client_id: null
}
```

---

## Visit Update Visibility Rules

| Status          | admin_owner | co_owner | caregiver (own) | client_family (linked) |
|-----------------|:-----------:|:--------:|:---------------:|:----------------------:|
| `draft`         | Visible     | Visible  | Visible         | **Hidden**             |
| `submitted`     | Visible     | Visible  | Visible         | Visible                |
| `approved`      | Visible     | Visible  | Visible         | Visible                |
| `internal_only` | Visible     | Visible  | Visible         | **Hidden**             |
| `rejected`      | Visible     | Visible  | Visible         | **Hidden**             |

---

## Supabase RLS Migration Guide

When ready to enforce security at the database level, add these RLS policies.
The client-side filters will remain as a UX layer (showing the right UI) while
RLS enforces actual data security.

### `schedules` table

```sql
-- Admins see all
CREATE POLICY "admins_all_schedules" ON schedules
  FOR ALL USING (auth.jwt() ->> 'role' IN ('admin_owner', 'co_owner'));

-- Caregivers see own
CREATE POLICY "caregiver_own_schedules" ON schedules
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'caregiver'
    AND caregiver_id = (
      SELECT id FROM caregivers WHERE auth_user_id = auth.uid()
    )
  );

-- Families see their client's schedules
CREATE POLICY "family_client_schedules" ON schedules
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'client_family'
    AND client_id = (
      SELECT id FROM clients WHERE auth_user_id = auth.uid()
    )
  );
```

### `timesheets` table

```sql
-- Admins see all
CREATE POLICY "admins_all_timesheets" ON timesheets
  FOR ALL USING (auth.jwt() ->> 'role' IN ('admin_owner', 'co_owner'));

-- Caregivers see own
CREATE POLICY "caregiver_own_timesheets" ON timesheets
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'caregiver'
    AND caregiver_id = (
      SELECT id FROM caregivers WHERE auth_user_id = auth.uid()
    )
  );

-- client_family: NO policy = no access (default deny)
```

### `visit_updates` table

```sql
-- Admins see all
CREATE POLICY "admins_all_visit_updates" ON visit_updates
  FOR ALL USING (auth.jwt() ->> 'role' IN ('admin_owner', 'co_owner'));

-- Caregivers see own
CREATE POLICY "caregiver_own_visit_updates" ON visit_updates
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'caregiver'
    AND caregiver_id = (SELECT id FROM caregivers WHERE auth_user_id = auth.uid())
  );

-- Families see only approved/submitted for their client
CREATE POLICY "family_approved_visit_updates" ON visit_updates
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'client_family'
    AND client_id = (SELECT id FROM clients WHERE auth_user_id = auth.uid())
    AND status NOT IN ('internal_only', 'rejected', 'draft')
  );
```

---

## Testing

To test filtering with real Supabase data:

1. Open `js/config.js`
2. Find `DEMO_USERS`
3. Set `caregiver_id` to a real UUID from your `caregivers` table
4. Set `client_id` to a real UUID from your `clients` table
5. Login as `caregiver@seniorsittersco.com` — should only see own records
6. Login as `family@seniorsittersco.com` — should only see linked client's approved data

For now (no real IDs set), caregiver and client_family will see **empty lists**
because `caregiver_id: null` causes `buildQueryFilters` to return `{ caregiver_id: '__none__' }`
which short-circuits to an empty array.

---

## Phase 2 Additions (May 2026)

### New helpers in `role-filter.js`

```js
// Check if the current caregiver is assigned to a specific schedule
RoleFilter.isAssignedCaregiver(schedule)  // → boolean

// Check if the current client_family is linked to a specific schedule
RoleFilter.isAssignedClient(schedule)     // → boolean
```

### `getDashboardStats()` — role-scoped

`database.js` `getDashboardStats()` now has three execution paths:

- **`admin_owner` / `co_owner`**: unchanged — runs all 13 parallel count queries
- **`caregiver`**: runs 4 queries scoped to `caregiver_id`:
  - today's visits, pending timesheets, pending/submitted updates, rejected timesheets
- **`client_family`**: runs 3 queries scoped to `client_id`:
  - today's visits, upcoming visits, approved updates

### `getCaregivers()` — role-scoped at DB level

- **`caregiver`**: single-row query `WHERE id = caregiverId` — returns only own profile
- **`client_family`**: fetches all (app.js `loadCaregivers()` then narrows to assigned IDs)
- **`admin/co_owner`**: unchanged full fetch

### `getClients()` — role-scoped at DB level

- **`client_family`**: single-row query `WHERE id = clientId` — returns only own record
- **`caregiver`**: fetches all (app.js `loadClients()` then narrows to assigned IDs)
- **`admin/co_owner`**: unchanged full fetch

### `getUnreadNotifications()` — role-scoped

- **`caregiver`**: Supabase OR filter: `caregiver_id = X OR related_type = 'caregiver'`
- **`client_family`**: Supabase OR filter: `client_id = X OR related_type = 'client'`
- JS safety net applied as second pass to eliminate any edge-case leakage

### `resolveUserIds()` in `auth.js`

Called on app init (`initApp()`). Looks up `caregiver_id` or `client_id` from
Supabase by matching `email = session.email`. Patches the localStorage session
so all subsequent queries are correctly scoped without requiring re-login.

```
Login → session stored (possibly no IDs) → resolveUserIds() runs async
     → session patched with real IDs → all DB calls now filtered correctly
```

---

## Phase 3 — Hardening Audit & Test Results (May 2026)

### Test Matrix

| Test | admin_owner | co_owner | caregiver | client_family |
|---|:---:|:---:|:---:|:---:|
| Dashboard loads without errors | ✓ | ✓ | ✓ | ✓ |
| KPI cards show correct set | ✓ (7) | ✓ (7) | ✓ (4) | ✓ (3) |
| Today's Schedule scoped correctly | ✓ all | ✓ all | ✓ own | ✓ own client |
| Recent Activity scoped correctly | ✓ all | ✓ all | ✓ own | ✓ own client |
| Alerts scoped correctly | ✓ all | ✓ all | ✓ own | ✓ own client |
| Schedules list/calendar scoped | ✓ all | ✓ all | ✓ own | ✓ own client |
| Timesheets visible | ✓ all | ✓ all | ✓ own | ✗ blocked |
| Visit Updates (internal_only) | ✓ visible | ✓ visible | ✓ own only | ✗ hidden |
| Visit Updates (draft/rejected) | ✓ visible | ✓ visible | ✓ own only | ✗ hidden |
| Caregivers list scoped | ✓ all | ✓ all | ✓ own row | ✓ assigned only |
| Clients list scoped | ✓ all | ✓ all | ✓ assigned | ✓ own row |
| Onboarding widget visible | ✓ | ✓ | ✗ hidden | ✗ hidden |
| Reassignment: old caregiver loses access | ✓ (DB filter) | n/a | ✓ | n/a |
| Reassignment: new caregiver gains access | ✓ (DB filter) | n/a | ✓ | n/a |
| Reassignment: client unaffected | n/a | n/a | n/a | ✓ |

### Gaps Found and Fixed

#### Gap 1 — `scopeDashboardStats` received empty timesheets/updates arrays
**Problem:** `renderDashboard` called `scopeDashboardStats(rawStats, todaysSchedule, [], [])`.
Caregiver KPIs for `pendingTimesheets` and `pendingVisitUpdates` always showed 0.

**Fix:** For restricted roles, `renderDashboard` now fetches personal timesheets and visit updates
in parallel with the other dashboard data and passes them to `scopeDashboardStats`.

#### Gap 2 — `renderKPIsV2` showed all 7 admin KPI cards to every role
**Problem:** Caregivers saw "New Applications" and "Care Requests" KPIs they had no data for.
Client/family saw "Active Caregivers" and "Active Clients" counts from the whole org.

**Fix:** `renderKPIsV2` now branches on role:
- `admin_owner` / `co_owner`: 7 KPIs (full org view)
- `caregiver`: 4 KPIs (today's visits, pending timesheets, pending updates, completed visits)
- `client_family`: 3 KPIs (today's visits, upcoming visits, approved updates)

#### Gap 3 — `getOnboardingCaregivers()` always queried Supabase for all roles
**Problem:** Caregivers and families triggered an unnecessary admin-only Supabase query.
The onboarding widget was also rendered (empty) for all roles.

**Fix:** `renderDashboard` now only calls `getOnboardingCaregivers()` when `showOnboarding`
is true for the current role (admin/co-owner). Restricted roles get `[]` immediately.

#### Gap 4 — `_filterActivity` had unsafe fallback `return true`
**Problem:** Activity events with no `caregiver_id` field would pass through to any caregiver,
potentially leaking unrelated system activity events.

**Fix:** Both caregiver and client_family branches now require an explicit ID match.
Activities with missing `caregiver_id`/`client_id` are excluded entirely.

### Console Testing Helpers

Two new functions are available in the browser console for manual testing:

```js
// Inspect current session and active filters
debugSession()

// Inject a real Supabase UUID into the active session (no re-login needed)
seedDemoIds({ caregiver_id: 'paste-uuid-here' })
seedDemoIds({ client_id: 'paste-uuid-here' })

// Then reload the current page
navigateTo('dashboard')

// Clear an injected ID
seedDemoIds({ caregiver_id: null })
```

### Manual Test Procedure

#### Step 1 — Find real UUIDs
1. Log in as `admin@ruknanalytics.com`
2. Go to Caregivers page, open a caregiver, copy their UUID from the URL or record
3. Go to Clients page, open a client, copy their UUID
4. Confirm that caregiver and client have at least one shared schedule (Schedule A)
5. Create a second schedule linked to a different caregiver/client (Schedule B)

#### Step 2 — Test caregiver role
```js
// Log in as caregiver@seniorsittersco.com then in console:
seedDemoIds({ caregiver_id: 'UUID-OF-CAREGIVER-WITH-SCHEDULE-A' })
navigateTo('schedules')
// Expected: Only Schedule A visible. Schedule B absent.

navigateTo('timesheets')
// Expected: Only own timesheets. No other caregivers' timesheets.

navigateTo('visit-updates')
// Expected: Only own updates. internal_only/draft/rejected visible to caregiver.

navigateTo('clients')
// Expected: Only clients from Schedule A. Not Schedule B's client.
```

#### Step 3 — Test client_family role
```js
// Log in as family@seniorsittersco.com then in console:
seedDemoIds({ client_id: 'UUID-OF-CLIENT-WITH-SCHEDULE-A' })
navigateTo('schedules')
// Expected: Only Schedule A visible. Schedule B absent.

navigateTo('timesheets')
// Expected: Page blocked / empty (client_family cannot see timesheets).

navigateTo('visit-updates')
// Expected: Only approved/submitted updates for their client.
// internal_only, draft, rejected NOT visible.

navigateTo('caregivers')
// Expected: Only caregiver(s) assigned to Schedule A.
```

#### Step 4 — Test reassignment
1. As admin, change Schedule A's `caregiver_id` to a new caregiver (Caregiver B)
2. Refresh as original caregiver → Schedule A should be **gone**
3. Log in as Caregiver B → Schedule A should be **visible**
4. Log in as client_family → Schedule A should **still be visible** (client_id unchanged)

#### Step 5 — Test visit update visibility rules
| Status | Admin sees | Caregiver (assigned) sees | Client/Family sees |
|---|:---:|:---:|:---:|
| `submitted` | ✓ | ✓ | ✓ |
| `approved` | ✓ | ✓ | ✓ |
| `draft` | ✓ | ✓ | ✗ |
| `internal_only` | ✓ | ✓ | ✗ |
| `rejected` | ✓ | ✓ | ✗ |

### Supabase RLS Still Pending
All filtering above is frontend-only. RLS policies documented in Phase 2 section
above must be deployed before going to production.
