-- ============================================================================
-- Migration: Caregiver Training Hub
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================================

-- ── 1. training_modules ──────────────────────────────────────────────────────
-- Reusable training content created/managed by admins.

create table if not exists public.training_modules (
    id              uuid primary key default gen_random_uuid(),
    title           text not null,
    description     text,
    category        text not null default 'general'
        check (category in ('onboarding','safety','clinical','compliance','soft_skills','policy','general')),
    content_type    text not null default 'document'
        check (content_type in ('document','video','link','quiz','photo_guide','mixed')),
    content_url     text,
    content_body    text,
    thumbnail_url   text,
    image_url       text,
    duration_minutes int,
    is_required     boolean not null default false,
    requires_acknowledgement boolean not null default false,
    is_active       boolean not null default true,
    sort_order      int not null default 0,
    created_by      uuid references auth.users(id) on delete set null,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz
);

-- ── 2. training_assignments ──────────────────────────────────────────────────
-- Links a training_module to a specific caregiver, tracks completion.

create table if not exists public.training_assignments (
    id              uuid primary key default gen_random_uuid(),
    module_id       uuid not null references public.training_modules(id) on delete cascade,
    caregiver_id    uuid not null references public.caregivers(id) on delete cascade,
    assigned_by     uuid references auth.users(id) on delete set null,
    assigned_at     timestamptz not null default now(),
    due_date        date,
    status          text not null default 'assigned'
        check (status in ('assigned','in_progress','completed','overdue','waived')),
    completed_at    timestamptz,
    acknowledged_at timestamptz,
    notes           text,
    unique (module_id, caregiver_id)
);

-- ── 3. onboarding_checklist ──────────────────────────────────────────────────
-- One row per caregiver. Tracks all onboarding steps.

create table if not exists public.onboarding_checklist (
    id                          uuid primary key default gen_random_uuid(),
    caregiver_id                uuid not null unique references public.caregivers(id) on delete cascade,
    profile_completed           boolean not null default false,
    handbook_reviewed           boolean not null default false,
    emergency_policy_reviewed   boolean not null default false,
    timesheet_training_done     boolean not null default false,
    visit_update_training_done  boolean not null default false,
    document_upload_done        boolean not null default false,
    background_check_status     text not null default 'pending'
        check (background_check_status in ('pending','submitted','cleared','failed','waived')),
    orientation_completed       boolean not null default false,
    orientation_date            date,
    completed_by                uuid references auth.users(id) on delete set null,
    notes                       text,
    created_at                  timestamptz not null default now(),
    updated_at                  timestamptz
);

-- ── 4. caregiver_resources ───────────────────────────────────────────────────
-- Static resource library: handbook, policies, emergency contacts, etc.

create table if not exists public.caregiver_resources (
    id              uuid primary key default gen_random_uuid(),
    title           text not null,
    description     text,
    category        text not null default 'general'
        check (category in ('handbook','emergency','policy','contact','mileage','dress_code','communication','incident','general')),
    content_type    text not null default 'document'
        check (content_type in ('document','video','link','phone','text_block')),
    content_url     text,
    content_body    text,
    phone_number    text,
    is_pinned       boolean not null default false,
    is_active       boolean not null default true,
    sort_order      int not null default 0,
    created_by      uuid references auth.users(id) on delete set null,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz
);

-- ── 5. Indexes ────────────────────────────────────────────────────────────────
create index if not exists train_assign_caregiver_idx on public.training_assignments (caregiver_id);
create index if not exists train_assign_module_idx    on public.training_assignments (module_id);
create index if not exists train_assign_status_idx    on public.training_assignments (status);
create index if not exists train_module_active_idx    on public.training_modules (is_active, sort_order);
create index if not exists onboard_caregiver_idx      on public.onboarding_checklist (caregiver_id);
create index if not exists resources_category_idx     on public.caregiver_resources (category, sort_order);

-- ── 6. RLS ────────────────────────────────────────────────────────────────────
alter table public.training_modules     enable row level security;
alter table public.training_assignments enable row level security;
alter table public.onboarding_checklist enable row level security;
alter table public.caregiver_resources  enable row level security;

