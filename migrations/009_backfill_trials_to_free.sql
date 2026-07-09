-- Migration 009: Backfill trial users to free tier
-- ⚠️  DO NOT RUN until the new free-tier frontend is DEPLOYED to production.
-- The old frontend paywalls any user with has_used_trial=true whose status
-- isn't active/past_due — running this early would lock out mid-trial users.
-- Once the new frontend is live, 'inactive' simply means "free tier".

-- All legacy (no-card) trial users — expired AND in-flight — become free tier.
UPDATE users
SET subscription_status = 'inactive',
    subscription_interval = NULL
WHERE subscription_interval = 'trial';

-- Expired Stripe-trial users become free tier. In-flight stripe_trial users
-- (card on file) are left alone; Stripe's subscription.updated webhook will
-- convert or cancel them within days.
UPDATE users
SET subscription_status = 'inactive',
    subscription_interval = NULL
WHERE subscription_interval = 'stripe_trial'
  AND subscription_end_date < NOW();

-- Sanity checks (run these after; both should return 0):
--   SELECT COUNT(*) FROM users WHERE subscription_interval = 'trial';
--   SELECT COUNT(*) FROM users WHERE subscription_interval = 'stripe_trial' AND subscription_end_date < NOW();
