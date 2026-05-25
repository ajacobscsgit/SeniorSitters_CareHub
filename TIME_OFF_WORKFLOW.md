# Time-Off Request Workflow

## Overview

The time-off request system manages caregiver unavailability through a structured request and approval process. This ensures adequate coverage and prevents scheduling conflicts.

---

## Request Types

| Type | Use Case | Auto-Blocks Scheduling |
|------|----------|----------------------|
| **time_off** | Vacation, personal days, appointments | Yes (when approved) |
| **unavailable** | General unavailability, no specific reason | Yes (when approved) |
| **schedule_change** | Request to modify existing shifts | No (manual review) |
| **availability_update** | Permanent availability pattern change | No (manual review) |

---

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Caregiver submits request                                    │
│  → Status: pending                                            │
│  → Notification sent to admins                                │
└───────────────────────────┬─────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Admin reviews request                                        │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   APPROVE   │  │    DENY     │  │    NO ACTION        │ │
│  │             │  │             │  │                     │ │
│  │ • Add to    │  │ • Add note  │  │ • Remains pending   │ │
│  │   unavailable│  │   explaining│  │ • Visible in        │ │
│  │   dates     │  │   reason    │  │   dashboard         │ │
│  │ • Notify    │  │ • Notify    │  │                     │ │
│  │   caregiver │  │   caregiver │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Detailed Steps

### 1. Request Submission

**Who:** Caregiver or Admin (on behalf of caregiver)

**How:**
1. Go to caregiver profile → Time-Off tab
2. Click "New Request" button
3. Fill in:
   - Request Type
   - Start Date, End Date
   - Start Time, End Time (optional)
   - Reason/Notes
4. Submit

**System Actions:**
- Creates record with `status = 'pending'`
- Sends notification to all admins
- Shows in dashboard pending count

### 2. Admin Review

**Who:** Admin/Owner or Co-Owner

**How:**
1. See notification or dashboard alert
2. Go to caregiver profile → Time-Off tab
3. Review request details
4. Choose action:

#### Approve
- Click green checkmark
- Optional: Add admin notes
- System:
  - Updates status to `approved`
  - Adds dates to `caregiver_unavailable_dates`
  - Sends approval notification to caregiver
  - Blocks scheduling for those dates

#### Deny
- Click red X
- Required: Add reason in admin notes
- System:
  - Updates status to `denied`
  - Sends denial notification to caregiver with reason
  - Does not block scheduling

#### No Action
- Request remains pending
- Visible in caregiver's pending list
- Shows in admin dashboard alert count

### 3. Caregiver Cancellation

**Who:** Caregiver (only their own pending requests)

**How:**
1. Go to My Profile → Time-Off tab
2. Find pending request
3. Click "Cancel" button
4. Confirm cancellation

**System Actions:**
- Updates status to `cancelled`
- No notifications sent
- Removed from pending count

---

## Notification Templates

### Time-Off Request Submitted (to Admins)
```
Title: Time Off Request
Message: <Caregiver Name> requested time off: <Start Date> to <End Date>. Reason: <Reason>
Priority: normal
Type: time_off_request_submitted
```

### Time-Off Approved (to Caregiver)
```
Title: Time Off Request Approved
Message: Your time off request for <Start Date> to <End Date> has been approved. <Admin Notes>
Priority: normal
Type: time_off_request_approved
```

### Time-Off Denied (to Caregiver)
```
Title: Time Off Request Denied
Message: Your time off request for <Start Date> to <End Date> has been denied. <Admin Notes with reason>
Priority: normal
Type: time_off_request_denied
```

---

## Admin Dashboard Integration

### Pending Request Alert
```js
const pendingCount = await getPendingTimeOffCount();
// Shows in dashboard alerts section
// Click navigates to pending requests
```

### Dashboard Alert Card
```
┌─────────────────────────────────────┐
│ ⚠️  3 Pending Time-Off Requests     │
│                                     │
│ Review and approve/deny requests    │
│ [Review Requests]                   │
└─────────────────────────────────────┘
```

---

## Conflict Prevention

When a time-off request is approved:

1. **Dates added to unavailable_dates table**
   ```js
   await addCaregiverUnavailableDate(caregiverId, date, reason)
   ```

2. **Schedule builder warns about conflicts:**
   ```js
   checkScheduleConflicts({ caregiver_id, date })
   // Returns: { type: 'time_off', message: 'Caregiver has approved time off...' }
   ```

3. **Available caregivers query excludes time-off:**
   ```js
   getAvailableCaregivers({ date })
   // Filters out caregivers with approved time-off
   ```

---

## Policies & Best Practices

### Request Timing
- **Standard requests:** Submit at least 2 weeks in advance
- **Emergency requests:** As soon as possible, call admin directly
- **Blackout dates:** Company-defined periods (holidays, etc.)

### Approval Guidelines
- **Vacation:** Approve if coverage available
- **Sick time:** Approve immediately
- **Conflicts:** Deny with explanation, suggest alternatives

### Limits
- Maximum consecutive days off: 14 (company policy)
- Maximum pending requests: 3 per caregiver
- Blackout periods: Cannot request time off

---

## Edge Cases

### Partial Day Time-Off
When start_time and end_time are provided:
- Only blocks scheduling during those hours
- Caregiver available outside those times
- Conflict detection checks for overlap

### Multi-Day Requests
- Each date in range added to unavailable_dates
- All dates must be approved/denied together
- Cannot partially approve a date range

### Recurring Time-Off
For regular unavailability (e.g., every Friday afternoon):
- Use "Update Availability" type instead
- Admin edits availability pattern
- Not handled through time-off requests

### Emergency Override
Admin can directly mark unavailable:
1. Go to caregiver profile
2. Availability tab
3. "Mark Unavailable Date"
4. No request workflow needed

---

## Reporting

### Monthly Report
```sql
SELECT 
    c.name,
    COUNT(*) as request_count,
    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
    SUM(CASE WHEN status = 'denied' THEN 1 ELSE 0 END) as denied
FROM caregiver_time_off_requests tor
JOIN caregivers c ON tor.caregiver_id = c.id
WHERE created_at >= DATE_TRUNC('month', NOW())
GROUP BY c.name;
```

### Pending Aging Report
```sql
SELECT 
    c.name,
    tor.start_date,
    tor.reason,
    EXTRACT(DAY FROM NOW() - tor.created_at) as days_pending
FROM caregiver_time_off_requests tor
JOIN caregivers c ON tor.caregiver_id = c.id
WHERE status = 'pending'
  AND tor.created_at < NOW() - INTERVAL '2 days'
ORDER BY tor.created_at;
```

---

## Troubleshooting

### Request not appearing
- Check caregiver_id matches
- Verify status filter (pending vs all)
- Check RLS policies for table access

### Cannot approve/deny
- Verify user role is admin_owner or co_owner
- Check request status is still pending
- Review browser console for errors

### Approved but still scheduled
- Verify unavailable_dates entry created
- Check date format matches (YYYY-MM-DD)
- Review conflict detection logs

### Duplicate notifications
- Check if multiple admin users exist
- Each admin gets their own notification
- This is expected behavior
