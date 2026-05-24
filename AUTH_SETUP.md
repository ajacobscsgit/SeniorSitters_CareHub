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

### 3. Create the `pending_invites` Table

This table is the **staging area for invites queued before the Edge Function is deployed**.
It is separate from `profiles` by design — `profiles` requires a real `auth.users` id
and is protected by strict RLS. Inserting a placeholder row into `profiles` triggers
a "new row violates row-level security policy" error.

**Run the migration file** in the Supabase SQL Editor:

> Copy and run: `supabase/migrations/20260524_create_pending_invites.sql`

Or run this minimal version:

```sql
create table if not exists public.pending_invites (
    id           uuid        primary key default gen_random_uuid(),
    email        text        unique not null,
    full_name    text,
    role         text        not null check (role in ('co_owner','caregiver','client_family')),
    caregiver_id uuid        references public.caregivers(id) on delete set null,
    client_id    uuid        references public.clients(id)    on delete set null,
    invited_by   uuid        references auth.users(id)         on delete set null,
    status       text        not null default 'pending'
                             check (status in ('pending','sent','cancelled')),
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

alter table public.pending_invites enable row level security;

-- get_my_role() helper (safe to run multiple times)
create or replace function public.get_my_role()
returns text language sql stable security definer set search_path = public as $$
    select role from public.profiles where id = auth.uid() limit 1;
$$;

-- Read: admin_owner and co_owner only
create policy "pending_invites: admins can read"
    on public.pending_invites for select
    using (public.get_my_role() in ('admin_owner','co_owner'));

-- Insert: admin_owner can create any invitable role
create policy "pending_invites: admin_owner can insert"
    on public.pending_invites for insert
    with check (public.get_my_role() = 'admin_owner'
                and role in ('co_owner','caregiver','client_family'));

-- Insert: co_owner can only create caregiver/client_family
create policy "pending_invites: co_owner can insert"
    on public.pending_invites for insert
    with check (public.get_my_role() = 'co_owner'
                and role in ('caregiver','client_family'));

-- Update: admins can mark as sent/cancelled
create policy "pending_invites: admins can update"
    on public.pending_invites for update
    using (public.get_my_role() in ('admin_owner','co_owner'));

grant select, insert, update on public.pending_invites to authenticated;
```

> **Note on `profiles.status`:** The `pending_invite` status value in `profiles`
> is no longer used for placeholder invites. It may still appear for users whose
> real auth account was created but profile is not yet fully onboarded.

### 4. Create the First Admin Account

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

---

## Password Setup Pages

Two pages handle Supabase Auth redirect flows. Both share the same JS module.

| Page | URL | Handles |
|---|---|---|
| `accept-invite.html` | `/accept-invite.html` | New user accepting an invite link (`type=invite`) |
| `reset-password.html` | `/reset-password.html` | Existing user resetting their password (`type=recovery`) |

Both pages use `js/password-reset.js`, which:
1. Parses `#access_token`, `#refresh_token`, and `type` from the URL hash
2. Calls `supabase.auth.setSession()` to establish the session from the tokens
3. Shows the correct form copy based on flow type (`invite` vs `recovery`)
4. Validates password (min 8 chars, match confirmation) with live strength indicator
5. Calls `supabase.auth.updateUser({ password })` to persist the new password
6. Signs out and redirects to `login.html` after 3 seconds

### Supabase Redirect URL Configuration

**Required:** Add both URLs to your Supabase project's allowed redirect list.

Supabase Dashboard → Authentication → URL Configuration:

**Site URL:**
```
http://127.0.0.1:5500
```

**Redirect URLs (add all that apply):**
```
http://127.0.0.1:5500/accept-invite.html
http://127.0.0.1:5500/reset-password.html
http://127.0.0.1:5500/login.html
```

For production, also add your live domain:
```
https://your-portal-domain.com/accept-invite.html
https://your-portal-domain.com/reset-password.html
https://your-portal-domain.com/login.html
```

### Email Template Configuration

Supabase Dashboard → Authentication → Email Templates:

**Invite User template** — set the confirmation URL to:
```
{{ .SiteURL }}/accept-invite.html?token_hash={{ .TokenHash }}&type=invite
```

**Reset Password template** — set the confirmation URL to:
```
{{ .SiteURL }}/reset-password.html?token_hash={{ .TokenHash }}&type=recovery
```

> **Note:** `{{ .TokenHash }}` is the PKCE format used by Supabase by default.
> The legacy `{{ .Token }}` / `#access_token=` hash format also still works —
> `password-reset.js` handles both automatically.

### Forgot Password Flow (login.html)

A "Forgot password?" link is present on `login.html`. When clicked, it prompts
for the user's email and calls `supabase.auth.resetPasswordForEmail()`, which
sends a recovery email linking to `reset-password.html`.

### Email Rate-Limit Protection

Supabase free-tier projects have a hard email-send rate limit (~3–4 emails/hour).
When exceeded, Supabase returns an error containing phrases like
`"email rate limit exceeded"` or `"for security purposes"`.

All three email-sending surfaces are protected:

| Surface | Location | Behaviour on rate-limit |
|---|---|---|
| Forgot-password button | `login.html` | Disabled + 90s live countdown, then re-enables |
| Invite form (Settings) | `js/invite-user.js` | Disabled + 90s live countdown, then re-enables |
| `inviteUser()` Edge Function call | `js/supabase-auth.js` | Returns `{ code: 'RATE_LIMIT' }` to caller |

**User-facing message (all surfaces):**
> "Too many email links were sent. Please wait before trying again."

**Detection phrases** (matched case-insensitively in `_isRateLimit()` /
`isForgotRateLimit()`):
- `rate limit`
- `too many requests`
- `email rate limit exceeded`
- `for security purposes`
- `over_email_send_rate_limit`

**DEBUG logging:** set `window.DEBUG = true` in `js/config.js` to see the
exact Supabase error object in the browser console. When `DEBUG = false`
(default), the raw error is never shown to the user.

**Cooldown timers:**
- Forgot-password button: **120 seconds** after rate-limit error
- Invite button: **120 seconds** after rate-limit error
- On success: **30 seconds** (prevents accidental double-send)

### Files Summary

| File | Purpose |
|---|---|
| `accept-invite.html` | Invite accept page — full CareHub split-screen layout |
| `reset-password.html` | Password reset page — full CareHub split-screen layout |
| `js/password-reset.js` | Shared module for both pages — token parsing, validation, Supabase update |
