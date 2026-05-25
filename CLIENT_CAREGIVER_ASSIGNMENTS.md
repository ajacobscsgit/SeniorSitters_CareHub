# Client-Caregiver Assignment System

## Overview

The `client_caregiver_assignments` table serves as the **operational bridge** connecting clients with caregivers. All schedules, visit updates, timesheets, and notifications flow through this assignment record.

**Core Principle:** Every operational interaction between a client and caregiver is linked through an assignment record, ensuring complete audit trails and role-based access control.

---

## Operational Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. Care Request Approved                                             │
│     ↓                                                                 │
│  2. Client Profile Created                                            │
│     ↓                                                                 │
│  3. Schedule Preferences Saved                                        │
│     ↓                                                                 │
│  4. Matching System Finds Caregivers                                  │
│     • Availability check                                                │
│     • Service area match                                                │
│     • Skills/preferences alignment                                      │
│     • Time-off conflict check                                           │
│     • Current workload balance                                          │
│     ↓                                                                 │
│  5. Admin Selects Caregiver                                           │
│     ↓                                                                 │
│  6. Assignment Created (active)                                       │
│     ↓                                                                 │
│  7. Schedule/Visits Created                                           │
│     • assignment_id set on schedules                                    │
│     • caregiver sees assigned client                                    │
│     • client sees assigned caregiver                                    │
│     ↓                                                                 │
│  8. Visit Day                                                         │
│     • Visit updates link to assignment                                  │
│     • Timesheets reference assignment                                   │
│     • Notifications sent via assignment context                         │
│     ↓                                                                 │
│  9. Assignment Ends (status: ended)                                   │
│     • End date recorded                                                 │
│     • Notifications sent                                                  │
│     • Historical data preserved                                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Table: `client_caregiver_assignments`

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key, auto-generated |
| `client_id` | UUID | Reference to clients table |
| `caregiver_id` | UUID | Reference to caregivers table |
| `status` | Enum | active, backup, ended |
| `start_date` | Date | When assignment begins |
| `end_date` | Date | When assignment ends (null = ongoing) |
| `assigned_by` | UUID | Admin who created assignment |
| `notes` | Text | Internal notes |
| `created_at`, `updated_at` | Timestamp | Audit fields |

### Related Table Updates

All operational tables now include `assignment_id`:

- **schedules** - Links visit to assignment
- **visit_updates** - Links update to assignment  
- **timesheets** - Links timesheet to assignment
- **notifications** - References assignment for context

---

## Assignment Statuses

| Status | Meaning | Use Case |
|--------|---------|----------|
| **active** | Currently providing care | Primary caregiver for client |
| **backup** | Available if primary unavailable | Secondary caregiver on standby |
| **ended** | Assignment terminated | Care completed or transferred |

### Status Transitions

```
active → ended (care completed)
backup → active (promoted to primary)
active → backup (demoted to secondary)
any → ended (assignment terminated)
```

---

## API Reference

### Get Assignments

```javascript
// Get all assignments with filters
const assignments = await getClientCaregiverAssignments({
    clientId: 'uuid',        // Filter by client
    caregiverId: 'uuid',     // Filter by caregiver
    status: 'active',        // Filter by status
    activeOnly: true,        // Only active assignments
    limit: 50                // Max results
});

// Get single assignment by ID
const assignment = await getAssignmentById('assignment-uuid');
```

### Create Assignment

```javascript
const assignment = await createClientCaregiverAssignment({
    clientId: 'client-uuid',
    caregiverId: 'caregiver-uuid',
    status: 'active',           // active, backup, ended
    startDate: '2026-05-28',    // Optional, defaults to today
    endDate: null,              // Optional, null = ongoing
    assignedBy: 'admin-uuid',   // Optional
    notes: 'Primary caregiver for daily visits'  // Optional
}, { sendNotification: true });  // Notify caregiver and client
```

**Auto-notifications sent:**
- Caregiver: "New Client Assignment - You have been assigned to care for [Client Name]"
- Client/Family: "Caregiver Assigned - [Caregiver Name] has been assigned to provide care"

### Update Assignment

```javascript
// Change status (sends notification)
await updateClientCaregiverAssignment('assignment-uuid', {
    status: 'backup',
    notes: 'Changed to backup caregiver'
}, { sendNotification: true });

// Modify dates
await updateClientCaregiverAssignment('assignment-uuid', {
    end_date: '2026-12-31'
});
```

### End Assignment

```javascript
// Gracefully end assignment (sends notification)
await endClientCaregiverAssignment('assignment-uuid', {
    reason: 'Client moved to facility',
    sendNotification: true
});
```

### Get Related Records

