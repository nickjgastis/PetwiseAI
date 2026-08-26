-- In-flight no-card trials are the current signup path, not a leftover.
-- Same view logic as 010 — only the label changes (legacy_trial → trial).
-- App does not depend on this; analytics only.

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
         AND subscription_end_date > NOW()                          THEN 'trial'
    ELSE 'free'
  END AS tier,
  (COALESCE(soap_notes_used, 0) + COALESCE(pet_queries_used, 0)) > 0
    OR usage_period_start IS NOT NULL AS has_used_this_period
FROM users;
