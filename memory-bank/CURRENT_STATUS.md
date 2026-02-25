# Current Status — February 25, 2026

## 🟢 Application is LIVE

**URL**: http://209.97.134.215  
**Server**: DigitalOcean Droplet (209.97.134.215)

## Services

| Service | Status | Port | Memory |
|---------|--------|------|--------|
| API | ✅ Online | 3002 | ~110 MB |
| Frontend | ✅ Online | 3001 | ~55 MB |
| Workers | ✅ Online | - | ~68 MB |
| Redis | ✅ Connected | 6379 | - |
| Supabase DB | ✅ Connected | cloud | - |
| Nginx | ✅ Running | 80 | - |

## Quick Commands

```bash
# Connect to server
ssh root@209.97.134.215

# Check services
pm2 list

# View logs
pm2 logs api --lines 50

# Restart
pm2 restart all --update-env

# Deploy update
cd /root/retetionai && git pull && pnpm install && cd packages/web && pnpm build && pm2 restart all
```

## Key Files on Server

| File | Path |
|------|------|
| Backend .env | `/root/retetionai/.env` |
| Frontend .env | `/root/retetionai/packages/web/.env.local` |
| Nginx config | `/etc/nginx/sites-available/recete` |
| PM2 config | `~/.pm2/dump.pm2` |

**Ports & "Could not reach the API"**: Fixed inside PM2 process via `.env` by setting **INTERNAL_API_URL=http://127.0.0.1:3002**. 

## Recent Operational Changes (Feb 24-25)

- **Merchant API key system removed from active app flows**
  - Auth now relies on `Supabase JWT` / `Shopify session token` / `INTERNAL_SERVICE_SECRET` (internal routes only)
  - Settings + signup API key UI/flows removed
  - Manual API-key webhook ingestion deprecated
- **Internal service auth added for ops/eval**
  - `X-Internal-Secret` + `X-Internal-Merchant-Id`
  - Used by workers and server-side eval scripts
- **Maruderm HU test ingestion completed**
  - 10 products from `https://maruderm.hu` ingested into test merchant
  - Scrape + enrich + embeddings succeeded; products produced ~9–10 chunks each
- **Products dashboard false-negative RAG status fixed**
  - `chunks/batch` JSON parse failure no longer causes silent `chunkCount=0` fallback
  - UI now shows `RAG status unknown` if chunk-count fetch fails, instead of false `RAG not ready`
- **Internal debug auth extended**
  - `/api/products/chunks/batch` and `/api/products/:id/chunks` now accept internal-secret auth (for server-side debugging)
- **Auth/Authz hardening (IDOR + webhook security)**
  - `auth.ts` internal-secret whitelist paths are now fail-closed (missing/invalid `INTERNAL_SERVICE_SECRET` no longer pass)
  - `req.user.authMethod` now distinguishes `jwt` vs `shopify` vs `internal`
  - Merchant isolation enforced for RAG order context and message scheduler helpers (`merchant_id` scoping)
  - WhatsApp inbound webhook now validates Meta `X-Hub-Signature-256` HMAC
  - `/api/events/process` restricted to internal-secret or super-admin only
- **Super Admin RAG Smoke Suite (UI)**
  - `/admin/system` includes a predefined `rag_superadmin_10_products_smoke` runner
  - Dynamically selects first 10 chunk-ready products and runs RAG / RAG+Answer smoke checks
  - UI supports query-set presets, `RAG only` mode, and product exclusion for next run

### Next Steps
1. **Eval quality tuning (TR/EN/HU)**: Re-run and tune multilingual/product-scoped evals using Maruderm products (facts-first coverage, language consistency, grounding).
2. **Prod DB migration alignment**: Verify/apply latest `product_facts` / chunk metadata migrations in Supabase (schema drift observed during eval checks).
3. **SSL/Domain**: Configure custom domain and Let's Encrypt SSL.
4. **Integrations**: Verify Shopify OAuth and WhatsApp API in end-to-end flows.
