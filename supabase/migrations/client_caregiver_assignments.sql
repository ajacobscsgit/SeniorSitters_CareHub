-- SeniorSitters CareHub - Client-Caregiver Assignment System
-- ================================================================
-- This table serves as the operational bridge between clients and caregivers
-- All schedules, visit updates, timesheets, and notifications flow through this connection

-- Table: client_caregiver_assignments
CREATE TABLE IF NOT EXISTS client_caregiver_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    caregiver_id UUID NOT NULL REFERENCES caregivers(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'backup', 'ended')),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    assigned_by UUID REFERENCES profiles(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    -- Ensure start_date <= end_date when end_date is provided
    CONSTRAINT valid_date_range CHECK (end_date IS NULL OR start_date <= end_date),
    -- Prevent duplicate active assignments for same client-caregiver pair
    UNIQUE (client_id, caregiver_id, status)
);

COMMENT ON TABLE client_caregiver_assignments IS 'Operational bridge connecting clients with assigned caregivers. All schedules, visit updates, timesheets, and notifications flow through this assignment record.';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_assignments_client ON client_caregiver_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_assignments_caregiver ON client_caregiver_assignments(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON client_caregiver_assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_active_client ON client_caregiver_assignments(client_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_assignments_active_caregiver ON client_caregiver_assignments(caregiver_id, status) WHERE status = 'active';

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON client_caregiver_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE client_caregiver_assignments ENABLE ROW LEVEL SECURITY;

-- Admin/Owner: Can see all assignments
CREATE POLICY "assignments_select_admin" ON client_caregiver_assignments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin_owner' OR profiles.role = 'co_owner')
        )
    );

-- Caregiver: Can see only their own assignments
CREATE POLICY "assignments_select_caregiver" ON client_caregiver_assignments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM caregivers
            WHERE caregivers.id = client_caregiver_assignments.caregiver_id
            AND caregivers.email = auth.email()
        )
    );

-- Client/Family: Can see only assignments for their client record
CREATE POLICY "assignments_select_client" ON client_caregiver_assignments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM clients
            WHERE clients.id = client_caregiver_assignments.client_id
            AND (
                clients.email = auth.email()
                OR EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.client_id = clients.id
                )
            )
        )
    );

-- Admin/Owner: Can insert assignments
CREATE POLICY "assignments_insert_admin" ON client_caregiver_assignments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin_owner' OR profiles.role = 'co_owner')
        )
    );

-- Admin/Owner: Can update assignments
CREATE POLICY "assignments_update_admin" ON client_caregiver_assignments
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin_owner' OR profiles.role = 'co_owner')
        )
    );

-- Admin/Owner: Can delete assignments
CREATE POLICY "assignments_delete_admin" ON client_caregiver_assignments
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin_owner' OR profiles.role = 'co_owner')
        )
    );

-- Function: Get active assignment for a client-caregiver pair
CREATE OR REPLACE FUNCTION get_active_assignment(
    p_client_id UUID,
    p_caregiver_id UUID
) RETURNS UUID AS $$
DECLARE
    v_assignment_id UUID;
BEGIN
    SELECT id INTO v_assignment_id
    FROM client_caregiver_assignments
    WHERE client_id = p_client_id
      AND caregiver_id = p_caregiver_id
      AND status = 'active'
      AND (end_date IS NULL OR end_date >= CURRENT_DATE);
    
    RETURN v_assignment_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Get all active caregivers for a client
CREATE OR REPLACE FUNCTION get_client_caregivers(
    p_client_id UUID
) RETURNS TABLE (
    assignment_id UUID,
    caregiver_id UUID,
    caregiver_name TEXT,
    caregiver_email TEXT,
    assignment_status TEXT,
    start_date DATE,
    notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id as assignment_id,
        c.id as caregiver_id,
        c.name as caregiver_name,
        c.email as caregiver_email,
        a.status as assignment_status,
        a.start_date,
        a.notes
    FROM client_caregiver_assignments a
    JOIN caregivers c ON a.caregiver_id = c.id
    WHERE a.client_id = p_client_id
      AND a.status = 'active'
      AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)
    ORDER BY a.start_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Function: Get all active clients for a caregiver
