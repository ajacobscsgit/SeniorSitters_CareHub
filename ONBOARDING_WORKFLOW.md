# Caregiver Onboarding Workflow

## Overview

When a new caregiver is approved and their portal account is created, the onboarding workflow tracks their progress from initial setup through orientation completion. The system supports both a legacy checklist (`onboarding_checklist`) and a new structured progress system (`onboarding_steps` + `caregiver_onboarding_progress`) with detailed step tracking, due dates, and flagging capabilities.

**Key Features:**
- 8 default onboarding steps with progress tracking
- Due date management and overdue detection
- Caregiver flagging for attention-required cases
- Real-time progress bars in Training Hub and caregiver profiles
- Automatic notifications for step completions and flags

---

## Step-by-Step Flow

### Legacy Checklist Flow

```
1. Caregiver application approved (Applications page)
        ↓
2. Admin creates caregiver profile (Caregivers page)
        ↓
3. Migration seeds onboarding_checklist row automatically
        ↓
4. Admin sends portal invite (sendCaregiverInvite in Caregivers page)
   → Notification created: invite_sent or invite_queued
        ↓
5. Caregiver logs in → sees Training Hub in sidebar
        ↓
6. Admin works through checklist via Training Hub → Onboarding → Edit
        ↓
7. Admin assigns required training modules
   → Notification sent to caregiver: training_assigned
        ↓
8. Caregiver completes modules + acknowledges required ones
        ↓
9. Admin marks remaining checklist steps complete
        ↓
10. Background check submitted → status updated to 'cleared'
        ↓
11. Orientation date set, orientation_completed = true
        ↓
12. Progress bar reaches 100% → caregiver is fully onboarded
```

### New Onboarding Progress Flow (Recommended)

```
1. Caregiver application approved → profile created
        ↓
2. Admin opens caregiver profile → Onboarding tab
   → 8 default steps are available for tracking
        ↓
3. Admin sets due dates for critical steps
        ↓
4. Admin assigns training modules with due dates
        ↓
5. Admin updates step status as caregiver progresses:
   - not_started → in_progress → completed
        ↓
6. System sends notifications:
   - training_assigned (when module assigned)
   - onboarding_step_completed (when step marked done)
        ↓
7. If issues arise, admin can flag caregiver with reason
   → High-priority notification sent to all admins
        ↓
8. Progress tracked in real-time in both:
   - Caregiver profile (Onboarding tab)
   - Training Hub (Onboarding table)
        ↓
9. 100% completion → caregiver fully onboarded
```

---

## Onboarding Systems

### System 1: Legacy Checklist (onboarding_checklist table)

| Step | Field | Who marks it |
|---|---|---|
| Profile Completed | `profile_completed` | Admin |
| Caregiver Handbook Reviewed | `handbook_reviewed` | Admin |
| Emergency Policy Reviewed | `emergency_policy_reviewed` | Admin |
| Timesheet Training Done | `timesheet_training_done` | Admin |
| Visit Update Training Done | `visit_update_training_done` | Admin |
| Required Documents Uploaded | `document_upload_done` | Admin |
| Orientation Completed | `orientation_completed` | Admin |
| Background Check | `background_check_status` | Admin (pending → submitted → cleared) |

### System 2: Structured Progress (onboarding_steps + caregiver_onboarding_progress)

| Step | Category | Required | Default Order |
|---|---|---|---|
| Complete Profile | paperwork | Yes | 1 |
| Sign Handbook Acknowledgement | compliance | Yes | 2 |
| Review Emergency Protocols | safety | Yes | 3 |
| Complete Timesheet Training | training | Yes | 4 |
| Complete Visit Update Training | training | Yes | 5 |
| Upload Required Documents | paperwork | Yes | 6 |
| Attend Orientation | training | Yes | 7 |
| Background Check Cleared | compliance | Yes | 8 |

**Status Options:**
- `not_started` - Step not yet begun
- `in_progress` - Currently working on this step
- `completed` - Step finished
- `flagged` - Issue requiring attention (with flagged_reason)

---

## Admin Workflow — Daily Use

