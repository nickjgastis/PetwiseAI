-- Drip email tracking (day 2 get-started, day 8 first-month discount)

ALTER TABLE users ADD COLUMN IF NOT EXISTS drip_get_started_email_sent_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS drip_discount_email_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_drip_get_started
ON users (welcome_email_sent_at)
WHERE drip_get_started_email_sent_at IS NULL
  AND welcome_email_sent_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_drip_discount
ON users (welcome_email_sent_at)
WHERE drip_discount_email_sent_at IS NULL
  AND welcome_email_sent_at IS NOT NULL;

COMMENT ON COLUMN users.drip_get_started_email_sent_at IS 'Timestamp when day-2 get-started drip email was sent';
COMMENT ON COLUMN users.drip_discount_email_sent_at IS 'Timestamp when day-8 50% off drip email was sent';
