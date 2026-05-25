-- SeniorSitters CareHub - Payroll Workflow & Visit Completion System
-- ================================================================
-- This migration creates the payroll export infrastructure and visit lifecycle tracking

-- Table: payroll_exports
-- Master payroll export records for pay periods
CREATE TABLE IF NOT EXISTS payroll_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pay_period_start DATE NOT NULL,
    pay_period_end DATE NOT NULL,
    export_type TEXT NOT NULL DEFAULT 'gusto' CHECK (export_type IN ('gusto', 'csv', 'quickbooks')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'preview', 'exported', 'processed')),
    total_hours DECIMAL(10,2) DEFAULT 0,
    total_mileage DECIMAL(10,2) DEFAULT 0,
    total_regular_pay DECIMAL(10,2) DEFAULT 0,
    total_overtime_pay DECIMAL(10,2) DEFAULT 0,
    total_mileage_reimbursement DECIMAL(10,2) DEFAULT 0,
    grand_total DECIMAL(10,2) DEFAULT 0,
    caregiver_count INTEGER DEFAULT 0,
    exported_by UUID REFERENCES profiles(id),
    exported_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    -- Ensure start <= end
    CONSTRAINT valid_pay_period CHECK (pay_period_start <= pay_period_end)
);

COMMENT ON TABLE payroll_exports IS 'Payroll export master records for pay periods. Contains summary data and export status.';

-- Table: payroll_export_items
-- Individual caregiver line items for each payroll export
CREATE TABLE IF NOT EXISTS payroll_export_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_export_id UUID NOT NULL REFERENCES payroll_exports(id) ON DELETE CASCADE,
    caregiver_id UUID NOT NULL REFERENCES caregivers(id),
    regular_hours DECIMAL(8,2) DEFAULT 0,
    overtime_hours DECIMAL(8,2) DEFAULT 0,
    total_hours DECIMAL(8,2) DEFAULT 0,
    hourly_rate DECIMAL(8,2),
    regular_pay DECIMAL(10,2) DEFAULT 0,
    overtime_pay DECIMAL(10,2) DEFAULT 0,
    mileage DECIMAL(8,2) DEFAULT 0,
    mileage_rate DECIMAL(6,3) DEFAULT 0.655, -- IRS standard
    mileage_reimbursement DECIMAL(10,2) DEFAULT 0,
    total_pay DECIMAL(10,2) DEFAULT 0,
    timesheet_ids UUID[], -- Array of included timesheet IDs
    visit_count INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'included', 'excluded', 'exported')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE payroll_export_items IS 'Individual caregiver line items for payroll exports. One row per caregiver per pay period.';

-- Table: visit_clock_events (for clock in/out tracking)
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

COMMENT ON TABLE visit_clock_events IS 'Tracks caregiver clock in/out events with optional GPS verification.';

-- Enhance schedules table with lifecycle statuses
DO $$
BEGIN
    -- Add status column if not exists (may already exist)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'schedules' 
                   AND column_name = 'lifecycle_status') THEN
        ALTER TABLE schedules ADD COLUMN lifecycle_status TEXT DEFAULT 'scheduled' 
            CHECK (lifecycle_status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'missed', 'cancelled', 'payroll_locked'));
    END IF;

    -- Add actual start/end times for clock tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'schedules' 
                   AND column_name = 'actual_start_time') THEN
        ALTER TABLE schedules ADD COLUMN actual_start_time TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'schedules' 
                   AND column_name = 'actual_end_time') THEN
        ALTER TABLE schedules ADD COLUMN actual_end_time TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'schedules' 
                   AND column_name = 'actual_duration_minutes') THEN
        ALTER TABLE schedules ADD COLUMN actual_duration_minutes INTEGER;
    END IF;

    -- Add mileage tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'schedules' 
                   AND column_name = 'mileage') THEN
        ALTER TABLE schedules ADD COLUMN mileage DECIMAL(6,2) DEFAULT 0;
    END IF;

    -- Add completion notes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'schedules' 
                   AND column_name = 'completion_notes') THEN
        ALTER TABLE schedules ADD COLUMN completion_notes TEXT;
    END IF;

    -- Add verification flags
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'schedules' 
                   AND column_name = 'gps_verified') THEN
        ALTER TABLE schedules ADD COLUMN gps_verified BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'schedules' 
                   AND column_name = 'signature_verified') THEN
        ALTER TABLE schedules ADD COLUMN signature_verified BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Enhance timesheets table with approval workflow
