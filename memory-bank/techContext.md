# Technical Context

## Technology Stack

### Backend (packages/api)
- **Runtime**: Node.js (TypeScript)
- **Framework**: Hono (lightweight, edge-compatible)
- **Database**: Supabase (PostgreSQL + pgvector extension)
- **Queue**: BullMQ + Redis
- **LLM Orchestration**: LangChain.js
- **LLM Models**: 
  - GPT-4o / GPT-4o-mini (reasoning, generation, enrichment, eval judge)
  - Multilingual embeddings via OpenAI (`text-embedding-3-small`)
- **Messaging**: WhatsApp Business API (Meta Cloud API)

### Frontend (packages/web)
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Auth**: Supabase Auth (email/password + Google OAuth)
- **State Management**: React hooks + Supabase client

### Workers (packages/workers)
- **Queue**: BullMQ (Redis-backed)
- **Jobs**: Order processing, scheduled messages, product scraping, analytics
- **Intelligence Workers**: RFM analysis (daily 2AM), churn prediction (weekly Mon 3AM), product recommendations (weekly Tue 4AM), abandoned cart reminders, feedback/NPS requests

### Shared (packages/shared)
- **Purpose**: Shared types, utilities, logger, database helpers

## Development Environment

- **Package Manager**: pnpm (workspace support)
- **Monorepo Structure**: pnpm workspaces
  - `packages/api/` - Backend API (Hono)
  - `packages/workers/` - Background workers (BullMQ)
  - `packages/shared/` - Shared types/utilities
  - `packages/web/` - Frontend (Next.js)

## Deployment (DigitalOcean)

### Server Details
- **Provider**: DigitalOcean Droplet
- **IP Address**: 209.97.134.215
- **OS**: Ubuntu
- **Node.js**: v20.20.0
- **Process Manager**: PM2 (auto-start on reboot)
- **Reverse Proxy**: Nginx

### Service Ports (production behind Nginx)
| Service | Port | PM2 Name |
|---------|------|----------|
| API     | 3002 | api      |
| Frontend| 3001 | web      |
| Workers | -    | workers  |
| Redis   | 6379 | system   |

Local dev: Frontend 3000, API 3001. See docs/deployment/PORTS_AND_ROUTING.md.

### Nginx Configuration
- `/` and `/api-backend/*` → Frontend (127.0.0.1:3001)
- `/api/*` and `/health` → API (127.0.0.1:3002)

### PM2 Commands
```bash
pm2 list                    # View all services
pm2 logs                    # View all logs
pm2 logs api --lines 50     # View API logs
pm2 restart api             # Restart API
pm2 restart all             # Restart all services
pm2 save                    # Save current config
```

### Deploying Updates
```bash
ssh root@209.97.134.215
cd /root/retetionai
git pull
pnpm install
cd packages/web && pnpm build
pm2 restart all --update-env
```

## Database Schema (Key Tables)

### Core Tables
- `merchants` — Merchant accounts, guardrail_settings (merchant API key feature removed from active app paths)
- `users` — End users/customers with phone, consent, rfm_score (JSONB), segment, churn_probability
- `orders` — Order records linked to merchants and users
- `products` — Product catalog with embeddings (pgvector)
- `conversations` — Chat history (JSONB), conversation_status (ai/human/resolved), assigned_to, escalated_at
- `analytics_events` — DAU, message volume, sentiment tracking

### Enrichment Tables (Migration 009)
- `merchant_members` — Team management (owner/admin/agent/viewer roles)
- `user_preferences` — Smart send timing (optimal_send_hour, timezone, avg_response_time)
- `feedback_requests` — Review/NPS requests (type, status, rating)
- `abandoned_carts` — Cart recovery (cart_data JSONB, recovery_url, status)
- `product_recommendations` — Co-purchase recommendations (product_id, recommended_product_id, score)
- `merchant_branding` — White-label (domain, logo_url, primary_color, secondary_color)

## API Routes (Key Endpoints)

- `/api/auth` — Login, signup, session
- `/api/merchants` — Merchant CRUD, settings
- `/api/merchants/me/members` — Team management CRUD + invite
- `/api/conversations` — List, detail, reply, status change
- `/api/customers` — Customer 360 (list with pagination/segment/search, detail)
- `/api/analytics` — Dashboard metrics, ROI
- `/api/products` — Product CRUD, RAG
- `/api/whatsapp` — Webhook + message handling
- `/api/integrations/shopify` — Shopify OAuth, webhooks
- `/api/billing` — Shopify billing
- `/api/gdpr` — GDPR compliance endpoints

## BullMQ Queues