```javascript
// Get all caregivers for a client
const caregivers = await getClientCaregivers('client-uuid');

// Get all clients for a caregiver
const clients = await getCaregiverClients('caregiver-uuid');

// Check if assignment exists
const hasAssignment = await hasActiveAssignment('client-uuid', 'caregiver-uuid');

// Get assignment ID for pair
const assignmentId = await getActiveAssignment('client-uuid', 'caregiver-uuid');
```

---

## Integration Points

### 1. Schedule Creation

When creating a schedule, the system:
1. Checks for active assignment between client-caregiver
2. Creates assignment if doesn't exist (auto-create)
3. Sets `assignment_id` on schedule record

```javascript
// Schedule now includes assignment context
const schedule = {
    client_id: '...',
    caregiver_id: '...',
    assignment_id: '...',  // NEW: Links to assignment
    date: '2026-05-28',
    start_time: '09:00',
    end_time: '12:00'
};
```

### 2. Visit Updates

Visit updates reference the assignment:
```javascript
const visitUpdate = {
    schedule_id: '...',
    assignment_id: '...',  // NEW: Links to assignment
    caregiver_id: '...',
    client_id: '...',
    content: 'Visit completed successfully...',
    status: 'pending_approval'
};
```

### 3. Timesheets

Timesheets include assignment context:
```javascript
const timesheet = {
    caregiver_id: '...',
    client_id: '...',
    assignment_id: '...',  // NEW: Links to assignment
    schedule_ids: [...],
    hours_worked: 8.5,
    mileage: 12.3,
    status: 'submitted'
};
```

### 4. Notifications

All assignment-related notifications include:
```javascript
const notification = {
    type: 'caregiver_assigned',
    title: 'New Client Assignment',
    message: '...',
    caregiver_id: '...',    // Recipient caregiver
    client_id: '...',       // Related client
    related_table: 'client_caregiver_assignments',
    related_record_id: 'assignment-uuid'  // Assignment context
};
```

---

## Role-Based Access

### Admin/Owner
- View all assignments
- Create assignments for any client-caregiver pair
- Update/End any assignment
- View complete assignment history

### Co-Owner
- View all operational assignments
- Create assignments for operational needs
- Update/End assignments (limited to operational context)

### Caregiver
- View only assignments where `caregiver_id` matches them
- See assigned clients and their details
- Cannot create/modify assignments

### Client/Family
- View only assignments where `client_id` matches them
- See assigned caregivers and their details
- Cannot create/modify assignments

### Other Users
- Cannot view assignments they are not part of
- RLS policies enforce strict isolation

---

## SQL Functions

### Get Active Assignment
```sql
SELECT get_active_assignment('client-uuid', 'caregiver-uuid');
-- Returns: assignment-id or NULL
```

### Get Client's Caregivers
```sql
SELECT * FROM get_client_caregivers('client-uuid');
-- Returns: assignment_id, caregiver_id, caregiver_name, etc.
```

### Get Caregiver's Clients
```sql
SELECT * FROM get_caregiver_clients('caregiver-uuid');
-- Returns: assignment_id, client_id, client_name, etc.
```

### Check Active Assignment
```sql
SELECT has_active_assignment('client-uuid', 'caregiver-uuid');
-- Returns: true or false
```

---

## Use Cases

### Scenario 1: New Client Onboarding

```javascript
// 1. Care request approved, client profile created
const client = await createClient({...});

// 2. Save schedule preferences
await saveClientSchedulePreferences(client.id, {...});

// 3. Match caregivers
const matches = await getAvailableCaregivers({
    date: '2026-05-28',
    start_time: '09:00',
    end_time: '12:00',
    client_city: client.city
});

// 4. Admin selects caregiver, creates assignment
const assignment = await createClientCaregiverAssignment({
    clientId: client.id,
    caregiverId: matches[0].caregiver.id,
    status: 'active',
    notes: 'Primary caregiver for daily care'
});

// 5. Create recurring schedule
await createRecurringSchedules({
    client_id: client.id,
    caregiver_id: matches[0].caregiver.id,
    assignment_id: assignment.id,  // Links to assignment
    ...
});
```

### Scenario 2: Backup Caregiver Setup

```javascript
// Assign backup caregiver
await createClientCaregiverAssignment({
    clientId: 'client-uuid',
    caregiverId: 'backup-caregiver-uuid',
    status: 'backup',
    notes: 'Backup for when primary unavailable'
});
```

### Scenario 3: Caregiver Change

```javascript
// 1. End current assignment
await endClientCaregiverAssignment('current-assignment-id', {
    reason: 'Caregiver moved out of area'
});

// 2. Create new assignment with replacement
await createClientCaregiverAssignment({
    clientId: 'client-uuid',
    caregiverId: 'new-caregiver-uuid',
    status: 'active',
    notes: 'Replacement caregiver'
});
```

### Scenario 4: Visit Day Operations

