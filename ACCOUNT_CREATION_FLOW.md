# CareHub — Account Creation Flow

## Overview

There are four account types. Each is created through a specific workflow:

| Role | Trigger | Creates |
|---|---|---|
| `admin_owner` | Manual Supabase setup | `auth.users` + `profiles` row |
| `co_owner` | Admin invites via Settings UI | `auth.users` + `profiles` row |
| `caregiver` | Admin approves application | `caregivers` row + `profiles` row + invite email |
| `client_family` | Admin converts care request | `clients` row + `profiles` row + invite email |

---

## Why the Frontend Cannot Create Auth Users

The Supabase JS client uses the **anon key**, which has no admin privileges.
Creating auth users requires `supabase.auth.admin.inviteUserByEmail()`, which
requires the **service role key**.

The service role key must **never** be exposed in frontend code.

**Solution: Supabase Edge Function.**

---

## Edge Function: `invite-user`

### Deploy Location
`supabase/functions/invite-user/index.ts`

### What It Does
1. Verifies the caller is an admin (checks their JWT / profile row)
2. Calls `supabase.auth.admin.inviteUserByEmail()` using the service role key
3. Upserts the `profiles` row with the real `auth.users` UUID
4. Returns `{ success: true, user_id }` or `{ success: false, error }`

### Skeleton Implementation

```typescript
// supabase/functions/invite-user/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
})

Deno.serve(async (req) => {
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 })
    }

    // ── 1. Verify caller is admin ─────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? ''
    const callerToken = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: callerErr } = await adminClient.auth.getUser(callerToken)

    if (callerErr || !caller) {
        return json({ error: 'Unauthorized' }, 401)
    }

    const { data: callerProfile } = await adminClient
        .from('profiles')
        .select('role')
        .eq('id', caller.id)
        .single()

    if (!callerProfile || !['admin_owner', 'co_owner'].includes(callerProfile.role)) {
        return json({ error: 'Forbidden: admin role required' }, 403)
    }

    // ── 2. Parse request body ─────────────────────────────────────────────
    const body = await req.json()
    const { email, role, full_name, caregiver_id = null, client_id = null } = body

    if (!email || !role || !full_name) {
        return json({ error: 'Missing required fields: email, role, full_name' }, 400)
    }

    const allowedRoles = ['co_owner', 'caregiver', 'client_family']
    if (!allowedRoles.includes(role)) {
        return json({ error: `Invalid role: ${role}` }, 400)
    }

    // ── 3. Create auth user + send invite email ───────────────────────────
    const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
        email,
        {
            data: { role, full_name, caregiver_id, client_id },
            redirectTo: `${Deno.env.get('SITE_URL')}/login.html`
        }
    )

    if (inviteErr) {
        return json({ error: inviteErr.message }, 500)
    }

    // ── 4. Upsert profile row with real auth UUID ─────────────────────────
    const { error: profileErr } = await adminClient
        .from('profiles')
        .upsert({
            id:           inviteData.user.id,
            email:        email.toLowerCase(),
            full_name,
            role,
            caregiver_id,
            client_id,
            status:       'pending_invite',
            updated_at:   new Date().toISOString()
        }, { onConflict: 'email' })

    if (profileErr) {
        console.error('Profile upsert failed:', profileErr)
        // Non-fatal — auth account was created; admin can fix profile manually
    }

    return json({ success: true, user_id: inviteData.user.id })
})

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' }
    })
}
```

### Deploy Command
```bash
supabase functions deploy invite-user --no-verify-jwt
```

Set the required secrets:
```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
supabase secrets set SITE_URL=https://your-portal-domain.com
```

### Frontend Call (update `supabase-auth.js` once deployed)

Replace the placeholder body in `inviteUser()` with:

