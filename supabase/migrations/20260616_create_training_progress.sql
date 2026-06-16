-- Migration: Create training_progress table
-- Stores per-user progress and quiz results for training modules

CREATE TABLE IF NOT EXISTS training_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module_id text NOT NULL,
  module_name text,
  status text DEFAULT 'in_progress', -- in_progress | passed | failed
  score integer,
  attempts integer DEFAULT 0,
  section_progress jsonb, -- object keyed by section id with completion timestamps
  started_at timestamptz,
  completed_at timestamptz,
  last_accessed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Unique constraint for upsert by user + module
CREATE UNIQUE INDEX IF NOT EXISTS training_progress_user_module_idx ON training_progress (user_id, module_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION trg_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp ON training_progress;
CREATE TRIGGER set_timestamp BEFORE UPDATE ON training_progress
FOR EACH ROW EXECUTE PROCEDURE trg_set_timestamp();
