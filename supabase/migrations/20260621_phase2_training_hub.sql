-- ============================================================================
-- Migration: Phase 2 Training Hub — Quiz Engine, Documents, Certificates & Activation
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================================

-- ── 0. Ensure storage bucket exists for caregiver documents ───────────────────
-- Note: storage.buckets may not exist in all environments; the insert is wrapped safely.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select 'caregiver-documents', 'caregiver-documents', true, 10485760, '{application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document}'
where NOT EXISTS (select 1 from storage.buckets where id = 'caregiver-documents');

-- Storage RLS policies: caregivers may upload only into their own folder; admins may manage all.
drop policy if exists "caregiver-documents: caregiver upload own" on storage.objects;
drop policy if exists "caregiver-documents: admin manage" on storage.objects;
drop policy if exists "caregiver-documents: public read" on storage.objects;

create policy "caregiver-documents: public read"
    on storage.objects for select
    using (bucket_id = 'caregiver-documents');

create policy "caregiver-documents: caregiver upload own"
    on storage.objects for insert
    with check (
        bucket_id = 'caregiver-documents'
        and exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.role = 'caregiver'
              and name like (p.caregiver_id::text || '/%')
        )
    );

create policy "caregiver-documents: caregiver update own"
    on storage.objects for update
    using (
        bucket_id = 'caregiver-documents'
        and exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.role = 'caregiver'
              and name like (p.caregiver_id::text || '/%')
        )
    );

create policy "caregiver-documents: admin manage"
    on storage.objects for all
    using (
        bucket_id = 'caregiver-documents'
        and exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.role in ('admin_owner','co_owner')
        )
    );

-- ── 1. Extend training_modules for quiz engine ───────────────────────────────
alter table public.training_modules
    add column if not exists passing_score int not null default 80,
    add column if not exists max_attempts  int not null default 0,  -- 0 = unlimited
    add column if not exists allow_retake boolean not null default true,
    add column if not exists quiz_config   jsonb;  -- {shuffle_questions, show_explanation, randomize_choices}

-- Ensure 'quiz' content type is allowed (drop/recreate check constraint idempotently)
alter table public.training_modules
    drop constraint if exists training_modules_content_type_check;
alter table public.training_modules
    add constraint training_modules_content_type_check
        check (content_type in ('document','video','link','quiz','photo_guide','mixed'));

-- ── 2. quiz_questions ────────────────────────────────────────────────────────
-- Multiple-choice questions tied to a quiz-type module.
create table if not exists public.quiz_questions (
    id                uuid primary key default gen_random_uuid(),
    module_id         uuid not null references public.training_modules(id) on delete cascade,
    question_text     text not null,
    question_type     text not null default 'multiple_choice'
        check (question_type in ('multiple_choice','true_false')),
    choices           jsonb not null,           -- array of strings
    correct_index     int not null,             -- 0-based index into choices
    explanation       text,
    sort_order        int not null default 0,
    is_active         boolean not null default true,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz,
    unique (module_id, question_text)
);

comment on table public.quiz_questions is 'Questions for quiz-type training modules.';

-- ── 3. quiz_attempts ─────────────────────────────────────────────────────────
-- Every quiz submission with full answer history and score.
create table if not exists public.quiz_attempts (
    id                uuid primary key default gen_random_uuid(),
    assignment_id     uuid references public.caregiver_training_assignments(id) on delete cascade,
    caregiver_id      uuid not null references public.caregivers(id) on delete cascade,
    module_id         uuid not null references public.training_modules(id) on delete cascade,
    attempt_number    int not null default 1,
    score             int not null,             -- percentage 0-100
    passed            boolean not null default false,
    answers           jsonb not null default '[]', -- [{question_id, selected_index, correct}]
    started_at        timestamptz,
    completed_at      timestamptz not null default now(),
    created_at        timestamptz not null default now()
);

comment on table public.quiz_attempts is 'Per-caregiver quiz attempt history and scores.';

-- ── 4. caregiver_documents ───────────────────────────────────────────────────
-- Secure uploads for required caregiver documents with admin review workflow.
create table if not exists public.caregiver_documents (
    id                uuid primary key default gen_random_uuid(),
    caregiver_id      uuid not null references public.caregivers(id) on delete cascade,
    document_type     text not null
        check (document_type in (
            'drivers_license','auto_insurance','background_check','w9','direct_deposit','signed_policies'
        )),
    file_url          text not null,
    file_name         text,
    file_size         int,
    mime_type         text,
    uploaded_at       timestamptz not null default now(),
    status            text not null default 'pending'
        check (status in ('pending','approved','rejected','expired')),
    reviewed_by       uuid references auth.users(id) on delete set null,
    reviewed_at       timestamptz,
    admin_notes       text,
    expires_on        date,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz,
    unique (caregiver_id, document_type)
);

comment on table public.caregiver_documents is 'Uploaded caregiver documents pending admin review/approval.';

