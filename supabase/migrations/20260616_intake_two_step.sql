-- ============================================================
-- CareHub: Two-Step Intake System Migration
-- Applications & Care Requests
-- Run date: 2026-06-16
-- ============================================================

-- ── 1. APPLICATIONS table ────────────────────────────────────
-- Create if it doesn't exist
CREATE TABLE IF NOT EXISTS applications (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name             TEXT NOT NULL,
    phone                 TEXT,
    email                 TEXT,
    city                  TEXT,
    availability          TEXT,
    transportation        TEXT,
    willing_outings       TEXT,
    experience            TEXT,
    why_work_with_seniors TEXT,
    resume_url            TEXT,
    status                TEXT NOT NULL DEFAULT 'new',
    admin_notes           TEXT,
    denial_reason         TEXT,
    interview_datetime    TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add any missing columns (idempotent)
ALTER TABLE applications ADD COLUMN IF NOT EXISTS admin_notes        TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS denial_reason      TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS interview_datetime TIMESTAMPTZ;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ NOT NULL DEFAULT now();

-- Drop old status constraint if it exists, re-add with new values
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE applications
    ADD CONSTRAINT applications_status_check
    CHECK (status IN ('new', 'reviewing', 'interview', 'approved', 'denied', 'pending'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_applications_email  ON applications (email);
CREATE INDEX IF NOT EXISTS idx_applications_phone  ON applications (phone);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications (status);

-- RLS: allow anon inserts (public form), admins read/update all
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert a new application (public careers form)
DROP POLICY IF EXISTS "Public can submit applications"      ON applications;
CREATE POLICY "Public can submit applications"
    ON applications FOR INSERT
    WITH CHECK (true);

-- Allow public to read for duplicate-check query (select by email/phone only)
DROP POLICY IF EXISTS "Public can read for duplicate check" ON applications;
CREATE POLICY "Public can read for duplicate check"
    ON applications FOR SELECT
    USING (true);

-- Admins (authenticated) can update applications
DROP POLICY IF EXISTS "Admins can update applications"      ON applications;
CREATE POLICY "Admins can update applications"
    ON applications FOR UPDATE
    USING (auth.role() = 'authenticated');


-- ── 2. CARE_REQUESTS table ───────────────────────────────────
CREATE TABLE IF NOT EXISTS care_requests (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_name        TEXT NOT NULL,
    phone                 TEXT,
    email                 TEXT,
    best_time_to_contact  TEXT,
    care_for              TEXT,
    location              TEXT,
    level_of_care         TEXT,
    start_timeframe       TEXT,
    lives_alone           BOOLEAN,
    pets_in_home          BOOLEAN,
    mobility_notes        TEXT,
    preferred_days        TEXT[],
    preferred_time        TEXT,
    support_types         TEXT[],
    main_concern          TEXT,
    notes                 TEXT,
    status                TEXT NOT NULL DEFAULT 'new',
    admin_notes           TEXT,
    denial_reason         TEXT,
    converted_client_id   UUID REFERENCES clients(id) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add any missing columns (idempotent)
ALTER TABLE care_requests ADD COLUMN IF NOT EXISTS best_time_to_contact TEXT;
ALTER TABLE care_requests ADD COLUMN IF NOT EXISTS start_timeframe       TEXT;
ALTER TABLE care_requests ADD COLUMN IF NOT EXISTS lives_alone           BOOLEAN;
ALTER TABLE care_requests ADD COLUMN IF NOT EXISTS pets_in_home          BOOLEAN;
ALTER TABLE care_requests ADD COLUMN IF NOT EXISTS mobility_notes        TEXT;
ALTER TABLE care_requests ADD COLUMN IF NOT EXISTS preferred_days        TEXT[];
ALTER TABLE care_requests ADD COLUMN IF NOT EXISTS preferred_time        TEXT;
ALTER TABLE care_requests ADD COLUMN IF NOT EXISTS support_types         TEXT[];
ALTER TABLE care_requests ADD COLUMN IF NOT EXISTS admin_notes           TEXT;
ALTER TABLE care_requests ADD COLUMN IF NOT EXISTS denial_reason         TEXT;
ALTER TABLE care_requests ADD COLUMN IF NOT EXISTS converted_client_id   UUID REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE care_requests ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMPTZ NOT NULL DEFAULT now();

-- Drop old status constraint if it exists, re-add with all supported values
ALTER TABLE care_requests DROP CONSTRAINT IF EXISTS care_requests_status_check;
ALTER TABLE care_requests
    ADD CONSTRAINT care_requests_status_check
    CHECK (status IN (
        'new', 'contacted', 'scheduled', 'converted', 'declined',
        -- legacy statuses kept for backward compatibility
        'reviewing', 'onboarding', 'approved', 'denied', 'converted_to_client'
    ));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_care_requests_email  ON care_requests (email);
CREATE INDEX IF NOT EXISTS idx_care_requests_phone  ON care_requests (phone);
CREATE INDEX IF NOT EXISTS idx_care_requests_status ON care_requests (status);

-- RLS: allow anon inserts (public form), admins read/update all
ALTER TABLE care_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can submit care requests"          ON care_requests;
CREATE POLICY "Public can submit care requests"
    ON care_requests FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Public can read for duplicate check"      ON care_requests;
CREATE POLICY "Public can read for duplicate check"
    ON care_requests FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins can update care requests"          ON care_requests;
CREATE POLICY "Admins can update care requests"
    ON care_requests FOR UPDATE
    USING (auth.role() = 'authenticated');


-- ── 3. CAREGIVERS table: add application_id FK if missing ────
ALTER TABLE caregivers ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES applications(id) ON DELETE SET NULL;
ALTER TABLE caregivers ADD COLUMN IF NOT EXISTS city           TEXT;
ALTER TABLE caregivers ADD COLUMN IF NOT EXISTS availability   TEXT;
ALTER TABLE caregivers ADD COLUMN IF NOT EXISTS transportation TEXT;
ALTER TABLE caregivers ADD COLUMN IF NOT EXISTS willing_outings TEXT;
ALTER TABLE caregivers ADD COLUMN IF NOT EXISTS experience     TEXT;
ALTER TABLE caregivers ADD COLUMN IF NOT EXISTS why_work_with_seniors TEXT;

-- ── 4. CLIENTS table: add care_request_id FK if missing ──────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS care_request_id UUID REFERENCES care_requests(id) ON DELETE SET NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS requester_name   TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS mobility_notes   TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS lives_alone      BOOLEAN;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pets_in_home     BOOLEAN;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS main_concern     TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS level_of_care    TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS start_timeframe  TEXT;

-- ── Done ──────────────────────────────────────────────────────
