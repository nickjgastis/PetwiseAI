-- Migration: Add email tracking columns to users table
-- This tracks when each type of email was sent to prevent duplicates

-- Welcome email sent timestamp
ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMPTZ;

-- Trial reminder emails sent timestamps
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_midway_email_sent_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ending_email_sent_at TIMESTAMPTZ;

-- Index for cron job queries (finding users who need reminder emails)
CREATE INDEX IF NOT EXISTS idx_users_trial_email_status 
ON users (subscription_status, subscription_interval, subscription_end_date)
WHERE subscription_interval = 'trial';

-- Comment for documentation
COMMENT ON COLUMN users.welcome_email_sent_at IS 'Timestamp when welcome email was sent';
COMMENT ON COLUMN users.trial_midway_email_sent_at IS 'Timestamp when trial midway (day 15) reminder was sent';
COMMENT ON COLUMN users.trial_ending_email_sent_at IS 'Timestamp when trial ending (3 days left) reminder was sent';
