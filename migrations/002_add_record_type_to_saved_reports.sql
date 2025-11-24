-- Add record_type column to saved_reports table for easier filtering
-- This is optional - the code works without it by detecting type from form_data JSON

ALTER TABLE public.saved_reports
  ADD COLUMN IF NOT EXISTS record_type text DEFAULT 'generator';

-- Add index for performance when filtering by record type
CREATE INDEX IF NOT EXISTS idx_saved_reports_record_type ON public.saved_reports(record_type);

-- Update existing records: set record_type based on form_data content
-- Generator records have patientName in form_data
UPDATE public.saved_reports
SET record_type = 'generator'
WHERE form_data IS NOT NULL 
  AND form_data->>'patientName' IS NOT NULL
  AND record_type IS NULL;

-- QuickSOAP records have dictations array in form_data
UPDATE public.saved_reports
SET record_type = 'quicksoap'
WHERE form_data IS NOT NULL 
  AND form_data->'dictations' IS NOT NULL
  AND record_type IS NULL;

-- Set default for records without form_data
UPDATE public.saved_reports
SET record_type = 'generator'
WHERE record_type IS NULL;

