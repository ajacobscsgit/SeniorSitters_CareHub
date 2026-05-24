/**
 * CareHub — Supabase Edge Function: invite-user
 * ==============================================
 * Creates a real Supabase Auth account and a matching profiles row for a new
 * CareHub user. Must be deployed to Supabase (not run in the browser).
 *
 * Why this must be an Edge Function:
 *   - The frontend uses the ANON key — it cannot call auth.admin.*
 *   - The SERVICE_ROLE key must never be exposed in frontend code
 *   - This function verifies the caller is an admin before acting
 *
 * Required Supabase secrets (set via `supabase secrets set`):
 *   SUPABASE_SERVICE_ROLE_KEY  — your project service role key
 *   SITE_URL                   — e.g. https://your-portal-domain.com
 *                                (used as the invite redirect base URL)
 *
 * Deploy command:
 *   supabase functions deploy invite-user
 *
 * Test locally (do NOT send real emails during testing):
 *   supabase functions serve invite-user --no-verify-jwt
 *
 * Request format (POST):
 *   Authorization: Bearer <caller_access_token>
 *   Content-Type: application/json
 *   {
 *     "email":        "user@example.com",
 *     "role":         "caregiver" | "client_family" | "co_owner",
 *     "full_name":    "Jane Doe",
 *     "caregiver_id": "uuid-or-null",
 *     "client_id":    "uuid-or-null"
 *   }
 *
 * Response format:
 *   200 { "success": true, "user_id": "uuid" }
 *   400 { "error": "Missing required fields: ..." }
 *   401 { "error": "Unauthorized" }
 *   403 { "error": "Forbidden: admin role required" }
 *   409 { "error": "A user with this email address already exists." }
 *   429 { "error": "Email rate limit exceeded. Please wait before sending more invites." }
 *   500 { "error": "..." }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Environment ──────────────────────────────────────────────────────────────

const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SITE_URL           = Deno.env.get('SITE_URL') ?? 'http://127.0.0.1:5500'

// ── Admin Supabase client (uses service role — never expose this key) ─────────

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
})

// ── Allowed roles that can be invited ────────────────────────────────────────

const INVITABLE_ROLES = ['co_owner', 'caregiver', 'client_family'] as const
type InvitableRole = typeof INVITABLE_ROLES[number]

// ── Role permission matrix ────────────────────────────────────────────────────
// Which roles the caller is allowed to invite

const CAN_INVITE: Record<string, InvitableRole[]> = {
    admin_owner: ['co_owner', 'caregiver', 'client_family'],
    co_owner:    ['caregiver', 'client_family'],
}

// ── CORS headers ─────────────────────────────────────────────────────────────

const CORS_HEADERS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: CORS_HEADERS })
    }

    if (req.method !== 'POST') {
        return json({ error: 'Method not allowed' }, 405)
    }

    // ── 1. Verify caller identity ─────────────────────────────────────────
    const authHeader  = req.headers.get('Authorization') ?? ''
    const callerToken = authHeader.replace('Bearer ', '').trim()

    if (!callerToken) {
        return json({ error: 'Unauthorized: no token provided' }, 401)
    }

    const { data: { user: caller }, error: callerErr } =
        await adminClient.auth.getUser(callerToken)

    if (callerErr || !caller) {
        return json({ error: 'Unauthorized: invalid or expired token' }, 401)
    }

    // ── 2. Verify caller role ─────────────────────────────────────────────
    const { data: callerProfile, error: profileErr } = await adminClient
        .from('profiles')
        .select('role')
        .eq('id', caller.id)
        .single()

    if (profileErr || !callerProfile) {
        return json({ error: 'Forbidden: your profile was not found' }, 403)
    }

    const callerRole = callerProfile.role as string
    const allowedTargetRoles = CAN_INVITE[callerRole]

    if (!allowedTargetRoles) {
        return json({ error: 'Forbidden: your role cannot invite users' }, 403)
    }

    // ── 3. Parse and validate request body ───────────────────────────────
    let body: Record<string, unknown>
    try {
        body = await req.json()
    } catch {
        return json({ error: 'Invalid JSON in request body' }, 400)
    }

    const {
        email,
        role,
        full_name,
        caregiver_id = null,
        client_id    = null
    } = body as {
        email:        string
        role:         string
        full_name:    string
        caregiver_id?: string | null
        client_id?:    string | null
    }

    // Required field check
    const missing: string[] = []
    if (!email)     missing.push('email')
    if (!role)      missing.push('role')
    if (!full_name) missing.push('full_name')
    if (missing.length > 0) {
        return json({ error: `Missing required fields: ${missing.join(', ')}` }, 400)
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
        return json({ error: 'Invalid email address format' }, 400)
    }

    // Validate role
    if (!INVITABLE_ROLES.includes(role as InvitableRole)) {
        return json({ error: `Invalid role: "${role}". Must be one of: ${INVITABLE_ROLES.join(', ')}` }, 400)
    }

    // Check caller permission for target role
    if (!allowedTargetRoles.includes(role as InvitableRole)) {
        return json({
            error: `Forbidden: a ${callerRole} cannot invite a ${role}`
        }, 403)
    }

    // caregiver_id required if role is caregiver
    if (role === 'caregiver' && !caregiver_id) {
        return json({ error: 'caregiver_id is required when role is "caregiver"' }, 400)
    }

    // client_id required if role is client_family
    if (role === 'client_family' && !client_id) {
        return json({ error: 'client_id is required when role is "client_family"' }, 400)
    }

    const normalizedEmail = email.trim().toLowerCase()

    // ── 4. Duplicate check — look for existing auth user with this email ──
    const { data: existingUsers, error: listErr } = await adminClient.auth.admin.listUsers()
    if (!listErr && existingUsers?.users) {
        const dupe = existingUsers.users.find(
            (u) => u.email?.toLowerCase() === normalizedEmail
        )
        if (dupe) {
            return json({
                error: 'A user with this email address already exists.',
                code:  'EMAIL_EXISTS'
            }, 409)
        }
    }

    // Also check profiles table for pending_invite rows (sentinel IDs from placeholder)
    const { data: existingProfile } = await adminClient
        .from('profiles')
        .select('id, status')
        .eq('email', normalizedEmail)
        .maybeSingle()

    if (existingProfile) {
        return json({
            error: `A profile for ${normalizedEmail} already exists (status: ${existingProfile.status}). Remove it first or use a different email.`,
            code:  'PROFILE_EXISTS'
        }, 409)
    }

    // ── 5. Create auth user via admin API + send invite email ─────────────
    const { data: inviteData, error: inviteErr } =
        await adminClient.auth.admin.inviteUserByEmail(normalizedEmail, {
            data: {
                role,
                full_name,
                caregiver_id: caregiver_id ?? null,
                client_id:    client_id    ?? null
            },
            redirectTo: `${SITE_URL}/accept-invite.html`
        })

    if (inviteErr) {
        const msg = inviteErr.message ?? ''
        const lower = msg.toLowerCase()

        // Surface rate limit errors clearly to the frontend
        if (lower.includes('rate limit') || lower.includes('over_email_send_rate_limit') || lower.includes('429')) {
            return json({
                error: 'Email rate limit exceeded. Please wait before sending more invites.',
                code:  'RATE_LIMIT'
            }, 429)
        }

        // Surface duplicate auth user (should have been caught above, but belt-and-suspenders)
        if (lower.includes('already registered') || lower.includes('already been invited')) {
            return json({
                error: 'A user with this email address already exists.',
                code:  'EMAIL_EXISTS'
            }, 409)
        }

        console.error('[invite-user] inviteUserByEmail error:', inviteErr)
        return json({ error: msg || 'Failed to create user account.' }, 500)
    }

    const newUserId = inviteData.user.id

    // ── 6. Upsert profiles row with real auth.users UUID ──────────────────
    // This overwrites any sentinel row inserted by the placeholder inviteUser()
    const { error: profileUpsertErr } = await adminClient
        .from('profiles')
        .upsert({
            id:           newUserId,
            email:        normalizedEmail,
            full_name,
            role,
            caregiver_id: caregiver_id ?? null,
            client_id:    client_id    ?? null,
            status:       'pending_invite',
            created_at:   new Date().toISOString(),
            updated_at:   new Date().toISOString()
        }, { onConflict: 'id' })

    if (profileUpsertErr) {
        // Auth user was created — log the error but don't fail the request.
        // Admin can insert the profile row manually.
        console.error('[invite-user] Profile upsert failed:', profileUpsertErr)
    }

    // ── 7. Log audit trail ────────────────────────────────────────────────
    console.log(`[invite-user] ✅ Invited ${normalizedEmail} as ${role} by ${caller.email} (${callerRole})`)

    return json({ success: true, user_id: newUserId })
})

// ── Response helper ───────────────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/json'
        }
    })
}
