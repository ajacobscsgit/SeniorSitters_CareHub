# Visit Lifecycle

## Overview

The visit lifecycle tracks a care visit from scheduling through completion, capturing actual vs planned times, GPS verification, and caregiver notes.

```
scheduled → confirmed → in_progress → completed
    ↓           ↓            ↓             ↓
 Cancelled   Missed      Clock In     Clock Out
                              ↓             ↓
                         GPS Verify    Duration
                                             ↓
                                        Timesheet
```

---

## Status Definitions

| Status | Meaning | Next States |
|--------|---------|-------------|
| **scheduled** | Visit created, not yet started | confirmed, in_progress, cancelled |
| **confirmed** | Caregiver acknowledged visit | in_progress, missed |
| **in_progress** | Caregiver clocked in, visit active | completed, missed |
| **completed** | Visit finished, clocked out | payroll_locked |
| **missed** | Caregiver did not arrive | - (terminal) |
| **cancelled** | Visit cancelled before start | - (terminal) |
| **payroll_locked** | Approved for payroll, locked | - (terminal) |

---

## Lifecycle Flow

### Phase 1: Scheduling

Admin creates visit:
```javascript
const schedule = await createSchedule({
    client_id: 'client-uuid',
    caregiver_id: 'caregiver-uuid',
    date: '2026-05-28',
    start_time: '09:00',
    end_time: '12:00',
    lifecycle_status: 'scheduled'
});
```

**System:**
- Creates schedule record
- Sends notification to caregiver
- Appears on caregiver calendar

### Phase 2: Confirmation

Caregiver acknowledges:
```javascript
await updateSchedule(schedule.id, {
    lifecycle_status: 'confirmed'
});
```

### Phase 3: In Progress (Clock In)

Caregiver arrives and clocks in:
```javascript
const clockInEvent = await clockIn(schedule.id, caregiverId, {
    lat: 42.3601,
    lng: -71.0589,
    accuracy: 10 // meters
});
```

**System Actions:**
1. Creates `visit_clock_events` record (type: 'clock_in')
2. Updates schedule:
   - `lifecycle_status` → 'in_progress'
   - `actual_start_time` → current timestamp
   - `gps_verified` → true (if location provided)
3. Calculates ETA vs scheduled start

**Caregiver View:**
```
┌─────────────────────────────────────────────┐
│ Visit In Progress                           │
├─────────────────────────────────────────────┤
│                                             │
│ Client: Mary Johnson                        │
│ Address: 123 Main St, Boston MA           │
│                                             │
│ Started: Today 9:02 AM                      │
│ Scheduled: 9:00 AM - 12:00 PM               │
│ Duration: 2h 15m (running)                  │
│                                             │
│ GPS: ✓ Verified (10m accuracy)             │
│                                             │
│ [Clock Out] [Add Note]                    │
│                                             │
└─────────────────────────────────────────────┘
```

### Phase 4: Completion (Clock Out)

Caregiver finishes and clocks out:
```javascript
const clockOutEvent = await clockOut(schedule.id, caregiverId, {
    lat: 42.3601,
    lng: -71.0589,
    accuracy: 15,
    notes: 'Client was responsive. Completed all tasks.'
});
```

**System Actions:**
1. Creates `visit_clock_events` record (type: 'clock_out')
2. Calculates duration from clock_in time
3. Updates schedule:
   - `lifecycle_status` → 'completed'
   - `actual_end_time` → current timestamp
   - `actual_duration_minutes` → calculated
   - `completion_notes` → provided notes
   - `gps_verified` → true (if location provided)

**Duration Calculation:**
```javascript
const durationMinutes = Math.round((clockOutTime - clockInTime) / 60000);
// Example: 9:00 AM → 12:05 PM = 185 minutes (3h 5m)
```

### Phase 5: Missed Visit

If caregiver doesn't arrive:
```javascript
await updateSchedule(schedule.id, {
    lifecycle_status: 'missed',
    notes: 'Caregiver did not arrive - contacted, car trouble'
});
```

**Triggers:**
- Manual admin action
- Automated after scheduled end time + grace period
- Caregiver emergency notification

### Phase 6: Cancellation

If visit cancelled before start:
```javascript
await updateSchedule(schedule.id, {
    lifecycle_status: 'cancelled',
    notes: 'Client requested reschedule - family emergency'
});
```

---

## Clock Events Table

### visit_clock_events

| Field | Type | Description |
|-------|------|-------------|
| `schedule_id` | UUID | Parent schedule |
| `caregiver_id` | UUID | Who clocked |
| `event_type` | Enum | clock_in, clock_out, break_start, break_end |
| `event_time` | Timestamp | When event occurred |
| `location_lat` | Decimal | GPS latitude |
| `location_lng` | Decimal | GPS longitude |
| `location_accuracy` | Decimal | GPS accuracy in meters |
| `notes` | Text | Optional notes |

### API

```javascript
// Clock in
await clockIn(scheduleId, caregiverId, { lat, lng, accuracy });

// Clock out
await clockOut(scheduleId, caregiverId, { lat, lng, accuracy, notes });

// Get clock events for a visit
const events = await getClockEvents(scheduleId);
// Returns: [{ event_type, event_time, location_lat, location_lng }, ...]
```

---

## Schedule Status vs Lifecycle Status

Two status fields serve different purposes:

| Field | Values | Purpose |
|-------|--------|---------|
| `status` | active, completed, cancelled | Operational state |
| `lifecycle_status` | scheduled → completed | Visit progression |

**Mapping:**
```
status: active + lifecycle: scheduled    → Upcoming visit
status: active + lifecycle: in_progress → Currently happening
status: active + lifecycle: completed    → Finished, pending timesheet
status: completed + lifecycle: completed → Finished, timesheet submitted
status: completed + lifecycle: payroll_locked → Approved for payroll
status: cancelled + lifecycle: cancelled → Cancelled
```