-- ── 5. caregiver_certificates ────────────────────────────────────────────────
create table if not exists public.caregiver_certificates (
    id                uuid primary key default gen_random_uuid(),
    caregiver_id      uuid not null references public.caregivers(id) on delete cascade,
    assignment_id     uuid references public.caregiver_training_assignments(id) on delete set null,
    module_id         uuid not null references public.training_modules(id) on delete cascade,
    module_name       text not null,
    score             int not null,
    certificate_number text unique,
    issued_at         timestamptz not null default now(),
    created_at        timestamptz not null default now(),
    unique (caregiver_id, module_id)
);

comment on table public.caregiver_certificates is 'Downloadable completion certificates for training modules.';

-- ── 6. Caregiver activation workflow ───────────────────────────────────────────
alter table public.caregivers
    add column if not exists activation_status text
        not null default 'training_required'
        check (activation_status in (
            'approved',
            'training_required',
            'training_complete',
            'documents_required',
            'active',
            'inactive',
            'flagged'
        ));

-- Back-fill existing caregivers
update public.caregivers
    set activation_status = 'active'
    where activation_status = 'training_required'
      and status = 'active'
      and (training_status = 'completed' or training_status is null);

update public.caregivers
    set activation_status = 'training_required'
    where activation_status = 'training_required'
      and (status = 'onboarding' or training_status = 'pending');

-- ── 7. Indexes ───────────────────────────────────────────────────────────────
create index if not exists quiz_questions_module_idx      on public.quiz_questions (module_id, sort_order);
create index if not exists quiz_attempts_caregiver_idx    on public.quiz_attempts (caregiver_id, module_id, attempt_number);
create index if not exists quiz_attempts_assignment_idx   on public.quiz_attempts (assignment_id);
create index if not exists caregiver_docs_caregiver_idx   on public.caregiver_documents (caregiver_id, document_type);
create index if not exists caregiver_docs_status_idx        on public.caregiver_documents (status);
create index if not exists caregiver_certs_caregiver_idx  on public.caregiver_certificates (caregiver_id);
create index if not exists caregivers_activation_idx      on public.caregivers (activation_status);

-- ── 8. RLS ─────────────────────────────────────────────────────────────────────
alter table public.quiz_questions      enable row level security;
alter table public.quiz_attempts       enable row level security;
alter table public.caregiver_documents enable row level security;
alter table public.caregiver_certificates enable row level security;

-- Drop & recreate policies
-- quiz_questions
-- Admin manage quiz_questions

-- Quiz questions: caregivers can read questions for active modules they are assigned to

drop policy if exists "quiz_questions: admin manage" on public.quiz_questions;
drop policy if exists "quiz_questions: caregiver read assigned" on public.quiz_questions;

create policy "quiz_questions: admin manage"
    on public.quiz_questions for all
    using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin_owner','co_owner')));

create policy "quiz_questions: caregiver read assigned"
    on public.quiz_questions for select
    using (
        is_active = true
        and exists (
            select 1 from public.caregiver_training_assignments ta
            join public.profiles p on p.caregiver_id = ta.caregiver_id
            where p.id = auth.uid()
              and p.role = 'caregiver'
              and ta.module_id = quiz_questions.module_id
        )
    );

-- quiz_attempts: caregivers read/insert own; admins read all

drop policy if exists "quiz_attempts: admin manage" on public.quiz_attempts;
drop policy if exists "quiz_attempts: caregiver own" on public.quiz_attempts;

create policy "quiz_attempts: admin manage"
    on public.quiz_attempts for all
    using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin_owner','co_owner')));

create policy "quiz_attempts: caregiver own"
    on public.quiz_attempts for select
    using (
        exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.role = 'caregiver'
              and p.caregiver_id = quiz_attempts.caregiver_id
        )
    );

create policy "quiz_attempts: caregiver insert own"
    on public.quiz_attempts for insert
    with check (
        exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.role = 'caregiver'
              and p.caregiver_id = quiz_attempts.caregiver_id
        )
    );

-- caregiver_documents: caregivers read/insert own; admins read/insert/update all

drop policy if exists "caregiver_documents: admin manage" on public.caregiver_documents;
drop policy if exists "caregiver_documents: caregiver own" on public.caregiver_documents;

create policy "caregiver_documents: admin manage"
    on public.caregiver_documents for all
    using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin_owner','co_owner')));

create policy "caregiver_documents: caregiver own"
    on public.caregiver_documents for all
    using (
        exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.role = 'caregiver'
              and p.caregiver_id = caregiver_documents.caregiver_id
        )
    );

-- caregiver_certificates: caregivers read own; admins read all

drop policy if exists "caregiver_certificates: admin manage" on public.caregiver_certificates;
drop policy if exists "caregiver_certificates: caregiver own" on public.caregiver_certificates;

create policy "caregiver_certificates: admin manage"
    on public.caregiver_certificates for all
    using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin_owner','co_owner')));

create policy "caregiver_certificates: caregiver own"
    on public.caregiver_certificates for select
    using (
        exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.role = 'caregiver'
              and p.caregiver_id = caregiver_certificates.caregiver_id
        )
    );

