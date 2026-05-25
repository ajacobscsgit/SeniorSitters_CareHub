# Schedule Conflict Rules

## Overview

The scheduling conflict system prevents double-booking and ensures caregivers are only assigned when they are truly available. Conflicts are checked when creating or editing schedules.

---

## Conflict Types

### 1. Caregiver Double-Booking
**Rule:** A caregiver cannot have two overlapping visits.

**Detection:**
```js
// Check if caregiver already has a visit at this time
caregiver_id = '...'
date = '2026-05-28'
start_time = '09:00'
end_time = '12:00'

// Conflict if existing visit:
// - Same caregiver
// - Same date
// - Time overlap: start1 < end2 && end1 > start2
```

**Error Message:**
> "Caregiver is already booked 09:00–12:00 on this date."

**Override:** Admin can save anyway if emergency

---

### 2. Client Double-Booking
**Rule:** A client cannot have two overlapping visits.

**Detection:**
```js
// Same logic as caregiver check
// Checks against client's existing visits
```

**Error Message:**
> "Client already has a visit 14:00–16:00 on this date."

**Override:** Not recommended - client can't be in two places

---

### 3. Caregiver Unavailable Date
**Rule:** Caregiver marked as unavailable on this specific date.

**Sources:**
- Admin manually marked date
- Approved time-off request (auto-added)
- System-generated (e.g., termination date)

**Detection:**
```js
SELECT * FROM caregiver_unavailable_dates
WHERE caregiver_id = '...'
  AND date = '2026-05-28'
```

**Error Message:**
> "Caregiver marked unavailable on this date: Doctor appointment"

**Override:** Remove unavailability first, then schedule

---

### 4. Caregiver Time-Off
**Rule:** Caregiver has approved time-off covering this date/time.

**Detection:**
```js
checkCaregiverTimeOff(caregiverId, date, startTime, endTime)

// Checks caregiver_time_off_requests:
// - status = 'approved'
// - date BETWEEN start_date AND end_date
// - Time overlap (if times provided)
```

**Error Message:**
> "Caregiver has approved time off: Vacation in Hawaii"

**Override:** Deny the time-off request first, then schedule

---

### 5. Outside Availability Window
**Rule:** Visit time falls outside caregiver's regular weekly availability.

**Detection:**
```js
// Get day of week (0=Sunday, 6=Saturday)
dow = 'Friday'

// Check caregiver_availability
SELECT * FROM caregiver_availability
WHERE caregiver_id = '...'
  AND day_of_week = 'Friday'
  AND status = 'active'

// Valid if:
// start_time >= availability.start_time
// AND end_time <= availability.end_time
```

**Error Message:**
> "Visit falls outside caregiver's availability window for Friday."

