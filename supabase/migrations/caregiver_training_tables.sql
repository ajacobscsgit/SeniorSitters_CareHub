-- SeniorSitters CareHub - Caregiver Training & Onboarding Tables
-- ================================================================

-- Table: training_modules
-- Stores all training content (videos, documents, quizzes, etc.)
CREATE TABLE IF NOT EXISTS training_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('video', 'document', 'photo', 'quiz', 'acknowledgement')),
    resource_url TEXT,
    required_role TEXT,
    is_required BOOLEAN DEFAULT true,
    estimated_minutes INTEGER,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE training_modules IS 'Training content library - videos, documents, quizzes, and acknowledgement forms';

-- Table: caregiver_training_assignments
-- Links caregivers to assigned training modules with tracking
CREATE TABLE IF NOT EXISTS caregiver_training_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caregiver_id UUID NOT NULL REFERENCES caregivers(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,
    assigned_by UUID,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    completed_by UUID,
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'overdue')),
    score INTEGER,
    acknowledged_at TIMESTAMPTZ,
    notes TEXT,
    started_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(caregiver_id, module_id)
);

COMMENT ON TABLE caregiver_training_assignments IS 'Tracks training assignments for each caregiver with status and due dates';

-- Table: onboarding_steps
-- Master list of onboarding checklist items
CREATE TABLE IF NOT EXISTS onboarding_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    required BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE onboarding_steps IS 'Master checklist of onboarding steps for new caregivers';

-- Table: caregiver_onboarding_progress
-- Tracks individual caregiver progress through onboarding steps
CREATE TABLE IF NOT EXISTS caregiver_onboarding_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caregiver_id UUID NOT NULL REFERENCES caregivers(id) ON DELETE CASCADE,
    onboarding_step_id UUID NOT NULL REFERENCES onboarding_steps(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'flagged')),
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    flagged_reason TEXT,
    admin_notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(caregiver_id, onboarding_step_id)
);

COMMENT ON TABLE caregiver_onboarding_progress IS 'Tracks each caregiver progress through onboarding checklist';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_training_assignments_caregiver ON caregiver_training_assignments(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_training_assignments_status ON caregiver_training_assignments(status);
CREATE INDEX IF NOT EXISTS idx_training_assignments_due_date ON caregiver_training_assignments(due_date);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_caregiver ON caregiver_onboarding_progress(caregiver_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_status ON caregiver_onboarding_progress(status);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_training_modules_updated_at BEFORE UPDATE ON training_modules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_caregiver_training_assignments_updated_at BEFORE UPDATE ON caregiver_training_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_onboarding_steps_updated_at BEFORE UPDATE ON onboarding_steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_caregiver_onboarding_progress_updated_at BEFORE UPDATE ON caregiver_onboarding_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE caregiver_training_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE caregiver_onboarding_progress ENABLE ROW LEVEL SECURITY;

-- Training modules: All authenticated users can view active modules
CREATE POLICY "training_modules_select_all" ON training_modules
    FOR SELECT USING (active = true);

-- Training modules: Only admins can modify
CREATE POLICY "training_modules_modify_admin" ON training_modules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin_owner' OR profiles.role = 'co_owner')
        )
    );

-- Training assignments: Caregivers see their own, admins see all
CREATE POLICY "training_assignments_select_caregiver" ON caregiver_training_assignments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM caregivers
            WHERE caregivers.id = caregiver_training_assignments.caregiver_id
            AND caregivers.email = auth.email()
        )
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin_owner' OR profiles.role = 'co_owner')
        )
    );

-- Training assignments: Admins can modify
CREATE POLICY "training_assignments_modify_admin" ON caregiver_training_assignments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin_owner' OR profiles.role = 'co_owner')
        )
    );

-- Onboarding steps: All authenticated users can view active steps
CREATE POLICY "onboarding_steps_select_all" ON onboarding_steps
    FOR SELECT USING (active = true);

-- Onboarding steps: Only admins can modify
CREATE POLICY "onboarding_steps_modify_admin" ON onboarding_steps
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin_owner' OR profiles.role = 'co_owner')
        )
    );

-- Onboarding progress: Caregivers see their own, admins see all
CREATE POLICY "onboarding_progress_select_caregiver" ON caregiver_onboarding_progress
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM caregivers
            WHERE caregivers.id = caregiver_onboarding_progress.caregiver_id
            AND caregivers.email = auth.email()
        )
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin_owner' OR profiles.role = 'co_owner')
        )
    );

-- Onboarding progress: Admins can modify
CREATE POLICY "onboarding_progress_modify_admin" ON caregiver_onboarding_progress
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin_owner' OR profiles.role = 'co_owner')
        )
    );

-- Default onboarding steps
INSERT INTO onboarding_steps (title, description, category, required, sort_order) VALUES
('Complete Profile', 'Fill out all profile information including contact details and emergency contacts', ' paperwork', true, 1),
('Sign Handbook Acknowledgement', 'Review and acknowledge the caregiver handbook', 'compliance', true, 2),
('Review Emergency Protocols', 'Read and understand emergency contact procedures', 'safety', true, 3),
('Complete Timesheet Training', 'Watch training video on how to fill out timesheets', 'training', true, 4),
('Complete Visit Update Training', 'Watch training video on submitting visit updates', 'training', true, 5),
('Upload Required Documents', 'Upload ID, certifications, and background check documents', 'paperwork', true, 6),
('Attend Orientation', 'Attend in-person or virtual orientation session', 'training', true, 7),
('Background Check Cleared', 'Pass background check verification', 'compliance', true, 8)
ON CONFLICT DO NOTHING;

-- Default training modules
INSERT INTO training_modules (title, description, type, is_required, estimated_minutes, active) VALUES
('Caregiver Handbook', 'Complete caregiver handbook review and acknowledgement', 'document', true, 30, true),
('Emergency Procedures', 'Emergency contact protocols and 911 procedures', 'video', true, 15, true),
('Timesheet Training', 'How to properly document and submit timesheets', 'video', true, 20, true),
('Visit Update Training', 'How to write and submit visit updates for families', 'video', true, 25, true),
('Client Communication', 'Best practices for communicating with clients and families', 'video', true, 20, true),
('HIPAA & Privacy', 'Understanding patient privacy and confidentiality', 'acknowledgement', true, 15, true),
('Mileage Policy', 'How to track and submit mileage reimbursement', 'document', true, 10, true),
('Dress Code Policy', 'Professional appearance and uniform requirements', 'document', true, 10, true),
('Incident Reporting', 'When and how to report incidents or concerns', 'acknowledgement', true, 15, true)
ON CONFLICT DO NOTHING;