### Adding a New Caregiver
1. Approve their application → Caregivers page → their profile is created
2. Go to **Training Hub → Onboarding** → their row appears automatically
3. Click **Edit** to begin tracking their progress
4. OR open caregiver profile → Onboarding tab for detailed step management

### Assigning Training
1. **Training Hub → Training** → find a module → click **Assign**
2. Select caregiver, set due date, optional notes → Save
3. Caregiver receives an in-app notification immediately
4. Urgent due dates (within 2 days) trigger high-priority notifications

### Tracking Progress
- **Training Hub → Onboarding tab** shows table for all caregivers
- **Caregiver Profile → Onboarding tab** shows detailed step-by-step progress
- Progress bars update immediately when you save changes
- Background check status is color-coded: `pending` = amber, `cleared` = green, `failed` = red

### Setting Due Dates
1. Open caregiver profile → Onboarding tab
2. Click "Set Due Date" to assign deadlines to steps
3. System automatically calculates and displays countdowns:
   - "Due in 5 days" (normal)
   - "Due tomorrow" (warning)
   - "Due today" (urgent)
   - "Overdue by 2 days" (critical)

### Flagging Caregivers
When a caregiver needs special attention:
1. Open caregiver profile → Onboarding tab
2. Click "Flag Caregiver" button
3. Enter reason (e.g., "Missing documents", "Background check delayed")
4. Optional: Add admin notes for internal reference
5. System sends high-priority notification to all admins
6. Flagged status appears prominently in caregiver lists

### Removing Flags
Once issues are resolved:
1. Open flagged caregiver's profile
2. Click "Remove Flag" button
3. Status returns to normal tracking

### Recommended Required Training for New Hires
1. Caregiver Handbook (type: `document`, is_required: true)
2. Emergency Procedures (type: `video`, is_required: true)
3. Timesheet Training (type: `video`, is_required: true)
4. Visit Update Training (type: `video`, is_required: true)
5. HIPAA & Privacy (type: `acknowledgement`, is_required: true)
6. Mileage Policy (type: `document`, is_required: true)
7. Dress Code Policy (type: `document`, is_required: true)
8. Incident Reporting (type: `acknowledgement`, is_required: true)

**Estimated Total Time:** ~2.5 hours for all required modules

---

## Caregiver Workflow

### What the caregiver sees on first login
- **Training Hub → Training** — assigned modules with status badges and due dates
- **Training Hub → Onboarding** — personal checklist with progress bar
- **Training Hub → Resources** — handbook, policies, contacts
- **Training Hub → Emergency** — 911 reminder + agency contacts

### Completing a training module
1. Click the module to read/view content or follow the URL link
2. Click **Mark Complete** (or **Acknowledge & Complete** if acknowledgement is required)
3. Status updates immediately; admin can see the change in their dashboard

---

## Database Seeding

The migration automatically seeds `onboarding_checklist` rows for all existing caregivers:

```sql
insert into public.onboarding_checklist (caregiver_id)
    select id from public.caregivers
    where id not in (select caregiver_id from public.onboarding_checklist)
    on conflict (caregiver_id) do nothing;
```

**For new caregivers added after the migration**, the row is NOT auto-created. Either:
- Re-run the migration (it's idempotent), OR
- Insert manually in Supabase SQL Editor:
  ```sql
  INSERT INTO onboarding_checklist (caregiver_id) VALUES ('<caregiver-uuid>');
  ```

---

## Default Resource Seeds

The migration seeds 6 default resource entries:

| Title | Category |
|---|---|
| Emergency: Call 911 | emergency |
| After-Hours Contact | contact |
| Incident Reporting | incident |
| Mileage Policy | mileage |
| Dress Code | dress_code |
| Client Communication Rules | communication |

**Update the "After-Hours Contact" resource** with your real phone number via Training Hub → Resources → Edit.

---

## Background Check Statuses

| Status | Meaning | Color |
|---|---|---|
| `pending` | Not yet submitted | Amber |
| `submitted` | Submitted to vendor | Blue |
| `cleared` | Background check passed | Green |
| `failed` | Background check failed | Red |
| `waived` | Waived by admin | Gray |
