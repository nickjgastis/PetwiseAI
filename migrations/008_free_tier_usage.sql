-- Migration 008: Free tier usage tracking (SAFE TO RUN IN PRODUCTION IMMEDIATELY)
-- Purely additive: new columns with defaults + new functions. Nothing in the
-- currently-deployed app reads any of this, so it changes no behavior.
-- The behavior-changing backfill (flipping trial users to free) is in 009 —
-- run that one only when the new frontend deploys.

-- ============ Usage counter columns on users ============

ALTER TABLE users ADD COLUMN IF NOT EXISTS soap_notes_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pet_queries_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS usage_period_start TIMESTAMPTZ; -- NULL = lazily initialized on first capped request
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_seen_app_tour BOOLEAN NOT NULL DEFAULT FALSE;

-- Existing users never see the first-run app tour; only brand-new signups do.
UPDATE users SET has_seen_app_tour = TRUE;

COMMENT ON COLUMN users.soap_notes_used IS 'SOAP generations used this period (QuickSOAP + PetSOAP combined pool). Reset lazily each anniversary month by consume_usage().';
COMMENT ON COLUMN users.pet_queries_used IS 'PetQuery messages used this period. Reset lazily each anniversary month by consume_usage().';
COMMENT ON COLUMN users.usage_period_start IS 'Start of the current usage period (anniversary-anchored to created_at). NULL until first capped request.';
COMMENT ON COLUMN users.has_seen_app_tour IS 'First-run in-app tutorial shown/dismissed. Backfilled TRUE for all pre-free-tier users.';

-- ============ Atomic check-and-consume ============
-- Locks the user row, lazily resets counters when a new anniversary period has
-- started, then either consumes one unit or reports the limit as reached.
-- p_feature: 'soap' | 'query'. Returns the post-operation state.

CREATE OR REPLACE FUNCTION consume_usage(
  p_auth0_user_id TEXT,
  p_feature TEXT,
  p_limit INTEGER
)
RETURNS TABLE(allowed BOOLEAN, used INTEGER, usage_limit INTEGER, resets_at TIMESTAMPTZ) AS $$
DECLARE
  u users%ROWTYPE;
  anchor TIMESTAMPTZ;
  months_elapsed INTEGER;
  period_start TIMESTAMPTZ;
  current_used INTEGER;
BEGIN
  IF p_feature NOT IN ('soap', 'query') THEN
    RAISE EXCEPTION 'consume_usage: unknown feature %', p_feature;
  END IF;

  SELECT * INTO u FROM users WHERE auth0_user_id = p_auth0_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, p_limit, NOW(); RETURN;
  END IF;

  -- Anniversary-based period: the period containing NOW(), anchored to signup.
  -- Postgres month arithmetic clamps day-31 anchors (Jan 31 + 1mo = Feb 28) sanely.
  anchor := COALESCE(u.created_at, NOW());
  months_elapsed := (EXTRACT(YEAR FROM AGE(NOW(), anchor)) * 12
                   + EXTRACT(MONTH FROM AGE(NOW(), anchor)))::INTEGER;
  period_start := anchor + MAKE_INTERVAL(months => months_elapsed);
  IF period_start > NOW() THEN
    period_start := anchor + MAKE_INTERVAL(months => months_elapsed - 1);
  END IF;

  -- Lazy monthly reset
  IF u.usage_period_start IS NULL OR u.usage_period_start < period_start THEN
    UPDATE users
      SET soap_notes_used = 0, pet_queries_used = 0, usage_period_start = period_start
      WHERE auth0_user_id = p_auth0_user_id;
    u.soap_notes_used := 0;
    u.pet_queries_used := 0;
  END IF;

  current_used := CASE WHEN p_feature = 'soap' THEN u.soap_notes_used ELSE u.pet_queries_used END;

  IF current_used >= p_limit THEN
    RETURN QUERY SELECT FALSE, current_used, p_limit, period_start + INTERVAL '1 month';
    RETURN;
  END IF;

  IF p_feature = 'soap' THEN
    UPDATE users SET soap_notes_used = soap_notes_used + 1 WHERE auth0_user_id = p_auth0_user_id;
  ELSE
    UPDATE users SET pet_queries_used = pet_queries_used + 1 WHERE auth0_user_id = p_auth0_user_id;
  END IF;

  RETURN QUERY SELECT TRUE, current_used + 1, p_limit, period_start + INTERVAL '1 month';
END;
$$ LANGUAGE plpgsql;

-- ============ Refund (for failed generations after consuming) ============

CREATE OR REPLACE FUNCTION refund_usage(
  p_auth0_user_id TEXT,
  p_feature TEXT
)
RETURNS VOID AS $$
BEGIN
  IF p_feature = 'soap' THEN
    UPDATE users SET soap_notes_used = GREATEST(soap_notes_used - 1, 0)
      WHERE auth0_user_id = p_auth0_user_id;
  ELSIF p_feature = 'query' THEN
    UPDATE users SET pet_queries_used = GREATEST(pet_queries_used - 1, 0)
      WHERE auth0_user_id = p_auth0_user_id;
  ELSE
    RAISE EXCEPTION 'refund_usage: unknown feature %', p_feature;
  END IF;
END;
$$ LANGUAGE plpgsql;