```javascript
// Caregiver completes visit, submits update
await createVisitUpdate({
    schedule_id: 'schedule-uuid',
    assignment_id: 'assignment-uuid',  // From schedule
    caregiver_id: 'caregiver-uuid',
    client_id: 'client-uuid',
    content: 'Visit completed...',
    status: 'pending_approval'
});

// Submit timesheet
await createTimesheet({
    caregiver_id: 'caregiver-uuid',
    client_id: 'client-uuid',
    assignment_id: 'assignment-uuid',  // Links to assignment
    hours_worked: 4.0,
    mileage: 8.5
});
```

---

## Dashboard Integration

### Admin Command Center

**Assignments Widget:**
```
┌─────────────────────────────────────────────┐
│ Active Assignments                          │
├─────────────────────────────────────────────┤
│ 47 Total active assignments                 │
│ 3 Ending this week                          │
│ 5 Backup caregivers on standby              │
│                                             │
│ [View All Assignments]                      │
└─────────────────────────────────────────────┘
```

**Unassigned Clients Alert:**
```
┌─────────────────────────────────────────────┐
│ ⚠️  3 Clients Without Assigned Caregiver  │
│                                             │
│ • Mary Johnson - Needs daily care           │
│ • Robert Smith - 3x/week visits             │
│ • Linda Davis - Temporary assignment ended  │
│                                             │
│ [Assign Caregivers]                       │
└─────────────────────────────────────────────┘
```

### Caregiver Portal

**My Clients View:**
```
┌─────────────────────────────────────────────┐
│ My Assigned Clients                         │
├─────────────────────────────────────────────┤
│                                             │
│ Mary Johnson (Primary)                      │
│   Next visit: Today 9:00 AM                   │
│   [View Schedule] [Submit Update]           │
│                                             │
│ Robert Smith (Backup)                         │
│   No upcoming visits                          │
│   [View Details]                            │
│                                             │
└─────────────────────────────────────────────┘
```

### Client/Family Portal

**My Caregivers View:**
```
┌─────────────────────────────────────────────┐
│ My Caregivers                               │
├─────────────────────────────────────────────┤
│                                             │
│ Jane Smith - Primary Caregiver              │
│   Phone: (555) 123-4567                     │
│   Next visit: Tomorrow 2:00 PM              │
│   [View All Visits]                         │
│                                             │
│ John Doe - Backup                           │
│   Available when Jane is unavailable        │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Best Practices

### For Admins
1. **Always create assignment** before scheduling visits
2. **Use status appropriately** - backup for secondary caregivers
3. **End assignments properly** - don't just stop scheduling
4. **Add notes** - document reason for assignment changes
5. **Check for conflicts** - verify no time-off before assigning

### For Developers
1. **Always include assignment_id** when creating schedules/updates/timesheets
2. **Use RLS policies** - don't bypass role-based access
3. **Send notifications** - keep caregivers and clients informed
4. **Handle duplicates** - check for existing active assignment first
5. **Preserve history** - never delete assignments, end them instead

---

## Migration & Setup

### 1. Run SQL Migration
```bash
psql -f supabase/migrations/client_caregiver_assignments.sql
```

### 2. Create Existing Assignments
For existing schedules without assignments, run:
```sql
-- Auto-create assignments from existing schedules
INSERT INTO client_caregiver_assignments (client_id, caregiver_id, status, start_date, notes)
SELECT DISTINCT 
    s.client_id,
    s.caregiver_id,
    'active',
    MIN(s.date),
    'Auto-created from existing schedules'
FROM schedules s
LEFT JOIN client_caregiver_assignments a 
    ON s.client_id = a.client_id 
    AND s.caregiver_id = a.caregiver_id
    AND a.status = 'active'
WHERE a.id IS NULL
  AND s.caregiver_id IS NOT NULL
GROUP BY s.client_id, s.caregiver_id;

-- Update existing schedules to link to assignments
UPDATE schedules s
SET assignment_id = a.id
FROM client_caregiver_assignments a
WHERE s.client_id = a.client_id
  AND s.caregiver_id = a.caregiver_id
  AND a.status = 'active'
  AND s.assignment_id IS NULL;
```

### 3. Verify Integration
- Check assignments created
- Verify schedule links updated
- Test role-based access
- Confirm notifications working

---

## Troubleshooting

### Assignment not visible
- Verify RLS policies allow access
- Check status filter (active vs all)
- Confirm user role has permissions

### Duplicate active assignments
- System enforces unique constraint
- Check for data inconsistency
- End one assignment if needed

### Notifications not sent
- Verify createNotification() called
- Check notification type registered
- Confirm email/portal preferences

### Schedule missing assignment_id
- Run auto-create migration
- Manually link existing schedules
- Check for NULL caregiver_id