-- ── 9. Helper: refresh caregiver activation_status ───────────────────────────
-- This function is called by triggers and application code to advance a caregiver
-- through the activation workflow: approved → training_required → training_complete
-- → documents_required → active.
create or replace function public.refresh_caregiver_activation(p_caregiver_id uuid)
returns public.caregivers.activation_status%type
language plpgsql
security definer
set search_path = public
as $$
declare
    v_status             public.caregivers.activation_status%type;
    v_training_status    text;
    v_bg_status          text;
    v_required_training  int;
    v_completed_training int;
    v_required_docs      int;
    v_approved_docs      int;
    v_flagged            boolean;
begin
    select activation_status, training_status, background_check_status
      into v_status, v_training_status, v_bg_status
      from public.caregivers
     where id = p_caregiver_id;

    if not found then return 'approved'; end if;

    -- Inactive/flagged are terminal admin-set states; do not auto-advance.
    if v_status in ('inactive','flagged') then return v_status; end if;

    -- Required training modules completed?
    select count(*) into v_required_training
      from public.training_modules
     where is_active = true and is_required = true;

    select count(distinct ta.module_id) into v_completed_training
      from public.caregiver_training_assignments ta
     where ta.caregiver_id = p_caregiver_id
       and ta.status = 'completed'
       and ta.module_id in (select id from public.training_modules where is_active = true and is_required = true);

    -- Required documents approved?
    select count(*) into v_required_docs
      from (values ('drivers_license'),('auto_insurance'),('background_check'),('w9'),('direct_deposit'),('signed_policies')) as t(doc_type);

    select count(*) into v_approved_docs
      from public.caregiver_documents
     where caregiver_id = p_caregiver_id
       and status = 'approved'
       and document_type in ('drivers_license','auto_insurance','background_check','w9','direct_deposit','signed_policies');

    -- Any flagged onboarding/training status?
    select exists (
        select 1 from public.caregiver_onboarding_progress
         where caregiver_id = p_caregiver_id and status = 'flagged'
    ) into v_flagged;

    if v_flagged then
        update public.caregivers
           set activation_status = 'flagged',
               status = case when status = 'active' then 'onboarding' else status end,
               updated_at = now()
         where id = p_caregiver_id;
        return 'flagged';
    end if;

    if v_bg_status = 'failed' then
        update public.caregivers
           set activation_status = 'flagged',
               status = 'onboarding',
               updated_at = now()
         where id = p_caregiver_id;
        return 'flagged';
    end if;

    -- Determine next activation state
    if v_required_training > 0 and v_completed_training < v_required_training then
        update public.caregivers
           set activation_status = 'training_required',
               status = 'onboarding',
               updated_at = now()
         where id = p_caregiver_id;
        return 'training_required';
    end if;

    if v_required_training > 0 and v_completed_training >= v_required_training then
        -- Still need documents?
        if v_approved_docs < v_required_docs then
            update public.caregivers
               set activation_status = 'documents_required',
                   status = 'onboarding',
                   updated_at = now()
             where id = p_caregiver_id;
            return 'documents_required';
        end if;

        -- Still need background check cleared?
        if v_bg_status not in ('cleared','waived') then
            update public.caregivers
               set activation_status = 'documents_required',
                   status = 'onboarding',
                   updated_at = now()
             where id = p_caregiver_id;
            return 'documents_required';
        end if;

        -- All clear
        update public.caregivers
           set activation_status = 'active',
               status = 'active',
               training_status = 'completed',
               documents_status = 'approved',
               updated_at = now()
         where id = p_caregiver_id;
        return 'active';
    end if;

    return v_status;
end;
$$;

-- ── 10. Triggers ───────────────────────────────────────────────────────────────
-- Auto-refresh activation whenever training assignments or documents change.
create or replace function public.trg_refresh_activation_on_training()
returns trigger as $$
begin
    perform public.refresh_caregiver_activation(new.caregiver_id);
    return new;
end;
$$ language plpgsql;

create or replace function public.trg_refresh_activation_on_documents()
returns trigger as $$
begin
    perform public.refresh_caregiver_activation(new.caregiver_id);
    return new;
end;
$$ language plpgsql;

drop trigger if exists refresh_activation_training on public.caregiver_training_assignments;
create trigger refresh_activation_training
    after insert or update on public.caregiver_training_assignments
    for each row execute function public.trg_refresh_activation_on_training();

drop trigger if exists refresh_activation_documents on public.caregiver_documents;
create trigger refresh_activation_documents
    after insert or update on public.caregiver_documents
    for each row execute function public.trg_refresh_activation_on_documents();

-- ── 10b. Mark training assignment complete (security definer) ─────────────────
-- Caregivers may not have direct UPDATE rights on caregiver_training_assignments.
-- This function lets them mark their own assigned module as completed.
create or replace function public.mark_training_assignment_complete(
    p_assignment_id uuid,
    p_score int default null,
    p_acknowledged boolean default false
) returns boolean
security definer
set search_path = public
as $$
declare
    v_caregiver_id uuid;
    v_user_caregiver_id uuid;
    v_module_id uuid;
    v_status text;
