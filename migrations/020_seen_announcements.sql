-- Which "what's new" announcements each account has seen: { "<announcement id>": "<seen at>" }.
-- Run before deploying the frontend that selects this column.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS seen_announcements jsonb NOT NULL DEFAULT '{}'::jsonb;
