-- One case per existing record, so users see their history in Cases.
-- Records are linked, not copied: each stays in Saved Records as it is, and edits show in both places.
-- Only finished QuickSOAP-style records (soap / quicksoap / summary / callback / dental). PetSOAP
-- ("generator") records and unfinished drafts stay in Saved Records only.
-- saved_reports.updated_at is left untouched so Saved Records keeps its order.
-- Safe to re-run (e.g. again at deploy): only rows with case_id IS NULL are touched.
--
-- Undo: DELETE FROM public.cases WHERE source = 'backfill';
-- saved_reports.case_id is ON DELETE SET NULL, so the records fall back to having no case.

ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS source text;

BEGIN;

CREATE TEMP TABLE _backfill ON COMMIT DROP AS
SELECT
  r.id AS report_id,
  gen_random_uuid() AS case_id,
  r.user_id,
  r.created_at,
  NULLIF(btrim(COALESCE(
    NULLIF(btrim(r.form_data->>'petName'), ''),
    CASE
      WHEN r.report_name LIKE '% - %'
       AND btrim(split_part(r.report_name, ' - ', 1)) !~* '^(QuickSOAP|SOAP|Summary|Callback|Dental)( Mobile| Draft)?$'
      THEN split_part(r.report_name, ' - ', 1)
    END
  )), '') AS pet_name,
  -- A name the vet typed (not an auto "Summary Mobile - 10/21/2026, ..." stamp) titles cases with no patient.
  CASE
    WHEN btrim(COALESCE(r.report_name, '')) = '' THEN NULL
    WHEN r.report_name ~* '^\s*(QuickSOAP|SOAP|Summary|Callback|Dental)( Mobile| Draft)?(\s+-\s+|\s*$)' THEN NULL
    ELSE left(btrim(r.report_name), 120)
  END AS custom_name
FROM public.saved_reports r
WHERE r.case_id IS NULL
  AND r.user_id IS NOT NULL
  AND r.report_text IS NOT NULL
  AND btrim(r.report_text) <> ''
  AND lower(COALESCE(r.record_type, r.form_data->>'record_type', '')) IN ('soap', 'quicksoap', 'summary', 'callback', 'dental');

INSERT INTO public.cases (id, user_id, pet_name, title, source, created_at, updated_at)
SELECT case_id, user_id, pet_name, CASE WHEN pet_name IS NULL THEN custom_name END, 'backfill', created_at, created_at
FROM _backfill;

ALTER TABLE public.saved_reports DISABLE TRIGGER update_saved_reports_updated_at;

UPDATE public.saved_reports r
SET case_id = b.case_id
FROM _backfill b
WHERE r.id = b.report_id
  AND r.case_id IS NULL;

ALTER TABLE public.saved_reports ENABLE TRIGGER update_saved_reports_updated_at;

COMMIT;

-- Check: every backfilled case holds exactly one record (expect 0 rows).
-- SELECT c.id FROM public.cases c LEFT JOIN public.saved_reports r ON r.case_id = c.id
-- WHERE c.source = 'backfill' GROUP BY c.id HAVING count(r.id) <> 1;
