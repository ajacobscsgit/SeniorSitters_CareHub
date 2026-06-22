-- ============================================================================
-- Migration: Phase 3 — Caregiver Onboarding Restructure
-- Renames conceptually restructures the Training Hub into a clean onboarding
-- and compliance system with role-based views, electronic signatures, and a
-- clear activation workflow.
-- ============================================================================
-- Run in Supabase Dashboard → SQL Editor

-- ── 0. Extend caregiver activation_status enum and training content types ─
-- New statuses per Phase 3 spec.
alter table public.caregivers
    drop constraint if exists caregivers_activation_status_check;

alter table public.caregivers
    add constraint caregivers_activation_status_check
        check (activation_status in (
            'application_approved',
            'training_required',
            'training_in_progress',
            'documents_required',
            'documents_pending_review',
            'background_pending',
            'ready_for_final_review',
            'active',
            'rejected',
            'inactive'
        ));

-- Ensure 'acknowledgement' content type is allowed (drop/recreate idempotently)
alter table public.training_modules
    drop constraint if exists training_modules_content_type_check;

alter table public.training_modules
    add constraint training_modules_content_type_check
        check (content_type in ('document','video','link','quiz','photo_guide','mixed','acknowledgement'));

-- Map old terminal statuses to new canonical ones
update public.caregivers
    set activation_status = 'inactive'
    where activation_status not in (
        'application_approved','training_required','training_in_progress',
        'documents_required','documents_pending_review','background_pending',
        'ready_for_final_review','active','rejected','inactive'
    );

