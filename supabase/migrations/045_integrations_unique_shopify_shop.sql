-- 045: one Shopify integration per shop.
--
-- Nothing stopped two rows for the same shop, and every shop-based lookup
-- (install-sync, the webhook route, session verification, internal auth, GDPR)
-- ended in .maybeSingle(), which errors when it finds two. Callers read that
-- error as "no integration". install-sync answered by creating another merchant,
-- so a single duplicate grew without bound: one shop reached 41 merchants in a
-- day, and every webhook from an affected shop was dropped with a 404.
--
-- The application fix (lib/shopifyIntegrationLookup.ts) handles errors
-- explicitly. This index makes the duplicate impossible in the first place,
-- including the race between the Shopify shell's afterAuth hook and its
-- bootstrap call landing together on a first install: the loser's insert now
-- fails with 23505, and ensureShopifyInstall adopts the winner's row.
--
-- Existing duplicates must be removed first. On production that cleanup ran on
-- 2026-09-24, in the same transaction as this index; see
-- docs/agent-memory/daily/2026-09-24.md.
create unique index if not exists integrations_shopify_shop_unique
  on public.integrations ((auth_data->>'shop'))
  where provider = 'shopify';
