# Caregiver Availability & Scheduling System

## Overview

The Caregiver Availability system enables:
- **Admins** to build caregiver work schedules, set recurring availability, and manage time-off requests
- **Caregivers** to view their schedules, submit availability preferences, and request time off

**Integration Points:**
- Schedule builder (conflict detection)
- Real-time notifications
- Dashboard alerts for pending requests
- Caregiver profile tabs

---

## Database Schema

### Tables

#### `caregiver_availability`
Weekly recurring availability patterns for each caregiver.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `caregiver_id` | UUID | Reference to caregiver |
| `day_of_week` | String | Sunday-Saturday |
| `start_time` | Time | Availability start (HH:MM) |
| `end_time` | Time | Availability end (HH:MM) |
| `recurrence_type` | String | weekly, biweekly, custom |
| `effective_start_date` | Date | When this availability starts |
| `effective_end_date` | Date | When this availability ends (optional) |
| `service_area` | String | Geographic service area |
| `status` | String | active, inactive |
| `created_by`, `updated_by` | UUID | Audit fields |

#### `caregiver_time_off_requests`
Time-off, unavailability, and schedule change requests.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `caregiver_id` | UUID | Requesting caregiver |
| `requested_by` | UUID | User who created the request (caregiver or admin) |
| `start_date` | Date | Start of period |
| `end_date` | Date | End of period |
| `start_time` | Time | Optional: partial day start |
| `end_time` | Time | Optional: partial day end |
| `request_type` | Enum | time_off, unavailable, schedule_change, availability_update |
| `reason` | Text | User-provided reason |
| `status` | Enum | pending, approved, denied, cancelled |
| `admin_notes` | Text | Admin response notes |
| `reviewed_by`, `reviewed_at` | UUID/Timestamp | Review audit |

#### `caregiver_unavailable_dates`
Specific dates when caregiver is unavailable (auto-created from approved requests or admin-marked).

| Field | Type | Description |
|-------|------|-------------|
| `caregiver_id` | UUID | Reference |
| `date` | Date | Unavailable date |
| `reason` | String | Optional reason |
| `request_id` | UUID | Link to time_off_requests (if applicable) |
| `created_by` | UUID | Who marked unavailable |

---

## Caregiver Profile Tabs

### 1. Schedule Tab
Shows upcoming visits with status indicators.

**Features:**
- Stats: Scheduled, Completed, Unavailable counts
- Upcoming visits list (next 10 visits)
- Today highlighting
- Client and location info
- Admin: Add visit button

### 2. Availability Tab
Weekly availability editor and viewer.

**Features:**
- Day-by-day time slot display
- Service area per slot
- Admin: Edit button opens availability modal
- Admin: Mark unavailable date button
- "Not available" indicator for empty days

### 3. Time-Off Requests Tab
Full request history and submission.

**Features:**
- Pending/Approved count badges
- Request cards with:
  - Type label (Time Off, Unavailable, etc.)
  - Status badge (color-coded)
  - Date range and times
  - Reason and admin notes
  - Created/reviewed timestamps
- Admin: Approve/Deny buttons for pending
- Caregiver: Cancel button for pending
- New Request button

---

## Modals

### Create Time-Off Request Modal
**Fields:**
- Request Type (dropdown)
- Start Date, End Date
- Start Time, End Time (optional)
- Reason/Notes

**Validation:**
- Start date <= End date
- Start time < End time (if both provided)

### Edit Availability Modal
**Interface:**
- 7 day sections (Sunday-Saturday)
- Each day has time slot rows
- Each row: Start Time, End Time, Service Area, Delete button
- Add Time Slot button per day

**Validation:**
- Start time < End time per slot
- Empty day = not available that day

### Mark Unavailable Date Modal
**Fields:**
- Date picker
- Reason (optional)

---

## API Reference

### Time-Off Requests

