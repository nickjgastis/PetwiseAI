-- Migration 013: clear Supabase security advisors without changing app access.
--
-- Context: PetWise uses Auth0 + the anon key. auth.uid() is always NULL, so
-- per-user RLS policies would break onboarding, SOAP logging, and the admin
-- dashboard. This migration:
--   1. Flips analytics views to SECURITY INVOKER and revokes API access
--      (the React app never queries these views).
--   2. Enables RLS on onboarding with a permissive anon policy — same
--      behavior as today, required so signup still works.
--   3. Enables RLS on usage_events: anon can INSERT (server logging) but
--      cannot SELECT the table. Admin RPCs become SECURITY DEFINER so the
--      dashboard still aggregates all events.
--
-- Safe to re-run.

-- ── 1. Analytics views ─────────────────────────────────────────────────────
-- These leak the full users table through the Data API while SECURITY DEFINER.
-- Invoker + REVOKE from anon/authenticated: SQL editor (postgres role) still
-- works; the public API cannot SELECT them.
DO $$
DECLARE
  v text;
BEGIN
  FOREACH v IN ARRAY ARRAY[
    'marketing_users_view',
    'active_users',
    'inactive_users',
    'users_trial_subscriptions',
    'users_monthly_subscriptions',
    'users_yearly_subscriptions',
    'users_null_subscription_interval',
    'user_metrics',
    'user_tiers'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_catalog.pg_views
      WHERE schemaname = 'public' AND viewname = v
    ) THEN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', v);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated, PUBLIC', v);
    END IF;
  END LOOP;
END $$;

-- ── 2. onboarding ──────────────────────────────────────────────────────────
-- Frontend (Dashboard / OnboardingFlow) and the admin users list all hit this
-- table with the anon key. A USING(true) policy matches current production
-- behavior so signup does not break. Real per-user RLS needs Auth0 JWTs
-- verified in Postgres — out of scope here.
ALTER TABLE public.onboarding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS onboarding_anon_all ON public.onboarding;
CREATE POLICY onboarding_anon_all ON public.onboarding
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ── 3. usage_events ────────────────────────────────────────────────────────
-- Written only by the Express server (anon key, insert, no .select()).
-- Block table dumps via the Data API; keep inserts working.
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS usage_events_anon_insert ON public.usage_events;
CREATE POLICY usage_events_anon_insert ON public.usage_events
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Admin RPCs query usage_events as the caller. After RLS, anon has no SELECT,
-- so invoker functions would return zeros. Run them as the owner instead.
-- search_path = '' forces fully-qualified names (advisor 0011).

CREATE OR REPLACE FUNCTION public.admin_usage_timeseries(
  p_granularity text DEFAULT 'day',
  p_start timestamptz DEFAULT (now() - interval '30 days'),
  p_end timestamptz DEFAULT now(),
  p_tz text DEFAULT 'America/Denver'
)
RETURNS TABLE (
  bucket timestamptz,
  signups bigint,
  quicksoap bigint,
  petsoap bigint,
  petquery bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_gran text := lower(coalesce(p_granularity, 'day'));
BEGIN
  IF v_gran NOT IN ('day', 'week', 'month') THEN
    v_gran := 'day';
  END IF;

  RETURN QUERY
  WITH buckets AS (
    SELECT generate_series(
      date_trunc(v_gran, (p_start AT TIME ZONE p_tz)),
      date_trunc(v_gran, (p_end AT TIME ZONE p_tz)),
      ('1 ' || v_gran)::interval
    ) AS b_local
  ),
  signup_counts AS (
    SELECT date_trunc(v_gran, (created_at AT TIME ZONE p_tz)) AS b_local, count(*) AS n
    FROM public.users
    WHERE created_at >= p_start AND created_at <= p_end
    GROUP BY 1
  ),
  event_counts AS (
    SELECT
      date_trunc(v_gran, (created_at AT TIME ZONE p_tz)) AS b_local,
      event_type,
      count(*) AS n
    FROM public.usage_events
    WHERE created_at >= p_start AND created_at <= p_end
    GROUP BY 1, 2
  )
  SELECT
    (b.b_local AT TIME ZONE p_tz) AS bucket,
    coalesce(max(s.n), 0)::bigint AS signups,
    coalesce(sum(e.n) FILTER (WHERE e.event_type = 'quicksoap'), 0)::bigint AS quicksoap,
    coalesce(sum(e.n) FILTER (WHERE e.event_type = 'petsoap'), 0)::bigint AS petsoap,
    coalesce(sum(e.n) FILTER (WHERE e.event_type = 'petquery'), 0)::bigint AS petquery
  FROM buckets b
  LEFT JOIN signup_counts s ON s.b_local = b.b_local
  LEFT JOIN event_counts e ON e.b_local = b.b_local
  GROUP BY b.b_local
  ORDER BY b.b_local;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_user_usage(p_auth0_user_id text)
RETURNS TABLE (event_type text, total bigint, last_30d bigint, last_7d bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    event_type,
    count(*) AS total,
    count(*) FILTER (WHERE created_at >= now() - interval '30 days') AS last_30d,
    count(*) FILTER (WHERE created_at >= now() - interval '7 days') AS last_7d
  FROM public.usage_events
  WHERE auth0_user_id = p_auth0_user_id
  GROUP BY event_type;
$$;

CREATE OR REPLACE FUNCTION public.admin_usage_by_user()
RETURNS TABLE (auth0_user_id text, quicksoap bigint, petsoap bigint, petquery bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    auth0_user_id,
    count(*) FILTER (WHERE event_type = 'quicksoap') AS quicksoap,
    count(*) FILTER (WHERE event_type = 'petsoap') AS petsoap,
    count(*) FILTER (WHERE event_type = 'petquery') AS petquery
  FROM public.usage_events
  GROUP BY auth0_user_id;
$$;
