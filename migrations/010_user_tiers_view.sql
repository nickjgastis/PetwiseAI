-- Migration 010: user_tiers view — explicit tier labels for analytics.
-- SAFE TO RUN ANYTIME: read-only view, no table changes, no app dependency.
--
-- Free tier is stored as "absence of a plan" (status inactive, interval NULL),
-- which is correct for the app but opaque for analytics. This view derives the
-- tier with the exact same rules the server uses (server/usage.js getTier),
-- so counts here always match what users actually experience.

CREATE OR REPLACE VIEW user_tiers AS
SELECT
  id,
  auth0_user_id,
  email,
  dvm_name,
  created_at,
  subscription_status,
  subscription_interval,
  plan_label,
  soap_notes_used,
  pet_queries_used,
  usage_period_start,
  CASE
    WHEN plan_label = 'student'
         AND subscription_end_date > NOW()                          THEN 'student'
    WHEN subscription_status IN ('active', 'past_due')
         AND subscription_interval IN ('monthly', 'yearly')         THEN 'paid'
    WHEN subscription_status = 'active'
         AND subscription_interval IN ('trial', 'stripe_trial')
         AND subscription_end_date > NOW()                          THEN 'legacy_trial'
    ELSE 'free'
  END AS tier,
  -- Engagement signal: separates real free users from sign-up-and-left accounts
  (COALESCE(soap_notes_used, 0) + COALESCE(pet_queries_used, 0)) > 0
    OR usage_period_start IS NOT NULL AS has_used_this_period
FROM users;

-- Example queries:
--   SELECT tier, COUNT(*) FROM user_tiers GROUP BY tier;
--   SELECT tier, COUNT(*) FILTER (WHERE has_used_this_period) AS active_this_period
--     FROM user_tiers GROUP BY tier;
--   New free signups this week:
--   SELECT COUNT(*) FROM user_tiers WHERE tier = 'free' AND created_at > NOW() - INTERVAL '7 days';
