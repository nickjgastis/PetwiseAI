-- Migration 011: Switch free-tier usage from monthly to DAILY reset at the
-- user's local midnight. SAFE TO RUN ANYTIME relative to the deploy:
-- the in-between state (daily reset with the old higher limits) is strictly
-- more generous — nobody gets wrongly locked out.
--
-- Design: fixed daily allowance (5 SOAPs / 15 PetQueries — limits live in the
-- server env, passed in as p_limit). No rollover: unused quota evaporates at
-- local midnight and the counters reset to zero on the first request of each
-- new local day. Timezone comes from the request (browser IANA zone), falls
-- back to the stored users.timezone, then UTC.

ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT;
COMMENT ON COLUMN users.timezone IS 'IANA timezone (e.g. America/Toronto), stamped by the client at login/generation. Drives the local-midnight daily usage reset.';
COMMENT ON COLUMN users.usage_period_start IS 'Start of the current usage day (local midnight in users.timezone, stored as an absolute instant). NULL until first capped request.';

-- Postgres overloads functions by argument list — drop the 3-arg monthly
-- version so only the daily 4-arg version exists (its default p_tz still
-- lets old 3-arg callers resolve to it during the deploy window).
DROP FUNCTION IF EXISTS consume_usage(TEXT, TEXT, INTEGER);

CREATE FUNCTION consume_usage(
  p_auth0_user_id TEXT,
  p_feature TEXT,
  p_limit INTEGER,
  p_tz TEXT DEFAULT NULL
)
RETURNS TABLE(allowed BOOLEAN, used INTEGER, usage_limit INTEGER, resets_at TIMESTAMPTZ) AS $$
DECLARE
  u users%ROWTYPE;
  tz TEXT;
  local_day_start TIMESTAMPTZ;
  next_reset TIMESTAMPTZ;
  current_used INTEGER;
BEGIN
  IF p_feature NOT IN ('soap', 'query') THEN
    RAISE EXCEPTION 'consume_usage: unknown feature %', p_feature;
  END IF;

  SELECT * INTO u FROM users WHERE auth0_user_id = p_auth0_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, p_limit, NOW(); RETURN;
  END IF;

  -- Resolve timezone: request > stored > UTC. Invalid names fall back to UTC.
  tz := COALESCE(NULLIF(p_tz, ''), u.timezone, 'UTC');
  BEGIN
    PERFORM NOW() AT TIME ZONE tz;
  EXCEPTION WHEN OTHERS THEN
    tz := 'UTC';
  END;

  -- Remember a newly seen timezone so the stored value tracks the user.
  IF p_tz IS NOT NULL AND p_tz <> '' AND u.timezone IS DISTINCT FROM p_tz THEN
    UPDATE users SET timezone = p_tz WHERE auth0_user_id = p_auth0_user_id;
  END IF;

  -- Today's local midnight (as an absolute instant) and the next one.
  local_day_start := date_trunc('day', NOW() AT TIME ZONE tz) AT TIME ZONE tz;
  next_reset := (date_trunc('day', NOW() AT TIME ZONE tz) + INTERVAL '1 day') AT TIME ZONE tz;

  -- Lazy daily reset: first request of a new local day zeroes both counters.
  IF u.usage_period_start IS NULL OR u.usage_period_start < local_day_start THEN
    UPDATE users
      SET soap_notes_used = 0, pet_queries_used = 0, usage_period_start = local_day_start
      WHERE auth0_user_id = p_auth0_user_id;
    u.soap_notes_used := 0;
    u.pet_queries_used := 0;
  END IF;

  current_used := CASE WHEN p_feature = 'soap' THEN u.soap_notes_used ELSE u.pet_queries_used END;

  IF current_used >= p_limit THEN
    RETURN QUERY SELECT FALSE, current_used, p_limit, next_reset;
    RETURN;
  END IF;

  IF p_feature = 'soap' THEN
    UPDATE users SET soap_notes_used = soap_notes_used + 1 WHERE auth0_user_id = p_auth0_user_id;
  ELSE
    UPDATE users SET pet_queries_used = pet_queries_used + 1 WHERE auth0_user_id = p_auth0_user_id;
  END IF;

  RETURN QUERY SELECT TRUE, current_used + 1, p_limit, next_reset;
END;
$$ LANGUAGE plpgsql;

-- refund_usage is unchanged (decrement with floor 0) — no action needed.

-- Verification after running:
--   SELECT * FROM consume_usage('auth0|YOUR_SUB', 'soap', 5, 'America/Toronto');
--   → resets_at should be YOUR next local midnight, used = 1.
--   Run again with a different tz string → timezone column updates.
