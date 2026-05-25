# CareHub Realtime Events

## Architecture

CareHub uses Supabase Realtime (postgres_changes) to push live updates to all connected clients.

```
Supabase Postgres → realtime.js subscriptions → UI handlers
                                              → CareHubNotifications
                                              → CareHubRefreshCoordinator
                                              → CareHubState invalidation
```

---

## Subscribed Tables

All subscriptions listen for INSERT, UPDATE, and DELETE events.

| Table | Handler | What it does |
|---|---|---|
| `applications` | `handleApplicationChange` | Marks state stale, triggers list refresh, adds activity, refreshes dashboard stats |
| `care_requests` | `handleCareRequestChange` | Same pattern as applications |
| `caregivers` | `handleCaregiverChange` | Refreshes caregiver list, updates stats |
| `clients` | `handleClientChange` | Refreshes client list, updates stats |
| `schedules` | `handleScheduleChange` | **Critical**: refreshes calendar, today's schedule widget, mini calendar on dashboard, and dashboard stats |
| `timesheets` | `handleTimesheetChange` | Refreshes timesheet list, updates stats |
| `visit_updates` | `handleVisitUpdateChange` | Refreshes visit updates list |
| `notifications` | `handleNotificationChange` | **New**: increments bell badge, shows toast for high/emergency, refreshes dropdown |

---

## Realtime Setup Requirements

### Enable in Supabase Dashboard
1. Go to **Database → Replication**
2. Ensure the following tables are in the `supabase_realtime` publication:
   - `notifications` ← most important for bell
   - `schedules`
   - `timesheets`
   - `visit_updates`
   - `applications`
   - `care_requests`
   - `caregivers`
   - `clients`

### RLS Must Be Compatible
Realtime uses the same RLS policies as regular queries. Each user only receives rows their policy allows. The notification bell only rings for events the user is permitted to see.

---

## Notification Realtime Flow

```
Admin approves timesheet
    → approveTimesheetUI()
        → approveTimesheet() [DB update]
        → createNotification({ type: 'timesheet_approved', recipient_role: 'caregiver' })
            → INSERT into notifications table
                → Supabase broadcasts to all subscribers
                    → handleNotificationChange() fires on caregiver's client
                        → CareHubNotifications.incrementBadge()  [immediate]
                        → CareHubNotifications.refresh()          [next tick]
```

---

## Schedule Change Realtime Flow

```
Visit created/updated/cancelled
    → Supabase INSERT/UPDATE on schedules
        → handleScheduleChange()
            → CareHubState.set('schedules', null)   [mark stale]
            → CareHubRefreshCoordinator.trigger('schedules')
            → If today's date → trigger('todays-schedule')
            → If on dashboard → re-render mini calendar
            → refreshDashboardStats()
```

---

## Activity Feed

Every realtime change appends to the `CareHubState.activities` array (capped at 50 items). The dashboard "Recent Activity" widget reads from this array.

Activity entries:
```js
{ id: timestamp, type: 'schedule', message: 'New visit scheduled for 2026-06-02', severity: 'new', timestamp: ISO }
```

Severity values: `new`, `success`, `warning`, `danger`, `info`

---

## Debugging Realtime

Set `window.DEBUG = true` in `config.js`. You'll see:

```
[CareHubRealtime] Initializing realtime subscriptions...
[CareHubRealtime] notifications-changes status: SUBSCRIBED
[CareHubRealtime] notifications change: INSERT abc-123
[CareHubRealtime] Notification change: INSERT abc-123
```

If you see `CHANNEL_ERROR` instead of `SUBSCRIBED`, check:
1. Table is in the Supabase realtime publication
2. RLS policies allow SELECT for the authenticated user
3. Supabase project is on a plan that supports realtime

---

## Integration Points Summary

Every operation that should broadcast a notification calls `createNotification()` after success:

| Function | type | recipient_role |
|---|---|---|
| `saveSchedule()` create | `schedule_created` | admin |
| `saveSchedule()` update | `schedule_updated` | admin |
| `cancelScheduleUI()` | `visit_cancelled` | `caregiver` |
| `scheduleBuilderCreateVisit()` | `schedule_created` | admin |
| `approveTimesheetUI()` | `timesheet_approved` | `caregiver` |
| `rejectTimesheetUI()` | `timesheet_rejected` | `caregiver` |
| `approveVisitUpdateUI()` | `visit_update_approved` | `client_family` |
| `rejectVisitUpdateUI()` | `visit_update_rejected` | `caregiver` |
| `sendCaregiverInvite()` — sent | `invite_sent` | `admin_owner` |
| `sendCaregiverInvite()` — queued | `invite_queued` | `admin_owner` |

---

## Adding a New Integration Point

```js
// After a successful operation:
await createNotification({
    type:             'your_type',           // must be in NOTIFICATION_TYPES
    title:            'Short Title',
    message:          'Full description of what happened.',
    recipient_role:   'caregiver',           // or 'admin_owner', 'client_family', etc.
    caregiver_id:     someId,               // optional: scope to specific caregiver
    client_id:        someId,               // optional: scope to specific client
    priority:         'high',              // low | normal | high | emergency
    related_table:    'schedules',
    related_record_id: record.id
});
```
