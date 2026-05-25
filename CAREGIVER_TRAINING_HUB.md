# Caregiver Training Hub

## Overview

The Training Hub gives caregivers a dedicated portal area for onboarding, assigned training, company resources, and emergency contacts. Admins can manage all content and track caregiver progress.

**Navigation:** Sidebar → Training Hub (visible to `admin_owner`, `co_owner`, `caregiver`)

---

## Four Tabs

### 1. Training
- Card-based grid of training modules
- **Admin view:** See all modules (active + inactive), assign to caregivers, edit, delete
- **Caregiver view:** See only active modules assigned to them, with status (assigned / in_progress / completed / overdue), due date, and complete/acknowledge buttons
- Modules with `requires_acknowledgement = true` show an "Acknowledge & Complete" button instead of "Mark Complete"
- Required modules are highlighted with an amber left border

### 2. Onboarding
- **Admin view:** Table of all caregivers with progress bars, per-step checkboxes, background check status, and an Edit button
- **Caregiver view:** Personal progress bar with 7 checklist items + background check status. Admin notes shown if set.

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

Run: `supabase/migrations/20260524_training_hub.sql`

| Table | Purpose |
|---|---|
| `training_modules` | Reusable training content (video, doc, link, quiz, photo guide) |
| `training_assignments` | Caregiver ↔ module assignments with status + completion tracking |
| `onboarding_checklist` | One row per caregiver; 7 boolean steps + background check status |
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

---

## Module Categories

`onboarding` · `safety` · `clinical` · `compliance` · `soft_skills` · `policy` · `general`

## Module Content Types

`document` · `video` · `link` · `quiz` · `photo_guide`

## Assignment Statuses

`assigned` → `in_progress` → `completed` / `overdue` / `waived`

---

## Resource Categories

`handbook` · `emergency` · `policy` · `contact` · `mileage` · `dress_code` · `communication` · `incident` · `general`

---

## Notifications Integration

When a training module is assigned via `saveAssignModuleModal()`, a notification is automatically created:

```js
createNotification({
    type: 'training_assigned',
    title: 'Training Assigned',
    message: `You have been assigned: <module title>.`,
    caregiver_id: caregiverId,
    recipient_role: 'caregiver',
    priority: 'normal',
    related_table: 'training_assignments',
    related_record_id: assignment.id
})
```

---

## API Reference (`database.js`)

```js
// Modules
getTrainingModules({ activeOnly })
createTrainingModule(mod)
updateTrainingModule(id, updates)
deleteTrainingModule(id)

// Assignments
getTrainingAssignments({ caregiverId, moduleId, status })
assignTrainingModule({ moduleId, caregiverId, assignedBy, dueDate, notes })
updateTrainingAssignment(id, updates)
markTrainingComplete(id)
acknowledgeTraining(id)

// Onboarding
getOnboardingChecklist(caregiverId)
upsertOnboardingChecklist(caregiverId, updates)
getAllOnboardingChecklists()

// Resources
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
