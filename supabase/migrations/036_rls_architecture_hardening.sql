-- Migration 036: RLS hardening aligned with the current Recete architecture.
--
-- Architecture assumptions at migration time:
-- - Standalone web and Shopify shell read/write business data via the API layer.
-- - API and workers use the Supabase service role for operational tables.
-- - Browser clients only need direct Supabase access for auth/session flows.
--
-- As a result:
-- - GDPR, product facts, delivery template, WhatsApp event, and team membership
--   tables are treated as internal/service-role-only tables.
-- - subscription_plans remains safe to expose as read-only reference data.
-- - usage_tracking allows read-only merchant access if a future client path
--   needs it, while writes stay server-side only.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Internal/service-role-only tables
-- ---------------------------------------------------------------------------

ALTER TABLE public.gdpr_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gdpr_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_fact_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_template_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_inbound_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_outbound_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_members ENABLE ROW LEVEL SECURITY;

-- Defense in depth: browser-facing roles should not access these tables
-- directly. API/workers continue using the service role.
REVOKE ALL ON TABLE public.gdpr_exports FROM anon, authenticated;
REVOKE ALL ON TABLE public.gdpr_jobs FROM anon, authenticated;
REVOKE ALL ON TABLE public.product_facts FROM anon, authenticated;
REVOKE ALL ON TABLE public.product_fact_evidence FROM anon, authenticated;
REVOKE ALL ON TABLE public.delivery_template_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.whatsapp_inbound_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.whatsapp_outbound_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.merchant_members FROM anon, authenticated;

COMMENT ON TABLE public.gdpr_exports IS
  'Internal GDPR export artifacts. Access via API/service role only.';
COMMENT ON TABLE public.gdpr_jobs IS
  'Internal durable GDPR job queue. Access via API/service role only.';
COMMENT ON TABLE public.product_facts IS
  'Internal structured product facts snapshots. Access via API/service role only.';
COMMENT ON TABLE public.product_fact_evidence IS
  'Internal evidence rows for product facts. Access via API/service role only.';
COMMENT ON TABLE public.delivery_template_events IS
  'Internal delivery-template workflow state. Access via API/service role only.';
COMMENT ON TABLE public.whatsapp_inbound_events IS
  'Internal inbound WhatsApp event inbox. Access via API/service role only.';
COMMENT ON TABLE public.whatsapp_outbound_events IS
  'Internal outbound WhatsApp outbox. Access via API/service role only.';
COMMENT ON TABLE public.merchant_members IS
  'Internal team membership table. Current app architecture manages access via API/service role only.';

-- ---------------------------------------------------------------------------
-- 2) Reference data that is safe for direct reads
-- ---------------------------------------------------------------------------

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active subscription plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Public can read active subscription plans" ON public.subscription_plans;

CREATE POLICY "Public can read active subscription plans"
  ON public.subscription_plans
  FOR SELECT
  USING (is_active = true);

GRANT SELECT ON TABLE public.subscription_plans TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.subscription_plans FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Merchant usage can be read by the merchant owner, but stays server-write
-- ---------------------------------------------------------------------------

ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchants can view their own usage" ON public.usage_tracking;
DROP POLICY IF EXISTS "Merchant owners can view their own usage" ON public.usage_tracking;

CREATE POLICY "Merchant owners can view their own usage"
  ON public.usage_tracking
  FOR SELECT
  USING (merchant_id = auth.uid());

REVOKE ALL ON TABLE public.usage_tracking FROM anon, authenticated;
GRANT SELECT ON TABLE public.usage_tracking TO authenticated;

COMMIT;
