# Caregiver Training Hub

## Overview

The Training Hub gives caregivers a dedicated portal area for onboarding, assigned training, company resources, and emergency contacts. Admins can manage all content and track caregiver progress with deadlines, overdue tracking, and completion statistics.

**Navigation:** Sidebar → Training Hub (visible to `admin_owner`, `co_owner`, `caregiver`)

**Caregiver Profile Tabs:** Each caregiver profile now includes tabs for Training, Onboarding, Documents, and Notes with full progress tracking and admin management tools.

---

## Four Tabs

### 1. Training
- Card-based grid of training modules
- **Admin view:** See all modules (active + inactive), assign to caregivers, edit, delete
- **Caregiver view:** See only active modules assigned to them, with status (not_started / in_progress / completed / overdue), due date, and complete/acknowledge buttons
- Modules with `type = 'acknowledgement'` show an "Acknowledge & Complete" button
- Required modules are highlighted with an amber left border
- **Deadline tracking:** Shows "Due in X days", "Due tomorrow", "Due today", or "Overdue by X days"

### 2. Onboarding
- **Admin view:** Table of all caregivers with progress bars, per-step checkboxes, background check status, and an Edit button
- **Caregiver view:** Personal progress bar with 8 default checklist items + background check status. Admin notes shown if set.
- **Caregiver Profile Tab:** Detailed onboarding progress with step-by-step checklist, completion percentage, flag status, and due date tracking

### 3. Resources
- Card grid of company resources (handbook, policies, contacts, mileage, etc.)
- Pinned items appear first with a 📌 badge
- **Admin view:** Add/Edit/Delete resources, pin/unpin
- **Caregiver view:** Read-only; phone numbers are tappable `tel:` links; URLs open in new tab

### 4. Emergency
- Always-visible 911 reminder card
- Pulls all resources with `category = 'emergency'` or `category = 'contact'`
- Static incident escalation protocol (5 steps)
- Admin note pointing to the Resources tab for editing

---

## Database Tables

Run: `supabase/migrations/caregiver_training_tables.sql`

| Table | Purpose |
|---|---|
| `training_modules` | Reusable training content (video, document, photo, quiz, acknowledgement) |
| `caregiver_training_assignments` | Caregiver ↔ module assignments with status, due dates, completion tracking, scores |
| `onboarding_steps` | Master list of onboarding checklist items (8 default steps) |
| `caregiver_onboarding_progress` | Per-caregiver progress through onboarding steps with status tracking |
| `onboarding_checklist` | Legacy: One row per caregiver; boolean steps + background check status |
| `caregiver_resources` | Resource library (handbook, policies, contacts, emergency info) |

---

## Role Visibility

| Feature | admin_owner | co_owner | caregiver | client_family |
|---|---|---|---|---|
| View Training Hub | ✓ | ✓ | ✓ | ✗ |
| Create/edit modules | ✓ | ✓ | ✗ | ✗ |
| Assign training | ✓ | ✓ | ✗ | ✗ |
| View own assignments | ✓ | ✓ | ✓ (own only) | ✗ |
| Mark complete/ack | — | — | ✓ (own only) | ✗ |
| Edit onboarding checklist | ✓ | ✓ | ✗ | ✗ |
| View own onboarding | — | — | ✓ (own only) | ✗ |
| Create/edit resources | ✓ | ✓ | ✗ | ✗ |
| View resources | ✓ | ✓ | ✓ | ✗ |
| View caregiver training tab | ✓ | ✓ | ✓ (own only) | ✗ |
| Flag/unflag caregiver | ✓ | ✓ | ✗ | ✗ |
| Set due dates | ✓ | ✓ | ✗ | ✗ |

---

## Module Categories

`onboarding` · `safety` · `clinical` · `compliance` · `soft_skills` · `policy` · `general`

## Module Content Types

`document` · `video` · `link` · `quiz` · `photo_guide`

## Assignment Statuses

`not_started` → `in_progress` → `completed` / `overdue`

- **not_started:** Module assigned but not yet started
- **in_progress:** Caregiver has clicked "Start" or opened the module
- **completed:** Finished and acknowledged (with completed_at timestamp)
- **overdue:** Past due date and not completed (automatically detected)

---

## Resource Categories

`handbook` · `emergency` · `policy` · `contact` · `mileage` · `dress_code` · `communication` · `incident` · `general`

---

## Notifications Integration

Training notifications are automatically created:

### Training Assigned
```js
createNotification({
    type: 'training_assigned',
    title: 'Training Assigned',
    message: `You have been assigned: <module title> (Due: <date>)`,
    caregiver_id: caregiverId,
    priority: 'normal' | 'high'  // high if due within 2 days
})
```