begin
    -- Resolve the caregiver linked to the authenticated user
    select caregiver_id into v_user_caregiver_id
      from public.profiles
     where id = auth.uid()
       and role = 'caregiver';

    -- Resolve assignment owner
    select caregiver_id, module_id, status into v_caregiver_id, v_module_id, v_status
      from public.caregiver_training_assignments
     where id = p_assignment_id;

    if v_caregiver_id is null then
        return false;
    end if;

    -- Only the assigned caregiver or an admin may complete it
    if v_user_caregiver_id is not null and v_user_caregiver_id <> v_caregiver_id then
        return false;
    end if;

    if v_user_caregiver_id is null and not exists (
        select 1 from public.profiles where id = auth.uid() and role in ('admin_owner','co_owner')
    ) then
        return false;
    end if;

    if v_status = 'completed' then
        return true;
    end if;

    update public.caregiver_training_assignments
       set status = 'completed',
           completed_at = now(),
           score = coalesce(p_score, score),
           acknowledged_at = case when p_acknowledged then now() else acknowledged_at end,
           updated_at = now()
     where id = p_assignment_id;

    return true;
end;
$$ language plpgsql;

-- ── 10c. Certificate issuance function (security definer) ────────────────────
-- Called by the app when a caregiver passes a quiz. Bypasses RLS because the
-- row is created as a side effect of a passed quiz, not by direct user action.
create or replace function public.issue_training_certificate(
    p_caregiver_id uuid,
    p_assignment_id uuid,
    p_module_id uuid,
    p_score int
) returns uuid
security definer
set search_path = public
as $$
declare
    v_module_name text;
    v_cert_number text;
    v_cert_id uuid;
    v_user_caregiver_id uuid;
    v_is_admin boolean;
    v_assignment_caregiver_id uuid;
    v_passed_attempt uuid;
begin
    -- Verify caller identity
    select caregiver_id into v_user_caregiver_id
      from public.profiles
     where id = auth.uid()
       and role = 'caregiver';

    v_is_admin := exists (
        select 1 from public.profiles
         where id = auth.uid()
           and role in ('admin_owner','co_owner')
    );

    if v_user_caregiver_id is null and not v_is_admin then
        return null;
    end if;

    -- Resolve assignment ownership
    select caregiver_id into v_assignment_caregiver_id
      from public.caregiver_training_assignments
     where id = p_assignment_id;

    if v_assignment_caregiver_id is null or v_assignment_caregiver_id <> p_caregiver_id then
        return null;
    end if;

    -- Caregivers can only issue certificates for themselves
    if v_user_caregiver_id is not null and v_user_caregiver_id <> p_caregiver_id then
        return null;
    end if;

    -- Require a passed quiz attempt for this module to prevent abuse
    select id into v_passed_attempt
      from public.quiz_attempts
     where caregiver_id = p_caregiver_id
       and module_id = p_module_id
       and passed = true
     order by created_at desc
     limit 1;

    if v_passed_attempt is null then
        return null;
    end if;

    select title into v_module_name from public.training_modules where id = p_module_id;
    v_cert_number := 'SS-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || upper(substring(md5(random()::text), 1, 4));

    insert into public.caregiver_certificates (
        caregiver_id, assignment_id, module_id, module_name, score, certificate_number, issued_at
    ) values (
        p_caregiver_id, p_assignment_id, p_module_id, coalesce(v_module_name, 'Training Module'), p_score, v_cert_number, now()
    )
    on conflict (caregiver_id, module_id) do nothing
    returning id into v_cert_id;

    return v_cert_id;
end;
$$ language plpgsql;