- `scheduled-messages` — T+0/3/14/25 messages, upsell
- `scrape-jobs` — Product URL scraping + embedding
- `analytics` — Async analytics event processing
- `rfm-analysis` — Daily RFM scoring (cron 0 2 * * *)
- `churn-prediction` — Weekly churn scoring (cron 0 3 * * 1)
- `product-recommendations` — Weekly co-purchase (cron 0 4 * * 2)
- `abandoned-cart` — Cart recovery WhatsApp reminders
- `feedback-request` — Review/NPS WhatsApp requests

## Environment Variables

### Backend (.env on server at /root/retetionai/.env)
```env
# Supabase
SUPABASE_URL=https://clcqmasqkfdcmznwdrbx.supabase.co
SUPABASE_ANON_KEY=<key>
SUPABASE_SERVICE_ROLE_KEY=<key>

# Database
DATABASE_URL=postgresql://postgres:<pass>@db.clcqmasqkfdcmznwdrbx.supabase.co:5432/postgres

# Redis
REDIS_URL=redis://localhost:6379

# OpenAI
OPENAI_API_KEY=<key>

# Shopify OAuth
SHOPIFY_API_KEY=<key>
SHOPIFY_API_SECRET=<key>
SHOPIFY_SCOPES=read_products,read_orders,read_customers,write_webhooks

# App Configuration (API on server: PORT=3002)
NODE_ENV=development
PORT=3002
API_URL=http://209.97.134.215
FRONTEND_URL=http://209.97.134.215
ALLOWED_ORIGINS=http://209.97.134.215,http://localhost:3000
```

### Frontend (.env.local on server at /root/retetionai/packages/web/.env.local)
```env
PORT=3001
INTERNAL_API_URL=http://127.0.0.1:3002
NEXT_PUBLIC_API_URL=http://209.97.134.215
NEXT_PUBLIC_SUPABASE_URL=https://clcqmasqkfdcmznwdrbx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<key>
```
(INTERNAL_API_URL is required so Next.js can proxy /api-backend/* to the API; avoids "Could not reach the API".)

## API Endpoints (Key)

- `GET /health` - Health check (database + Redis status)
- `GET /api/config/platform-contact` - Platform support number
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Current user
- `GET/POST/PUT/DELETE /api/integrations` - Integration CRUD
- `POST /webhooks/commerce/event` - Commerce event ingestion (manual API-key variant deprecated/disabled)
- `POST /api/import/orders/csv` - CSV order import
- `POST /webhooks/whatsapp/inbound` - WhatsApp inbound messages
- `GET /api/analytics/dashboard` - Analytics data
- `GET/PUT /api/merchant/persona` - Persona settings
- `POST /api/test/*` - Test interface endpoints

## Authentication Notes (Current)

- **Merchant/admin app auth**: Supabase JWT + Shopify session token
- **Internal service auth**: `INTERNAL_SERVICE_SECRET` via `X-Internal-Secret` (worker/internal eval/debug routes)
- **Merchant API keys**: Removed from active runtime flows (UI/auth/routes). Shopify `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` remain required for Shopify app integration.

## RAG / Eval Notes (Feb 24, 2026)

- Added multilingual cosmetics eval tooling (`run/score/judge/summarize` scripts)
- Server-side eval now runs using internal-secret auth (no merchant API key)
- Maruderm HU product set (10 products) ingested for realistic cosmetics testing
- Chunk counts verified in `knowledge_chunks`; products dashboard false `RAG not ready` issue fixed by:
  - hardening `/api/products/chunks/batch` JSON parsing
  - frontend `unknown` chunk-status fallback instead of `0 chunk`

## Key Dependencies

### Backend
- `@hono/node-server` - Hono server adapter
- `@supabase/supabase-js` - Supabase client
- `bullmq` - Queue management
- `ioredis` - Redis client
- `langchain` - LLM orchestration
- `openai` - OpenAI API client
- `puppeteer` - Web scraping
- `zod` - Schema validation

### Frontend
- `next` - Next.js framework
- `react` - React library
- `@supabase/auth-helpers-nextjs` - Supabase auth
- `tailwindcss` - CSS framework
- `recharts` - Chart library (analytics)

## External Services

| Service | Purpose | Dashboard |
|---------|---------|-----------|
| Supabase | Auth + PostgreSQL DB | https://app.supabase.com/project/clcqmasqkfdcmznwdrbx |
| OpenAI | LLM (GPT-4o, GPT-3.5) | https://platform.openai.com |
| Shopify | E-commerce integration | https://partners.shopify.com |
| Meta WhatsApp | Messaging | https://developers.facebook.com |
