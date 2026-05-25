# Caregiver Onboarding Workflow

## Overview

When a new caregiver is approved and their portal account is created, the onboarding workflow tracks their progress from initial setup through orientation completion.

---

## Step-by-Step Flow

```
1. Caregiver application approved (Applications page)
        ↓
2. Admin creates caregiver profile (Caregivers page)
        ↓
3. Migration seeds onboarding_checklist row automatically
   (OR admin runs: INSERT INTO onboarding_checklist (caregiver_id) VALUES (...))
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

---

## Onboarding Checklist Steps

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

---

## Admin Workflow — Daily Use

### Adding a New Caregiver
1. Approve their application → Caregivers page → their profile is created
2. Go to **Training Hub → Onboarding** → their row appears automatically
3. Click **Edit** to begin tracking their progress

### Assigning Training
1. **Training Hub → Training** → find a module → click **Assign**
2. Select caregiver, set due date, optional notes → Save
3. Caregiver receives an in-app notification immediately

### Tracking Progress
- **Onboarding tab** shows a live progress table for all caregivers
- Progress bars update immediately when you save changes
- Background check status is color-coded: `pending` = amber, `cleared` = green, `failed` = red

### Recommended Required Training for New Hires
1. Company Orientation (category: `onboarding`, requires_acknowledgement: true)
2. Emergency Procedures (category: `safety`, requires_acknowledgement: true)
3. Timesheet Completion Guide (category: `policy`)
4. Visit Update Training (category: `policy`)
5. Client Communication Rules (category: `soft_skills`)

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