-- ── 11. Seed the 12 required SeniorSitters onboarding modules ──────────────────
-- These modules are the core curriculum. Each quiz module has passing_score = 80.
with inserted_modules as (
    insert into public.training_modules (
        title, description, category, content_type, is_required, requires_acknowledgement,
        passing_score, max_attempts, allow_retake, duration_minutes, sort_order, is_active, content_body
    ) values
    (
        'Welcome to SeniorSitters',
        'Introduction to SeniorSitters, our mission, and what it means to be a caregiver on our team.',
        'onboarding', 'mixed', true, true, 80, 0, true, 15, 1, true,
        'Welcome to the SeniorSitters team!

SeniorSitters is a family-owned, non-medical companion care company serving seniors and families throughout Northeast Ohio. Our mission is to help older adults remain connected, independent, active, and supported while giving families peace of mind.

What We Do:
- Friendly companionship and conversation
- Games, puzzles, reading, and hobbies
- Appointment companionship
- Grocery shopping and errands
- Community outings
- Meal reminders and light meal assistance
- Light household support
- Wellness check-ins
- Family updates
- Respite support for family caregivers

What We Do NOT Do:
- No medical care, medication administration, or nursing tasks
- No injections, wound care, or diagnosis
- No heavy lifting outside company policy
- No accepting money, gifts, loans, or tips from clients
- No giving personal medical, legal, or financial advice

By completing this training, you agree to represent SeniorSitters with professionalism, compassion, and respect.'
    ),
    (
        'Non-Medical Companion Care Overview',
        'Defines the scope of non-medical companion care and the limits of a caregiver role.',
        'onboarding', 'quiz', true, false, 80, 0, true, 20, 2, true,
        'Companion care focuses on emotional support, safety, and daily quality of life—not medical treatment.

Examples of companion care tasks:
- Conversation, social engagement, and emotional support
- Accompanying clients to appointments, errands, or outings
- Reminding clients to take medications (but never administering them)
- Light housekeeping, meal preparation, and laundry
- Reporting changes in condition to the agency and family

Caregivers must stay within the non-medical scope. If a client asks for help that requires a nurse, therapist, or medical professional, contact SeniorSitters management.'
    ),
    (
        'Professional Boundaries',
        'Maintaining appropriate relationships with clients, families, and the agency.',
        'compliance', 'quiz', true, false, 80, 0, true, 15, 3, true,
        'Professional boundaries keep clients safe, protect your reputation, and preserve trust.

Key boundaries:
- Keep relationships professional, not personal or romantic
- Do not accept money, gifts, loans, or tips from clients or families
- Do not share personal problems, social media, or contact information with clients
- Do not visit clients outside assigned schedule times without agency approval
- Do not take clients to your home or personal locations
- Do not give medical, legal, financial, or nutritional advice
- Report any boundary-testing behavior to SeniorSitters immediately'
    ),
    (
        'Senior Safety',
        'Identifying and reducing common safety hazards in the home and during outings.',
        'safety', 'quiz', true, false, 80, 0, true, 20, 4, true,
        'Senior safety is everyone’s responsibility. Be alert to hazards and advocate for a safe environment.

Common home hazards:
- Throw rugs, clutter, and uneven flooring
- Poor lighting, especially at night
- Wet floors and bathrooms without grab bars
- Unsafe cooking or heating equipment
- Medication mismanagement or expired medications
- Tripping hazards from cords or pets

During outings:
- Use the client’s mobility aids (walker, cane, wheelchair) as appropriate
- Choose accessible routes and parking
- Avoid rushing; allow extra time
- Keep an eye on weather and temperature
- Carry the agency emergency contact number'
    ),
    (
        'Fall Prevention',
        'Strategies to prevent falls and respond appropriately if a fall occurs.',
        'safety', 'quiz', true, false, 80, 0, true, 15, 5, true,
        'Falls are a leading cause of injury among older adults. Prevention and response are critical.

Prevention tips:
- Ensure clear pathways and adequate lighting
- Encourage appropriate footwear
- Assist clients during position changes (sitting to standing)
- Use gait belts or mobility aids when trained and approved
- Never rush a client
- Report home hazards to the agency and family

If a fall occurs:
- Stay calm and call 911 if there is injury, pain, or uncertainty
- Do not lift the client alone unless it is safe and within your training
- Reassure the client and keep them comfortable
- Notify SeniorSitters immediately
- Document the incident in a visit update'
    ),
    (
        'Emergency Response',
        'How to respond to medical emergencies, fires, severe weather, and other urgent situations.',
        'safety', 'quiz', true, false, 80, 0, true, 20, 6, true,
        'In any emergency, your first priority is safety.

Medical emergency:
- Call 911 first
- Stay with the client until help arrives
- Notify SeniorSitters as soon as it is safe to do so
- Document the incident thoroughly

Fire or severe weather:
- Follow the client’s emergency plan if available
- Move to a safe location if possible
- Call 911 for life-threatening situations
- Keep your phone charged and accessible

Remember: You are never expected to handle emergencies alone. When in doubt, call 911 and then call us.'
    ),
    (
        'Transportation & Outings',
        'Safely transporting clients and planning community outings.',
        'safety', 'quiz', true, false, 80, 0, true, 15, 7, true,
        'Transportation and outings support social connection and independence.

Before transporting a client:
- Confirm the client has signed a transportation waiver on file
- Verify your driver’s license and auto insurance are current and approved
- Inspect the vehicle for safety
- Plan the route and allow extra time
- Bring the client’s mobility aids if needed

During outings:
- Assist clients in and out of the vehicle safely
- Never leave a client unattended in a vehicle
- Follow traffic laws and avoid distractions
- Keep receipts and log mileage for reimbursement
- Report any incidents or concerns immediately'
    ),
    (
        'Documentation & CareHub Usage',
        'How to document visits, submit timesheets, and use the CareHub portal correctly.',
        'policy', 'quiz', true, false, 80, 0, true, 25, 8, true,
        'Accurate documentation is essential for quality care, billing, and payroll.

Visit updates:
- Submit after every visit
- Record what happened, how the client was doing, and any concerns
- Use objective, respectful language
- Submit before the end of the day when possible

Timesheets:
- Record actual start and end times
- Submit within the pay period
- Include breaks and mileage if applicable

CareHub:
- Check your schedule before each visit
- Review client notes and preferences
- Submit documentation promptly
- Update your availability and time-off requests'
    ),
    (
        'Family Communication',
        'Best practices for communicating with clients and their families.',
        'soft_skills', 'quiz', true, false, 80, 0, true, 15, 9, true,
        'Clear, respectful communication builds trust.

With clients:
- Speak clearly, listen actively, and be patient
- Respect preferences and dignity
- Do not rush or talk down to the client
- Confirm understanding when giving reminders

With families:
- Share only what is relevant and appropriate
- Report concerns to the agency, not directly to family members unless instructed
- Be professional in all calls, texts, and messages
- Document important communications in the visit update

Remember: client information is confidential. Do not share details outside the care team.'
    ),
    (
        'Elder Abuse Awareness',
        'Recognizing and reporting suspected abuse, neglect, or exploitation.',
        'compliance', 'quiz', true, false, 80, 0, true, 20, 10, true,
        'Elder abuse can be physical, emotional, financial, or neglectful. Caregivers are mandatory reporters in many situations.

Signs to watch for:
- Unexplained bruises, burns, or injuries
- Sudden changes in behavior or withdrawal
- Fear of a particular person
- Missing money, unpaid bills, or unusual financial activity
- Poor hygiene, dehydration, or unsafe living conditions
- Isolation from friends or family

If you suspect abuse:
- Ensure the client is safe
- Call 911 if there is immediate danger
- Report to SeniorSitters immediately
- Document observations objectively
- Do not confront the suspected abuser yourself'
    ),
    (
        'Confidentiality & Privacy',
        'Protecting client information and following HIPAA-aligned privacy practices.',
        'compliance', 'mixed', true, true, 80, 0, true, 15, 11, true,
        'Client information is private and must be protected at all times.

You must NOT:
- Share client names, addresses, phone numbers, or health information
- Discuss clients with friends, family, or other clients
- Post photos, videos, or comments about clients online
- Remove documents or records from the client’s home
- Access client information that is not needed for your role

You MUST:
- Store devices and notes securely
- Use only approved communication channels
- Report any privacy breach immediately
- Follow agency policies for records and documentation

Violation of confidentiality is grounds for immediate termination and may result in legal action.'
    ),
    (
        'Company Policies',
        'SeniorSitters employee policies, including dress code, attendance, and conduct.',
        'policy', 'quiz', true, true, 80, 0, true, 20, 12, true,
        'Company policies ensure consistency, safety, and professionalism.

Dress code:
- Clean, professional, comfortable clothing
- Closed-toe shoes
- Minimal perfume or cologne
- ID badge visible when required

Attendance and punctuality:
- Arrive on time for every shift
- Report lateness or absence as early as possible
- Follow the call-out procedure

Conduct:
- Treat clients, families, and coworkers with respect
- Follow the care plan and agency instructions
- Complete required training on time
- Maintain boundaries and confidentiality
- Represent SeniorSitters positively in the community

By acknowledging this module, you confirm you understand and agree to follow SeniorSitters policies.'
    )
    on conflict do nothing
    returning id, title
)
select * from inserted_modules;

