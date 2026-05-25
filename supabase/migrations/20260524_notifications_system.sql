-- ============================================================================
-- Migration: Notifications System
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================================

-- ── 1. Add missing columns to notifications table ───────────────────────────
-- Safe to run multiple times (all use IF NOT EXISTS / idempotent)

alter table public.notifications
    add column if not exists recipient_user_id  uuid references auth.users(id) on delete cascade,
    add column if not exists recipient_role     text,
    add column if not exists caregiver_id       uuid references public.caregivers(id) on delete set null,
    add column if not exists client_id          uuid references public.clients(id)    on delete set null,
    add column if not exists priority           text not null default 'normal'
        check (priority in ('low','normal','high','emergency')),
    add column if not exists read_at            timestamptz,
    add column if not exists related_table      text,
    add column if not exists related_record_id  uuid;

-- We keep the old `read` boolean for backward compat; read_at is the new canonical.

-- ── 2. Sync read_at from legacy read boolean on existing rows ────────────────
-- Uses created_at as fallback (current table has no updated_at column)
update public.notifications
    set read_at = created_at
    where read = true and read_at is null;

-- ── 3. Indexes ───────────────────────────────────────────────────────────────
create index if not exists notif_recipient_user_idx  on public.notifications (recipient_user_id) where recipient_user_id is not null;
create index if not exists notif_recipient_role_idx  on public.notifications (recipient_role)    where recipient_role    is not null;
create index if not exists notif_caregiver_idx       on public.notifications (caregiver_id)      where caregiver_id      is not null;
create index if not exists notif_client_idx          on public.notifications (client_id)         where client_id         is not null;
create index if not exists notif_read_at_idx         on public.notifications (read_at)           where read_at           is null;
create index if not exists notif_priority_idx        on public.notifications (priority);
create index if not exists notif_created_idx         on public.notifications (created_at desc);

-- ── 4. Enable RLS (idempotent) ───────────────────────────────────────────────
alter table public.notifications enable row level security;

-- Drop old policies if they exist so we can recreate cleanly
drop policy if exists "Admins see all notifications"           on public.notifications;
drop policy if exists "Caregiver sees own notifications"       on public.notifications;
drop policy if exists "Client family sees own notifications"   on public.notifications;
drop policy if exists "Admins insert notifications"            on public.notifications;
drop policy if exists "Mark own notifications read"            on public.notifications;
drop policy if exists "Delete own notifications"               on public.notifications;

-- Admin/Owner: full access
create policy "Admins see all notifications"
    on public.notifications for select
    using (
        exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.role in ('admin_owner', 'co_owner')
        )
    );

-- Caregiver: only rows addressed to them
create policy "Caregiver sees own notifications"
    on public.notifications for select
    using (
        exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.role = 'caregiver'
              and (
                  notifications.recipient_user_id = auth.uid()
                  or notifications.caregiver_id   = p.caregiver_id
                  or notifications.recipient_role = 'caregiver'
              )
        )
    );

-- Client/Family: only rows addressed to them
create policy "Client family sees own notifications"
    on public.notifications for select
    using (
        exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.role = 'client_family'
              and (
                  notifications.recipient_user_id = auth.uid()
                  or notifications.client_id      = p.client_id
                  or notifications.recipient_role = 'client_family'
              )
        )
    );

-- Insert: admins + backend service role
create policy "Admins insert notifications"
    on public.notifications for insert
    with check (
        exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.role in ('admin_owner', 'co_owner')
        )
    );

-- Update (mark read): user updating their own or admin
create policy "Mark own notifications read"
    on public.notifications for update
    using (
        recipient_user_id = auth.uid()
        or exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.role in ('admin_owner', 'co_owner')
        )
    );

-- Delete: admin only
create policy "Delete own notifications"
    on public.notifications for delete
    using (
        exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.role in ('admin_owner', 'co_owner')
        )
    );