-- ── 1. Form / policy templates for electronic signatures ───────────────────
create table if not exists public.caregiver_form_templates (
    id                uuid primary key default gen_random_uuid(),
    title             text not null,
    slug              text not null unique,
    category          text not null default 'policy',
    content           text not null,              -- full text shown to caregiver
    version           text not null default '1.0',
    is_required       boolean not null default true,
    is_active         boolean not null default true,
    sort_order        int not null default 0,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

comment on table public.caregiver_form_templates is
    'Master policy and form templates that caregivers must acknowledge/sign.';

-- Trigger for updated_at
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language 'plpgsql';

drop trigger if exists update_caregiver_form_templates_updated_at on public.caregiver_form_templates;
create trigger update_caregiver_form_templates_updated_at
    before update on public.caregiver_form_templates
    for each row execute function public.update_updated_at_column();

-- ── 2. Caregiver electronic acknowledgements / signatures ───────────────────
create table if not exists public.caregiver_form_acknowledgements (
    id                    uuid primary key default gen_random_uuid(),
    caregiver_id          uuid not null references public.caregivers(id) on delete cascade,
    form_template_id      uuid not null references public.caregiver_form_templates(id) on delete cascade,
    full_name_typed       text not null,
    acknowledged_at       timestamptz not null default now(),
    document_version        text not null,              -- snapshot of version signed
    form_content_snapshot   text not null,              -- snapshot of content at signing
    ip_address            text,
    user_agent            text,
    created_at            timestamptz not null default now(),
    unique (caregiver_id, form_template_id)
);

comment on table public.caregiver_form_acknowledgements is
    'Electronic signature records for caregiver policy and form acknowledgements.';

-- ── 3. Admin activation reviews / final approval decisions ─────────────────
create table if not exists public.caregiver_activation_reviews (
    id                uuid primary key default gen_random_uuid(),
    caregiver_id      uuid not null references public.caregivers(id) on delete cascade,
    reviewed_by       uuid references auth.users(id) on delete set null,
    reviewed_at       timestamptz not null default now(),
    decision          text not null check (decision in ('approved','rejected','flagged','unflagged','override')),
    notes             text,
    override_reason   text,
    created_at        timestamptz not null default now()
);

comment on table public.caregiver_activation_reviews is
    'History of admin activation decisions, flags, overrides, and final approvals.';

-- Indexes
create index if not exists idx_form_templates_active on public.caregiver_form_templates (is_active, sort_order);
create index if not exists idx_form_ack_caregiver on public.caregiver_form_acknowledgements (caregiver_id);
create index if not exists idx_form_ack_template on public.caregiver_form_acknowledgements (form_template_id);
create index if not exists idx_activation_reviews_caregiver on public.caregiver_activation_reviews (caregiver_id, reviewed_at desc);

-- ── 4. Extend caregiver document types to match Phase 3 spec ───────────────
alter table public.caregiver_documents
    drop constraint if exists caregiver_documents_document_type_check;

alter table public.caregiver_documents
    add constraint caregiver_documents_document_type_check
        check (document_type in (
            'drivers_license',
            'auto_insurance',
            'vehicle_registration',
            'w9',
            'direct_deposit',
            'background_check_authorization',
            'cpr_first_aid_certificate',
            'signed_policies'
        ));

-- ── 5. New function: create onboarding placeholders for a caregiver ────────
-- Called after application approval. Creates required document placeholders,
-- training assignments, and form signature placeholders.
create or replace function public.create_onboarding_placeholders(
    p_caregiver_id uuid,
    p_due_days int default 7,
    p_assigned_by uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_module record;
    v_due_date timestamptz;
    v_doc_type text;
    v_template record;
    v_count int;
begin
    -- Validate caregiver exists
    if not exists (select 1 from public.caregivers where id = p_caregiver_id) then
        return false;
    end if;

    v_due_date := now() + (p_due_days || ' days')::interval;

    -- 1. Assign required active training modules
    for v_module in
        select id
        from public.training_modules
        where is_active = true and is_required = true
    loop
        insert into public.caregiver_training_assignments (
            caregiver_id, module_id, assigned_by, assigned_at, due_date, status
        )
        values (p_caregiver_id, v_module.id, p_assigned_by, now(), v_due_date, 'not_started')
        on conflict (caregiver_id, module_id) do nothing;
    end loop;

    -- 2. Create required document placeholders
    for v_doc_type in
        values ('drivers_license'),('auto_insurance'),('w9'),('direct_deposit'),('background_check_authorization')
    loop
        insert into public.caregiver_documents (
            caregiver_id, document_type, file_url, status
        )
        values (p_caregiver_id, v_doc_type, 'pending-upload', 'pending')
        on conflict (caregiver_id, document_type) do nothing;
    end loop;

    -- 3. Create required form acknowledgement placeholders
    for v_template in
        select id
        from public.caregiver_form_templates
        where is_active = true and is_required = true
    loop
        insert into public.caregiver_form_acknowledgements (
            caregiver_id, form_template_id, full_name_typed, document_version, form_content_snapshot
        )
        values (
            p_caregiver_id, v_template.id, 'PENDING',
            (select version from public.caregiver_form_templates where id = v_template.id),
            (select content from public.caregiver_form_templates where id = v_template.id)
        )
        on conflict (caregiver_id, form_template_id) do nothing;
    end loop;

    -- 4. Set initial activation status
    update public.caregivers
        set activation_status = 'training_required',
            status = 'onboarding',
            updated_at = now()
        where id = p_caregiver_id
          and activation_status not in ('active','rejected','inactive');

    return true;
end;
$$;

-- ── 6. Refresh activation function (Phase 3) ─────────────────────────────────
-- Updated to support the new activation status enum and finer-grained states.
create or replace function public.refresh_caregiver_activation(p_caregiver_id uuid)
returns public.caregivers.activation_status%type
language plpgsql
security definer
set search_path = public
as $$
declare
    v_status             public.caregivers.activation_status%type;
    v_bg_status          text;
    v_required_training  int;
    v_completed_training int;
    v_required_docs      int;
    v_approved_docs      int;
    v_required_forms     int;
    v_signed_forms       int;
    v_flagged            boolean;
    v_latest_review      public.caregiver_activation_reviews.decision%type;
begin
    select activation_status, background_check_status
      into v_status, v_bg_status
      from public.caregivers
     where id = p_caregiver_id;

    if not found then return 'application_approved'; end if;

    -- Terminal admin-set states
    if v_status in ('rejected','inactive') then return v_status; end if;

    -- Any active flag decision?
    select decision into v_latest_review
      from public.caregiver_activation_reviews
     where caregiver_id = p_caregiver_id
     order by reviewed_at desc
     limit 1;

    -- If most recent decision is flagged, lock there until unflagged
    if v_latest_review = 'flagged' then
        update public.caregivers
           set activation_status = 'inactive',
               status = 'onboarding',
               updated_at = now()
         where id = p_caregiver_id;
        return 'inactive';   -- flagged caregivers are not active
    end if;

    -- Background check failed is a hard block
    if v_bg_status = 'failed' then
        insert into public.caregiver_activation_reviews (caregiver_id, decision, notes)
        values (p_caregiver_id, 'flagged', 'Background check failed; auto-flagged.');
        update public.caregivers
           set activation_status = 'inactive',
               status = 'onboarding',
               updated_at = now()
         where id = p_caregiver_id;
        return 'inactive';
    end if;

    -- Required training
    select count(*) into v_required_training
      from public.training_modules
     where is_active = true and is_required = true;

    select count(distinct ta.module_id) into v_completed_training
      from public.caregiver_training_assignments ta
     where ta.caregiver_id = p_caregiver_id
       and ta.status = 'completed'
       and ta.module_id in (
           select id from public.training_modules where is_active = true and is_required = true
       );

    if v_required_training > 0 and v_completed_training < v_required_training then
        select count(*) into v_completed_training
          from public.caregiver_training_assignments
         where caregiver_id = p_caregiver_id
           and status in ('in_progress','completed')
           and module_id in (select id from public.training_modules where is_active = true and is_required = true);

        update public.caregivers
           set activation_status = case
                   when v_completed_training > 0 then 'training_in_progress'
                   else 'training_required'
               end,
               status = 'onboarding',
               updated_at = now()
         where id = p_caregiver_id;
        return (select activation_status from public.caregivers where id = p_caregiver_id);
    end if;

    -- Required uploaded documents
    select count(*) into v_required_docs
      from public.caregiver_documents
     where caregiver_id = p_caregiver_id
       and document_type in ('drivers_license','auto_insurance','w9','direct_deposit','background_check_authorization')
       and status = 'approved';

    if v_required_docs < 5 then
        update public.caregivers
           set activation_status = 'documents_required',
               status = 'onboarding',
               updated_at = now()
         where id = p_caregiver_id;
        return 'documents_required';
    end if;

    -- Any pending documents still under review?
    select exists (
        select 1 from public.caregiver_documents
         where caregiver_id = p_caregiver_id
           and status in ('pending','rejected')
           and document_type in ('drivers_license','auto_insurance','w9','direct_deposit','background_check_authorization')
    ) into v_flagged;

    if v_flagged then
        update public.caregivers
           set activation_status = 'documents_pending_review',
               status = 'onboarding',
               updated_at = now()
         where id = p_caregiver_id;
        return 'documents_pending_review';
    end if;

    -- Required forms signed
    select count(*) into v_required_forms
      from public.caregiver_form_templates
     where is_active = true and is_required = true;

    select count(*) into v_signed_forms
      from public.caregiver_form_acknowledgements fa
      join public.caregiver_form_templates ft on ft.id = fa.form_template_id
     where fa.caregiver_id = p_caregiver_id
       and ft.is_active = true
       and ft.is_required = true
       and fa.full_name_typed <> 'PENDING';

    if v_required_forms > 0 and v_signed_forms < v_required_forms then
        update public.caregivers
           set activation_status = 'documents_required',
               status = 'onboarding',
               updated_at = now()
         where id = p_caregiver_id;
        return 'documents_required';
    end if;

    -- Background check cleared
    if v_bg_status not in ('cleared','waived') then
        update public.caregivers
           set activation_status = 'background_pending',
               status = 'onboarding',
               updated_at = now()
         where id = p_caregiver_id;
        return 'background_pending';
    end if;

    -- All requirements met, waiting for admin final review
    update public.caregivers
       set activation_status = 'ready_for_final_review',
           status = 'onboarding',
           updated_at = now()
     where id = p_caregiver_id;
    return 'ready_for_final_review';

    -- Admin must explicitly set activation_status = 'active' via review
end;
$$;

-- ── 7. Triggers to refresh activation on form acknowledgement ──────────────
create or replace function public.trg_refresh_activation_on_forms()
returns trigger as $$
begin
    perform public.refresh_caregiver_activation(new.caregiver_id);
    return new;
end;
$$ language plpgsql;

drop trigger if exists refresh_activation_forms on public.caregiver_form_acknowledgements;
create trigger refresh_activation_forms
    after insert or update on public.caregiver_form_acknowledgements
    for each row execute function public.trg_refresh_activation_on_forms();

-- ── 8. Seed default SeniorSitters training modules (Phase 3) ─────────────────
-- These replace/supplement the existing defaults. Run idempotently.
insert into public.training_modules (
    title, description, category, content_type, content_body,
    is_required, requires_acknowledgement, duration_minutes, is_active, passing_score
)
select title, description, category, content_type, content_body,
       is_required, requires_acknowledgement, duration_minutes, is_active, passing_score
from (values
('Welcome to SeniorSitters', 'Introduction to SeniorSitters mission, values, and what we do.', 'onboarding', 'document', 'Welcome to SeniorSitters.

We are a family-owned non-medical companion care company serving seniors and families throughout Northeast Ohio. Our mission is to help older adults remain connected, independent, active, and supported while giving families peace of mind.

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
- Respite support

What We Do NOT Do:
- No medical care
- No medication administration
- No injections
- No wound care
- No diagnosis
- No nursing services
- No emergency medical services
- No heavy lifting outside company policy
- No accepting money, loans, or personal gifts from clients', true, true, 15, true, 80),

('Non-Medical Companion Care Overview', 'Scope of non-medical care, what caregivers can and cannot do.', 'onboarding', 'document', 'SeniorSitters provides non-medical companion care only.

You may provide:
- Companionship and supervision
- Conversation and engagement
- Light meal preparation and reminders
- Assistance with errands and shopping
- Transportation to appointments and outings
- Light household tasks
- Family communication and updates

You may NOT provide:
- Medical or nursing care
- Medication administration
- Wound care or injections
- Medical advice or diagnosis
- Physical therapy or rehabilitation

Always stay within your scope. When in doubt, call your supervisor.', true, true, 15, true, 80),

('Professional Boundaries', 'Maintaining professional relationships with clients and families.', 'compliance', 'document', 'Professional Boundaries

- Treat clients and families with respect and dignity
- Do not share personal contact information or social media
- Do not accept gifts, money, loans, or tips
- Do not form personal or financial relationships outside of work
- Do not provide medical, legal, or financial advice
- Keep all client information confidential
- Report boundary concerns to your supervisor immediately', true, true, 10, true, 80),

('Senior Safety', 'General safety practices when caring for seniors.', 'safety', 'document', 'Senior Safety

- Keep walkways clear and well-lit
- Assist with standing and walking as appropriate
- Encourage hydration and nutrition
- Watch for signs of confusion or distress
- Report unsafe home conditions
- Never leave a client unattended in an unsafe situation
- Follow the care plan and client preferences', true, true, 15, true, 80),

('Fall Prevention', 'How to reduce fall risk and respond if a fall occurs.', 'safety', 'document', 'Fall Prevention

- Remove tripping hazards (rugs, cords, clutter)
- Ensure good lighting
- Use non-slip footwear
- Encourage slow, deliberate movements
- Assist with transfers as instructed
- If a fall occurs: call 911 if injured, do not move the client unless necessary, notify SeniorSitters, document in a Visit Update', true, true, 15, true, 80),

('Emergency Response', 'How to respond to emergencies during visits.', 'safety', 'document', 'Emergency Response

1. Call 911 first for any life-threatening emergency
2. Stay calm and stay with the client
3. Notify SeniorSitters management immediately after 911
4. Document the incident in a Visit Update
5. Complete an incident report within 24 hours

Report: falls, injuries, sudden health changes, unsafe conditions, suspected abuse/neglect, missed visits, or any safety concern.', true, true, 15, true, 80),

('Transportation & Outings', 'Policies for driving clients and community outings.', 'policy', 'document', 'Transportation & Outings

- Only approved caregivers may transport clients
- Maintain valid driver license and auto insurance
- Follow all traffic laws and drive safely
- Use client seatbelt and assist as needed
- Keep outings within approved scope
- Report any vehicle issues immediately
- Do not transport clients in unsafe vehicles
- Mileage may be reimbursed per company policy', true, true, 15, true, 80),

('Documentation & CareHub Usage', 'How to use CareHub for schedules, timesheets, visit updates, and mileage.', 'policy', 'document', 'Documentation & CareHub Usage

- Check your schedule daily
- Review client notes before every visit
- Submit visit updates after each visit
- Submit timesheets promptly
- Log approved mileage accurately
- Keep your profile and availability up to date
- Communicate schedule issues early

Accurate documentation helps us provide the best care and ensures you are paid correctly.', true, true, 15, true, 80),

('Family Communication', 'How to communicate professionally with families.', 'soft_skills', 'document', 'Family Communication

- Be respectful, clear, and concise
- Provide updates through CareHub visit notes
- Do not share personal contact information
- Listen to family concerns and report them to your supervisor
- Maintain confidentiality at all times
- Use professional language in all communications', true, true, 10, true, 80),

('Elder Abuse Awareness', 'Recognizing and reporting suspected abuse, neglect, or exploitation.', 'compliance', 'document', 'Elder Abuse Awareness

Types of abuse:
- Physical, emotional, sexual, financial
- Neglect (including self-neglect)
- Abandonment

Signs to watch for:
- Unexplained injuries
- Fear or withdrawal
- Poor hygiene or unsafe conditions
- Missing money or belongings
- Rapid changes in health or weight

If you suspect abuse or neglect:
1. Ensure immediate safety
2. Call 911 if the person is in danger
3. Report to SeniorSitters management
4. Report to Adult Protective Services as required by law

You are a mandated reporter.', true, true, 15, true, 80),

('Confidentiality & Privacy', 'Protecting client information and privacy expectations.', 'compliance', 'acknowledgement', 'All client information is private and confidential.

You must NOT:
- Share client names, addresses, or phone numbers
- Discuss client health, finances, or personal matters
- Post photos or information about clients online
- Record clients without consent
- Accept private payments or gifts
- Give personal medical, legal, or financial advice

Violations may result in immediate termination and legal action.

By acknowledging, you agree to protect all client and company confidential information.', true, true, 10, true, 80),

('Company Policies', 'Overview of SeniorSitters policies including attendance, dress code, communication, and social media.', 'policy', 'document', 'Company Policies

Attendance & Call-Off:
- Arrive on time for every scheduled visit
- If you cannot work a shift, notify your supervisor as early as possible
- Follow the call-off procedure in your handbook

Dress Code:
- Wear clean, professional, modest clothing
- Wear comfortable, non-slip shoes
- Avoid strong fragrances

Communication:
- Respond to messages and calls promptly
- Use professional language
- Report concerns immediately

Social Media:
- Never post about clients, families, or work situations
- Do not identify yourself as a SeniorSitters caregiver in ways that reveal client information
- Violations are grounds for termination', true, true, 20, true, 80)
) as v(title, description, category, content_type, content_body, is_required, requires_acknowledgement, duration_minutes, is_active, passing_score)
where not exists (
    select 1 from public.training_modules t where t.title = v.title
);

-- ── 9. Seed default form / policy templates ────────────────────────────────
insert into public.caregiver_form_templates (title, slug, category, content, version, is_required, sort_order)
values
('Caregiver Agreement', 'caregiver_agreement', 'agreement',
'CAREGIVER AGREEMENT

I agree to provide non-medical companion care services in accordance with SeniorSitters policies and procedures.

I understand that:
1. I am an independent contractor responsible for my own taxes and insurance.
2. I must maintain a valid driver license and auto insurance if transporting clients.
3. I will treat all clients, families, and staff with dignity and respect.
4. I will maintain confidentiality and protect client privacy.
5. I will report emergencies, incidents, and concerns immediately.
6. I will not provide medical care, administer medications, or give medical advice.
7. I will follow all company policies, including attendance, dress code, and social media policies.
8. I understand that violation of these terms may result in termination of my relationship with SeniorSitters.',
'1.0', true, 1),

('Confidentiality Agreement', 'confidentiality_agreement', 'compliance',
'CONFIDENTIALITY AGREEMENT

I understand that in the course of providing services to SeniorSitters and its clients, I may have access to confidential, private, and personal information.

I agree to:
- Keep all client, family, and company information confidential
- Not disclose any information to unauthorized persons
- Not use confidential information for personal benefit
- Not post or discuss client information on social media or in public
- Return or destroy confidential information if requested
- Maintain confidentiality even after my relationship with SeniorSitters ends

I understand that breach of confidentiality may result in termination and legal action.',
'1.0', true, 2),

('Handbook Acknowledgement', 'handbook_acknowledgement', 'policy',
'EMPLOYEE HANDBOOK ACKNOWLEDGEMENT

I acknowledge that I have received, read, and understood the SeniorSitters Caregiver Handbook.

I understand the handbook contains important information about:
- Company policies and procedures
- Job responsibilities and expectations
- Attendance and call-off procedures
- Dress code and professional standards
- Safety and emergency procedures
- Confidentiality and privacy
- Documentation requirements

I agree to comply with all policies and procedures described in the handbook. I understand the handbook may be updated from time to time and that I am responsible for reviewing updates.',
'1.0', true, 3),

('Transportation Policy', 'transportation_policy', 'policy',
'TRANSPORTATION POLICY

I understand that transportation of clients is only permitted with prior approval and when all required documentation is on file.

I agree to:
- Maintain a valid driver license and current auto insurance
- Keep my vehicle in safe operating condition
- Follow all traffic laws and drive safely
- Ensure clients wear seatbelts
- Only transport clients to approved destinations
- Report any accidents or vehicle issues immediately
- Understand that SeniorSitters is not responsible for my vehicle or personal insurance coverage

I will not transport clients if I am not approved, if my documentation is expired, or if I feel unsafe.',
'1.0', true, 4),

('Attendance & Call-Off Policy', 'attendance_call_off_policy', 'policy',
'ATTENDANCE & CALL-OFF POLICY

I understand that reliable attendance is essential to client care and family trust.

I agree to:
- Arrive on time for every scheduled visit
- Be prepared and ready to work at the scheduled start time
- Notify my supervisor as soon as possible if I cannot work a scheduled visit
- Provide adequate notice for planned time off
- Follow the call-off procedure documented in the handbook

I understand that repeated tardiness, no-shows, or failure to follow call-off procedures may result in removal from the schedule and termination of my relationship with SeniorSitters.',
'1.0', true, 5),

('Social Media/Photo Policy', 'social_media_photo_policy', 'policy',
'SOCIAL MEDIA & PHOTO POLICY

I agree to the following:

- I will not post photos, videos, or information about clients, families, or work situations on social media or any public platform.
- I will not identify clients or discuss specific work incidents online.
- I will not record clients without explicit written consent.
- I will not use SeniorSitters logos or branding in a way that suggests client endorsement.
- I understand that violation of this policy is grounds for immediate termination and may result in legal action.',
'1.0', true, 6),

('Non-Medical Care Scope Acknowledgement', 'non_medical_scope_acknowledgement', 'compliance',
'NON-MEDICAL CARE SCOPE ACKNOWLEDGEMENT

I acknowledge that SeniorSitters provides non-medical companion care only.

I agree that I will NOT:
- Administer medications, injections, or treatments
- Provide wound care or medical procedures
- Make medical diagnoses or give medical advice
- Provide physical therapy or nursing services
- Transport clients in emergency medical situations

I agree that I WILL:
- Stay within the scope of non-medical companion care
- Call 911 in emergencies
- Report health concerns to my supervisor
- Follow the care plan and client preferences

I understand that working outside my scope may put clients at risk and is grounds for termination.',
'1.0', true, 7),

('Mileage Policy', 'mileage_policy', 'policy',
'MILEAGE REIMBURSEMENT POLICY

I understand that mileage may be reimbursed for approved client-related travel.

I agree to:
- Log mileage accurately in CareHub
- Only submit mileage for approved trips
- Keep mileage records truthful and complete
- Submit mileage within the required timeframe
- Understand that reimbursement is subject to company approval and policy limits

I understand that falsifying mileage records is a serious violation and may result in termination.',
'1.0', true, 8)

on conflict (slug) do update set
    title = excluded.title,
    category = excluded.category,
    content = excluded.content,
    version = excluded.version,
    is_required = excluded.is_required,
    sort_order = excluded.sort_order,
    updated_at = now();

-- ── 10. Update RLS policies for new tables ───────────────────────────────────
alter table public.caregiver_form_templates     enable row level security;
alter table public.caregiver_form_acknowledgements enable row level security;
alter table public.caregiver_activation_reviews enable row level security;

-- Form templates: all authenticated can view active; admins manage

drop policy if exists "form_templates: admin manage" on public.caregiver_form_templates;
drop policy if exists "form_templates: all read active" on public.caregiver_form_templates;

create policy "form_templates: admin manage"
    on public.caregiver_form_templates for all
    using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin_owner','co_owner')));

create policy "form_templates: all read active"
    on public.caregiver_form_templates for select
    using (is_active = true);

-- Form acknowledgements: caregivers own; admins manage

drop policy if exists "form_acknowledgements: admin manage" on public.caregiver_form_acknowledgements;
drop policy if exists "form_acknowledgements: caregiver own" on public.caregiver_form_acknowledgements;

create policy "form_acknowledgements: admin manage"
    on public.caregiver_form_acknowledgements for all
    using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin_owner','co_owner')));

create policy "form_acknowledgements: caregiver own"
    on public.caregiver_form_acknowledgements for all
    using (
        exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.role = 'caregiver'
              and p.caregiver_id = caregiver_form_acknowledgements.caregiver_id
        )
    );

-- Activation reviews: admins manage

drop policy if exists "activation_reviews: admin manage" on public.caregiver_activation_reviews;

create policy "activation_reviews: admin manage"
    on public.caregiver_activation_reviews for all
    using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin_owner','co_owner')));

-- Make sure caregiver_documents update trigger still calls refresh

drop trigger if exists refresh_activation_documents on public.caregiver_documents;
create trigger refresh_activation_documents
    after insert or update on public.caregiver_documents
    for each row execute function public.trg_refresh_activation_on_documents();

-- Refresh all existing caregivers through the new logic

do $$
declare
    r record;
begin
    for r in select id from public.caregivers where activation_status not in ('active','rejected','inactive')
    loop
        perform public.refresh_caregiver_activation(r.id);
    end loop;
end;
$$;