DO $$
BEGIN
    -- Update status enum if needed
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'timesheets' 
               AND column_name = 'status') THEN
        -- Alter column to include new statuses
        ALTER TABLE timesheets ALTER COLUMN status TYPE TEXT;
        -- Add check constraint
        ALTER TABLE timesheets DROP CONSTRAINT IF EXISTS timesheets_status_check;
        ALTER TABLE timesheets ADD CONSTRAINT timesheets_status_check 
            CHECK (status IN ('draft', 'submitted', 'pending', 'approved', 'rejected', 'correction_requested', 'payroll_exported'));
    END IF;

    -- Add approval fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'timesheets' 
                   AND column_name = 'approved_by') THEN
        ALTER TABLE timesheets ADD COLUMN approved_by UUID REFERENCES profiles(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'timesheets' 
                   AND column_name = 'approved_at') THEN
        ALTER TABLE timesheets ADD COLUMN approved_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'timesheets' 
                   AND column_name = 'rejection_reason') THEN
        ALTER TABLE timesheets ADD COLUMN rejection_reason TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'timesheets' 
                   AND column_name = 'correction_notes') THEN
        ALTER TABLE timesheets ADD COLUMN correction_notes TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'timesheets' 
                   AND column_name = 'payroll_export_id') THEN
        ALTER TABLE timesheets ADD COLUMN payroll_export_id UUID REFERENCES payroll_exports(id);
    END IF;

    -- Add overtime tracking
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'timesheets' 
                   AND column_name = 'regular_hours') THEN
        ALTER TABLE timesheets ADD COLUMN regular_hours DECIMAL(6,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'timesheets' 
                   AND column_name = 'overtime_hours') THEN
        ALTER TABLE timesheets ADD COLUMN overtime_hours DECIMAL(6,2) DEFAULT 0;
    END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payroll_exports_period ON payroll_exports(pay_period_start, pay_period_end);
CREATE INDEX IF NOT EXISTS idx_payroll_exports_status ON payroll_exports(status);
CREATE INDEX IF NOT EXISTS idx_payroll_export_items_export ON payroll_export_items(payroll_export_id);
CREATE INDEX IF NOT EXISTS idx_payroll_export_items_caregiver ON payroll_export_items(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_clock_events_schedule ON visit_clock_events(schedule_id);
CREATE INDEX IF NOT EXISTS idx_clock_events_caregiver ON visit_clock_events(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_schedules_lifecycle ON schedules(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_schedules_actual_times ON schedules(actual_start_time, actual_end_time);
CREATE INDEX IF NOT EXISTS idx_timesheets_status ON timesheets(status);
CREATE INDEX IF NOT EXISTS idx_timesheets_payroll ON timesheets(payroll_export_id);

-- RLS Policies for payroll_exports
ALTER TABLE payroll_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_export_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_clock_events ENABLE ROW LEVEL SECURITY;

-- Admin/Owner: Full access to payroll exports
CREATE POLICY "payroll_exports_admin" ON payroll_exports
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin_owner' OR profiles.role = 'co_owner')
        )
    );

-- Admin/Owner: Full access to payroll export items
CREATE POLICY "payroll_export_items_admin" ON payroll_export_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin_owner' OR profiles.role = 'co_owner')
        )
    );

-- Caregiver: View own payroll export items only
CREATE POLICY "payroll_export_items_caregiver" ON payroll_export_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM caregivers
            WHERE caregivers.id = payroll_export_items.caregiver_id
            AND caregivers.email = auth.email()
        )
    );

-- Caregiver: View own clock events
CREATE POLICY "clock_events_caregiver" ON visit_clock_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM caregivers
            WHERE caregivers.id = visit_clock_events.caregiver_id
            AND caregivers.email = auth.email()
        )
    );

-- Caregiver: Insert own clock events
CREATE POLICY "clock_events_insert" ON visit_clock_events
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM caregivers
            WHERE caregivers.id = visit_clock_events.caregiver_id
            AND caregivers.email = auth.email()
        )
    );

