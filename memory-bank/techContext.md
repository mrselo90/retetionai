# Technical Context

## Technology Stack

### Backend (packages/api)
- **Runtime**: Node.js (TypeScript)
- **Framework**: Hono (lightweight, edge-compatible)
- **Database**: Supabase (PostgreSQL + pgvector extension)
- **Queue**: BullMQ + Redis
- **LLM Orchestration**: LangChain.js
- **LLM Models**: 
  - GPT-4o (reasoning & complex queries)
  - GPT-3.5-Turbo (sentiment analysis & summarization - cost optimization)
- **Messaging**: WhatsApp Business API (Meta Cloud API)

### Frontend (packages/web)
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Auth**: Supabase Auth (email/password + Google OAuth)
- **State Management**: React hooks + Supabase client

### Workers (packages/workers)
- **Queue**: BullMQ (Redis-backed)
- **Jobs**: Order processing, scheduled messages, product scraping, analytics, API key expiration

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

### Service Ports
| Service | Port | PM2 Name |
|---------|------|----------|
| API     | 3000 | api      |
| Frontend| 3001 | web      |
| Workers | -    | workers  |
| Redis   | 6379 | system   |

### Nginx Configuration
- `/` → Frontend (localhost:3001)
- `/api/` → API (localhost:3000/api/)
- `/health` → API (localhost:3000/health)

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

# App Configuration
NODE_ENV=development
PORT=3000
API_URL=http://209.97.134.215
FRONTEND_URL=http://209.97.134.215
ALLOWED_ORIGINS=http://209.97.134.215,http://localhost:3001
```

### Frontend (.env.local on server at /root/retetionai/packages/web/.env.local)
```env
NEXT_PUBLIC_API_URL=http://209.97.134.215
NEXT_PUBLIC_SUPABASE_URL=https://clcqmasqkfdcmznwdrbx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<key>
```

## API Endpoints (Key)

- `GET /health` - Health check (database + Redis status)
- `GET /api/config/platform-contact` - Platform support number
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Current user
- `GET/POST/PUT/DELETE /api/integrations` - Integration CRUD
- `POST /webhooks/commerce/event` - Commerce event ingestion
- `POST /api/import/orders/csv` - CSV order import
- `POST /webhooks/whatsapp/inbound` - WhatsApp inbound messages
- `GET /api/analytics/dashboard` - Analytics data
- `GET/PUT /api/merchant/persona` - Persona settings
- `POST /api/test/*` - Test interface endpoints

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