```js
// Get requests with filters
getTimeOffRequests({ caregiverId, status, requestType, pendingOnly, limit })

// Get pending count for dashboard
getPendingTimeOffCount()

// Create request (sends notification to admins)
createTimeOffRequest({ caregiverId, requestedBy, startDate, endDate, startTime, endTime, requestType, reason })

// Approve or deny (sends notification to caregiver, optionally adds to unavailable_dates)
reviewTimeOffRequest(requestId, status, reviewedBy, { adminNotes, addToUnavailable })

// Cancel pending request (caregiver only)
cancelTimeOffRequest(requestId, caregiverId)

// Check for conflicts
checkCaregiverTimeOff(caregiverId, date, startTime, endTime)
```

### Availability Management

```js
// Get weekly availability
getCaregiverAvailability(caregiverId)

// Save all slots (replaces existing)
saveCaregiverAvailability(caregiverId, slots)

// Get unavailable dates
getCaregiverUnavailableDates(caregiverId)

// Add single unavailable date
addCaregiverUnavailableDate(caregiverId, date, reason)

// Remove unavailable date
removeCaregiverUnavailableDate(caregiverId, date)
```

### Conflict Detection

```js
// Check all conflict types (includes time-off)
checkScheduleConflicts({ date, start_time, end_time, caregiver_id, client_id, exclude_id })

// Returns array of conflicts:
// - caregiver_booked
// - client_booked
// - unavailable_date
// - time_off
// - outside_availability

// Get available caregivers for a slot
getAvailableCaregivers({ date, start_time, end_time, client_city })
```

---

## Notifications

| Event | Recipient | Type | Priority |
|-------|-----------|------|----------|
| Time-off request submitted | Admins | time_off_request_submitted | normal |
| Time-off request approved | Caregiver | time_off_request_approved | normal |
| Time-off request denied | Caregiver | time_off_request_denied | normal |

---

## Conflict Prevention

When creating or editing a schedule, the system automatically warns if:

1. **Caregiver already booked** - Has another visit at that time
2. **Client already booked** - Has another visit at that time
3. **Caregiver unavailable** - Date is in `caregiver_unavailable_dates`
4. **Caregiver on time-off** - Approved time-off request covers this date/time
5. **Outside availability** - Time falls outside caregiver's weekly availability

**UI Behavior:**
- Conflicts shown in warnings list
- Admin can still save if needed (override)
- Caregiver availability shown in caregiver selector

---

## Permissions

| Feature | Admin/Owner | Co-Owner | Caregiver | Client |
|---------|-------------|----------|-----------|--------|
| View all caregiver schedules | ✓ | ✓ | ✗ | ✗ |
| Edit caregiver availability | ✓ | ✓ | ✗ | ✗ |
| Mark unavailable dates | ✓ | ✓ | ✗ | ✗ |
| Approve/deny time-off | ✓ | ✓ | ✗ | ✗ |
| View own schedule | ✓ | ✓ | ✓ | ✗ |
| View own availability | ✓ | ✓ | ✓ | ✗ |
| Submit time-off request | ✓ | ✓ | ✓ | ✗ |
| Cancel own pending request | ✓ | ✓ | ✓ | ✗ |

---

## Setup

1. Run SQL migration:
   ```bash
   supabase/migrations/caregiver_availability_timeoff.sql
   ```

2. Verify tables created:
   - `caregiver_time_off_requests`
   - Enhanced `caregiver_availability`

3. Test workflow:
   - Create time-off request
   - Approve/deny
   - Check conflict detection in schedule builder

---

## Best Practices

### For Admins
- Set up caregiver availability during onboarding
- Review time-off requests within 24-48 hours
- Use "Mark Unavailable Date" for emergency situations
- Check conflict warnings when building schedules

### For Caregivers
- Submit time-off requests at least 2 weeks in advance
- Provide clear reasons for requests
- Check schedule regularly for updates
- Update availability preferences as needed

---

## Troubleshooting

### Request not showing in dashboard
- Check `status` filter (pending vs all)
- Verify caregiver_id matches
- Check RLS policies if using Supabase

### Conflict not detected
- Ensure `checkCaregiverTimeOff()` is called
- Verify time-off request status is 'approved'
- Check date/time format (YYYY-MM-DD, HH:MM)

### Notification not received
- Verify `createNotification()` called
- Check recipient_role or caregiver_id set correctly
- Review notification type exists in system
