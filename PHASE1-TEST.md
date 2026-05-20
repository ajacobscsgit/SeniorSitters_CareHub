# Phase 1 Applications Workflow Test Checklist

## Pre-Test Setup
1. Open browser DevTools (F12) → Console tab
2. Clear console
3. Navigate to CareHub login: `file:///.../CareHub Portal/index.html`
4. Login with: `admin@seniorsittersco.com` / `demo123`

---

## Test 1: Fetch Applications from Supabase

**Steps:**
1. Click "Applications" in sidebar

**Expected Console Output:**
```
[CareHub] === loadApplications START ===
[CareHub] Filter: all
[CareHub] Running testDirectQuery for comparison...
[CareHub] === Direct Query Test ===
[CareHub] Using window.carehubSupabase: true
[CareHub] === Fetching Applications ===
[CareHub] Supabase client exists: true
[CareHub] Table: applications
[CareHub] Filters: {}
[CareHub] No status filter - fetching ALL applications
[CareHub] Executing Supabase query...
[CareHub] SUCCESS - Applications returned: X
[CareHub] Data: [{...}]
[CareHub] Direct query result: {data: [...], error: null}
[CareHub] loadApplications received: X applications
[CareHub] === loadApplications END ===
[CareHub] Rendered X applications in table
```

**Pass Criteria:**
- [ ] Console shows `Supabase client exists: true`
- [ ] Console shows `SUCCESS - Applications returned: X` (X > 0 if data exists)
- [ ] Applications table displays with columns: Applicant, Email, City, Availability, Date, Status
- [ ] No red errors in console

---

## Test 2: Filter "New" Applications

**Steps:**
1. Click "New" filter tab

**Expected:**
- [ ] URL updates with `?status=new` (if applicable)
- [ ] Console shows: `[CareHub] Filter: new`
- [ ] Console shows: `[CareHub] Filtering by status: new`
- [ ] Table shows only applications with `status = "new"`

---

## Test 3: View Application Details

**Steps:**
1. Click "View" button on any application

**Expected Display:**
```
Personal Information
├── Full Name: [full_name]
├── Email: [email]
├── Phone: [phone]
└── City: [city]

Availability & Preferences
├── Availability: [availability]
├── Has Transportation: Yes/No
└── Willing to do Outings: Yes/No

Experience & Motivation
├── Relevant Experience: [experience text]
├── Why Work with Seniors: [why_work_with_seniors text]
└── Resume: [View Resume link] or "Not provided"

Application Review
├── Status: [badge]
├── Applied: [date/time]
└── (Admin Notes, Denial Reason, Interview - only if present)
```

**Pass Criteria:**
- [ ] All fields display correctly
- [ ] Boolean fields show "Yes/No" not "true/false"
- [ ] Empty fields show "N/A" or "Not provided"
- [ ] Resume shows link if `resume_url` exists
- [ ] Approve/Deny buttons visible for `status = new`

---

## Test 4: Approve Application → Create Caregiver

**Steps:**
1. Click "View" on a `status = "new"` application
2. Click "Approve" button
3. Confirm in dialog

**Expected Console Output:**
```
[CareHub] Updating application [ID] to status: approved
[CareHub] Application [ID] updated to approved successfully
[CareHub] Creating caregiver from application: [ID] [full_name]
[CareHub] Inserting caregiver: {name: ..., ...}
[CareHub] Caregiver created successfully: {id: ..., name: ...}
[CareHub] Creating notification for new caregiver...
[CareHub] Creating notification: {type: 'caregiver_created', ...}
[CareHub] Notification created successfully: {...}
```

**OR** (if notifications table has issues):
```
[CareHub] Failed to create notification, but caregiver was created
```

**Expected Result:**
- [ ] Alert shows: `Application approved! Caregiver "[name]" has been created...`
- [ ] Applications table refreshes
- [ ] Approved application now shows `status = "approved"`
- [ ] Caregivers page shows new caregiver with `status = "onboarding"`

---

## Test 5: Deny Application with Reason

**Steps:**
1. Click "View" on a `status = "new"` application
2. Click "Deny" button
3. Enter denial reason: "Not enough experience"
4. Click OK

**Expected Console Output:**
```
[CareHub] Updating application [ID] to status: denied
[CareHub] Application [ID] updated to denied successfully
```

**Expected Result:**
- [ ] Alert shows: `Application has been denied.`
- [ ] Applications table refreshes
- [ ] Application shows `status = "denied"`
- [ ] Viewing application shows "Denial Reason" section with entered text
- [ ] `denial_reason` field contains "Not enough experience"

---

## Test 6: Dashboard Counts

**Steps:**
1. Click "Dashboard" in sidebar

**Expected:**
- [ ] Console shows: `[CareHub] Fetching dashboard stats`
- [ ] "New Applications" card shows count of `status = "new"` applications
- [ ] "Pending Care Requests" card shows count of `status = "pending"` care requests
- [ ] "Onboarding" card shows count of caregivers with `status = "onboarding"`

---

## Error Handling Tests

### Test 7: Missing Column Detection

**If any insert/update fails:**

**Expected Console Output:**
```
[CareHub] ERROR creating notification: {...}
[CareHub] Error code: 42703
[CareHub] Error message: column "[column_name]" does not exist
[CareHub] MISSING COLUMN: notifications table needs column "[column_name]"
```

**Action:** Add missing column to Supabase table.

---

## Bug Fixes Applied

| Issue | Fix |
|-------|-----|
| Experience showing `true` | Fixed form mapping - experience now saves textarea text, not boolean |
| Willing outings showing "Not specified" | Fixed mapping - `driversLicense` field maps to `willing_outings` |
| Approve alert shows `undefined` | Fixed to use `caregiver.name` instead of `first_name/last_name` |
| Denial reason not saved | Now saves to `denial_reason` column when status = denied |
| Missing column errors unclear | Added column detection logging |

---

## Supabase Table Verification

### applications table:
- [ ] id
- [ ] full_name
- [ ] phone
- [ ] email
- [ ] city
- [ ] availability
- [ ] transportation
- [ ] willing_outings
- [ ] experience
- [ ] why_work_with_seniors
- [ ] resume_url
- [ ] status
- [ ] admin_notes
- [ ] denial_reason
- [ ] interview_datetime
- [ ] created_at
- [ ] updated_at
- [ ] approved_at

### caregivers table:
- [ ] id
- [ ] name
- [ ] phone
- [ ] email
- [ ] city
- [ ] availability
- [ ] transportation
- [ ] willing_outings
- [ ] application_id
- [ ] status (onboarding/active/inactive)
- [ ] pay_rate
- [ ] background_check_status
- [ ] training_status
- [ ] documents_status
- [ ] welcome_package_status
- [ ] notes
- [ ] created_at
- [ ] updated_at

### notifications table:
- [ ] id
- [ ] type
- [ ] title
- [ ] message
- [ ] related_id
- [ ] related_type
- [ ] read
- [ ] created_at

---

## Final Checklist

- [ ] Login works
- [ ] Applications load from Supabase
- [ ] View application details shows all fields correctly
- [ ] Approve creates caregiver with onboarding status
- [ ] Deny saves denial reason
- [ ] Dashboard counts are accurate
- [ ] No console errors during workflow
