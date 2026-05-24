-- ============================================================================
-- Migration: add account_status column to caregivers table
-- ============================================================================
-- Tracks the portal-account lifecycle for each caregiver independently of
-- their employment status (active/inactive/onboarding).
--
-- account_status values:
--   approved_no_invite  – caregiver profile created; no invite queued yet
--   pending_invite      – invite row exists in pending_invites; email not sent
--   invite_sent         – invite email delivered via Edge Function
--   active              – caregiver has accepted invite and set password
--   inactive            – account disabled
--
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================================

alter table public.caregivers
    add column if not exists account_status text
        not null default 'approved_no_invite'
        check (account_status in (
            'approved_no_invite',
            'pending_invite',
            'invite_sent',
            'active',
            'inactive'
        ));

-- Back-fill any existing rows that don't have the column yet
update public.caregivers
    set account_status = 'approved_no_invite'
    where account_status is null;

-- Index for Settings/User Management queries
create index if not exists caregivers_account_status_idx
    on public.caregivers (account_status);
