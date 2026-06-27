ALTER TABLE tenant_integrations
  ADD COLUMN IF NOT EXISTS fb_page_name             text,
  ADD COLUMN IF NOT EXISTS fb_user_access_token     text,
  ADD COLUMN IF NOT EXISTS fb_user_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS fb_ad_account_id         text,
  ADD COLUMN IF NOT EXISTS fb_ad_account_name       text,
  ADD COLUMN IF NOT EXISTS fb_webhook_subscribed_at timestamptz;
