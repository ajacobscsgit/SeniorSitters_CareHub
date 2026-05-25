# CareHub Scheduling Engine

## Overview

The scheduling engine connects the full care workflow:

```
Client Intake → Care Schedule Preferences → Caregiver Availability → Admin Match → Visit Created → Role Calendars
```

---

## Database Tables

### `schedules` (existing, enhanced)
Core visit table. New columns added:

| Column | Type | Description |
|---|---|---|
| `is_recurring` | boolean | True if part of a recurring series |
| `recurrence_rule` | text | `daily` / `weekly` / `bi-weekly` / `monthly` |
| `recurrence_end_date` | date | When the series ends |
| `recurrence_parent_id` | uuid | Points to first visit in a series |

### `client_schedule_preferences`
One row per client. Captures needs from intake/care request.

| Column | Type | Description |
|---|---|---|
| `client_id` | uuid | FK → clients |
| `preferred_days` | text[] | e.g. `['Monday','Wednesday']` |
| `preferred_start` / `preferred_end` | time | Preferred visit time window |
| `visit_length_hours` | numeric | e.g. `4.0` |
| `frequency` | text | `daily`, `weekly`, `bi-weekly`, `monthly`, `as-needed` |
| `service_type` | text | Personal Care, Companionship, etc. |
| `start_date` | date | Requested care start date |
| `is_recurring` | boolean | Ongoing or one-time |
| `notes` | text | Special preferences |

### `caregiver_availability`
Multiple rows per caregiver (one per available day slot).

| Column | Type | Description |
|---|---|---|
| `caregiver_id` | uuid | FK → caregivers |
| `day_of_week` | text | Monday–Sunday |
| `start_time` / `end_time` | time | Available window |
| `max_hours_week` | numeric | Weekly hour cap |
| `service_area` | text | City / zip / region |

### `caregiver_unavailable_dates`
Blocked specific dates (vacation, sick, etc.).

| Column | Type | Description |
|---|---|---|
| `caregiver_id` | uuid | FK → caregivers |
| `date` | date | Blocked date |
| `reason` | text | Optional reason |

---

## Setup: Run the Migration

In Supabase Dashboard → SQL Editor, run:
```
supabase/migrations/20260524_scheduling_engine.sql
```

---

## Schedule Builder (Admin Only)

Access via: **Schedules → Schedule Builder** button.

Three-panel layout:

| Left Panel | Center Panel | Right Panel |
|---|---|---|
| Client Care Needs | Visit Parameters | Suggested Caregivers |
| Set/view preferences | Date, time, recurring | Ranked by match score |
| Edit via modal | Conflict check | Click to select |
| | Create visit/series | Caregiver availability editor |

### Flow

1. Select a client — preferences auto-load; fields pre-fill from prefs
2. Enter date + time — suggested caregiver list refreshes (debounced, 400ms)
3. Optionally select a caregiver from suggestions — conflict check runs automatically
4. Toggle **Recurring Visit** to set repeat rule + end date
5. Click **Check Conflicts** for an explicit pre-flight check
6. Click **Create Visit** — creates single visit or entire recurring series

---

## Conflict Prevention

`checkScheduleConflicts()` checks four conditions:

1. **Caregiver double-booking** — already scheduled at overlapping time on that date
2. **Client double-booking** — client already has a visit at overlapping time
3. **Unavailable date** — caregiver explicitly blocked that date
4. **Outside availability window** — visit time falls outside caregiver's set window for that day of week

Conflicts are **warnings only** — admin can proceed after confirmation.

The conflict check runs:
- Live in the Schedule Builder center panel (on caregiver selection)
- Before saving in the standard "New Visit" modal

---

## Recurring Visits

`createRecurringSchedules(template)` generates a series:
- First visit becomes the `recurrence_parent_id` for subsequent visits
- All visits share `recurrence_rule` and `recurrence_end_date`
- Each visit is independent — can be individually cancelled, reassigned, or completed
- Monthly recurrence uses calendar months (not 30-day intervals)

---

## Role-Based Calendar Access

| Role | Sees |
|---|---|
| `admin_owner` / `co_owner` | All visits, all caregivers, all clients |
| `caregiver` | Only their own assigned visits |
| `client_family` | Only visits for their linked client |

RLS policies on `schedules` enforce this at the database level.

---

## Change Propagation

When a visit is created or updated:
1. `createNotification()` fires — appears in the notifications bell
2. `CareHubRefreshCoordinator.trigger('schedules')` updates the calendar and list view
3. Dashboard "Today's Schedule" widget refreshes on next load

---

## API Reference (`database.js`)

```js
// Client preferences
getClientSchedulePreferences(clientId)
saveClientSchedulePreferences(clientId, prefs)

// Caregiver availability
getCaregiverAvailability(caregiverId)
getCaregiverAvailabilityBulk(caregiverIds[])
saveCaregiverAvailability(caregiverId, slots[])

// Blocked dates
getCaregiverUnavailableDates(caregiverId)
addCaregiverUnavailableDate(caregiverId, date, reason)
removeCaregiverUnavailableDate(caregiverId, date)

// Matching + conflict check
checkScheduleConflicts({ date, start_time, end_time, caregiver_id, client_id, exclude_id })
getAvailableCaregivers({ date, start_time, end_time, client_city })

// Recurring series
createRecurringSchedules(template)  // includes recurrence_rule + recurrence_end_date
```
