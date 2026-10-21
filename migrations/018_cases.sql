-- Cases: one visit that groups the notes generated for it (SOAP, summary, callback, later dental).
-- Additive only. Existing saved_reports keep case_id = NULL and behave exactly as before.
-- Accessed only through the server (/api/db, service role), same as saved_reports after 015.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pet_name text,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cases_user_updated ON public.cases (user_id, updated_at DESC);

DROP TRIGGER IF EXISTS update_cases_updated_at ON public.cases;
CREATE TRIGGER update_cases_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.saved_reports
  ADD COLUMN IF NOT EXISTS case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_saved_reports_case ON public.saved_reports (case_id) WHERE case_id IS NOT NULL;

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cases FROM anon, authenticated, PUBLIC;
GRANT ALL ON TABLE public.cases TO service_role;
