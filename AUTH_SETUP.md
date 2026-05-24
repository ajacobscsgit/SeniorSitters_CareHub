# CareHub — Authentication Setup Guide

## Overview

CareHub uses Supabase Auth as its identity provider. The authentication system
has two modes controlled by a single flag in `config.js`:

```js
window.DEV_MODE = true;   // Development: demo/mock login enabled
window.DEV_MODE = false;  // Production: only real Supabase Auth accepted
```

---

## Architecture

```
login.html
  └─ login() in auth.js
       ├─ DEV_MODE = true  → DEMO_USERS lookup (localStorage session)
       └─ DEV_MODE = false → SupabaseAuth.signIn() (supabase-auth.js)
                                  └─ supabase.auth.signInWithPassword()
                                  └─ fetch profile from `profiles` table
                                  └─ write carehub_session to localStorage

index.html (on load)
  └─ initAuth() → SupabaseAuth.hydrateSession()
       └─ reads live Supabase Auth token
       └─ re-fetches profile and refreshes localStorage session
```

---

## Files

| File | Purpose |
|---|---|
| `js/config.js` | `DEV_MODE` flag + Supabase URL/key |
| `js/supabase-auth.js` | Real Supabase Auth layer — `signIn`, `signOut`, `inviteUser`, `hydrateSession` |
| `js/auth.js` | CareHub session helpers — routes to supabase-auth.js or mock based on DEV_MODE |
| `login.html` | Login UI — demo section hidden when DEV_MODE = false |

---

## Supabase Project Setup

### 1. Enable Email Auth
Supabase Dashboard → Authentication → Providers → Email: **Enable**

Recommended settings:
- Confirm email: **Enabled** (users must verify before first login)
- Secure email change: **Enabled**
- Minimum password length: **8**

### 2. Create the `profiles` Table

Run in Supabase SQL Editor:

```sql
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text unique not null,
  full_name    text,
  role         text not null check (role in ('admin_owner','co_owner','caregiver','client_family')),
  caregiver_id uuid references public.caregivers(id) on delete set null,
  client_id    uuid references public.clients(id) on delete set null,
  status       text not null default 'active' check (status in ('active','inactive','pending_invite')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

-- Allow users to read their own profile
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Admins can read all profiles (add after RLS is fully configured)
-- create policy "Admins can view all profiles"
--   on public.profiles for select
--   using (exists (
--     select 1 from public.profiles p
--     where p.id = auth.uid() and p.role in ('admin_owner','co_owner')
--   ));
```

### 3. Create the First Admin Account

Option A — Supabase Dashboard:
1. Authentication → Users → **Invite User**
2. Enter admin email address
3. User receives invite email and sets password

Option B — SQL (if you already have an auth.users row):
```sql
insert into public.profiles (id, email, full_name, role)
values (
  '<auth-user-uuid>',
  'admin@yourcompany.com',
  'Admin User',
  'admin_owner'
);
```

### 4. Set Production Mode
In `js/config.js`, change:
```js
window.DEV_MODE = false;
```
The demo login buttons will be hidden automatically.

---

## Session Format (localStorage `carehub_session`)

```json
{
  "id":           "uuid-from-auth-users",
  "email":        "user@example.com",
  "role":         "caregiver",
  "name":         "Jane Doe",
  "caregiver_id": "uuid-from-caregivers-table",
  "client_id":    null,
  "timestamp":    1716000000000
}
```

Sessions expire after 24 hours. `hydrateSession()` refreshes from the live Supabase
token on each page load in production mode.

---

## Edge Function Requirement (Invite Flow)

`SupabaseAuth.inviteUser()` is currently a placeholder. It inserts a `pending_invite`
profile row but **cannot** create Supabase Auth accounts — the anon key does not have
admin privileges.

**To complete the invite flow, deploy the Edge Function described in `ACCOUNT_CREATION_FLOW.md`.**
