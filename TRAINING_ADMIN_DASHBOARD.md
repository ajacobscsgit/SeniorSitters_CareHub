# Training Admin Dashboard Guide

## Overview

The Training Admin Dashboard provides comprehensive oversight of all caregiver training and onboarding activities. Admin/Owner and Co-Owner roles can monitor progress, assign deadlines, identify overdue items, and manage flagged caregivers.

**Access:** Training Hub (sidebar) → Any tab | OR Caregivers → Click any caregiver → Training/Onboarding tabs

---

## Dashboard Views

### 1. Training Hub - Training Tab

**Admin View:**
- See ALL training modules (active and inactive)
- Create new modules with title, description, type, and content URL
- Edit existing modules
- Delete modules (removes all assignments too)
- Assign modules to specific caregivers with due dates

**Module Types:**
- `video` - Video training content
- `document` - PDF, Word, or text documents
- `photo` - Image-based guides
- `quiz` - Quizzes with scoring
- `acknowledgement` - Requires caregiver confirmation/acknowledgement

**Assignment Features:**
- Set due dates with automatic countdown display
- Add admin notes to assignments
- View assignment status across all caregivers
- Filter by status (not_started, in_progress, completed, overdue)

### 2. Training Hub - Onboarding Tab

**Overview Table:**
- All caregivers with their onboarding progress
- Progress bars showing completion percentage
- Individual step checkboxes
- Background check status indicators
- Quick-edit functionality

**Progress Tracking:**
- 8 default onboarding steps
- Real-time progress calculation
- Color-coded status indicators
- Flag status visibility

### 3. Caregiver Profile - Training Tab

**Individual Caregiver View:**
- Training completion percentage
- Modules completed / total count
- Overdue count (with red highlight if > 0)
- Next due module countdown
- Full assignment history

**Assignment Cards:**
- Module title and description
- Status badge (color-coded)
- Due date with countdown text
- Completion date if finished
- Score (if quiz-type module)
- Admin notes

**Admin Actions:**
- Edit due dates
- Mark modules complete manually
- View training resource links

### 4. Caregiver Profile - Onboarding Tab

**Detailed Progress View:**
- Overall completion percentage with progress bar
- Flag status (if caregiver is flagged)
- Step-by-step checklist with status dropdowns

**Step Management:**
- Each step shows: title, description, status dropdown
- Status options: not_started, in_progress, completed, flagged
- Flagged steps display the flagged reason
- Admin notes visible per step

**Admin Controls:**
- Flag caregiver button (with reason input)
- Remove flag button
- Set due date button
- Edit onboarding checklist button

---

## Deadline & Countdown System

### Visual Indicators

| Status | Display | Color |
|--------|---------|-------|
| Due in > 3 days | "Due in 5 days" | Gray |
| Due in 2-3 days | "Due in 2 days" | Yellow/Amber |
| Due tomorrow | "Due tomorrow" | Orange |
| Due today | "Due today" | Red |
| Overdue | "Overdue by X days" | Red background |
| Completed | "Completed May 24, 2026" | Green |

### Automatic Overdue Detection

The system automatically identifies overdue items:
```js
// Training assignments
getTrainingAssignments({ overdue: true })

// Returns all assignments where:
// - due_date < now
// - status !== 'completed'
```

### Urgent Due Date Alerts

Notifications are marked high-priority when:
- Due date is within 2 days
- Item becomes overdue

---

## Flagging System

### When to Flag a Caregiver

- Missing required documents
- Background check delayed
- Training consistently overdue
- Performance concerns
- Administrative hold

### Flag Process

1. Open caregiver profile → Onboarding tab
2. Click "Flag Caregiver"
3. Enter reason (required)
4. Add admin notes (optional)
5. Click Save

**Effects:**
- Caregiver marked with red FLAGGED badge
- High-priority notification sent to all admins
- Flagged status visible in all caregiver lists
- Progress bar turns red

### Removing Flags

1. Open flagged caregiver's profile
2. Click "Remove Flag"
3. Flag removed immediately
4. Status returns to normal

---

## Statistics & Reporting

### Individual Caregiver Stats