**Warning vs Block:**
- **Warning:** No availability set yet (admin hasn't configured)
- **Block:** Availability set but visit outside window

---

## Conflict Priority Order

When multiple conflicts exist, they are reported in this priority:

1. **Caregiver Double-Booking** (most critical)
2. **Client Double-Booking**
3. **Unavailable Date** (hard block)
4. **Time-Off** (hard block)
5. **Outside Availability** (warning/block)

---

## Conflict API

### Check for Conflicts

```js
const conflicts = await checkScheduleConflicts({
    date: '2026-05-28',
    start_time: '09:00',
    end_time: '12:00',
    caregiver_id: 'uuid',
    client_id: 'uuid',
    exclude_id: 'uuid'  // Optional: for editing existing schedule
});

// Returns array of conflict objects:
// [
//   { type: 'caregiver_booked', message: '...' },
//   { type: 'time_off', message: '...' }
// ]
```

### Get Available Caregivers

```js
const available = await getAvailableCaregivers({
    date: '2026-05-28',
    start_time: '09:00',
    end_time: '12:00',
    client_city: 'Boston'
});

// Returns array with conflict status:
// [
//   {
//     caregiver: { id, name, ... },
//     score: 75,
//     reasons: [
//       { type: 'good', text: 'Available Friday' },
//       { type: 'good', text: 'Has transportation' }
//     ],
//     blocked: false
//   },
//   {
//     caregiver: { id, name, ... },
//     score: -1,
//     reasons: [
//       { type: 'block', text: 'Has approved time off' }
//     ],
//     blocked: true
//   }
// ]
```

---

## UI Behavior

### Schedule Creation Modal

```
┌────────────────────────────────────────────┐
│ Create Schedule                              │
├────────────────────────────────────────────┤
│ ⚠️  2 Conflicts Detected                      │
│                                              │
│ • Caregiver already booked 09:00–12:00    │
│ • Caregiver has approved time off           │
│                                              │
│ [View Conflicts] [Save Anyway]             │
└────────────────────────────────────────────┘
```

### Caregiver Selector

Blocked caregivers shown with red indicator:
```
┌────────────────────────────────────────────┐
│ Select Caregiver                           │
├────────────────────────────────────────────┤
│ ○ Jane Smith (95% match)                   │
│   ✓ Available Friday                       │
│   ✓ Has transportation                     │
│                                              │
│ ✗ John Doe (BLOCKED)                      │
│   ✗ Already booked at this time            │
│                                              │
│ ✗ Mary Johnson (BLOCKED)                  │
│   ✗ Has approved time off                  │
└────────────────────────────────────────────┘
```

---

## Conflict Resolution Workflows

### Scenario 1: Caregiver Double-Booked

**Problem:** Need to assign caregiver to new visit, but they're already booked.

**Options:**
1. **Reassign existing visit** → Move existing to another caregiver
2. **Split time** → Adjust times so they don't overlap
3. **Override** → Save anyway (emergency only)
4. **Choose different caregiver**

### Scenario 2: Approved Time-Off Conflict

**Problem:** Caregiver approved for vacation, but now client needs care.

**Options:**
1. **Find alternate caregiver** → Use getAvailableCaregivers()
2. **Contact caregiver** → Ask if they can cancel time-off
3. **Reschedule client** → Move to different date
4. **Emergency override** → Admin marks unavailable date as available

### Scenario 3: Outside Availability

**Problem:** Client needs evening care, caregiver only available days.

**Options:**
1. **Update availability** → Ask caregiver to extend hours
2. **Find different caregiver** → Search for evening availability
3. **Split shift** → Day caregiver + evening caregiver

---

## Database Functions

### SQL: Check Availability

```sql
-- Check if caregiver is available on specific date/time
CREATE OR REPLACE FUNCTION is_caregiver_available(
    p_caregiver_id UUID,
    p_date DATE,
    p_start_time TIME,
    p_end_time TIME
) RETURNS BOOLEAN AS $$
DECLARE
    v_has_conflict BOOLEAN;
BEGIN
    -- Check unavailable dates
    SELECT EXISTS (
        SELECT 1 FROM caregiver_unavailable_dates
        WHERE caregiver_id = p_caregiver_id
        AND date = p_date
    ) INTO v_has_conflict;
    
    IF v_has_conflict THEN
        RETURN FALSE;
    END IF;
    
    -- Check approved time-off
    SELECT EXISTS (
        SELECT 1 FROM caregiver_time_off_requests
        WHERE caregiver_id = p_caregiver_id
        AND status = 'approved'
        AND p_date BETWEEN start_date AND end_date
        AND (start_time IS NULL OR 
             (p_start_time < end_time AND p_end_time > start_time))
    ) INTO v_has_conflict;
    
    IF v_has_conflict THEN
        RETURN FALSE;
    END IF;
    
    -- Check availability window
    RETURN EXISTS (
        SELECT 1 FROM caregiver_availability
        WHERE caregiver_id = p_caregiver_id
        AND day_of_week = TO_CHAR(p_date, 'Day')
        AND status = 'active'
        AND start_time <= p_start_time
        AND end_time >= p_end_time
    );
END;
$$ LANGUAGE plpgsql;
```

---

## Configuration

### Ignore Conflicts (Emergency Mode)

Admins can override conflicts with sufficient privileges:

```js
// Frontend: Show warning but allow save
if (conflicts.length > 0) {
    const confirm = await CareHubConfirm.confirm({
        title: `${conflicts.length} Conflicts Detected`,
        message: conflicts.map(c => `• ${c.message}`).join('\n'),
        confirmText: 'Save Anyway (Override)',
        danger: true
    });
    
    if (confirm) {
        // Save with override flag
        await saveSchedule(data, { ignoreConflicts: true });
    }
}
```

### Soft vs Hard Blocks

| Conflict Type | Default Behavior | Can Override |
|--------------|------------------|--------------|
| Caregiver Double-Book | Hard Block | Yes (emergency) |
| Client Double-Book | Hard Block | No |
| Unavailable Date | Hard Block | Yes (remove first) |
| Time-Off | Hard Block | Yes (deny request first) |
| Outside Availability | Warning | Yes |

---

## Testing

### Unit Tests

```javascript
// Test: Caregiver double-booking
describe('checkScheduleConflicts', () => {
    it('should detect caregiver double-booking', async () => {
        // Create existing visit 09:00-12:00
        await createSchedule({ caregiver_id: 'cg1', date: '2026-05-28', 
                               start_time: '09:00', end_time: '12:00' });
        
        // Try to create overlapping visit 11:00-14:00
        const conflicts = await checkScheduleConflicts({
            caregiver_id: 'cg1',
            date: '2026-05-28',
            start_time: '11:00',
            end_time: '14:00'
        });
        
        expect(conflicts).toContainEqual({
            type: 'caregiver_booked',
            message: expect.stringContaining('already booked')
        });
    });
});
```

### Integration Tests

```javascript
// Test: Time-off approval blocks scheduling
describe('Time-Off Integration', () => {
    it('should block scheduling after time-off approved', async () => {
        // Approve time-off
        await reviewTimeOffRequest(requestId, 'approved', adminId);
        
        // Try to schedule during time-off
        const conflicts = await checkScheduleConflicts({
            caregiver_id: 'cg1',
            date: '2026-06-01',  // During approved time-off
            start_time: '09:00',
            end_time: '12:00'
        });
        
        expect(conflicts).toContainEqual({
            type: 'time_off',
            message: expect.stringContaining('time off')
        });
    });
});
```

---

## Best Practices

### For Admins
1. **Always review conflicts** before overriding
2. **Contact caregiver** if time-off conflict (emergency)
3. **Document reason** when overriding
4. **Use availability** to prevent conflicts proactively

### For Developers
1. **Check conflicts before save** in all schedule operations
2. **Show clear error messages** with specific conflict details
3. **Log overrides** for audit purposes
4. **Test edge cases** like DST transitions, overnight shifts

---

## Troubleshooting

### False Positive Conflicts

**Problem:** Conflict detected but no actual overlap

**Causes:**
- Time format mismatch (12h vs 24h)
- Timezone issues
- Date parsing errors

**Fix:**
```js
// Ensure consistent format
const startTime = '09:00'; // Always HH:MM 24h
const date = '2026-05-28';   // Always YYYY-MM-DD
```

### Missing Conflicts

**Problem:** Schedule created despite conflict

**Causes:**
- checkScheduleConflicts not called
- Conflict check bypassed
- Async race condition

**Fix:**
- Always await conflict check
- Don't allow client-side-only validation
- Add server-side constraint

### Performance Issues

**Problem:** Slow conflict detection with many caregivers

**Optimization:**
```sql
-- Add indexes
CREATE INDEX idx_schedules_caregiver_date 
ON schedules(caregiver_id, date, status);

CREATE INDEX idx_unavailable_dates_caregiver 
ON caregiver_unavailable_dates(caregiver_id, date);

CREATE INDEX idx_time_off_approved_dates 
ON caregiver_time_off_requests(caregiver_id, status, start_date, end_date);
```
