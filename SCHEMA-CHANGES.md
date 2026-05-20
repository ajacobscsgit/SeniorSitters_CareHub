# CareHub Schema Alignment Changes

## Applications Table Schema (Actual)
- id
- full_name
- phone
- email
- city
- availability
- transportation
- willing_outings
- experience
- why_work_with_seniors
- resume_url
- status
- admin_notes
- denial_reason
- interview_datetime
- created_at

## Changes Made

### 1. `database.js` - getApplications()
- Now selects explicit columns: `id, full_name, phone, email, city, availability, transportation, willing_outings, experience, why_work_with_seniors, resume_url, status, admin_notes, denial_reason, interview_datetime, created_at`

### 2. `database.js` - createCaregiverFromApplication()
**Before:** Used non-existent fields (first_name, last_name, address, state, zip, certifications, experience_years, cover_letter)

**After:** Maps actual fields:
- `full_name` → `name`
- `phone` → `phone`
- `email` → `email`
- `city` → `city`
- `availability` → `availability`
- `transportation` → `transportation`
- `willing_outings` → `willing_outings`
- `id` → `application_id`
- `status` → `'onboarding'`
- `pay_rate` → `17`
- `background_check_status` → `'pending'`
- `training_status` → `'pending'`
- `documents_status` → `'pending'`
- `welcome_package_status` → `'not_sent'`
- `notes` → combined `experience` + `why_work_with_seniors`

### 3. `database.js` - Dashboard Stats
**Before:** Counted `status = 'pending'` applications

**After:** Counts `status = 'new'` applications
- Property renamed from `pendingApplications` to `newApplications`

### 4. `app.js` - Dashboard Rendering
**Before:** Showed "Pending Applications" stat

**After:** Shows "New Applications" stat using `stats.newApplications`

### 5. `app.js` - Applications Table
**Before:**
- Columns: Applicant, Email, Phone, Date Applied, Status, Actions
- Used `first_name` + `last_name`

**After:**
- Columns: Applicant, Email, City, Availability, Date Applied, Status, Actions
- Uses `full_name`
- Shows `city` and `availability`

### 6. `app.js` - Application Detail Modal
**Before:**
- Personal Info: Full Name (first + last), Email, Phone, Location (city, state, zip)
- Qualifications: Experience years, Certifications
- Cover Letter section

**After:**
- Personal Info: Full Name, Email, Phone, City
- Availability & Preferences: Availability, Transportation, Willing to do Outings
- Experience & Motivation: Experience text, Why Work with Seniors text
- Resume: Link to view resume (if resume_url exists)
- Admin Notes (if exists)
- Denial Reason (if exists)

### 7. `app.js` - Approve/Deny Buttons
**Before:** Only showed for `status === 'pending'`

**After:** Shows for `status === 'new' || status === 'pending'`

## Test Checklist

- [ ] Applications page shows table with actual data
- [ ] Columns visible: Applicant, Email, City, Availability, Date, Status
- [ ] Click "View" shows full details with all actual fields
- [ ] Approve button creates caregiver with correct mapping
- [ ] Dashboard shows "New Applications" count
- [ ] Filter tabs work: All, New, Pending, Approved, Denied
