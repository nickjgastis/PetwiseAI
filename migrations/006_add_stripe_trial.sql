-- Migration: Add Stripe trial tracking
-- Separates Stripe trial (14-day, card required) from legacy in-house trial (30-day, no card)

-- Track if user has activated the new Stripe trial (separate from has_used_trial for legacy)
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_activated_stripe_trial BOOLEAN DEFAULT FALSE;

-- Email tracking for Stripe trial (different timing than legacy trial)
-- Day 7 reminder (midway through 14-day trial)
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_trial_midway_email_sent_at TIMESTAMPTZ;
-- Day 12 reminder (2 days before trial ends)
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_trial_ending_email_sent_at TIMESTAMPTZ;

-- Index for Stripe trial email cron queries
CREATE INDEX IF NOT EXISTS idx_users_stripe_trial_email_status 
ON users (subscription_status, subscription_interval, subscription_end_date)
WHERE subscription_interval = 'stripe_trial';

-- Comments for documentation
COMMENT ON COLUMN users.has_activated_stripe_trial IS 'Whether user has activated the Stripe 14-day trial (separate from legacy has_used_trial)';
COMMENT ON COLUMN users.stripe_trial_midway_email_sent_at IS 'Timestamp when Stripe trial midway (day 7) reminder was sent';
COMMENT ON COLUMN users.stripe_trial_ending_email_sent_at IS 'Timestamp when Stripe trial ending (2 days left) reminder was sent';