### Due Date Updated
```js
createNotification({
    type: 'training_due_date_updated',
    title: 'Training Due Date Updated',
    message: `The due date has been updated to <date>. Reason: <reason>`,
    caregiver_id: caregiverId,
    priority: 'normal' | 'high'
})
```

### Training Completed
```js
createNotification({
    type: 'training_completed',
    title: 'Training Completed',
    message: `<Caregiver> completed "<module title>"`,
    recipient_role: 'admin_owner',
    priority: 'normal'
})
```

### Caregiver Flagged
```js
createNotification({
    type: 'caregiver_flagged',
    title: 'Caregiver Flagged',
    message: `<Caregiver> has been flagged: <reason>`,
    recipient_role: 'admin_owner',
    priority: 'high'
})
```

### Onboarding Step Completed
```js
createNotification({
    type: 'onboarding_step_completed',
    title: 'Onboarding Step Completed',
    message: `<Caregiver> completed: <step title>`,
    recipient_role: 'admin_owner',
    priority: 'normal'
})
```

---

## API Reference (`database.js`)

### Training Modules
```js
getTrainingModules({ activeOnly })
createTrainingModule(mod)
updateTrainingModule(id, updates)
deleteTrainingModule(id)
getTrainingModuleById(id)
```

### Training Assignments
```js
getTrainingAssignments({ caregiverId, moduleId, status, dueBefore, overdue })
assignTrainingModule({ moduleId, caregiverId, assignedBy, dueDate, notes, sendNotification })
updateTrainingAssignment(id, updates, { sendNotification, reason })
markTrainingComplete(id, { completedBy, score })
acknowledgeTraining(id, { completedBy })
getTrainingAssignmentById(id)
updateTrainingStatusToInProgress(id)
```

### Onboarding Steps
```js
getOnboardingSteps({ activeOnly, category })
createOnboardingStep(step)
updateOnboardingStep(id, updates)
deleteOnboardingStep(id)
getOnboardingStepById(id)
```

### Onboarding Progress
```js
getOnboardingProgress(caregiverId)
updateOnboardingProgress(caregiverId, stepId, updates, { sendNotification })
getAllOnboardingProgress()
```

### Caregiver Management
```js
flagCaregiver(caregiverId, { reason, adminNotes, notify })
unflagCaregiver(caregiverId)
```

### Statistics & Dashboard
```js
getCaregiverTrainingStats(caregiverId)           // Individual stats
getAllCaregiversTrainingStats()                  // All caregivers' stats
getOverdueTrainingAssignments()                    // All overdue assignments
getTrainingApproachingDue(days)                  // Due within X days
```

### Utility Functions
```js
_formatDueDate(dateString)     // "Due in 3 days", "Overdue by 2 days"
_isUrgentDue(dateString)       // true if due within 2 days
_isOverdue(dateString)         // true if past due
```

### Legacy (Onboarding Checklist)
```js
getOnboardingChecklist(caregiverId)
upsertOnboardingChecklist(caregiverId, updates)
getAllOnboardingChecklists()
```

### Resources
```js
getCaregiverResources({ category, activeOnly })
createCaregiverResource(resource)
updateCaregiverResource(id, updates)
deleteCaregiverResource(id)
```

---

## Setup Checklist

1. Run `supabase/migrations/20260524_training_hub.sql` in Supabase SQL Editor
2. Run `supabase/migrations/20260621_phase2_training_hub.sql` in Supabase SQL Editor
3. Verify seed data created default `onboarding_checklist` rows for existing caregivers
4. Verify the 12 required onboarding modules and quiz questions were seeded
5. Verify the `caregiver-documents` storage bucket was created
6. Set `window.DEBUG = true` temporarily to verify DB calls in console
7. Add your real business phone number to the "After-Hours Contact" resource via the Resources tab

---

## Phase 2: Complete Training, Documents & Activation Workflow

### Overview
Phase 2 adds a full quiz engine, secure document collection, downloadable completion certificates, and a caregiver activation workflow that integrates with scheduling.

### Required Onboarding Curriculum (12 modules)
1. Welcome to SeniorSitters
2. Non-Medical Companion Care Overview
3. Professional Boundaries
4. Senior Safety
5. Fall Prevention
6. Emergency Response
7. Transportation & Outings
8. Documentation & CareHub Usage
9. Family Communication
10. Elder Abuse Awareness
11. Confidentiality & Privacy
12. Company Policies

Each module is seeded as a required training module with a quiz (passing score 80%) except Welcome and Confidentiality, which require acknowledgement.

### Quiz Engine Features
- Multiple-choice and true/false questions
- Configurable passing score per module
- Unlimited or limited retake attempts
- Full attempt history with scores
- Automatic completion and certificate issuance on pass

