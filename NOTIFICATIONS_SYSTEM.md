# CareHub Notifications System

## Overview

The notifications system delivers real-time alerts to the correct people when operational events occur — visits, timesheets, approvals, invites, training, and emergencies.

```
Event occurs → createNotification() → Supabase INSERT
    → Realtime broadcast → handleNotificationChange()
        → Bell badge increments
        → Dropdown refreshes (if open)
        → Toast shown (high/emergency priority)
```

---

## Database Table: `notifications`

Run migration: `supabase/migrations/20260524_notifications_system.sql`

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | Auto-generated |
| `recipient_user_id` | uuid nullable | Specific auth user (direct message) |
| `recipient_role` | text nullable | Role-wide broadcast: `admin_owner`, `co_owner`, `caregiver`, `client_family` |
| `caregiver_id` | uuid nullable | FK → caregivers (for caregiver-scoped access) |
| `client_id` | uuid nullable | FK → clients (for client-scoped access) |
| `type` | text | One of the 16 notification types |
| `title` | text | Short display title |
| `message` | text | Full description |
| `related_table` | text nullable | Table the event concerns (`schedules`, `timesheets`, etc.) |
| `related_record_id` | uuid nullable | Row UUID of the related record |
| `priority` | text | `low` / `normal` / `high` / `emergency` |
| `read` | boolean | Legacy read flag (kept for compat) |
| `read_at` | timestamptz nullable | Canonical read timestamp (null = unread) |
| `created_at` | timestamptz | When the notification was created |

---

## Notification Types

| Type | Who sees it | Triggered by |
|---|---|---|
| `new_visit_assigned` | caregiver | When a visit is assigned to them |
| `visit_changed` | caregiver | When their visit is edited |
| `visit_cancelled` | caregiver | When their visit is cancelled |
| `caregiver_reassigned` | caregiver | When a client's caregiver changes |
| `timesheet_submitted` | admin | When a caregiver submits a timesheet |
| `timesheet_approved` | caregiver | When their timesheet is approved |
| `timesheet_rejected` | caregiver | When their timesheet is rejected |
| `visit_update_submitted` | admin | When a caregiver submits a visit update |
| `visit_update_approved` | client_family | When an update is approved for family view |
| `visit_update_rejected` | caregiver | When their visit update is rejected |
| `training_assigned` | caregiver | When training is assigned to them |
| `invite_queued` | admin_owner | When invite is queued (Edge Function not deployed) |
| `invite_sent` | admin_owner | When invite email is actually sent |
| `emergency_alert` | all admin | Emergency/incident alerts |
| `schedule_created` | admin | New visit scheduled |
| `schedule_updated` | admin | Existing visit modified |

---

## Priority Levels

| Priority | Badge Color | Toast Type |
|---|---|---|
| `emergency` | Red | `CareHubToast.error()` |
| `high` | Orange | `CareHubToast.warning()` |
| `normal` | Accent | No toast (bell only) |
| `low` | Muted gray | No toast (bell only) |

---

## Role-Based Visibility

RLS policies enforce access at the DB level. The JS `_filterNotificationsForRole()` function provides a secondary safety filter.

| Role | Sees |
|---|---|
| `admin_owner` / `co_owner` | All notifications |
| `caregiver` | Rows where `caregiver_id = their ID` OR `recipient_role = 'caregiver'` |
| `client_family` | Rows where `client_id = their ID` OR `recipient_role = 'client_family'` |

**Admin notes are never surfaced to `client_family`.** Only `visit_update_approved` type notifications are sent to families.

---

## UI Components

### Bell Badge
- Located in the sidebar footer (next to user info)
- Shows red dot with unread count
- Hides when count = 0
- Increments immediately on realtime INSERT (no DB round-trip)

### Dropdown (max 8 items)
- Opens on bell click, closes on outside click
- Shows unread notifications with type icon, title, message, relative time
- Per-item dismiss (✕) button — deletes notification
- "Mark all read" button
- "View all" → navigates to Notifications page

### Notifications Page
- Full table view with filters: Unread only / Type / Priority
- Mark individual items read
- Delete individual items
- Mark All Read button in page header
- Unread rows highlighted in yellow

---

## API Reference (`database.js`)

```js
createNotification({ type, title, message, recipient_user_id?, recipient_role?,
                     caregiver_id?, client_id?, priority?, related_table?,
                     related_record_id? })

getUnreadNotifications()           // max 20, role-filtered
getNotifications({ unreadOnly, type, priority, limit, offset })
getNotificationCount()             // integer badge count
markNotificationRead(id)           // sets read_at = now
markAllNotificationsRead()         // bulk sets read_at = now
deleteNotification(id)             // hard delete
```

---

## `CareHubNotifications` (app.js module)

```js
window.CareHubNotifications.refresh()          // re-fetch badge count + dropdown
window.CareHubNotifications.incrementBadge()   // optimistic +1 (from realtime)
window.CareHubNotifications.toggleDropdown()   // open/close
window.CareHubNotifications.markRead(id)
window.CareHubNotifications.markAllRead()
window.CareHubNotifications.deleteOne(id)
```

---

## Setup Checklist

1. Run `supabase/migrations/20260524_notifications_system.sql` in Supabase SQL Editor
2. Enable Realtime on the `notifications` table in Supabase Dashboard → Database → Replication
3. Verify `profiles` table has `caregiver_id` and `client_id` columns (needed for RLS)
4. Set `window.DEBUG = true` temporarily to verify realtime events fire in console
