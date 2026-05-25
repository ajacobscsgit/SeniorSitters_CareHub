-- ============================================================================
-- Migration: Scheduling Engine + Availability Matching
-- ============================================================================
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================================

-- ── 1. client_schedule_preferences ──────────────────────────────────────────
-- Captures care schedule needs from intake / care request.
-- One row per client (upsert on client_id).

create table if not exists public.client_schedule_preferences (
    id              uuid primary key default gen_random_uuid(),
    client_id       uuid not null references public.clients(id) on delete cascade,
    preferred_days  text[],          -- e.g. ['Monday','Wednesday','Friday']
    preferred_start time,            -- e.g. 09:00
    preferred_end   time,            -- e.g. 13:00
    visit_length_hours numeric(4,2), -- e.g. 4.0
    frequency       text check (frequency in ('daily','weekly','bi-weekly','monthly','as-needed')),
    service_type    text,            -- Personal Care, Companionship, etc.
    start_date      date,
    is_recurring    boolean not null default true,
    notes           text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    constraint uq_client_schedule_prefs unique (client_id)
);

alter table public.client_schedule_preferences enable row level security;

create policy "Admins manage client_schedule_preferences"
    on public.client_schedule_preferences
    for all
    using (
        exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.role in ('admin_owner', 'co_owner')
        )
    );

create policy "Client_family read own preferences"
    on public.client_schedule_preferences
    for select
    using (
        exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.client_id = client_schedule_preferences.client_id
        )
    );

create index if not exists csp_client_id_idx on public.client_schedule_preferences (client_id);

-- ── 2. caregiver_availability ────────────────────────────────────────────────
-- Structured weekly availability per caregiver.
-- Multiple rows per caregiver (one per day slot).

create table if not exists public.caregiver_availability (
    id              uuid primary key default gen_random_uuid(),
    caregiver_id    uuid not null references public.caregivers(id) on delete cascade,
    day_of_week     text not null check (day_of_week in (
                        'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'
                    )),
    start_time      time not null,
    end_time        time not null,
    max_hours_week  numeric(4,1),    -- weekly hour cap (optional)
    service_area    text,            -- city / zip / region
    notes           text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

alter table public.caregiver_availability enable row level security;

create policy "Admins manage caregiver_availability"
    on public.caregiver_availability
    for all
    using (
        exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.role in ('admin_owner', 'co_owner')
        )
    );

create policy "Caregiver reads own availability"
    on public.caregiver_availability
    for select
    using (
        exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.caregiver_id = caregiver_availability.caregiver_id
        )
    );

create index if not exists ca_caregiver_id_idx on public.caregiver_availability (caregiver_id);
create index if not exists ca_day_idx          on public.caregiver_availability (day_of_week);

-- ── 3. caregiver_unavailable_dates ───────────────────────────────────────────
-- Specific blocked dates (vacation, sick, etc.).

create table if not exists public.caregiver_unavailable_dates (
    id           uuid primary key default gen_random_uuid(),
    caregiver_id uuid not null references public.caregivers(id) on delete cascade,
    date         date not null,
    reason       text,
    created_at   timestamptz not null default now(),
    constraint uq_caregiver_unavail unique (caregiver_id, date)
);

alter table public.caregiver_unavailable_dates enable row level security;

create policy "Admins manage caregiver_unavailable_dates"
    on public.caregiver_unavailable_dates
    for all
    using (
        exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.role in ('admin_owner', 'co_owner')
        )
    );

create policy "Caregiver reads own unavailable dates"
    on public.caregiver_unavailable_dates
    for select
    using (
        exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.caregiver_id = caregiver_unavailable_dates.caregiver_id
        )
    );

create index if not exists cud_caregiver_date_idx on public.caregiver_unavailable_dates (caregiver_id, date);

-- ── 4. schedules — add recurrence columns ───────────────────────────────────

alter table public.schedules
    add column if not exists is_recurring        boolean not null default false,
    add column if not exists recurrence_rule     text check (recurrence_rule in (
                                 'daily','weekly','bi-weekly','monthly'
                             )),
    add column if not exists recurrence_end_date date,
    add column if not exists recurrence_parent_id uuid references public.schedules(id) on delete set null;

create index if not exists schedules_recurrence_parent_idx
    on public.schedules (recurrence_parent_id)
    where recurrence_parent_id is not null;

create index if not exists schedules_date_caregiver_idx
    on public.schedules (date, caregiver_id);

create index if not exists schedules_date_client_idx
    on public.schedules (date, client_id);
