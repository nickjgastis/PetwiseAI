-- Migration: Create onboarding table for new user signup flow
-- Existing users are NOT affected — only new signups get a row in this table.
-- If no row exists for a user, onboarding is skipped entirely.

CREATE TABLE IF NOT EXISTS onboarding (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth0_user_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'in_progress',        -- in_progress | completed
  current_step TEXT NOT NULL DEFAULT 'congrats',     -- congrats | quiz1 | quiz2 | affirmation | benefits | testimonial | trial | welcome | terms | complete
  quiz_answers JSONB DEFAULT '{}',                   -- { "role": "veterinarian", "goal": "soap_notes" }
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by auth0_user_id (already UNIQUE but explicit)
CREATE INDEX IF NOT EXISTS idx_onboarding_auth0_user_id ON onboarding (auth0_user_id);

-- Index for finding in-progress onboarding sessions
CREATE INDEX IF NOT EXISTS idx_onboarding_status ON onboarding (status) WHERE status = 'in_progress';

-- Comments
COMMENT ON TABLE onboarding IS 'Tracks new user onboarding progress. No row = existing user, skip onboarding.';
COMMENT ON COLUMN onboarding.current_step IS 'Step IDs: congrats, quiz1, quiz2, affirmation, benefits, testimonial, trial, welcome, terms, complete';
COMMENT ON COLUMN onboarding.quiz_answers IS 'JSON: { role: string, goal: string }';
