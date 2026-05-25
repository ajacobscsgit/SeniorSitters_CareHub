# Timesheet Approval Flow

## Overview

The timesheet approval workflow manages caregiver hour submissions from submission through approval to payroll readiness.

```
Caregiver Submits
       ↓
    Pending
       ↓
┌──────┴──────┐
│             │
Approved    Rejected
│             │
↓             ↓
Payroll    Correction
Ready      Requested
              │
              ↓
         Resubmitted
              │
              ↓
           Approved
```

---

## Status Definitions

| Status | Meaning | Who Can Change |
|--------|---------|----------------|
| **draft** | Caregiver working on timesheet | Caregiver → submitted |
| **submitted** | Submitted for approval | Admin → approved/rejected/correction |
| **pending** | Awaiting admin review | Admin → approved/rejected/correction |
| **approved** | Approved for payroll | Admin (only before export) |
| **rejected** | Rejected with reason | Admin (terminal or resubmit) |
| **correction_requested** | Needs caregiver fix | Caregiver → resubmit |
| **payroll_exported** | Locked in payroll | System (terminal) |

---

## Workflow Steps

### Phase 1: Submission

Caregiver submits hours:
```javascript
await createTimesheet({
    caregiver_id: 'caregiver-uuid',
    client_id: 'client-uuid',
    date: '2026-05-28',
    hours_worked: 8.0,
    mileage: 12.5,
    notes: 'Regular shift, completed all tasks',
    status: 'submitted'
});
```

**Validation Checks:**
```javascript
const conflicts = await validateTimesheet(timesheet);
// Checks:
// - Hours match visit duration
// - Overlapping timesheets
// - Excessive mileage (>100 miles)
// - Visit completed status

if (conflicts.length > 0) {
    // Show warnings but allow submission
    // Conflicts sent to admin for review
}
```

**System Actions:**
1. Validates timesheet data
2. Checks for conflicts
3. Creates timesheet record (status: 'submitted')
4. Sends notification to admins
5. Adds to pending approvals dashboard

### Phase 2: Admin Review

Admin reviews pending timesheets:
```javascript
// Get all pending timesheets
const pending = await getPendingTimesheets({
    startDate: '2026-05-01',
    endDate: '2026-05-31'
});

// Shows:
// - Caregiver name
// - Client name
// - Date and hours
// - Mileage
// - Conflict warnings
// - Submitted timestamp
```

**Dashboard View:**
```
┌─────────────────────────────────────────────────────────────┐
│ Pending Timesheet Approvals (12)                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ⚠️ Jane Smith - Mary Johnson - May 28                      │
│    Hours: 8.0 | Mileage: 45 miles                        │
│    Warning: Mileage seems high for single day              │
│    [Approve] [Request Correction] [Reject]                 │
│                                                             │
│ ✓ John Doe - Robert Brown - May 28                         │
│    Hours: 4.0 | Mileage: 8 miles                           │
│    No conflicts                                            │
│    [Approve] [Request Correction] [Reject]                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Phase 3: Approval

Admin approves timesheet:
```javascript
await approveTimesheet('timesheet-uuid', 'admin-uuid', {
    notes: 'Looks good, approved for payroll'
});
```

**System Actions:**
1. Calculates overtime using 40-hour week threshold:
   ```javascript
   const { regular_hours, overtime_hours } = await supabaseClient
       .rpc('calculate_overtime', {
           p_caregiver_id: caregiverId,
           p_week_start: weekStartDate,
           p_hours: hoursWorked
       });
   ```
2. Updates timesheet:
   - `status` → 'approved'
   - `approved_by` → admin ID
   - `approved_at` → timestamp
   - `regular_hours` → calculated
   - `overtime_hours` → calculated
   - `admin_notes` → provided notes
3. Sends notification to caregiver

### Phase 4: Rejection

Admin rejects timesheet:
```javascript
await rejectTimesheet('timesheet-uuid', 'admin-uuid', 
    'Hours do not match scheduled visit duration (4h vs 8h submitted)'
);
```

**System Actions:**
1. Updates timesheet:
   - `status` → 'rejected'
   - `rejection_reason` → provided reason
   - `approved_by` → admin ID (who rejected)
   - `approved_at` → timestamp
2. Sends high-priority notification to caregiver
3. Requires caregiver to resubmit

### Phase 5: Correction Requested

Admin requests changes:
```javascript
await requestTimesheetCorrection('timesheet-uuid', 'admin-uuid',
    'Please verify mileage - seems high. Also add note about client condition.'
);
```

**System Actions:**
1. Updates timesheet:
   - `status` → 'correction_requested'
   - `correction_notes` → requested changes
   - `approved_by` → admin ID
   - `approved_at` → timestamp
2. Sends notification to caregiver with instructions
3. Caregiver edits and resubmits

### Phase 6: Payroll Lock

When payroll exported:
```javascript
await updatePayrollExportStatus(exportId, 'exported');
// System automatically:
// - Finds all approved timesheets in period
// - Sets status to 'payroll_exported'
// - Sets payroll_export_id
// - Locks from future edits
```

**Locked Timesheet:**
- Cannot be edited
- Cannot be rejected
- Cannot be corrected
- Permanent record for audit

---

## Conflict Validation

### 1. Duration Mismatch

**Check:** Submitted hours vs scheduled duration
```javascript
const scheduledMinutes = calculateScheduledDuration(schedules);
const submittedMinutes = timesheet.hours_worked * 60;
const variance = Math.abs(submittedMinutes - scheduledMinutes);