-- Helper to find module IDs for quiz question insertion
-- We use DO block so we can look up UUIDs safely.
do $$
declare
    m_welcome uuid;
    m_nonmed  uuid;
    m_bound   uuid;
    m_safety  uuid;
    m_fall    uuid;
    m_emer    uuid;
    m_trans   uuid;
    m_doc     uuid;
    m_fam     uuid;
    m_abuse   uuid;
    m_conf    uuid;
    m_policy  uuid;
begin
    select id into m_welcome from public.training_modules where title = 'Welcome to SeniorSitters';
    select id into m_nonmed  from public.training_modules where title = 'Non-Medical Companion Care Overview';
    select id into m_bound   from public.training_modules where title = 'Professional Boundaries';
    select id into m_safety  from public.training_modules where title = 'Senior Safety';
    select id into m_fall    from public.training_modules where title = 'Fall Prevention';
    select id into m_emer    from public.training_modules where title = 'Emergency Response';
    select id into m_trans   from public.training_modules where title = 'Transportation & Outings';
    select id into m_doc     from public.training_modules where title = 'Documentation & CareHub Usage';
    select id into m_fam     from public.training_modules where title = 'Family Communication';
    select id into m_abuse   from public.training_modules where title = 'Elder Abuse Awareness';
    select id into m_conf    from public.training_modules where title = 'Confidentiality & Privacy';
    select id into m_policy  from public.training_modules where title = 'Company Policies';

    -- Welcome to SeniorSitters (acknowledgement only, no quiz questions needed)

    -- Non-Medical Companion Care Overview
    insert into public.quiz_questions (module_id, question_text, choices, correct_index, explanation, sort_order) values
    (m_nonmed, 'Which of the following is an appropriate companion care task?', '["Administering medication","Wound care","Accompanying a client to an appointment","Giving medical advice"]', 2, 'Accompanying a client to an appointment is within the non-medical companion care scope.', 1),
    (m_nonmed, 'A client asks you to help with their insulin injection. What should you do?', '["Help because it is a small task","Refuse and contact SeniorSitters management","Ask a family member to do it","Look up instructions online"]', 1, 'Insulin injections are medical tasks and outside the caregiver scope. Contact management.', 2),
    (m_nonmed, 'Which statement best describes the SeniorSitters scope of care?', '["Medical nursing care","Non-medical companion care","Physical therapy","Hospice care"]', 1, 'SeniorSitters provides non-medical companion care.', 3),
    (m_nonmed, 'You notice a client condition change. What should you do?', '["Ignore it unless it is severe","Document it and report to the agency","Tell the client to call their doctor","Post about it on social media"]', 1, 'Report changes in condition to the agency and family through proper channels.', 4),
    (m_nonmed, 'Meal reminders are allowed, but medication administration is not.', '["True","False"]', 0, 'Caregivers may remind clients about medications but cannot administer them.', 5) on conflict (module_id, question_text) do nothing;

    -- Professional Boundaries
    insert into public.quiz_questions (module_id, question_text, choices, correct_index, explanation, sort_order) values
    (m_bound, 'A client offers you a $50 gift card. What should you do?', '["Accept it graciously","Accept it and do not tell anyone","Politely decline and report it to the agency","Ask for cash instead"]', 2, 'Caregivers must not accept gifts, money, or tips from clients.', 1),
    (m_bound, 'Which of the following is a violation of professional boundaries?', '["Visiting a client during assigned hours","Accepting a friend request from a client on social media","Following the care plan","Reporting a safety concern"]', 1, 'Connecting with clients on personal social media crosses professional boundaries.', 2),
    (m_bound, 'You may give a client general wellness tips but not medical advice.', '["True","False"]', 0, 'Caregivers should not give medical, legal, or financial advice.', 3),
    (m_bound, 'A client asks to borrow money until payday. You should:', '["Lend it if you trust them","Politely refuse and report to SeniorSitters","Ask a family member to lend it","Ignore the request"]', 1, 'Financial relationships with clients are prohibited.', 4) on conflict (module_id, question_text) do nothing;

    -- Senior Safety
    insert into public.quiz_questions (module_id, question_text, choices, correct_index, explanation, sort_order) values
    (m_safety, 'Which is a common home fall hazard?', '["Night lights","Grab bars","Throw rugs","Handrails"]', 2, 'Throw rugs are a common tripping hazard.', 1),
    (m_safety, 'During an outing, you should:', '["Leave the client in the car while you run an errand","Rush to finish on time","Use the client’s mobility aids and allow extra time","Let the client walk unassisted if they insist"]', 2, 'Use mobility aids and allow extra time for safety.', 3),
    (m_safety, 'Expired medications should be reported as a safety concern.', '["True","False"]', 0, 'Expired medications can be dangerous and should be reported.', 3),
    (m_safety, 'Poor lighting is not a safety concern for older adults.', '["True","False"]', 1, 'Poor lighting increases fall risk and is a safety concern.', 4) on conflict (module_id, question_text) do nothing;

    -- Fall Prevention
    insert into public.quiz_questions (module_id, question_text, choices, correct_index, explanation, sort_order) values
    (m_fall, 'If a client falls and is in pain, you should first:', '["Help them up immediately","Call 911","Wait to see if it gets better","Call the family first"]', 1, 'Call 911 if there is pain, injury, or uncertainty.', 1),
    (m_fall, 'To prevent falls, caregivers should encourage clients to change positions slowly.', '["True","False"]', 0, 'Slow position changes reduce dizziness and fall risk.', 2),
    (m_fall, 'A gait belt should be used:', '["Only when lifting a client alone","When trained and approved as part of the care plan","Never","Only for exercise"]', 1, 'Use gait belts only when trained and approved in the care plan.', 3),
    (m_fall, 'After a fall, you must document the incident in a visit update.', '["True","False"]', 0, 'All falls must be documented and reported.', 4) on conflict (module_id, question_text) do nothing;

    -- Emergency Response
    insert into public.quiz_questions (module_id, question_text, choices, correct_index, explanation, sort_order) values
    (m_emer, 'In a medical emergency, the first call should be to:', '["SeniorSitters management","911","The client family","The pharmacy"]', 1, 'Call 911 first for life-threatening emergencies.', 1),
    (m_emer, 'After calling 911, you should notify SeniorSitters as soon as it is safe.', '["True","False"]', 0, 'The agency must be notified after emergency services are contacted.', 2),
    (m_emer, 'You are expected to handle all emergencies alone without calling for help.', '["True","False"]', 1, 'Caregivers should call 911 and the agency for support.', 3),
    (m_emer, 'During severe weather, you should:', '["Continue the outing as planned","Follow the client’s emergency plan and move to safety","Leave the client immediately","Ignore weather alerts"]', 1, 'Follow the emergency plan and prioritize safety.', 4) on conflict (module_id, question_text) do nothing;

    -- Transportation & Outings
    insert into public.quiz_questions (module_id, question_text, choices, correct_index, explanation, sort_order) values
    (m_trans, 'Before transporting a client, you must verify:', '["That the client has a transportation waiver on file","That you have a sports car","That the family is not home","That the client does not need mobility aids"]', 0, 'Transportation waivers and current insurance/license are required.', 1),
    (m_trans, 'You may leave a client unattended in a vehicle briefly if the weather is mild.', '["True","False"]', 1, 'Never leave a client unattended in a vehicle.', 2),
    (m_trans, 'Mileage for outings should be:', '["Guessed at the end of the week","Logged with date and purpose","Not recorded","Submitted only if requested"]', 1, 'Mileage must be logged accurately for reimbursement.', 3),
    (m_trans, 'Which document is required before driving a client?', '["Client birth certificate","Valid driver’s license and approved auto insurance","Client will","Social security card"]', 1, 'Current license and approved auto insurance are required.', 4) on conflict (module_id, question_text) do nothing;

    -- Documentation & CareHub Usage
    insert into public.quiz_questions (module_id, question_text, choices, correct_index, explanation, sort_order) values
    (m_doc, 'Visit updates should be submitted:', '["Weekly","After every visit","Only when something bad happens","Monthly"]', 1, 'Visit updates are submitted after every visit.', 1),
    (m_doc, 'Timesheets should reflect actual start and end times.', '["True","False"]', 0, 'Accurate time recording is required for payroll.', 2),
    (m_doc, 'Caregivers should review client notes in CareHub before each visit.', '["True","False"]', 0, 'Reviewing notes helps provide safe, consistent care.', 3),
    (m_doc, 'If you forget to submit a visit update, you should:', '["Skip it","Submit it as soon as possible","Make up details later","Tell the client to submit it"]', 1, 'Submit documentation as soon as possible if missed.', 4) on conflict (module_id, question_text) do nothing;

    -- Family Communication
    insert into public.quiz_questions (module_id, question_text, choices, correct_index, explanation, sort_order) values
    (m_fam, 'When communicating with a client, you should:', '["Speak loudly and quickly","Use simple, respectful language and listen actively","Finish their sentences","Share personal problems to bond"]', 1, 'Respectful, clear communication and active listening are essential.', 1),
    (m_fam, 'Client information may be shared with a family member if they ask nicely.', '["True","False"]', 1, 'Client information is confidential and should only be shared through approved channels.', 2),
    (m_fam, 'Important communications should be documented in the visit update.', '["True","False"]', 0, 'Document relevant communications to maintain the care record.', 3),
    (m_fam, 'If a family member asks for medical advice, you should:', '["Give your best opinion","Refer them to the care team or appropriate professional","Search the internet","Ask the client"]', 1, 'Caregivers do not give medical advice.', 4) on conflict (module_id, question_text) do nothing;

    -- Elder Abuse Awareness
    insert into public.quiz_questions (module_id, question_text, choices, correct_index, explanation, sort_order) values
    (m_abuse, 'Signs of possible elder abuse include:', '["Unexplained injuries","Sudden fear of a caregiver","Missing money","All of the above"]', 3, 'All of these can be signs of abuse.', 1),
    (m_abuse, 'If you suspect abuse, you should confront the suspected abuser directly.', '["True","False"]', 1, 'Do not confront the abuser. Report to the agency and authorities.', 2),
    (m_abuse, 'You should call 911 if a client is in immediate danger.', '["True","False"]', 0, 'Immediate danger requires emergency services.', 3),
    (m_abuse, 'Documenting suspected abuse observations is important.', '["True","False"]', 0, 'Objective documentation helps investigators and protects the client.', 4) on conflict (module_id, question_text) do nothing;

    -- Confidentiality & Privacy (acknowledgement only, no quiz questions)

    -- Company Policies
    insert into public.quiz_questions (module_id, question_text, choices, correct_index, explanation, sort_order) values
    (m_policy, 'Which is part of the SeniorSitters dress code?', '["Open-toe sandals","Strong perfume","Closed-toe shoes","Casual gym clothes"]', 2, 'Closed-toe shoes are required for safety and professionalism.', 1),
    (m_policy, 'If you are running late for a visit, you should:', '["Arrive quietly and hope no one notices","Notify the agency and client as soon as possible","Skip the visit","Leave early to make up time"]', 1, 'Prompt communication about lateness is required.', 2),
    (m_policy, 'Caregivers must complete required training on time.', '["True","False"]', 0, 'Training compliance is a condition of active caregiver status.', 3),
    (m_policy, 'Professional conduct includes treating clients, families, and coworkers with respect.', '["True","False"]', 0, 'Respectful conduct is core to SeniorSitters policies.', 4) on conflict (module_id, question_text) do nothing;

