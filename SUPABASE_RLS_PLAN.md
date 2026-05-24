# CareHub — Supabase RLS Plan

## Current State

All data filtering is **frontend-only** (implemented in `role-filter.js` and
`database.js`). Row-Level Security policies exist as a documented plan but have
**not been deployed** to Supabase yet.

**Do not deploy RLS until:**
1. Real Supabase Auth is live (users log in with real accounts)
2. The `profiles` table is populated with correct `caregiver_id`/`client_id` links
3. All frontend queries have been verified to work with RLS enabled
4. The invite-user Edge Function is deployed

---

## How RLS Works in This App

Supabase uses `auth.uid()` (the UUID of the logged-in user) inside policies.
Our `profiles` table maps `auth.uid() → role + caregiver_id + client_id`.

Helper function used in all policies:

```sql
-- Returns the role of the currently logged-in user
create or replace function public.current_user_role()
returns text language sql stable as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Returns the caregiver_id of the currently logged-in user (null if not a caregiver)
create or replace function public.current_caregiver_id()
returns uuid language sql stable as $$
  select caregiver_id from public.profiles where id = auth.uid()
$$;

-- Returns the client_id of the currently logged-in user (null if not client_family)
create or replace function public.current_client_id()
returns uuid language sql stable as $$
  select client_id from public.profiles where id = auth.uid()
$$;
```

---

## RLS Policies by Table

### `profiles`

```sql
alter table public.profiles enable row level security;

-- Users read their own profile
create policy "profiles: own read"
  on public.profiles for select
  using (auth.uid() = id);

-- Users update their own profile (name only — role/ids changed by admin only)
create policy "profiles: own update"
  on public.profiles for update
  using (auth.uid() = id);

-- Admins read all profiles
create policy "profiles: admin read all"
  on public.profiles for select
  using (current_user_role() in ('admin_owner', 'co_owner'));

-- Admins insert/update any profile
create policy "profiles: admin write"
  on public.profiles for all
  using (current_user_role() in ('admin_owner', 'co_owner'));
```

---

### `schedules`

```sql
alter table public.schedules enable row level security;

-- Admins see all schedules
create policy "schedules: admin read all"
  on public.schedules for select
  using (current_user_role() in ('admin_owner', 'co_owner'));

-- Caregivers see only schedules assigned to them
create policy "schedules: caregiver own"
  on public.schedules for select
  using (
    current_user_role() = 'caregiver'
    and caregiver_id = current_caregiver_id()
  );

-- Client/family sees only schedules for their client
create policy "schedules: client_family own"
  on public.schedules for select
  using (
    current_user_role() = 'client_family'
    and client_id = current_client_id()
  );

-- Only admins can insert/update/delete schedules
create policy "schedules: admin write"
  on public.schedules for all
  using (current_user_role() in ('admin_owner', 'co_owner'));
```

---

### `timesheets`

```sql
alter table public.timesheets enable row level security;

-- Admins see all timesheets
create policy "timesheets: admin read all"
  on public.timesheets for select
  using (current_user_role() in ('admin_owner', 'co_owner'));

-- Caregivers see only their own timesheets
create policy "timesheets: caregiver own"
  on public.timesheets for select
  using (
    current_user_role() = 'caregiver'
    and caregiver_id = current_caregiver_id()
  );

-- Client/family cannot see timesheets (no policy = no access)

-- Caregivers can insert/update their own timesheets
create policy "timesheets: caregiver write own"
  on public.timesheets for insert
  with check (
    current_user_role() = 'caregiver'
    and caregiver_id = current_caregiver_id()
  );

create policy "timesheets: caregiver update own"
  on public.timesheets for update
  using (
    current_user_role() = 'caregiver'
    and caregiver_id = current_caregiver_id()
  );

-- Admins can do everything
create policy "timesheets: admin write"
  on public.timesheets for all
  using (current_user_role() in ('admin_owner', 'co_owner'));
```

---

### `visit_updates`

```sql
alter table public.visit_updates enable row level security;

-- Admins see all visit updates
create policy "visit_updates: admin read all"
  on public.visit_updates for select
  using (current_user_role() in ('admin_owner', 'co_owner'));

-- Caregivers see updates for their own schedules only
create policy "visit_updates: caregiver own"
  on public.visit_updates for select
  using (
    current_user_role() = 'caregiver'
    and exists (
      select 1 from public.schedules s
      where s.id = schedule_id
        and s.caregiver_id = current_caregiver_id()
    )
  );

-- Client/family sees only approved/submitted updates for their client's schedules
-- (internal_only, draft, rejected are excluded)
create policy "visit_updates: client_family approved only"
  on public.visit_updates for select
  using (
    current_user_role() = 'client_family'
    and status in ('submitted', 'approved')
    and exists (
      select 1 from public.schedules s
      where s.id = schedule_id
        and s.client_id = current_client_id()
    )
  );

-- Caregivers can insert/update their own visit updates
create policy "visit_updates: caregiver write own"
  on public.visit_updates for insert
  with check (
    current_user_role() = 'caregiver'
    and exists (
      select 1 from public.schedules s
      where s.id = schedule_id
        and s.caregiver_id = current_caregiver_id()
    )
  );

create policy "visit_updates: caregiver update own"
  on public.visit_updates for update
  using (
    current_user_role() = 'caregiver'
    and exists (
      select 1 from public.schedules s
      where s.id = schedule_id
        and s.caregiver_id = current_caregiver_id()
    )
  );

-- Admins can do everything
create policy "visit_updates: admin write"
  on public.visit_updates for all
  using (current_user_role() in ('admin_owner', 'co_owner'));
```