if (variance > 15) { // 15 minutes tolerance
    conflicts.push({
        type: 'duration_mismatch',
        severity: 'warning',
        message: `Submitted hours (${hoursWorked}h) differ from scheduled (${scheduledHours}h)`
    });
}
```

**Resolution:**
- Admin reviews and decides
- If caregiver worked longer: Approve with note
- If error: Request correction

### 2. Overlapping Timesheets

**Check:** Multiple timesheets same day
```javascript
const otherTimesheets = await getTimesheets({
    caregiver_id: timesheet.caregiver_id,
    date: timesheet.date,
    status: ['submitted', 'pending', 'approved']
});

const totalHours = sum(otherTimesheets.map(t => t.hours_worked)) + timesheet.hours_worked;

if (totalHours > 16) {
    conflicts.push({
        type: 'excessive_hours',
        severity: 'error',
        message: `Total hours (${totalHours}h) exceeds 16-hour safety limit`
    });
}
```

**Resolution:**
- Reject if impossible (can't work 20 hours in a day)
- Approve if legitimate (rare emergency situation)

### 3. Excessive Mileage

**Check:** Miles seem unrealistic
```javascript
if (timesheet.mileage > 100) {
    conflicts.push({
        type: 'high_mileage',
        severity: 'warning',
        message: `Mileage (${timesheet.mileage} miles) seems high`
    });
}
```

**Resolution:**
- Request correction with explanation
- Approve if caregiver covers wide rural area

### 4. Incomplete Visit

**Check:** Visit not marked completed
```javascript
const incompleteVisits = schedules.filter(s => 
    s.lifecycle_status !== 'completed'
);

if (incompleteVisits.length > 0) {
    conflicts.push({
        type: 'incomplete_visit',
        severity: 'error',
        message: `${incompleteVisits.length} visit(s) not marked as completed`
    });
}
```

**Resolution:**
- Reject until caregiver clocks out
- Emergency: Admin can override

---

## API Reference

### Get Pending Timesheets

```javascript
const pending = await getPendingTimesheets({
    caregiverId: 'caregiver-uuid',  // Optional filter
    startDate: '2026-05-01',
    endDate: '2026-05-31'
});

// Returns array with:
// - timesheet data
// - caregiver info
// - client info
// - schedule details
```

### Approve Timesheet

```javascript
const success = await approveTimesheet(
    'timesheet-uuid',
    'admin-uuid',
    { notes: 'Approved for payroll' }
);

// Automatically:
// - Calculates regular vs overtime hours
// - Sends notification to caregiver
// - Updates dashboard counts
```

### Reject Timesheet

```javascript
const success = await rejectTimesheet(
    'timesheet-uuid',
    'admin-uuid',
    'Hours do not match visit duration'
);

// Sends high-priority notification
```

### Request Correction

```javascript
const success = await requestTimesheetCorrection(
    'timesheet-uuid',
    'admin-uuid',
    'Please verify mileage and add visit notes'
);

// Caregiver will see correction request
// Must resubmit with changes
```

### Validate Before Submit

```javascript
const conflicts = await validateTimesheet({
    caregiver_id: 'caregiver-uuid',
    date: '2026-05-28',
    hours_worked: 8.5,
    mileage: 45,
    schedule_ids: ['schedule-1', 'schedule-2']
});

