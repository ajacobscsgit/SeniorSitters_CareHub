# Role Testing Guide
## CareHub Portal - Demo Account Testing

**Last Updated:** May 2026
**Purpose:** Test all role-based views before implementing real Supabase auth/RLS

---

## Quick Start

1. Open `login.html`
2. Click any "Quick Demo Login" button OR manually enter credentials
3. All passwords: `demo123`

---

## Demo Accounts

| Email | Role | Password | Access Level |
|-------|------|----------|--------------|
| `admin@seniorsittersco.com` | Admin/Owner | `demo123` | Full access to everything |
| *(no demo account)* | Co-Owner | — | Use a real invited co-owner account |
| `caregiver@seniorsittersco.com` | Caregiver | `demo123` | Own schedule, timesheets, visit updates, assigned clients |
| `family@seniorsittersco.com` | Client/Family | `demo123` | Loved one's schedule, approved updates, family notes |

---

## Test Checklist by Role

### 1. Admin/Owner (`admin@seniorsittersco.com`)

**Expected Behavior:** Full access to all features

#### Navigation Test
- [ ] Can see all sidebar items: Dashboard, Applications, Care Requests, Caregivers, Clients, Schedules, Timesheets, Visit Updates, Settings
- [ ] Can click and open each page without errors
- [ ] Sidebar shows "Admin/Owner" as role label

#### Dashboard Test
- [ ] Sees KPI cards (New Applications, Pending Care Requests, etc.)
- [ ] Sees Quick Actions bar (New Visit, Timesheet, Visit Update, etc.)
- [ ] Sees Recent Activity feed
- [ ] Sees Urgent Alerts panel
- [ ] Sees Mini Calendar
- [ ] "Today's Schedule" label shown

#### Features Test
- [ ] Can create new schedules
- [ ] Can approve/reject timesheets
- [ ] Can view all applications
- [ ] Can manage caregivers and clients
- [ ] Can access care requests
- [ ] Settings page accessible

---

### 2. Co-Owner (real invited account)

**Expected Behavior:** Almost full access, but sensitive ownership/admin settings may be limited later

#### Navigation Test
- [ ] Can see all sidebar items: Dashboard, Applications, Care Requests, Caregivers, Clients, Schedules, Timesheets, Visit Updates, Settings
- [ ] Can click and open each page without errors
- [ ] Sidebar shows "Co-Owner" as role label

#### Dashboard Test
- [ ] Sees KPI cards
- [ ] Sees Quick Actions bar
- [ ] Sees Recent Activity feed
- [ ] Sees Urgent Alerts panel
- [ ] Sees Mini Calendar

#### Features Test
- [ ] Can create new schedules
- [ ] Can approve/reject timesheets
- [ ] Can view all applications
- [ ] Can manage caregivers and clients
- [ ] Can access care requests

---

### 3. Caregiver (`caregiver@seniorsittersco.com`)

**Expected Behavior:** Only sees their own data and assigned pages

#### Navigation Test
- [ ] Can see: Dashboard, Schedules, Timesheets, Visit Updates, Clients, Settings
- [ ] **CANNOT see:** Applications, Care Requests, Caregivers
- [ ] Sidebar shows "Caregiver" as role label

#### Dashboard Test
- [ ] **NO KPI cards** (not shown)
- [ ] **NO Quick Actions bar** (not shown)
- [ ] **NO Recent Activity feed** (not shown)
- [ ] **NO Urgent Alerts panel** (not shown)
- [ ] Sees Mini Calendar
- [ ] Schedule label should show "My Schedule"
- [ ] Only sees their assigned visits

#### Page Access Test
- [ ] **Applications page:** Should show "Access Denied" or redirect to dashboard
- [ ] **Care Requests page:** Should show "Access Denied" or redirect to dashboard
- [ ] **Caregivers page:** Should show "Access Denied" or redirect to dashboard
- [ ] **Schedules page:** Only sees their assigned schedules
- [ ] **Timesheets page:** Only sees their own timesheets
- [ ] **Visit Updates page:** Only sees their own updates

