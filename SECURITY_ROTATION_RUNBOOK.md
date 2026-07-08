# Security Rotation Runbook (CareHub)

Use this when Supabase client keys/project details were previously committed.

## 1) Rotate Supabase client credentials

1. Open Supabase Dashboard for your project.
2. Go to Project Settings -> API.
3. Rotate/regenerate the public client key used by the frontend.
4. Copy the new values and update local private config only:
   - `js/config.local.js`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
5. Do not put these values back in `js/config.js`.

Notes:
- `SUPABASE_ANON_KEY` is public by design in browser apps, but should not be hardcoded in tracked files.
- If your old anon key was in public git history, rotate it.

## 2) Project ref reality check

- Supabase project ref (the subdomain part) is generally not treated as a secret.
- In-place rotation of project ref is not a standard operation.
- If you need a fully new ref, create a new project and migrate data/functions.

## 3) Enable Edge Function path for sensitive invite flow

Invite creation is already implemented server-side in:
- `supabase/functions/invite-user/index.ts`

To switch frontend to use it:
1. Deploy function:
   - `supabase functions deploy invite-user`
2. Ensure secrets are set in Supabase:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SITE_URL`
3. In local private config set:
   - `EDGE_FUNCTION_DEPLOYED: true`
4. Test invite from Settings page.

## 4) Verify no secrets are tracked

1. Confirm local private file is ignored:
   - `git check-ignore -v js/config.local.js`
2. Confirm tracked config has no credentials:
   - `js/config.js` should read from `window.CAREHUB_PRIVATE_CONFIG`.
3. Optional history check:
   - `git log --all -S "eyJ" --oneline`
   - If sensitive values were committed, rotate them.

## 5) Optional hardening

- Restrict signup and auth settings in Supabase to required providers only.
- Keep all privileged operations in Edge Functions (service role never in browser).
- Add CI secret scanning (for example, GitHub Secret Scanning or gitleaks).
