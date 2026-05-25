-- SeniorSitters CareHub - Caregiver Availability & Time-Off Requests
-- ================================================================

-- Table: caregiver_time_off_requests
-- Tracks time-off, unavailability, and schedule change requests
CREATE TABLE IF NOT EXISTS caregiver_time_off_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caregiver_id UUID NOT NULL REFERENCES caregivers(id) ON DELETE CASCADE,
    requested_by UUID, -- User ID who created the request (caregiver or admin)
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    request_type TEXT NOT NULL CHECK (request_type IN ('time_off', 'unavailable', 'schedule_change', 'availability_update')),
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
    admin_notes TEXT,
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    -- Ensure start_date <= end_date
    CONSTRAINT valid_date_range CHECK (start_date <= end_date),
    -- Ensure start_time < end_time when both are provided
    CONSTRAINT valid_time_range CHECK (
        (start_time IS NULL AND end_time IS NULL) OR
        (start_time IS NOT NULL AND end_time IS NULL) OR
        (start_time IS NULL AND end_time IS NOT NULL) OR
        (start_time < end_time)
    )
);

COMMENT ON TABLE caregiver_time_off_requests IS 'Tracks caregiver time-off requests, unavailability periods, and schedule changes';

-- Table: caregiver_availability (enhanced)
-- Already exists but ensure it has all needed fields
-- This migration makes sure the table structure is complete

-- Add columns if they don't exist (for existing installations)
DO $$
BEGIN
    -- Add recurrence_type if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'caregiver_availability' 
                   AND column_name = 'recurrence_type') THEN
        ALTER TABLE caregiver_availability ADD COLUMN recurrence_type TEXT DEFAULT 'weekly' 
            CHECK (recurrence_type IN ('weekly', 'biweekly', 'custom'));
    END IF;

    -- Add effective_start_date if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'caregiver_availability' 
                   AND column_name = 'effective_start_date') THEN
        ALTER TABLE caregiver_availability ADD COLUMN effective_start_date DATE;
    END IF;

    -- Add effective_end_date if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'caregiver_availability' 
                   AND column_name = 'effective_end_date') THEN
        ALTER TABLE caregiver_availability ADD COLUMN effective_end_date DATE;
    END IF;

    -- Add status if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'caregiver_availability' 
                   AND column_name = 'status') THEN
        ALTER TABLE caregiver_availability ADD COLUMN status TEXT DEFAULT 'active' 
            CHECK (status IN ('active', 'inactive'));
    END IF;

    -- Add created_by if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'caregiver_availability' 
                   AND column_name = 'created_by') THEN
        ALTER TABLE caregiver_availability ADD COLUMN created_by UUID;
    END IF;

    -- Add updated_by if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'caregiver_availability' 
                   AND column_name = 'updated_by') THEN
        ALTER TABLE caregiver_availability ADD COLUMN updated_by UUID;
    END IF;

    -- Add updated_at if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'caregiver_availability' 
                   AND column_name = 'updated_at') THEN
        ALTER TABLE caregiver_availability ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    END IF;

    -- Add service_area if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'caregiver_availability' 
                   AND column_name = 'service_area') THEN
        ALTER TABLE caregiver_availability ADD COLUMN service_area TEXT;
    END IF;
END $$;

-- Table: caregiver_unavailable_dates (already exists, ensure it has reason column)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'caregiver_unavailable_dates' 
                   AND column_name = 'created_by') THEN
        ALTER TABLE caregiver_unavailable_dates ADD COLUMN created_by UUID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'caregiver_unavailable_dates' 
                   AND column_name = 'request_id') THEN
        ALTER TABLE caregiver_unavailable_dates ADD COLUMN request_id UUID REFERENCES caregiver_time_off_requests(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_time_off_requests_caregiver ON caregiver_time_off_requests(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_time_off_requests_status ON caregiver_time_off_requests(status);
CREATE INDEX IF NOT EXISTS idx_time_off_requests_dates ON caregiver_time_off_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_availability_caregiver_status ON caregiver_availability(caregiver_id, status);
CREATE INDEX IF NOT EXISTS idx_availability_dates ON caregiver_availability(effective_start_date, effective_end_date);

-- Trigger for updated_at on time_off_requests
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_time_off_requests_updated_at BEFORE UPDATE ON caregiver_time_off_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for updated_at on caregiver_availability
DROP TRIGGER IF EXISTS update_caregiver_availability_updated_at ON caregiver_availability;
CREATE TRIGGER update_caregiver_availability_updated_at BEFORE UPDATE ON caregiver_availability
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE caregiver_time_off_requests ENABLE ROW LEVEL SECURITY;

-- Caregivers can view their own requests
CREATE POLICY "time_off_requests_select_own" ON caregiver_time_off_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM caregivers
            WHERE caregivers.id = caregiver_time_off_requests.caregiver_id
            AND caregivers.email = auth.email()
        )
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin_owner' OR profiles.role = 'co_owner')
        )
    );

