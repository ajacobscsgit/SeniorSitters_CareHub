# CareHub Availability Matching

## How `getAvailableCaregivers()` Works

Called from the Schedule Builder when date + time are entered. Returns all active caregivers ranked by match quality.

### Input

```js
getAvailableCaregivers({
    date:        'YYYY-MM-DD',
    start_time:  'HH:MM',
    end_time:    'HH:MM',
    client_city: 'Springfield'   // optional — used for service area scoring
})
```

### Output

Array of result objects, sorted best-first:

```js
[
  {
    caregiver: { id, name, city, transportation, ... },
    score: 70,
    reasons: [
      { type: 'good', text: 'Available Monday' },
      { type: 'good', text: 'Serves this area' },
      { type: 'good', text: 'Has transportation' }
    ],
    blocked: false
  },
  {
    caregiver: { ... },
    score: -1,
    reasons: [{ type: 'block', text: 'Already booked at this time' }],
    blocked: true
  }
]
```

---

## Scoring Model

| Condition | Points |
|---|---|
| Availability slot fully covers the visit window for that day | +40 |
| Has availability slot for that day (but window extends outside it) | +10 |
| Service area field matches client city | +20 |
| Caregiver city matches client city | +10 |
| Has transportation | +10 |

### Hard Blocks (score = -1, shown at bottom as "Unavailable")

- Caregiver is on a `caregiver_unavailable_dates` row for that date
- Caregiver already has a non-cancelled visit that overlaps the proposed time

### No Availability Data

If a caregiver has no rows in `caregiver_availability`, they are NOT blocked — they appear with an info note "No structured availability set — may still be available." This allows the system to work before availability is fully configured.

---

## Setting Up Caregiver Availability

**Via Schedule Builder:**
1. Go to Schedules → Schedule Builder
2. In the right panel, select a caregiver from the dropdown
3. Their current availability loads (weekly grid + unavailable dates)
4. Click **Edit Availability** → set start/end per day → Save
5. Add blocked dates with the date picker + reason field below

**Via Caregiver Profile:**
- (Future enhancement) Availability editor button in the caregiver detail modal footer

---

## Setting Up Client Schedule Preferences

**Via Schedule Builder:**
1. Select a client in the left panel
2. If no preferences exist, click **Set Preferences**
3. Fill out the preference form:
   - Preferred days (checkboxes)
   - Preferred time window
   - Visit length, frequency, service type
   - Requested start date, recurring toggle, notes
4. Save — the builder center panel auto-fills from these preferences

**Via Care Request / Intake:**
- When a care request is converted to a client, preferences can be set immediately from the Schedule Builder
- Future: intake form fields map directly to `client_schedule_preferences`

---

## Conflict Check Detail

`checkScheduleConflicts()` runs four sequential checks:

```
Proposed visit: 2026-06-02 09:00–13:00, caregiver X, client Y
│
├─ 1. Caregiver X has another visit overlapping 09:00–13:00 on 2026-06-02?
│      → conflict: caregiver_booked
│
├─ 2. Client Y has another visit overlapping 09:00–13:00 on 2026-06-02?
│      → conflict: client_booked
│
├─ 3. Caregiver X is in caregiver_unavailable_dates for 2026-06-02?
│      → conflict: unavailable_date
│
└─ 4. 2026-06-02 is a Monday. Does caregiver X have a Monday slot covering 09:00–13:00?
       → If yes: no conflict
       → If slots exist but don't cover: conflict: outside_availability
       → If no slots exist: no constraint (skip)
```

All four checks always run (not early-exit). Multiple conflicts can be returned.

**When editing an existing visit**, pass `exclude_id` to ignore that visit's own bookings in the check.

---

## Propagation After Creating / Updating a Visit

```
saveSchedule() or scheduleBuilderCreateVisit()
  │
  ├─ createNotification() → notifications bell (all roles with access)
  ├─ CareHubRefreshCoordinator.trigger('schedules') → calendar + list refresh
  └─ viewSchedule() on edit → modal updates immediately
```

Dashboard "Today's Schedule" and "Upcoming Visits" widgets refresh on next page load or coordinator trigger.
