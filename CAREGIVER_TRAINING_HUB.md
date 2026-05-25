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
2. Verify seed data created default `onboarding_checklist` rows for existing caregivers
3. Verify 6 default resource entries were seeded (emergency, contacts, policies)
4. Set `window.DEBUG = true` temporarily to verify DB calls in console
5. Add your real business phone number to the "After-Hours Contact" resource via the Resources tab
