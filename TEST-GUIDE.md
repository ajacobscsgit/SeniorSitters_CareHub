# Phase 1 Test Guide

## Quick Test Steps

### Test 1: Login Page Loads
1. Open `login.html` in browser
2. **Expected**: Clean login form with SeniorSitters branding
3. **Check Console (F12)**: No red errors

### Test 2: Successful Login
1. Enter: `admin@seniorsittersco.com` / `demo123`
2. Click Sign In
3. **Expected**: Redirects to `index.html`, dashboard loads

### Test 3: Failed Login Shows Error
1. Enter wrong password: `admin@seniorsittersco.com` / `wrongpass`
2. **Expected**: Red error message "Invalid email or password"
3. Button returns to "Sign In" state

### Test 4: Dashboard Protection
1. While logged in, copy the `index.html` URL
2. Logout (click 🚪 Logout in sidebar)
3. Paste `index.html` URL directly
4. **Expected**: Redirects back to `login.html`

### Test 5: Logout Works
1. Login, then click 🚪 Logout in sidebar
2. **Expected**: Clears session, returns to login page
3. Try accessing `index.html` again - should redirect to login

### Test 6-7: Data Loading
1. Login and navigate to Applications
2. **Expected**: Shows loading spinner, then table or "No applications found"
3. Check Console for "Supabase client initialized successfully" message
4. Repeat for Care Requests

### Test 8: Approve Application Creates Caregiver
**Prerequisite**: Have a pending application in Supabase
1. Login → Applications → click "View" on pending application
2. Click **Approve**
3. Confirm in popup
4. **Expected**: Success message, caregiver created with `onboarding` status
5. Navigate to Caregivers → should see new caregiver

### Test 9: Deny Application Saves Status
1. Login → Applications → click "View" on pending application
2. Click **Deny**
3. Enter optional reason, confirm
4. **Expected**: Application status changes to `denied`
5. Application shows in "Denied" filter tab

### Test 10: Approve Care Request Creates Client
**Prerequisite**: Have a pending care request in Supabase
1. Login → Care Requests → click "View" on pending request
2. Click **Approve**
3. Confirm in popup
4. **Expected**: Success message, client created with `active` status
5. Navigate to Clients → should see new client

### Test 11: No Duplicate Tables Created
1. Check Supabase Dashboard → Table Editor
2. **Expected**: Only lowercase tables exist:
   - `applications`
   - `care_requests`
   - `caregivers`
   - `clients`
   - `notifications`
3. No capitalized tables (Applications, Care_Requests, etc.)

### Test 12: Console Has No Red Errors
- Keep browser console (F12) open during all tests
- **Expected**: No red error messages
- Yellow warnings about Supabase initialization timing are OK

---

## Troubleshooting

### "Supabase library not loaded" in console
- Refresh the page
- Check that you're using a local server (not `file://` protocol)

### Dashboard shows "Loading..." forever
- Check console for Supabase connection errors
- Verify credentials in `js/config.js`
- Check browser network tab for failed requests

### "Failed to approve application"
- Check Supabase RLS (Row Level Security) policies
- Verify you're using anon key with proper permissions

### Cannot create caregiver/client
- Check that the `caregivers` and `clients` tables exist
- Verify column names match the database.js mappings

---

## Debug Commands (Browser Console)

```javascript
// Check if logged in
isAuthenticated()

// Check session
getSession()

// Check Supabase connection
console.log(supabaseClient)

// Test fetching applications
getApplications().then(console.log)
```
