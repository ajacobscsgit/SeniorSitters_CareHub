-- Fix missing status columns for payroll and training workflow
-- ================================================================

-- First, create training tables if they don't exist (needed before adding columns)
CREATE TABLE IF NOT EXISTS training_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('video', 'document', 'pdf', 'quiz', 'acknowledgement', 'photo')),
    category TEXT NOT NULL,
    resource_url TEXT,
    thumbnail_url TEXT,
    estimated_minutes INTEGER DEFAULT 0,
    passing_score INTEGER DEFAULT 80,
    required BOOLEAN DEFAULT true,
    active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS caregiver_training_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caregiver_id UUID NOT NULL REFERENCES caregivers(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'not_started',
    score INTEGER,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    due_date DATE,
    assigned_by UUID REFERENCES profiles(id),
    assigned_at TIMESTAMPTZ DEFAULT now(),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(caregiver_id, module_id)
);

CREATE TABLE IF NOT EXISTS onboarding_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    step_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    required BOOLEAN DEFAULT true,
    assign_training_id UUID REFERENCES training_modules(id),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS caregiver_onboarding_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caregiver_id UUID NOT NULL REFERENCES caregivers(id) ON DELETE CASCADE,
    step_id UUID NOT NULL REFERENCES onboarding_steps(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'not_started',
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES profiles(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(caregiver_id, step_id)
);

-- Create payroll tables if they don't exist
CREATE TABLE IF NOT EXISTS payroll_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pay_period_start DATE NOT NULL,
    pay_period_end DATE NOT NULL,
    export_type TEXT NOT NULL DEFAULT 'gusto' CHECK (export_type IN ('gusto', 'csv', 'quickbooks')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'preview', 'exported', 'processed')),
    total_hours DECIMAL(10,2) DEFAULT 0,
    total_mileage DECIMAL(10,2) DEFAULT 0,
    caregiver_count INTEGER DEFAULT 0,
    exported_by UUID REFERENCES profiles(id),
    exported_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT valid_pay_period CHECK (pay_period_start <= pay_period_end)
);

CREATE TABLE IF NOT EXISTS payroll_export_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_export_id UUID NOT NULL REFERENCES payroll_exports(id) ON DELETE CASCADE,
    caregiver_id UUID NOT NULL REFERENCES caregivers(id),
    regular_hours DECIMAL(8,2) DEFAULT 0,
    overtime_hours DECIMAL(8,2) DEFAULT 0,
    total_hours DECIMAL(8,2) DEFAULT 0,
    mileage DECIMAL(8,2) DEFAULT 0,
    mileage_rate DECIMAL(6,3) DEFAULT 0.655,
    mileage_reimbursement DECIMAL(10,2) DEFAULT 0,
    total_pay DECIMAL(10,2) DEFAULT 0,
    timesheet_ids UUID[],
    visit_count INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'included', 'excluded', 'exported')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS visit_clock_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    caregiver_id UUID NOT NULL REFERENCES caregivers(id),
    client_id UUID REFERENCES clients(id),
    event_type TEXT NOT NULL CHECK (event_type IN ('clock_in', 'clock_out', 'break_start', 'break_end')),
    event_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    location_accuracy DECIMAL(6, 2),
    device_info TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Fix schedules table - add lifecycle_status if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'schedules' 
                   AND column_name = 'lifecycle_status') THEN
        ALTER TABLE schedules ADD COLUMN lifecycle_status TEXT DEFAULT 'scheduled';
    END IF;
    
    -- Add check constraint if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage 
                   WHERE table_name = 'schedules' AND constraint_name = 'schedules_lifecycle_check') THEN
        ALTER TABLE schedules ADD CONSTRAINT schedules_lifecycle_check 
            CHECK (lifecycle_status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'missed', 'cancelled', 'payroll_locked'));
    END IF;
END $$;

-- Fix timesheets table - add/update status if not exists or wrong type
DO $$
BEGIN
    -- Check if status column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'timesheets' 
                   AND column_name = 'status') THEN
        ALTER TABLE timesheets ADD COLUMN status TEXT DEFAULT 'draft';
    ELSE
        -- Status exists, make sure it has the right default
        ALTER TABLE timesheets ALTER COLUMN status SET DEFAULT 'draft';
    END IF;
    
    -- Drop existing check constraint if any
    ALTER TABLE timesheets DROP CONSTRAINT IF EXISTS timesheets_status_check;
    
    -- Add new check constraint
    ALTER TABLE timesheets ADD CONSTRAINT timesheets_status_check 
        CHECK (status IN ('draft', 'submitted', 'pending', 'approved', 'rejected', 'correction_requested', 'payroll_exported'));
END $$;

-- Fix training_modules table - add status if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'training_modules' 
                   AND column_name = 'status') THEN
        ALTER TABLE training_modules ADD COLUMN status TEXT DEFAULT 'active';
    END IF;
END $$;

-- Fix caregiver_training_assignments table - add status if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'caregiver_training_assignments' 
                   AND column_name = 'status') THEN
        ALTER TABLE caregiver_training_assignments ADD COLUMN status TEXT DEFAULT 'not_started';
    END IF;
END $$;

-- Fix onboarding_steps table - add status if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'onboarding_steps' 
                   AND column_name = 'status') THEN
        ALTER TABLE onboarding_steps ADD COLUMN status TEXT DEFAULT 'active';
    END IF;
