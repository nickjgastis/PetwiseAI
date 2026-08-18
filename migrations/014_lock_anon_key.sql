-- SUPERSEDED by 015_lock_anon_via_api.sql (Auth0 JWT in Postgres / TPA was
-- abandoned). Do not run this. Path A: Express + service role + deny anon.
--   1. SUPABASE_SERVICE_ROLE_KEY is set on the API server (Vercel).
--   2. Supabase dashboard → Authentication → Third-party Auth → add Auth0
--      (tenant id from your Auth0 domain).
--   3. Auth0 Action on post-login:
--        exports.onExecutePostLogin = async (event, api) => {
--          api.idToken.setCustomClaim('role', 'authenticated');
--        };
--   4. Deploy the app with REACT_APP_SUPABASE_AUTH0_TPA=true
--      and confirm login + SOAP save still work.
--   5. THEN run this SQL.
--
-- After this, anon can do nothing to user data. Clients must present an Auth0
-- ID token (role=authenticated). Each user only sees/edits their own rows.
-- The Express server uses the service role and is unaffected.
-- Billing columns cannot be changed via the Data API even for your own row.

-- ── helpers ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.jwt_auth0_sub()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT auth.jwt()->>'sub';
$$;

CREATE OR REPLACE FUNCTION public.jwt_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT u.id
  FROM public.users u
  WHERE u.auth0_user_id = auth.jwt()->>'sub'
  LIMIT 1;
$$;

-- ── users ──────────────────────────────────────────────────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select_own ON public.users;
DROP POLICY IF EXISTS users_insert_own ON public.users;
DROP POLICY IF EXISTS users_update_own ON public.users;
DROP POLICY IF EXISTS users_anon_all ON public.users;

CREATE POLICY users_select_own ON public.users
  FOR SELECT TO authenticated
  USING (auth0_user_id = public.jwt_auth0_sub());

CREATE POLICY users_insert_own ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (auth0_user_id = public.jwt_auth0_sub());

CREATE POLICY users_update_own ON public.users
  FOR UPDATE TO authenticated
  USING (auth0_user_id = public.jwt_auth0_sub())
  WITH CHECK (auth0_user_id = public.jwt_auth0_sub());

-- No DELETE policy: account deletion stays on the service-role API.

CREATE OR REPLACE FUNCTION public.protect_user_billing_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- service_role / postgres (webhooks, cron, admin) may change billing.
  -- authenticated/anon may not, even on their own row.
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.subscription_status := COALESCE(NEW.subscription_status, 'inactive');
      IF NEW.subscription_status IS DISTINCT FROM 'inactive' THEN
        NEW.subscription_status := 'inactive';
      END IF;
      NEW.subscription_interval := NULL;
      NEW.subscription_end_date := NULL;
      NEW.stripe_customer_id := NULL;
      NEW.cancel_at_period_end := COALESCE(NEW.cancel_at_period_end, false);
      NEW.plan_label := NULL;
    ELSIF TG_OP = 'UPDATE' THEN
      NEW.subscription_status := OLD.subscription_status;
      NEW.subscription_interval := OLD.subscription_interval;
      NEW.subscription_end_date := OLD.subscription_end_date;
      NEW.stripe_customer_id := OLD.stripe_customer_id;
      NEW.cancel_at_period_end := OLD.cancel_at_period_end;
      NEW.plan_label := OLD.plan_label;
      NEW.grace_period_end := OLD.grace_period_end;
      NEW.has_used_trial := OLD.has_used_trial;
      NEW.has_activated_stripe_trial := OLD.has_activated_stripe_trial;
      NEW.soap_notes_used := OLD.soap_notes_used;
      NEW.pet_queries_used := OLD.pet_queries_used;
      NEW.usage_period_start := OLD.usage_period_start;
      NEW.welcome_email_sent_at := OLD.welcome_email_sent_at;
      NEW.auth0_user_id := OLD.auth0_user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_user_billing ON public.users;
CREATE TRIGGER trg_protect_user_billing
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_user_billing_columns();

-- ── saved_reports ──────────────────────────────────────────────────────────
ALTER TABLE public.saved_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saved_reports_own ON public.saved_reports;
CREATE POLICY saved_reports_own ON public.saved_reports
  FOR ALL TO authenticated
  USING (user_id = public.jwt_user_id())
  WITH CHECK (user_id = public.jwt_user_id());

-- ── templates ──────────────────────────────────────────────────────────────
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS templates_own ON public.templates;
CREATE POLICY templates_own ON public.templates
  FOR ALL TO authenticated
  USING (user_id = public.jwt_user_id())
  WITH CHECK (user_id = public.jwt_user_id());

-- ── onboarding ─────────────────────────────────────────────────────────────
ALTER TABLE public.onboarding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS onboarding_anon_all ON public.onboarding;
DROP POLICY IF EXISTS onboarding_own ON public.onboarding;
CREATE POLICY onboarding_own ON public.onboarding
  FOR ALL TO authenticated
  USING (auth0_user_id = public.jwt_auth0_sub())
  WITH CHECK (auth0_user_id = public.jwt_auth0_sub());

-- ── usage_events ───────────────────────────────────────────────────────────
-- Server-only (service role). No anon/authenticated policies = no Data API access.
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS usage_events_anon_insert ON public.usage_events;