-- Admin: View all clock events
CREATE POLICY "clock_events_admin" ON visit_clock_events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin_owner' OR profiles.role = 'co_owner')
        )
    );

-- Triggers for updated_at
CREATE TRIGGER update_payroll_exports_updated_at BEFORE UPDATE ON payroll_exports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payroll_export_items_updated_at BEFORE UPDATE ON payroll_export_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function: Calculate overtime hours (weekly threshold > 40)
CREATE OR REPLACE FUNCTION calculate_overtime(
    p_caregiver_id UUID,
    p_week_start DATE,
    p_hours DECIMAL
) RETURNS TABLE (
    regular_hours DECIMAL(8,2),
    overtime_hours DECIMAL(8,2)
) AS $$
DECLARE
    v_weekly_total DECIMAL(8,2);
    v_regular DECIMAL(8,2);
    v_overtime DECIMAL(8,2);
BEGIN
    -- Get current week total (excluding this entry)
    SELECT COALESCE(SUM(regular_hours), 0) INTO v_weekly_total
    FROM timesheets
    WHERE caregiver_id = p_caregiver_id
      AND status IN ('approved', 'payroll_exported')
      AND week_starting = p_week_start;
    
    -- Calculate regular vs overtime
    IF v_weekly_total >= 40 THEN
        -- Already at/over 40, all new hours are overtime
        v_regular := 0;
        v_overtime := p_hours;
    ELSIF (v_weekly_total + p_hours) <= 40 THEN
        -- Still under 40, all regular
        v_regular := p_hours;
        v_overtime := 0;
    ELSE
        -- Crossing 40 hour threshold
        v_regular := 40 - v_weekly_total;
        v_overtime := p_hours - v_regular;
    END IF;
    
    RETURN QUERY SELECT v_regular, v_overtime;
END;
$$ LANGUAGE plpgsql;

-- Function: Get payroll summary for period
CREATE OR REPLACE FUNCTION get_payroll_summary(
    p_start_date DATE,
    p_end_date DATE
) RETURNS TABLE (
    caregiver_id UUID,
    caregiver_name TEXT,
    total_hours DECIMAL(10,2),
    regular_hours DECIMAL(10,2),
    overtime_hours DECIMAL(10,2),
    mileage DECIMAL(10,2),
    visit_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        COALESCE(SUM(t.hours_worked), 0) as total_hours,
        COALESCE(SUM(t.regular_hours), 0) as regular_hours,
        COALESCE(SUM(t.overtime_hours), 0) as overtime_hours,
        COALESCE(SUM(t.mileage), 0) as mileage,
        COUNT(DISTINCT t.id) as visit_count
    FROM caregivers c
    LEFT JOIN timesheets t ON t.caregiver_id = c.id
        AND t.status = 'approved'
        AND t.date >= p_start_date
        AND t.date <= p_end_date
    WHERE c.status = 'active'
    GROUP BY c.id, c.name
    HAVING COALESCE(SUM(t.hours_worked), 0) > 0
    ORDER BY c.name;
END;
$$ LANGUAGE plpgsql;

-- Function: Lock approved timesheets for payroll
CREATE OR REPLACE FUNCTION lock_timesheets_for_export(
    p_start_date DATE,
    p_end_date DATE,
    p_export_id UUID
) RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE timesheets
    SET 
        status = 'payroll_exported',
        payroll_export_id = p_export_id,
        updated_at = now()
    WHERE status = 'approved'
      AND date >= p_start_date
      AND date <= p_end_date
      AND payroll_export_id IS NULL;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE payroll_exports IS 'Payroll export master records with pay period summaries';
COMMENT ON TABLE payroll_export_items IS 'Individual caregiver payroll line items';
COMMENT ON TABLE visit_clock_events IS 'GPS-tracked caregiver clock in/out events';
COMMENT ON FUNCTION calculate_overtime IS 'Calculates regular vs overtime hours based on 40-hour week threshold';
COMMENT ON FUNCTION get_payroll_summary IS 'Returns payroll summary for a date range';
COMMENT ON FUNCTION lock_timesheets_for_export IS 'Locks approved timesheets to prevent changes after payroll export';
