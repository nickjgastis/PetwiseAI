-- Move pre-cases records into cases so existing users see their history in Cases.
-- One case per user + patient name + day (UTC). Records with no recognisable pet name get a case each.
-- Only finished QuickSOAP-style records (soap / quicksoap / summary / callback); PetSOAP ("generator")
-- records and unprocessed mobile drafts stay as they are and remain in Saved Records.
-- saved_reports.updated_at is left untouched so Saved Records keeps its order.
-- Safe to re-run: only rows with case_id IS NULL are touched.

BEGIN;

CREATE TEMP TABLE _backfill ON COMMIT DROP AS
SELECT
  r.id AS report_id,
  r.user_id,
  r.created_at,
  COALESCE(r.updated_at, r.created_at) AS touched_at,
  NULLIF(btrim(COALESCE(
    NULLIF(btrim(r.form_data->>'petName'), ''),
    CASE
      WHEN r.report_name LIKE '% - %'
       AND btrim(split_part(r.report_name, ' - ', 1)) !~* '^(QuickSOAP|SOAP|Summary|Callback)( Mobile| Draft)?$'
      THEN split_part(r.report_name, ' - ', 1)
    END
  )), '') AS pet_name
FROM public.saved_reports r
WHERE r.case_id IS NULL
  AND r.user_id IS NOT NULL
  AND r.report_text IS NOT NULL
  AND btrim(r.report_text) <> ''
  AND lower(COALESCE(r.record_type, r.form_data->>'record_type', '')) IN ('soap', 'quicksoap', 'summary', 'callback');

ALTER TABLE _backfill ADD COLUMN grp text;

UPDATE _backfill
SET grp = CASE
  WHEN pet_name IS NULL THEN 'solo|' || report_id::text
  ELSE user_id::text || '|' || lower(pet_name) || '|' || (created_at AT TIME ZONE 'UTC')::date::text
END;

CREATE TEMP TABLE _groups ON COMMIT DROP AS
SELECT
  g.*,
  gen_random_uuid() AS case_id
FROM (
  SELECT
    grp,
    user_id,
    (array_agg(pet_name ORDER BY created_at))[1] AS pet_name,
    min(created_at) AS created_at,
    max(touched_at) AS updated_at
  FROM _backfill
  GROUP BY grp, user_id
) g;

INSERT INTO public.cases (id, user_id, pet_name, created_at, updated_at)
SELECT case_id, user_id, pet_name, created_at, updated_at
FROM _groups;

ALTER TABLE public.saved_reports DISABLE TRIGGER update_saved_reports_updated_at;

UPDATE public.saved_reports r
SET case_id = g.case_id
FROM _backfill b
JOIN _groups g ON g.grp = b.grp
WHERE r.id = b.report_id
  AND r.case_id IS NULL;

ALTER TABLE public.saved_reports ENABLE TRIGGER update_saved_reports_updated_at;

COMMIT;
