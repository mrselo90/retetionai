-- Migration 047: browser-facing roles lose direct access to merchants and integrations.
--
-- Both tables kept Supabase's default grants for anon/authenticated, and their
-- policies ("... isolated by merchant_id", FOR ALL, no column restriction) let a
-- signed-in user write any column of their own rows straight through PostgREST
-- with the public anon key:
-- - merchants: setting is_super_admin = true passed adminAuth and opened
--   /api/admin/impersonate for every account.
-- - integrations: inserting a shopify row with auth_data.shop = <any shop> let
--   install-sync adopt it and write that shop's offline access token into the
--   attacker's row.
--
-- Nothing outside the API reads or writes these tables with a user JWT: the web
-- dashboard and Shopify shell go through the API, and the API and workers use the
-- service role. Same model as migration 036.

BEGIN;

ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.merchants FROM anon, authenticated;
REVOKE ALL ON TABLE public.integrations FROM anon, authenticated;

COMMENT ON TABLE public.merchants IS
  'Merchant accounts, including is_super_admin and billing state. Access via API/service role only.';
COMMENT ON TABLE public.integrations IS
  'Store integrations, including Shopify access tokens. Access via API/service role only.';

COMMIT;