-- Caregivers can create their own requests
CREATE POLICY "time_off_requests_insert_own" ON caregiver_time_off_requests
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM caregivers
            WHERE caregivers.id = caregiver_time_off_requests.caregiver_id
            AND caregivers.email = auth.email()
        )
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin_owner' OR profiles.role = 'co_owner')
        )
    );

-- Caregivers can update their own pending requests (cancel them)
CREATE POLICY "time_off_requests_update_own" ON caregiver_time_off_requests
    FOR UPDATE USING (
        (
            EXISTS (
                SELECT 1 FROM caregivers
                WHERE caregivers.id = caregiver_time_off_requests.caregiver_id
                AND caregivers.email = auth.email()
            )
            AND status = 'pending'
        )
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin_owner' OR profiles.role = 'co_owner')
        )
    );

-- Admins can manage all availability
CREATE POLICY "caregiver_availability_admin" ON caregiver_availability
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin_owner' OR profiles.role = 'co_owner')
        )
    );

-- Caregivers can view their own availability
CREATE POLICY "caregiver_availability_select_own" ON caregiver_availability
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM caregivers
            WHERE caregivers.id = caregiver_availability.caregiver_id
            AND caregivers.email = auth.email()
        )
    );

-- Function to check if caregiver is available on a specific date/time
CREATE OR REPLACE FUNCTION is_caregiver_available(
    p_caregiver_id UUID,
    p_date DATE,
    p_start_time TIME,
    p_end_time TIME
) RETURNS BOOLEAN AS $$
DECLARE
    v_day_of_week INTEGER;
    v_has_availability BOOLEAN;
    v_has_conflict BOOLEAN;
BEGIN
    -- Get day of week (0=Sunday, 1=Monday, etc.)
    v_day_of_week := EXTRACT(DOW FROM p_date);
    
    -- Check if caregiver has approved unavailable time
    SELECT EXISTS (
        SELECT 1 FROM caregiver_unavailable_dates
        WHERE caregiver_id = p_caregiver_id
        AND date = p_date
    ) INTO v_has_conflict;
    
    IF v_has_conflict THEN
        RETURN FALSE;
    END IF;
    
    -- Check if there's an approved time-off request
    SELECT EXISTS (
        SELECT 1 FROM caregiver_time_off_requests
        WHERE caregiver_id = p_caregiver_id
        AND status = 'approved'
        AND p_date BETWEEN start_date AND end_date
        AND (
            (start_time IS NULL AND end_time IS NULL) OR
            (p_start_time < end_time AND p_end_time > start_time)
        )
    ) INTO v_has_conflict;
    
    IF v_has_conflict THEN
        RETURN FALSE;
    END IF;
    
    -- Check if caregiver has availability for this day
    SELECT EXISTS (
        SELECT 1 FROM caregiver_availability
        WHERE caregiver_id = p_caregiver_id
        AND day_of_week = v_day_of_week
        AND status = 'active'
        AND (
            effective_start_date IS NULL OR effective_start_date <= p_date
        )
        AND (
            effective_end_date IS NULL OR effective_end_date >= p_date
        )
        AND start_time <= p_start_time
        AND end_time >= p_end_time
    ) INTO v_has_availability;
    
    RETURN v_has_availability;
END;
$$ LANGUAGE plpgsql;

-- Function to get pending time-off request count for dashboard
CREATE OR REPLACE FUNCTION get_pending_time_off_count()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM caregiver_time_off_requests
    WHERE status = 'pending';
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;
