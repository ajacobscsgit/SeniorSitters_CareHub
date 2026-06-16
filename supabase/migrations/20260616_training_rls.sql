-- Migration: RLS policies and helper for training_progress

-- Helper function to check training completion for a caregiver (by caregivers.id)
CREATE OR REPLACE FUNCTION is_caregiver_training_complete(cg_id uuid)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
  prof_row RECORD;
  tp RECORD;
BEGIN
  SELECT * INTO prof_row FROM profiles WHERE caregiver_id = cg_id LIMIT 1;
  IF prof_row IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO tp FROM training_progress
    WHERE user_id = prof_row.id
      AND module_id = 'level_1_orientation'
    LIMIT 1;

  IF tp IS NULL THEN
    RETURN false;
  END IF;

  RETURN (tp.status = 'passed' AND COALESCE(tp.score,0) >= 80 AND tp.completed_at IS NOT NULL);
END;
$$;

-- Enable RLS on training_progress and add policies
ALTER TABLE training_progress ENABLE ROW LEVEL SECURITY;

-- Allow admins (profiles.role in admin_owner/co_owner) to SELECT all rows
CREATE POLICY "Admins can select all training_progress" ON training_progress
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid AND p.role IN ('admin_owner','co_owner')
  )
);

-- Allow caregivers to select only their own training_progress row
CREATE POLICY "Caregivers can select own training_progress" ON training_progress
FOR SELECT USING (
  user_id = auth.uid
);

-- Allow authenticated users to insert/update their own row
CREATE POLICY "Users can upsert their training_progress" ON training_progress
FOR INSERT, UPDATE USING (
  user_id = auth.uid
) WITH CHECK (
  user_id = auth.uid
);