end $$;

-- ── 12. Auto-create training assignments for existing caregivers ─────────────
-- Assign all required modules to caregivers who are onboarding or active but not yet assigned.
insert into public.caregiver_training_assignments (module_id, caregiver_id, status, assigned_at)
select m.id, c.id, 'not_started', now()
from public.training_modules m
 cross join public.caregivers c
 where m.is_active = true
   and m.is_required = true
   and c.status in ('onboarding','active')
   and not exists (
       select 1 from public.caregiver_training_assignments ta
        where ta.module_id = m.id and ta.caregiver_id = c.id
   )
 on conflict (caregiver_id, module_id) do nothing;

-- ── 13. Seed default document records for existing caregivers (placeholder) ────
-- No files are uploaded yet; status remains pending until the caregiver uploads.
insert into public.caregiver_documents (caregiver_id, document_type, status, file_url)
select c.id, t.doc_type, 'pending', 'pending-upload'
from public.caregivers c
 cross join (values
   ('drivers_license'),('auto_insurance'),('background_check'),('w9'),('direct_deposit'),('signed_policies')
 ) as t(doc_type)
where c.status in ('onboarding','active')
  and not exists (
      select 1 from public.caregiver_documents d
       where d.caregiver_id = c.id and d.document_type = t.doc_type
  )
 on conflict (caregiver_id, document_type) do nothing;