### Required Documents
- Driver's License
- Auto Insurance
- Background Check
- W9
- Direct Deposit Form
- Signed Policies

Uploads are stored in the `caregiver-documents` Supabase Storage bucket. Admin review and approval are required.

### Activation Workflow
`approved → training_required → training_complete → documents_required → active`

Caregivers must complete all required training, have all required documents approved, and have a cleared/waived background check before their activation status becomes `active`. Only `active` caregivers may be scheduled for visits.

### New Phase 2 APIs
```js
// Quiz
getQuizQuestions(moduleId)
getQuizAttemptHistory(assignmentId)
submitQuizAttempt({ assignmentId, caregiverId, moduleId, answers, score, passed })

// Documents
getCaregiverDocuments(caregiverId)
getAllCaregiverDocuments(filters)
createCaregiverDocument(doc)
reviewCaregiverDocument(id, { status, reviewedBy, adminNotes })

// Certificates
getCaregiverCertificates(caregiverId)
issueTrainingCertificate(caregiverId, assignmentId, moduleId, score)

// Activation
isCaregiverEligibleForScheduling(caregiverId)
getEligibleCaregiversForScheduling()
getCaregiverActivationSummary(caregiverId)
refreshCaregiverActivation(caregiverId)
```

### Backend RPC Functions
The migration creates two security-definer PostgreSQL functions that the UI calls instead of writing directly to protected tables:
- `public.mark_training_assignment_complete(p_assignment_id, p_score, p_acknowledged)` — marks a caregiver's own training assignment as completed.
- `public.issue_training_certificate(p_caregiver_id, p_assignment_id, p_module_id, p_score)` — issues a certificate only after a passed quiz attempt is recorded.

### Storage RLS
- The `caregiver-documents` Supabase Storage bucket is created automatically.
- Public read is enabled so shared links work for admins.
- Caregivers may only upload/update files in paths prefixed with their own `caregiver_id`.
- Admins have full manage access on the bucket.

---

## Phase 3: Automatic Training Assignment, Status Badges, and Activation Gating

### Overview
Phase 3 connects caregiver application approval to the Training Hub. When an application is approved, required training is assigned automatically, the caregiver's activation status is set to `training_required`, and the caregiver advances to `active` once training, documents, and background check are complete.

### Automatic Workflow
1. Admin approves a caregiver application.
2. `createCaregiverFromApplication` creates the caregiver profile.
3. `assignRequiredTrainingAndDocuments` assigns all required active modules with a 7-day due date.
4. `refreshCaregiverActivation` sets `activation_status` to `training_required`.
5. A portal invite is sent (now or later).
6. The caregiver logs in and sees assigned training immediately.
7. The caregiver completes all required modules.
8. `refreshCaregiverActivation` advances the caregiver to `documents_required` or `active`.
9. Admins receive a notification when all required training is complete.
10. Only `active` caregivers can be scheduled for visits.

### Training Status Badges
Caregiver profiles and directory show a Phase 3 badge:
- **Training Required** — activation status is `training_required`.
- **Training In Progress** — training is partially complete or training is done but documents/background check are pending.
- **Active** — activation status is `active`.
- **Training Overdue** — at least one required assignment is past its due date.

### Admin Bulk Actions
In the Training Hub → Training tab, admins can:
- **Assign Required Training to All Eligible Caregivers** — assigns missing required modules to every caregiver with `activation_status = training_required`.
- **Backfill Existing Caregivers** — assigns missing required modules to all onboarding and active caregivers who were approved before the automation existed.

Both actions are idempotent: existing assignments are not duplicated.

### Dashboard Alerts
The admin dashboard shows alerts for:
- Caregivers needing training (`activation_status = training_required`).
- Overdue training assignments.
- Caregivers who completed training and are ready for activation.

### Scheduling Gating
- Visit creation and edit dropdowns only include caregivers with `activation_status = active`.
- The caregiver dropdown shows a note: "Only caregivers with Active training status can be scheduled."
- If a caregiver becomes ineligible after being scheduled, the edit modal shows a red warning and keeps the caregiver selected only until an active replacement is chosen.
- `createSchedule` and `updateSchedule` in `database.js` block the save if the caregiver is not active.

### New Phase 3 APIs
```js
// Bulk assignment
assignRequiredTrainingAndDocuments(caregiverId, { dueDays, notify })
assignRequiredTrainingToCaregiver(caregiverId, { dueDays, notify })
assignRequiredTrainingToAllEligibleCaregivers({ dueDays })
backfillRequiredTrainingForAllEligibleCaregivers({ dueDays })

// Status badge
getCaregiverTrainingBadge(caregiverId)

// Admin notification
notifyIfTrainingComplete(caregiverId)
```