```js
async function inviteUser({ email, role, full_name, caregiver_id = null, client_id = null }) {
    const db = _db();
    if (!db) return { success: false, error: 'Supabase client not available.' };

    const { data: { session } } = await db.auth.getSession();
    if (!session) return { success: false, error: 'Not authenticated.' };

    const response = await fetch(
        `${window.CAREHUB_CONFIG.SUPABASE_URL}/functions/v1/invite-user`,
        {
            method: 'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ email, role, full_name, caregiver_id, client_id })
        }
    );

    const result = await response.json();
    if (!response.ok) return { success: false, error: result.error };
    return { success: true };
}
```

---

## Flow 1 — Admin / Owner First-Time Setup

1. Admin registers via Supabase Dashboard → Authentication → Invite User
2. Admin sets password via the invite email link
3. Admin logs into CareHub → Supabase Auth session created
4. If no `profiles` row exists, `supabase-auth.js` defaults to `admin_owner` role
5. Admin manually inserts their profile row (or via SQL):

```sql
insert into public.profiles (id, email, full_name, role)
select id, email, raw_user_meta_data->>'full_name', 'admin_owner'
from auth.users
where email = 'admin@yourcompany.com';
```

---

## Flow 2 — Co-Owner Invite (Settings UI — TODO)

1. Admin navigates to Settings → Team Members → Invite Co-Owner
2. Admin enters email + full name
3. Frontend calls `SupabaseAuth.inviteUser({ email, role: 'co_owner', full_name })`
4. Edge Function creates auth account + sends invite email + upserts profile
5. Co-Owner receives email, clicks link, sets password
6. Co-Owner logs in — profile loaded from `profiles` table, role = `co_owner`

> **UI not yet built.** Add to Settings page when Edge Function is deployed.

---

## Flow 3 — Caregiver Account (Application Approval)

```
Admin views Application → clicks "Approve"
  ├─ updateApplicationStatus(id, 'approved')        [database.js]
  ├─ createCaregiverFromApplication(application)     [database.js]
  │    └─ inserts row into caregivers table
  └─ SupabaseAuth.inviteUser({                       [supabase-auth.js]
         email:        caregiver.email,
         role:         'caregiver',
         full_name:    caregiver.name,
         caregiver_id: caregiver.id
     })
       └─ Edge Function: creates auth.users row
       └─ Edge Function: upserts profiles row with caregiver_id
       └─ Supabase sends invite email to caregiver
```

**Data linkage:** `profiles.caregiver_id → caregivers.id`
This is how `resolveUserIds()` and `RoleFilter` know which caregiver record
belongs to the logged-in user.

---

## Flow 4 — Client/Family Account (Care Request Conversion)

```
Admin views Care Request → clicks "Convert to Client"
  ├─ createClientFromCareRequest(careRequest)        [database.js]
  │    └─ inserts row into clients table
  └─ SupabaseAuth.inviteUser({                       [supabase-auth.js]
         email:     familyEmail,
         role:      'client_family',
         full_name: requester_name,
         client_id: client.id
     })
       └─ Edge Function: creates auth.users row
       └─ Edge Function: upserts profiles row with client_id
       └─ Supabase sends invite email to family
```

**Data linkage:** `profiles.client_id → clients.id`

**Email field priority:** `care_requests.email` → `care_requests.requester_email`

---

## Password Reset Flow

Once Supabase Auth is live, users can reset their password via:

```js
await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://your-portal-domain.com/login.html'
});
```

> **TODO:** Add "Forgot password?" link to `login.html` that calls this.

---

## Current Status

| Step | Status |
|---|---|
| `supabase-auth.js` created | ✅ Done |
| `inviteUser()` placeholder | ✅ Done (inserts pending_invite profile row) |
| `approveApplication` wired | ✅ Done |
| `convertCareRequestToClient` wired | ✅ Done |
| Edge Function skeleton | ✅ Documented above |
| Edge Function deployed | ⏳ Pending |
| Co-owner invite UI in Settings | ⏳ Pending |
| "Forgot password" link | ⏳ Pending |
| `profiles` table created in Supabase | ⏳ Pending |
| First admin profile row inserted | ⏳ Pending |