CREATE OR REPLACE FUNCTION get_caregiver_clients(
    p_caregiver_id UUID
) RETURNS TABLE (
    assignment_id UUID,
    client_id UUID,
    client_name TEXT,
    client_care_for TEXT,
    client_email TEXT,
    assignment_status TEXT,
    start_date DATE,
    notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id as assignment_id,
        c.id as client_id,
        c.name as client_name,
        c.care_for as client_care_for,
        c.email as client_email,
        a.status as assignment_status,
        a.start_date,
        a.notes
    FROM client_caregiver_assignments a
    JOIN clients c ON a.client_id = c.id
    WHERE a.caregiver_id = p_caregiver_id
      AND a.status = 'active'
      AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)
    ORDER BY a.start_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Function: Check if client-caregiver pair has active assignment
CREATE OR REPLACE FUNCTION has_active_assignment(
    p_client_id UUID,
    p_caregiver_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM client_caregiver_assignments
        WHERE client_id = p_client_id
          AND caregiver_id = p_caregiver_id
          AND status = 'active'
          AND (end_date IS NULL OR end_date >= CURRENT_DATE)
    );
END;
$$ LANGUAGE plpgsql;

-- Function: Auto-create assignment when creating first schedule
CREATE OR REPLACE FUNCTION auto_create_assignment()
RETURNS TRIGGER AS $$
DECLARE
    v_assignment_id UUID;
BEGIN
    -- Check if active assignment already exists
    v_assignment_id := get_active_assignment(NEW.client_id, NEW.caregiver_id);
    
    -- If no assignment exists, create one
    IF v_assignment_id IS NULL THEN
        INSERT INTO client_caregiver_assignments (
            client_id,
            caregiver_id,
            status,
            start_date,
            assigned_by,
            notes
        ) VALUES (
            NEW.client_id,
            NEW.caregiver_id,
            'active',
            NEW.date,
            NULL,
            'Auto-created from schedule'
        )
        ON CONFLICT (client_id, caregiver_id, status) DO UPDATE
        SET updated_at = now()
        RETURNING id INTO v_assignment_id;
    END IF;
    
    -- Set assignment_id on the schedule
    NEW.assignment_id := v_assignment_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add assignment_id column to schedules if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'schedules' 
                   AND column_name = 'assignment_id') THEN
        ALTER TABLE schedules ADD COLUMN assignment_id UUID REFERENCES client_caregiver_assignments(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add assignment_id column to visit_updates if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'visit_updates' 
                   AND column_name = 'assignment_id') THEN
        ALTER TABLE visit_updates ADD COLUMN assignment_id UUID REFERENCES client_caregiver_assignments(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add assignment_id column to timesheets if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'timesheets' 
                   AND column_name = 'assignment_id') THEN
        ALTER TABLE timesheets ADD COLUMN assignment_id UUID REFERENCES client_caregiver_assignments(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create indexes for assignment_id columns
CREATE INDEX IF NOT EXISTS idx_schedules_assignment ON schedules(assignment_id);
CREATE INDEX IF NOT EXISTS idx_visit_updates_assignment ON visit_updates(assignment_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_assignment ON timesheets(assignment_id);

-- Comment explaining the assignment bridge
COMMENT ON FUNCTION get_active_assignment IS 'Returns the active assignment ID for a client-caregiver pair, or NULL if none exists';
COMMENT ON FUNCTION get_client_caregivers IS 'Returns all active caregivers assigned to a client';
COMMENT ON FUNCTION get_caregiver_clients IS 'Returns all active clients assigned to a caregiver';
COMMENT ON FUNCTION has_active_assignment IS 'Checks if a client-caregiver pair has an active assignment';