```js
getCaregiverTrainingStats(caregiverId)
```

Returns:
```json
{
  "training": {
    "total": 9,
    "completed": 7,
    "overdue": 1,
    "percentage": 78,
    "nextDue": "2026-05-28T00:00:00Z",
    "nextDueModule": "HIPAA & Privacy"
  },
  "onboarding": {
    "total": 8,
    "completed": 6,
    "percentage": 75,
    "flagged": false
  }
}
```

### Dashboard-Level Stats

```js
getAllCaregiversTrainingStats()
```

Returns array of all caregivers with their stats for comparative reporting.

### Overdue Report

```js
getOverdueTrainingAssignments()
```

Returns all overdue assignments across all caregivers, sorted by due date (oldest first).

Use this for:
- Daily standup reports
- Follow-up calls
- Escalation tracking

### Approaching Due Report

```js
getTrainingApproachingDue(3) // Due within 3 days
```

Returns assignments due within specified days.

Use this for:
- Proactive outreach
- Deadline reminders

---

## Notification Management

### Automatic Notifications

| Event | Recipient | Priority |
|-------|-----------|----------|
| Training assigned | Caregiver | normal/high* |
| Due date updated | Caregiver | normal/high* |
| Training completed | Admins | normal |
| Caregiver flagged | Admins | high |
| Onboarding step completed | Admins | normal |

*High if due within 2 days

### Manual Notifications

Admins can create custom notifications via the Notifications page for:
- Training reminders
- Deadline warnings
- Policy updates
- General announcements

---

## Best Practices

### Onboarding New Caregivers

1. **Day 1:** Send portal invite, assign handbook (acknowledgement type)
2. **Day 2-3:** Assign emergency procedures and timesheet training
3. **Week 1:** Complete all required training modules
4. **Week 2:** Background check submitted, orientation scheduled
5. **Week 3:** Orientation completed, final documents uploaded
6. **Week 4:** 100% onboarding complete, active status

### Managing Overdue Items

1. Check `getOverdueTrainingAssignments()` daily
2. Contact caregiver within 24 hours of overdue
3. Update due date if legitimate extension needed
4. Flag if repeated pattern
5. Escalate to management if unresolved after 1 week

### Training Assignment Strategy

- Assign 2-3 modules at a time (not all at once)
- Set realistic due dates (1-2 weeks per module)
- Use acknowledgements for critical policies
- Space out assignments for ongoing education

### Using the Flag System

**DO:**
- Flag for administrative holds
- Flag for document collection delays
- Flag with specific, actionable reasons
- Remove flags promptly when resolved

**DON'T:**
- Flag for performance issues (use separate system)
- Leave flags active indefinitely
- Flag without adding a reason

---

## Troubleshooting

### Caregiver Can't See Assigned Training

1. Verify assignment exists in database
2. Check caregiver's role filter (they see only their own)
3. Verify module is active
4. Check for JavaScript errors in browser console

### Progress Not Updating

1. Refresh the page (stats cache for 30 seconds)
2. Check database for updates
3. Verify `updateOnboardingProgress()` returned true
4. Look for network errors in browser console

### Notifications Not Sending

1. Verify `createNotification()` called successfully
2. Check Supabase RLS policies
3. Verify notification type is valid
4. Check recipient role/caregiver_id is correct

---

## Database Reference

### Key Queries for Admin Reporting

```sql
-- All caregivers with incomplete onboarding
SELECT c.name, c.email, 
       COUNT(CASE WHEN cop.status != 'completed' THEN 1 END) as incomplete_steps
FROM caregivers c
LEFT JOIN caregiver_onboarding_progress cop ON c.id = cop.caregiver_id
GROUP BY c.id
HAVING COUNT(CASE WHEN cop.status != 'completed' THEN 1 END) > 0;

-- Overdue training assignments
SELECT c.name, tm.title, cta.due_date
FROM caregiver_training_assignments cta
JOIN caregivers c ON cta.caregiver_id = c.id
JOIN training_modules tm ON cta.module_id = tm.id
WHERE cta.due_date < NOW() 
  AND cta.status != 'completed'
ORDER BY cta.due_date ASC;

-- Flagged caregivers
SELECT c.name, c.email, cop.flagged_reason
FROM caregiver_onboarding_progress cop
JOIN caregivers c ON cop.caregiver_id = c.id
WHERE cop.status = 'flagged';
```

