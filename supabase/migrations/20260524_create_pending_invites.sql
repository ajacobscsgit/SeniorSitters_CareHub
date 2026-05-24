-- ============================================================================
-- Migration: create pending_invites table
-- ============================================================================
-- Purpose:
--   Stores invite intentions queued before the invite-user Edge Function is
--   deployed. Keeps placeholder/dev invites completely separate from the
--   profiles table, which requires a real auth.users id and is protected by RLS.
--
-- Run once in your Supabase project:
--   Supabase Dashboard → SQL Editor → paste and run this file
--   OR: supabase db push  (if using the CLI with migrations)
-- ============================================================================

create table if not exists public.pending_invites (
    id           uuid        primary key default gen_random_uuid(),
    email        text        unique not null,
    full_name    text,
    role         text        not null
                             check (role in ('co_owner','caregiver','client_family')),
    caregiver_id uuid        references public.caregivers(id) on delete set null,
    client_id    uuid        references public.clients(id)    on delete set null,
    invited_by   uuid        references auth.users(id)         on delete set null,
    status       text        not null default 'pending'
                             check (status in ('pending','sent','cancelled')),
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
create index if not exists pending_invites_email_idx
    on public.pending_invites (email);

create index if not exists pending_invites_status_idx
    on public.pending_invites (status);

-- ── Updated-at trigger (reuse if the function already exists) ────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists set_pending_invites_updated_at on public.pending_invites;
create trigger set_pending_invites_updated_at
    before update on public.pending_invites
    for each row execute function public.set_updated_at();

-- ── Enable RLS ────────────────────────────────────────────────────────────────
alter table public.pending_invites enable row level security;

-- ── Helper: get the caller's role from profiles ───────────────────────────────
-- (Creates the function if it does not already exist from SUPABASE_RLS_PLAN.md)
create or replace function public.get_my_role()
returns text
language sql stable
security definer
set search_path = public
as $$
    select role from public.profiles where id = auth.uid() limit 1;
$$;

-- ── RLS Policies ─────────────────────────────────────────────────────────────

-- admin_owner and co_owner can read all pending invites
create policy "pending_invites: admins can read"
    on public.pending_invites
    for select
    using (
        public.get_my_role() in ('admin_owner', 'co_owner')
    );

-- admin_owner can insert any invitable role
create policy "pending_invites: admin_owner can insert"
    on public.pending_invites
    for insert
    with check (
        public.get_my_role() = 'admin_owner'
        and role in ('co_owner', 'caregiver', 'client_family')
    );

-- co_owner can insert caregiver and client_family only
create policy "pending_invites: co_owner can insert"
    on public.pending_invites
    for insert
    with check (
        public.get_my_role() = 'co_owner'
        and role in ('caregiver', 'client_family')
    );

-- admin_owner and co_owner can update (e.g. mark as sent/cancelled)
create policy "pending_invites: admins can update"
    on public.pending_invites
    for update
    using (
        public.get_my_role() in ('admin_owner', 'co_owner')
    );

-- No delete from the frontend — soft-cancel via status = 'cancelled' instead
-- (Uncomment below if you want hard-delete by admins)
-- create policy "pending_invites: admin_owner can delete"
--     on public.pending_invites
--     for delete
--     using ( public.get_my_role() = 'admin_owner' );

-- ── Grants ────────────────────────────────────────────────────────────────────
grant select, insert, update on public.pending_invites to authenticated;
grant usage on schema public to authenticated;
