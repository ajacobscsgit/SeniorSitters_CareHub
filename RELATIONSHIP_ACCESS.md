# CareHub Portal — Relationship-Based Data Access

## Overview

Every authenticated user in CareHub sees only the data connected to their
relationship in the care network. This document defines who can see what,
how the relationship is established, and what work remains for full
server-side enforcement.

---

## Access Model

| Role | Sees |
|---|---|
| `admin_owner` | Everything — all records, all users, all pages |
| `co_owner` | All operational data; excludes ownership settings |
| `caregiver` | Only records where `caregiver_id` matches their profile |
| `client_family` | Only records where `client_id` matches their linked client |

---

## Relationship Mapping

Each authenticated session stores:

```json
{
  "email": "user@example.com",
  "role": "caregiver",
  "name": "Jane Smith",
  "caregiver_id": "uuid-from-caregivers-table",
  "client_id": null,
  "timestamp": 1716000000000
}
```

- **`caregiver_id`** is resolved by `resolveUserIds()` in `auth.js` by
  matching `caregivers.email = session.email` in Supabase on login.
- **`client_id`** is resolved by matching `clients.email = session.email`.
- For `admin_owner` / `co_owner` both IDs remain `null` — they are not
  restricted to any record.

---

## Data Access Rules by Record Type

### Schedules
- **admin/co_owner**: all schedules
- **caregiver**: `schedules.caregiver_id = my caregiver_id`
- **client_family**: `schedules.client_id = my client_id`

### Timesheets
- **admin/co_owner**: all timesheets
- **caregiver**: `timesheets.caregiver_id = my caregiver_id`
- **client_family**: **blocked** (timesheets are internal payroll documents)

### Visit Updates
- **admin/co_owner**: all updates including `internal_only` and `rejected`
- **caregiver**: updates where `caregiver_id = my caregiver_id`
- **client_family**: updates where `client_id = my client_id`
  AND `status NOT IN ('internal_only', 'rejected', 'draft')`

### Client Records
- **admin/co_owner**: all clients
- **caregiver**: only clients they have a current schedule with
  (derived from schedule join — see `loadClients()` in `app.js`)
- **client_family**: only their own client row (`clients.id = my client_id`)

### Caregiver Records
- **admin/co_owner**: all caregivers
- **caregiver**: only their own row (`caregivers.id = my caregiver_id`)
- **client_family**: only caregivers assigned to their client's schedules
  (derived from schedule join — see `loadCaregivers()` in `app.js`)

### Dashboard Stats (KPIs)
- **admin/co_owner**: global aggregate counts
- **caregiver**: today's visits, pending timesheets, pending updates,
  rejected timesheets — all scoped to `caregiver_id`
- **client_family**: today's visits, upcoming visits, approved updates
  — all scoped to `client_id`

### Alerts
- **admin/co_owner**: unassigned visits, onboarding caregivers, rejected
  timesheets, pending counts
- **caregiver**: own rejected timesheets + own upcoming visits today
- **client_family**: upcoming scheduled visits for their loved one

### Recent Activity Feed
- **admin/co_owner**: full activity stream (applications, care requests,
  timesheets, visit updates, schedule changes)
- **caregiver**: timesheet approvals/rejections + visit completions/cancellations
  scoped to `caregiver_id`
- **client_family**: visit completions + approved visit updates scoped to
  `client_id`

### Notifications
- **admin/co_owner**: all unread notifications
- **caregiver**: notifications where `caregiver_id = my caregiver_id`
- **client_family**: notifications where `client_id = my client_id`

### Calendars (Mini + Full Schedule View)
- All roles: same scoping as Schedules — `buildCalendarQueryFilters()` injects
  the correct `caregiver_id` or `client_id` into the Supabase query.

---

## Reassignment Behaviour

When a schedule's `caregiver_id` is changed:

| Scenario | Effect |
|---|---|
| Old caregiver | Immediately loses visibility (query filter no longer matches) |
| New caregiver | Immediately gains visibility (their `caregiver_id` now matches) |
| Client/family | Unchanged — `client_id` never changes on reassignment |

This is enforced purely through the data model — no special reassignment
event handling is needed at the frontend layer.

---

## Implementation Files

| File | Role |
|---|---|
| `js/auth.js` | Session management + `resolveUserIds()` |
| `js/role-filter.js` | All permission check helpers + batch filters |
| `js/database.js` | DB-level query scoping on every data function |
| `js/app.js` | Post-query JS filtering for list pages |
| `js/config.js` | Role constants + `DEMO_USERS` |

---

## Mock Auth Limitations

During Phase 1 (frontend/mock auth):

- `DEMO_USERS` in `config.js` may have `caregiver_id: null` / `client_id: null`
- `resolveUserIds()` runs on app init and patches the session by email lookup
- If no matching DB row exists, filters return empty safely (`__none__` sentinel)
- **No filtering is enforced server-side** — a motivated user could bypass
  client-side checks by calling Supabase directly

---

## Supabase RLS Requirement (Future)

The following Row Level Security policies **must** be implemented before
going to production:

```sql
-- Schedules: caregiver sees own rows
CREATE POLICY "caregiver_own_schedules" ON schedules
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'caregiver' AND
    caregiver_id = (SELECT id FROM caregivers WHERE email = auth.email())
  );

-- Schedules: client_family sees own rows
CREATE POLICY "client_own_schedules" ON schedules
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'client_family' AND
    client_id = (SELECT id FROM clients WHERE email = auth.email())
  );

-- Timesheets: caregiver sees own, client_family blocked
CREATE POLICY "caregiver_own_timesheets" ON timesheets
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'caregiver' AND
    caregiver_id = (SELECT id FROM caregivers WHERE email = auth.email())
  );

-- Visit updates: client_family sees approved only
CREATE POLICY "client_approved_visit_updates" ON visit_updates
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'client_family' AND
    client_id = (SELECT id FROM clients WHERE email = auth.email()) AND
    status NOT IN ('internal_only', 'rejected', 'draft')
  );
```

Until RLS is active, the frontend filtering provides a UX-level access
boundary only — not a security boundary.