END $$;

-- Fix caregiver_onboarding_progress table - add status if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'caregiver_onboarding_progress' 
                   AND column_name = 'status') THEN
        ALTER TABLE caregiver_onboarding_progress ADD COLUMN status TEXT DEFAULT 'not_started';
    END IF;
END $$;

-- Fix client_caregiver_assignments table - ensure status has proper default
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'client_caregiver_assignments' 
               AND column_name = 'status') THEN
        ALTER TABLE client_caregiver_assignments ALTER COLUMN status SET DEFAULT 'active';
    END IF;
END $$;

-- Add missing columns to schedules if not present
DO $$
BEGIN
    -- actual_start_time
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'schedules' 
                   AND column_name = 'actual_start_time') THEN
        ALTER TABLE schedules ADD COLUMN actual_start_time TIMESTAMPTZ;
    END IF;
    
    -- actual_end_time
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'schedules' 
                   AND column_name = 'actual_end_time') THEN
        ALTER TABLE schedules ADD COLUMN actual_end_time TIMESTAMPTZ;
    END IF;
    
    -- actual_duration_minutes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'schedules' 
                   AND column_name = 'actual_duration_minutes') THEN
        ALTER TABLE schedules ADD COLUMN actual_duration_minutes INTEGER;
    END IF;
    
    -- mileage
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'schedules' 
                   AND column_name = 'mileage') THEN
        ALTER TABLE schedules ADD COLUMN mileage DECIMAL(6,2) DEFAULT 0;
    END IF;
    
    -- completion_notes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'schedules' 
                   AND column_name = 'completion_notes') THEN
        ALTER TABLE schedules ADD COLUMN completion_notes TEXT;
    END IF;
    
    -- gps_verified
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'schedules' 
                   AND column_name = 'gps_verified') THEN
        ALTER TABLE schedules ADD COLUMN gps_verified BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- signature_verified
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'schedules' 
                   AND column_name = 'signature_verified') THEN
        ALTER TABLE schedules ADD COLUMN signature_verified BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Add missing columns to timesheets if not present
DO $$
BEGIN
    -- approved_by
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'timesheets' 
                   AND column_name = 'approved_by') THEN
        ALTER TABLE timesheets ADD COLUMN approved_by UUID REFERENCES profiles(id);
    END IF;
    
    -- approved_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'timesheets' 
                   AND column_name = 'approved_at') THEN
        ALTER TABLE timesheets ADD COLUMN approved_at TIMESTAMPTZ;
    END IF;
    
    -- rejection_reason
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'timesheets' 
                   AND column_name = 'rejection_reason') THEN
        ALTER TABLE timesheets ADD COLUMN rejection_reason TEXT;
    END IF;
    
    -- correction_notes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'timesheets' 
                   AND column_name = 'correction_notes') THEN
        ALTER TABLE timesheets ADD COLUMN correction_notes TEXT;
    END IF;
    
    -- payroll_export_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'timesheets' 
                   AND column_name = 'payroll_export_id') THEN
        ALTER TABLE timesheets ADD COLUMN payroll_export_id UUID REFERENCES payroll_exports(id);
    END IF;
    
    -- regular_hours
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'timesheets' 
                   AND column_name = 'regular_hours') THEN
        ALTER TABLE timesheets ADD COLUMN regular_hours DECIMAL(6,2) DEFAULT 0;
    END IF;
    
    -- overtime_hours
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'timesheets' 
                   AND column_name = 'overtime_hours') THEN
        ALTER TABLE timesheets ADD COLUMN overtime_hours DECIMAL(6,2) DEFAULT 0;
    END IF;
END $$;

-- Update existing rows to have valid status values
UPDATE schedules 
SET lifecycle_status = 'scheduled' 
WHERE lifecycle_status IS NULL OR lifecycle_status = '';

UPDATE timesheets 
SET status = 'draft' 
WHERE status IS NULL OR status = '';

UPDATE training_modules 
SET status = 'active' 
WHERE status IS NULL OR status = '';

UPDATE caregiver_training_assignments 
SET status = 'not_started' 
WHERE status IS NULL OR status = '';

UPDATE onboarding_steps 
SET status = 'active' 
WHERE status IS NULL OR status = '';

UPDATE caregiver_onboarding_progress 
SET status = 'not_started' 
WHERE status IS NULL OR status = '';

-- Make status columns NOT NULL after setting defaults
ALTER TABLE schedules ALTER COLUMN lifecycle_status SET NOT NULL;
ALTER TABLE timesheets ALTER COLUMN status SET NOT NULL;
ALTER TABLE training_modules ALTER COLUMN status SET NOT NULL;
ALTER TABLE caregiver_training_assignments ALTER COLUMN status SET NOT NULL;
ALTER TABLE onboarding_steps ALTER COLUMN status SET NOT NULL;
ALTER TABLE caregiver_onboarding_progress ALTER COLUMN status SET NOT NULL;

COMMENT ON COLUMN schedules.lifecycle_status IS 'Visit lifecycle: scheduled, confirmed, in_progress, completed, missed, cancelled, payroll_locked';
COMMENT ON COLUMN timesheets.status IS 'Timesheet workflow: draft, submitted, pending, approved, rejected, correction_requested, payroll_exported';