---

### `caregivers`

```sql
alter table public.caregivers enable row level security;

-- Admins see all caregivers
create policy "caregivers: admin read all"
  on public.caregivers for select
  using (current_user_role() in ('admin_owner', 'co_owner'));

-- Caregivers see only their own row
create policy "caregivers: own row"
  on public.caregivers for select
  using (
    current_user_role() = 'caregiver'
    and id = current_caregiver_id()
  );

-- Client/family sees caregivers assigned to their client's schedules
create policy "caregivers: client_family assigned"
  on public.caregivers for select
  using (
    current_user_role() = 'client_family'
    and exists (
      select 1 from public.schedules s
      where s.caregiver_id = caregivers.id
        and s.client_id = current_client_id()
    )
  );

-- Only admins write caregiver records
create policy "caregivers: admin write"
  on public.caregivers for all
  using (current_user_role() in ('admin_owner', 'co_owner'));
```

---

### `clients`

```sql
alter table public.clients enable row level security;

-- Admins see all clients
create policy "clients: admin read all"
  on public.clients for select
  using (current_user_role() in ('admin_owner', 'co_owner'));

-- Caregivers see only clients assigned to them via schedules
create policy "clients: caregiver assigned"
  on public.clients for select
  using (
    current_user_role() = 'caregiver'
    and exists (
      select 1 from public.schedules s
      where s.client_id = clients.id
        and s.caregiver_id = current_caregiver_id()
    )
  );

-- Client/family sees only their own client row
create policy "clients: own row"
  on public.clients for select
  using (
    current_user_role() = 'client_family'
    and id = current_client_id()
  );

-- Only admins write client records
create policy "clients: admin write"
  on public.clients for all
  using (current_user_role() in ('admin_owner', 'co_owner'));
```

---

### `notifications`

```sql
alter table public.notifications enable row level security;

-- Admins see all notifications
create policy "notifications: admin read all"
  on public.notifications for select
  using (current_user_role() in ('admin_owner', 'co_owner'));

-- Caregivers see notifications related to their records
create policy "notifications: caregiver own"
  on public.notifications for select
  using (
    current_user_role() = 'caregiver'
    and (
      related_type = 'caregiver' and related_id::uuid = current_caregiver_id()
      or related_type = 'schedule' and exists (
        select 1 from public.schedules s
        where s.id = related_id::uuid
          and s.caregiver_id = current_caregiver_id()
      )
    )
  );

-- Client/family sees approved visit update notifications for their client
create policy "notifications: client_family approved"
  on public.notifications for select
  using (
    current_user_role() = 'client_family'
    and type = 'visit_update_approved'
    and related_type = 'schedule'
    and exists (
      select 1 from public.schedules s
      where s.id = related_id::uuid
        and s.client_id = current_client_id()
    )
  );
```

---

### `applications` and `care_requests`

```sql
alter table public.applications enable row level security;
alter table public.care_requests enable row level security;

-- Only admins can read/write applications and care requests
create policy "applications: admin only"
  on public.applications for all
  using (current_user_role() in ('admin_owner', 'co_owner'));

create policy "care_requests: admin only"
  on public.care_requests for all
  using (current_user_role() in ('admin_owner', 'co_owner'));
```

---

## Deployment Checklist

Before enabling RLS, verify each step:

- [ ] `profiles` table created with correct schema
- [ ] Helper functions (`current_user_role`, `current_caregiver_id`, `current_client_id`) created
- [ ] At least one `admin_owner` profile row exists
- [ ] `caregiver_id` and `client_id` columns populated in profiles for all restricted users
- [ ] Real Supabase Auth login working end-to-end
- [ ] All 7 tables tested with each role in browser (check Network tab for 403s)
- [ ] Frontend filters in `database.js` and `role-filter.js` still in place as defence-in-depth

### Enable RLS Table by Table

Test one table at a time. Start with the least critical:

1. `profiles` — low risk, already has policies above
2. `caregivers` — test caregiver login after enabling
3. `clients` — test client_family login after enabling
4. `schedules` — highest impact, test all 4 roles
5. `timesheets`
6. `visit_updates`
7. `notifications`
8. `applications` + `care_requests` — admin-only, lowest risk for restricted users

### Verify With `supabase-auth.js` Console Helper

```js
// After enabling RLS on schedules, log in as caregiver and run:
debugSession()    // check caregiver_id is set
// Then navigate to schedules — should only see own records
// Check Supabase Dashboard → Table Editor for any unexpected 403s
```

---

## Notes

- Frontend filtering remains in place as **defence-in-depth** even after RLS is deployed.
- The `current_user_role()` function uses a `stable` qualifier so Postgres can
  cache it per query — important for performance on complex joins.
- The `SUPABASE_ANON_KEY` is safe to expose in frontend code. RLS is the security layer.
- Never expose the `SERVICE_ROLE_KEY` in frontend code — it bypasses all RLS.