---

## Setup Checklist

- [ ] Run SQL migration: `supabase/migrations/caregiver_training_tables.sql`
- [ ] Verify default onboarding steps created
- [ ] Verify default training modules created
- [ ] Test assign training workflow
- [ ] Test complete training workflow
- [ ] Test flag caregiver workflow
- [ ] Set real business phone in emergency resources
- [ ] Train admin staff on dashboard use
- [ ] Document any custom training modules added
- [ ] Review pending caregiver documents under Training Hub → Documents
- [ ] Verify only active caregivers appear in scheduling dropdowns

---

## Phase 2: Training Dashboard, Documents & Activation Compliance

### New Dashboard Metrics
The Training Hub Dashboard tab now displays:
- **Total Assigned Training** — sum of all required module assignments
- **Completion Rate** — percentage of completed required assignments
- **Overdue Training** — assignments past their due date
- **Due Within 7 Days** — upcoming due dates
- **New Caregiver Onboarding** — caregivers with status `onboarding`
- **Active Caregivers** — caregivers with `activation_status = active`
- **In Training / Documents** — caregivers in `training_required`, `training_complete`, or `documents_required`
- **Flagged Caregivers** — caregivers with `activation_status = flagged`
- **Document Compliance** — lowest document approval percentages first

### Document Review Workflow
1. Caregiver uploads a required document in Training Hub → Documents
2. Document status becomes `pending`
3. Admin opens Training Hub → Documents to review pending uploads
4. Admin approves or rejects with notes
5. Approval advances the caregiver toward `active` activation status

### Activation Compliance Enforcement
- Schedule creation and edit dropdowns only include caregivers with `activation_status = active`
- The database layer (`createSchedule`/`updateSchedule`) blocks scheduling ineligible caregivers
- Caregiver profile overview shows activation status and document/training progress
- Caregiver directory includes a `Flagged` filter for quick compliance review

---

## Phase 3: Automatic Training Assignment & Activation

### Application Approval Flow
When an admin approves a caregiver application:
1. The caregiver profile is created with `status = onboarding` and `activation_status = training_required`.
2. All required active training modules are automatically assigned with a 7-day due date.
3. Required document placeholders are created.
4. A portal invite can be sent immediately or later.
5. The caregiver sees assigned training as soon as they log in.

### Training Status Badges
The caregiver directory and profile display a Phase 3 badge:
- **Training Required** — `activation_status = training_required`.
- **Training In Progress** — some training complete or training done but documents/background check pending.
- **Active** — `activation_status = active`.
- **Training Overdue** — a required assignment is past its due date.

### Bulk Admin Actions
In Training Hub → Training, admins can:
- **Assign Required Training to All Eligible Caregivers** — assigns missing modules to all caregivers with `activation_status = training_required`.
- **Backfill Existing Caregivers** — assigns missing modules to all onboarding and active caregivers, useful for caregivers approved before the automation existed.

Both actions skip caregivers who already have the required assignments.

### Dashboard Alerts
The Command Center alerts panel now includes:
- **Training Required** — new caregivers waiting for training.
- **Training Overdue** — caregivers with overdue assignments.
- **Training Complete — Ready for Activation** — caregivers who finished training and need documents/background check review.

### Scheduling
- Only caregivers with `activation_status = active` appear in visit creation/edit dropdowns.
- The caregiver dropdown in the visit modal shows a note explaining the active-only filter.
- If a previously scheduled caregiver becomes ineligible, the edit modal shows a red warning and keeps them selected until an active caregiver is chosen.

---

## Support

For technical issues with the Training Admin Dashboard:
1. Check browser console for JavaScript errors
2. Verify Supabase connection in config.js
3. Confirm RLS policies are active
4. Review database.js for API errors
5. Check CAREGIVER_TRAINING_HUB.md for detailed API docs