-- Drop & recreate policies (idempotent)
drop policy if exists "Admin manage training_modules"          on public.training_modules;
drop policy if exists "Caregiver read training_modules"        on public.training_modules;
drop policy if exists "Admin manage training_assignments"      on public.training_assignments;
drop policy if exists "Caregiver read own assignments"         on public.training_assignments;
drop policy if exists "Caregiver ack own assignment"           on public.training_assignments;
drop policy if exists "Admin manage onboarding_checklist"      on public.onboarding_checklist;
drop policy if exists "Caregiver read own onboarding"          on public.onboarding_checklist;
drop policy if exists "Admin manage caregiver_resources"       on public.caregiver_resources;
drop policy if exists "Caregiver read resources"               on public.caregiver_resources;

-- training_modules: admins full CRUD; caregivers read active modules only
create policy "Admin manage training_modules"
    on public.training_modules for all
    using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin_owner','co_owner')));

create policy "Caregiver read training_modules"
    on public.training_modules for select
    using (
        is_active = true
        and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'caregiver')
    );

-- training_assignments: admins full CRUD; caregivers read their own
create policy "Admin manage training_assignments"
    on public.training_assignments for all
    using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin_owner','co_owner')));

create policy "Caregiver read own assignments"
    on public.training_assignments for select
    using (
        exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'caregiver'
              and p.caregiver_id = training_assignments.caregiver_id
        )
    );

create policy "Caregiver ack own assignment"
    on public.training_assignments for update
    using (
        exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'caregiver'
              and p.caregiver_id = training_assignments.caregiver_id
        )
    );

-- onboarding_checklist: admins full CRUD; caregivers read own
create policy "Admin manage onboarding_checklist"
    on public.onboarding_checklist for all
    using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin_owner','co_owner')));

create policy "Caregiver read own onboarding"
    on public.onboarding_checklist for select
    using (
        exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'caregiver'
              and p.caregiver_id = onboarding_checklist.caregiver_id
        )
    );

-- caregiver_resources: admins full CRUD; caregivers read active
create policy "Admin manage caregiver_resources"
    on public.caregiver_resources for all
    using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin_owner','co_owner')));

create policy "Caregiver read resources"
    on public.caregiver_resources for select
    using (
        is_active = true
        and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'caregiver')
    );

-- ── 7. Seed: default onboarding rows for existing caregivers ─────────────────
insert into public.onboarding_checklist (caregiver_id)
    select id from public.caregivers
    where id not in (select caregiver_id from public.onboarding_checklist)
    on conflict (caregiver_id) do nothing;

-- ── 8. Seed: default resource entries ────────────────────────────────────────
insert into public.caregiver_resources (title, description, category, content_type, content_body, is_pinned, sort_order) values
    ('Emergency: Call 911', 'For any life-threatening emergency, call 911 immediately.', 'emergency', 'text_block', 'If a client is in immediate danger or having a medical emergency, call 911 first, then notify the agency.', true, 1),
    ('After-Hours Contact', 'Call or text the SeniorSitters on-call number for urgent non-911 situations.', 'contact', 'phone', null, true, 2),
    ('Incident Reporting', 'Any incident — fall, injury, medication error, or client complaint — must be reported within 24 hours.', 'incident', 'text_block', 'Complete an incident report form and notify your supervisor immediately. Document the situation in the visit update.', false, 10),
    ('Mileage Policy', 'Mileage reimbursement is provided for client-related travel between visits.', 'mileage', 'text_block', 'Track mileage from client location to client location (not from home). Submit with your timesheet.', false, 11),
    ('Dress Code', 'Professional, clean attire is required for all client visits.', 'dress_code', 'text_block', 'Wear comfortable, professional clothing. No strong perfumes. Closed-toe shoes recommended. ID badge must be visible.', false, 12),
    ('Client Communication Rules', 'Guidelines for communicating with clients and their families.', 'communication', 'text_block', 'Always be respectful and patient. Do not discuss other clients. Report family concerns to your supervisor.', false, 13)
on conflict do nothing;

-- ── 9. Patch: add image_url + mixed content_type (safe to re-run) ────────────
-- If the table was already created without image_url, add it now.
alter table public.training_modules
    add column if not exists image_url text;

-- Drop the old check constraint and recreate it with 'mixed' included.
-- The constraint name Postgres auto-generates is training_modules_content_type_check.
alter table public.training_modules
    drop constraint if exists training_modules_content_type_check;

alter table public.training_modules
    add constraint training_modules_content_type_check
        check (content_type in ('document','video','link','quiz','photo_guide','mixed'));