---

### 4. Client/Family (`family@seniorsittersco.com`)

**Expected Behavior:** Only sees loved one's data and family-related pages

#### Navigation Test
- [ ] Can see: Dashboard, Schedules, Visit Updates, Settings
- [ ] **CANNOT see:** Applications, Care Requests, Caregivers, Clients, Timesheets
- [ ] Sidebar shows "Client/Family" as role label

#### Dashboard Test
- [ ] **NO KPI cards** (not shown)
- [ ] **NO Quick Actions bar** (not shown)
- [ ] **NO Recent Activity feed** (not shown)
- [ ] **NO Urgent Alerts panel** (not shown)
- [ ] Sees Mini Calendar
- [ ] Schedule label should show "Loved One's Schedule"
- [ ] Only sees approved visit updates

#### Page Access Test
- [ ] **Applications page:** Should show "Access Denied" or redirect to dashboard
- [ ] **Care Requests page:** Should show "Access Denied" or redirect to dashboard
- [ ] **Caregivers page:** Should show "Access Denied" or redirect to dashboard
- [ ] **Clients page:** Should show "Access Denied" or redirect to dashboard
- [ ] **Timesheets page:** Should show "Access Denied" or redirect to dashboard
- [ ] **Schedules page:** Only sees their loved one's schedule
- [ ] **Visit Updates page:** Only sees approved updates

---

## Access Matrix

| Page | Admin/Owner | Co-Owner | Caregiver | Client/Family |
|------|:-----------:|:--------:|:---------:|:-------------:|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Applications | ✅ | ✅ | ❌ | ❌ |
| Care Requests | ✅ | ✅ | ❌ | ❌ |
| Caregivers | ✅ | ✅ | ❌ | ❌ |
| Clients | ✅ | ✅ | ✅* | ❌ |
| Schedules | ✅ | ✅ | ✅* | ✅* |
| Timesheets | ✅ | ✅ | ✅* | ❌ |
| Visit Updates | ✅ | ✅ | ✅* | ✅* |
| Settings | ✅ | ✅ | ✅ | ✅ |

*Filtered to show only assigned/relevant data

---

## Dashboard Feature Matrix

| Feature | Admin/Owner | Co-Owner | Caregiver | Client/Family |
|---------|:-----------:|:--------:|:---------:|:-------------:|
| KPI Cards | ✅ | ✅ | ❌ | ❌ |
| Quick Actions | ✅ | ✅ | ❌ | ❌ |
| Recent Activity | ✅ | ✅ | ❌ | ❌ |
| Urgent Alerts | ✅ | ✅ | ❌ | ❌ |
| Mini Calendar | ✅ | ✅ | ✅ | ✅ |
| Today's Schedule | ✅ | ✅ | ✅ (My Schedule) | ✅ (Loved One's) |

---

## How to Report Issues

If a role sees something it shouldn't, or can't see something it should:

1. **Note the role:** Which demo account you're using
2. **Note the page:** Which page has the issue
3. **Expected vs Actual:** What should happen vs what actually happens
4. **Browser console:** Any JavaScript errors (F12 → Console)

---

## Technical Notes

- All demo accounts use password: `demo123`
- Sessions are stored in `sessionStorage` with key `carehub_session` (cleared when tab is closed)
- Role is normalized from legacy names (admin→admin_owner, manager→co_owner, etc.)
- Unauthorized pages redirect to dashboard automatically
- Navigation items are hidden (not just disabled) for unauthorized roles

---

## Next Steps After Testing

1. ✅ All 4 roles tested and working
2. ⬜ Implement real Supabase authentication
3. ⬜ Set up Row-Level Security (RLS) policies per role
4. ⬜ Remove mock authentication (DEMO_USERS)
5. ⬜ Add password change functionality
6. ⬜ Add "Forgot Password" flow

---

*This is temporary mock authentication for development/testing purposes only.*