---

## GPS Verification

### Accuracy Levels

| Accuracy | Status | Icon |
|----------|--------|------|
| < 10m | Excellent | ✓ |
| 10-50m | Good | ✓ |
| 50-100m | Fair | ~ |
| > 100m | Poor | ⚠ |
| No GPS | Unverified | - |

### Verification Logic

```javascript
// Compare GPS to client address
const clientLocation = { lat: 42.3601, lng: -71.0589 };
const caregiverLocation = { lat: clockIn.location_lat, lng: clockIn.location_lng };

const distance = calculateDistance(clientLocation, caregiverLocation);
// If distance < 100m, mark as verified at location
```

---

## Dashboard Views

### Admin: Today's Visits

```
┌─────────────────────────────────────────────────────────────┐
│ Today's Visits - May 28, 2026                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ In Progress (2)                                             │
│ ● Mary Johnson - Jane Smith (9:02 AM - )                   │
│   Duration: 2h 15m | GPS: ✓                                │
│                                                             │
│ ● Robert Brown - John Doe (10:00 AM - )                    │
│   Duration: 1h 17m | GPS: ✓                                │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Completed (3)                                               │
│ ✓ Linda Davis - Sarah Wilson (8:00 AM - 11:30 AM)         │
│   Duration: 3h 30m | Visit update submitted                │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Scheduled (5)                                               │
│ ○ Thomas Green - Mike Johnson (2:00 PM - 4:00 PM)           │
│ ○ ...                                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Caregiver: My Schedule

```
┌─────────────────────────────────────────────┐
│ My Schedule - May 28, 2026                 │
├─────────────────────────────────────────────┤
│                                             │
│ In Progress                                 │
│ Mary Johnson (9:00 AM - 12:00 PM)          │
│ [Clock Out] [View Details]                 │
│                                             │
├─────────────────────────────────────────────┤
│ Upcoming                                    │
│ Robert Brown (2:00 PM - 4:00 PM)            │
│ [Start Visit]                              │
│                                             │
├─────────────────────────────────────────────┤
│ Completed                                   │
│ ✓ Linda Davis (8:00 AM - 11:30 AM)        │
│   [Submit Timesheet]                        │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Reporting

### Visit Completion Rate

```sql
SELECT 
    COUNT(*) FILTER (WHERE lifecycle_status = 'completed') as completed,
    COUNT(*) FILTER (WHERE lifecycle_status = 'missed') as missed,
    COUNT(*) FILTER (WHERE lifecycle_status = 'cancelled') as cancelled,
    ROUND(
        COUNT(*) FILTER (WHERE lifecycle_status = 'completed') * 100.0 / COUNT(*), 
        2
    ) as completion_rate
FROM schedules
WHERE date >= DATE_TRUNC('month', NOW())
  AND date < DATE_TRUNC('month', NOW()) + INTERVAL '1 month';
```

### Average Visit Duration

```sql
SELECT 
    AVG(actual_duration_minutes) as avg_duration,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY actual_duration_minutes) as median_duration
FROM schedules
WHERE lifecycle_status = 'completed'
  AND actual_duration_minutes IS NOT NULL
  AND date >= NOW() - INTERVAL '30 days';
```

### Late Arrivals

```sql
SELECT 
    s.caregiver_id,
    c.name,
    COUNT(*) as late_count,
    AVG(EXTRACT(EPOCH FROM (s.actual_start_time - (s.date + s.start_time))) / 60) as avg_minutes_late
FROM schedules s
JOIN caregivers c ON s.caregiver_id = c.id
WHERE s.lifecycle_status = 'completed'
  AND s.actual_start_time > (s.date + s.start_time + INTERVAL '5 minutes')
  AND s.date >= NOW() - INTERVAL '30 days'
GROUP BY s.caregiver_id, c.name
HAVING COUNT(*) > 0
ORDER BY late_count DESC;
```

---

## Best Practices

### For Caregivers
1. **Clock in when you arrive** - Not before, not after
2. **Verify GPS accuracy** - Ensure < 50m if possible
3. **Clock out when leaving** - Include travel notes if needed
4. **Add completion notes** - Document what was done
5. **Report issues immediately** - If running late or problems occur

### For Admins
1. **Monitor in-progress visits** - Dashboard shows real-time status
2. **Review missed visits** - Follow up within 24 hours
3. **Check GPS patterns** - Verify caregivers at client locations
4. **Track duration variance** - Investigate outliers (> 30 min difference)
5. **Lock completed visits** - Before payroll export

---

## Troubleshooting

### Caregiver can't clock in
- Check schedule status is 'scheduled' or 'confirmed'
- Verify caregiver assigned to schedule
- Confirm date/time matches current
- Try without GPS if location fails

### Wrong duration calculated
- Check clock_in event exists before clock_out
- Verify clock_out event_time > clock_in event_time
- Review timezone settings

### GPS not verifying
- Ensure location services enabled
- Check browser/app permissions
- Verify outdoors/open sky (not in basement)
- Retry with WiFi enabled

### Visit stuck in 'in_progress'
- Check if clock_out event was created
- Manually update status if caregiver forgot to clock out
- Add notes explaining manual correction

---

## Mobile App Considerations

### Background Location
- Request 'Always' location permission
- Use significant location change API
- Battery optimization exempt

### Offline Support
- Queue clock events locally
- Sync when connection restored
- Show pending count badge

### Push Notifications
- "Visit starting in 30 minutes"
- "Don't forget to clock in"
- "Visit running 15 minutes over"
