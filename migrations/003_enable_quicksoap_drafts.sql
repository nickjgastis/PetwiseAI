-- Enable QuickSOAP draft functionality for mobile dictation recording
-- This migration ensures the saved_reports table supports draft records (report_text = NULL)

-- Ensure report_text column allows NULL (should already be the case, but being explicit)
ALTER TABLE public.saved_reports
  ALTER COLUMN report_text DROP NOT NULL;

-- Add updated_at column if it doesn't exist (for tracking when drafts are updated)
ALTER TABLE public.saved_reports
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create trigger to automatically update updated_at on row updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if it exists, then create it
DROP TRIGGER IF EXISTS update_saved_reports_updated_at ON public.saved_reports;
CREATE TRIGGER update_saved_reports_updated_at
    BEFORE UPDATE ON public.saved_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add index for faster querying of draft records (report_text IS NULL)
CREATE INDEX IF NOT EXISTS idx_saved_reports_drafts 
  ON public.saved_reports(user_id, record_type) 
  WHERE report_text IS NULL;

-- Add index for updated_at to help with ordering draft records
CREATE INDEX IF NOT EXISTS idx_saved_reports_updated_at 
  ON public.saved_reports(updated_at DESC);

-- Ensure record_type column exists (from previous migration, but safe to run again)
ALTER TABLE public.saved_reports
  ADD COLUMN IF NOT EXISTS record_type text;

-- Add comment for documentation
COMMENT ON COLUMN public.saved_reports.report_text IS 
  'NULL for draft records (dictations only), contains SOAP report text for completed records';

COMMENT ON COLUMN public.saved_reports.record_type IS 
  'Type of record: quicksoap, generator, etc. Used to filter and identify record types';

COMMENT ON COLUMN public.saved_reports.updated_at IS 
  'Timestamp of last update, automatically maintained by trigger';

