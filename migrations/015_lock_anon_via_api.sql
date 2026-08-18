-- Migration 015: lock the Data API. Anon/authenticated can no longer read or
-- write user data. The React app talks to Express /api/db (Auth0-verified) and
-- the API uses the service role, which bypasses RLS.
--
-- DO NOT RUN until:
--   1. SUPABASE_SERVICE_ROLE_KEY is on the API (Vercel + local .env).
--   2. The new /api/db route is deployed.
--   3. The frontend supabase client proxies through /api/db (not the anon key).
--
-- After this, possessing the anon key cannot dump or destroy users,
-- saved_reports, templates, onboarding, or usage_events.
-- Billing writes from the client are also stripped in /api/db.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users', 'saved_reports', 'templates', 'onboarding', 'usage_events']
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('users', 'saved_reports', 'templates', 'onboarding', 'usage_events')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

REVOKE ALL ON TABLE public.users FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.saved_reports FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.templates FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.onboarding FROM anon, authenticated, PUBLIC;
REVOKE ALL ON TABLE public.usage_events FROM anon, authenticated, PUBLIC;

GRANT ALL ON TABLE public.users TO service_role;
GRANT ALL ON TABLE public.saved_reports TO service_role;
GRANT ALL ON TABLE public.templates TO service_role;
GRANT ALL ON TABLE public.onboarding TO service_role;
GRANT ALL ON TABLE public.usage_events TO service_role;