// Returns array of conflict objects
// Show to caregiver before submission
```

---

## Overtime Calculation

### 40-Hour Weekly Threshold

```sql
CREATE FUNCTION calculate_overtime(
    p_caregiver_id UUID,
    p_week_start DATE,
    p_hours DECIMAL
) RETURNS TABLE (regular_hours DECIMAL, overtime_hours DECIMAL)
```

**Logic:**
1. Sum all approved timesheets for week (excluding current)
2. If current week total >= 40:
   - All new hours are overtime
3. If current week total + new hours <= 40:
   - All new hours are regular
4. If crossing 40-hour threshold:
   - Split at 40-hour mark

**Example:**
```
Week Starting: Monday, May 26

Approved so far: 38 hours
New timesheet: 6 hours

Result:
- Regular: 2 hours (to reach 40)
- Overtime: 4 hours (over 40)
```

---

## Notifications

### Timesheet Submitted
**To:** Admins
```
Title: Timesheet Submitted
Message: Jane Smith submitted timesheet for Mary Johnson on May 28 (8.0 hours)
Action: Review for approval
```

### Timesheet Approved
**To:** Caregiver
```
Title: Timesheet Approved ✓
Message: Your timesheet for May 28 has been approved and is ready for payroll.
Details: 8.0 hours (Regular: 8.0, OT: 0)
```

### Timesheet Rejected
**To:** Caregiver (High Priority)
```
Title: Timesheet Rejected ✗
Message: Your timesheet for May 28 was rejected.
Reason: Hours do not match scheduled visit duration (4h vs 8h submitted)
Action: Please correct and resubmit
```

### Correction Requested
**To:** Caregiver (High Priority)
```
Title: Timesheet Correction Needed
Message: Please review and correct your timesheet for May 28.
Requested Changes: Please verify mileage - seems high. Also add note about client condition.
```

---

## Dashboard Widgets

### Admin: Pending Approvals

```
┌─────────────────────────────────────────────┐
│ Timesheet Approvals                         │
├─────────────────────────────────────────────┤
│                                             │
│ Pending:     12    ⚠️ Urgent: 3            │
│ Approved:    45                            │
│ Rejected:     2                            │
│                                             │
│ [Review Pending]                            │
└─────────────────────────────────────────────┘
```

### Caregiver: My Timesheets

```
┌─────────────────────────────────────────────┐
│ My Timesheets                               │
├─────────────────────────────────────────────┤
│                                             │
│ Recent Submissions                          │
│                                             │
│ May 28 - Mary Johnson                       │
│ Hours: 8.0 | Status: Approved ✓            │
│                                             │
│ May 27 - Robert Brown                       │
│ Hours: 4.0 | Status: Rejected ✗            │
│ Reason: Duration mismatch                  │
│ [Correct and Resubmit]                      │
│                                             │
│ May 26 - Linda Davis                        │
│ Hours: 6.0 | Status: Correction Needed ⚠  │
│ Note: Please verify mileage                │
│ [Edit]                                      │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Best Practices

### For Caregivers
1. **Submit daily** - Don't wait until end of week
2. **Verify hours** - Match scheduled duration ± 15 min
3. **Log mileage accurately** - Track all work travel
4. **Add notes** - Document any issues or exceptions
5. **Check before submit** - Review conflict warnings

### For Admins
1. **Review within 24 hours** - Don't let them pile up
2. **Check conflict warnings** - But use judgment
3. **Approve with notes** - Document decisions
4. **Reject with clear reasons** - So caregiver can fix
5. **Batch process** - Use filters for efficiency

---

## Troubleshooting

### Timesheet not showing in payroll
- Check status is 'approved' (not 'submitted')
- Verify date falls within pay period
- Confirm not already in another export

### Wrong overtime calculated
- Check week_starting date matches pay week
- Verify all previous timesheets in week are approved
- Review 40-hour threshold calculation

### Can't approve timesheet
- Check admin permissions (admin_owner or co_owner)
- Verify timesheet status is 'submitted' or 'pending'
- Confirm not already 'payroll_exported'

### Caregiver can't resubmit
- Check timesheet status is 'rejected' or 'correction_requested'
- Verify caregiver owns the timesheet
- Ensure not past payroll lock date

---

## Audit Trail

Every timesheet maintains:
- `created_at` - Initial submission
- `approved_by` - Who approved/rejected
- `approved_at` - When decision made
- `admin_notes` - Approval/rejection notes
- `rejection_reason` - Why rejected
- `correction_notes` - What needs fixing
- `payroll_export_id` - Which payroll export included

**Query for audit:**
```sql
SELECT 
    t.date,
    t.hours_worked,
    t.status,
    t.approved_at,
    p.name as approved_by,
    t.admin_notes
FROM timesheets t
LEFT JOIN profiles p ON t.approved_by = p.id
WHERE t.caregiver_id = 'caregiver-uuid'
ORDER BY t.date DESC;
```
