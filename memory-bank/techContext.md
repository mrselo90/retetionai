# Technical Context

## Technology Stack

### Backend
- **Runtime**: Node.js (TypeScript)
- **Framework**: Hono (lightweight, edge-compatible)
- **Database**: Supabase (PostgreSQL + pgvector extension)
- **Queue**: BullMQ + Redis
- **LLM Orchestration**: LangChain.js
- **LLM Models**: 
  - GPT-4o (reasoning & complex queries)
  - GPT-3.5-Turbo (sentiment analysis & summarization - cost optimization)
- **Messaging**: WhatsApp Business API (Twilio or BSP)

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Auth**: Supabase Auth
- **State Management**: React hooks + Supabase client

## Development Environment

- **Package Manager**: pnpm (workspace support)
- **Monorepo Structure**: 
  - `api/` - Backend API (Hono)
  - `workers/` - Background workers (BullMQ)
  - `shared/` - Shared types/utilities
  - `web/` - Frontend (Next.js)

## Key Dependencies

### Backend
- `@hono/node-server` - Hono server adapter
- `@supabase/supabase-js` - Supabase client
- `bullmq` - Queue management
- `ioredis` - Redis client
- `langchain` - LLM orchestration
- `openai` - OpenAI API client
- `puppeteer` - Web scraping
- `twilio` - WhatsApp messaging (or alternative BSP)

### Frontend
- `next` - Next.js framework
- `react` - React library
- `@supabase/auth-helpers-nextjs` - Supabase auth
- `tailwindcss` - CSS framework
- `recharts` - Chart library (for analytics)

## Environment Variables

```env
# Database
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Redis
REDIS_URL=

# OpenAI
OPENAI_API_KEY=

# WhatsApp
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
WHATSAPP_PHONE_NUMBER=

# Shopify
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=

# App
NODE_ENV=development
API_PORT=3001
```

## API Endpoints (Planned)

- `POST /webhooks/commerce/event` - Event ingestion
- `POST /api/import/orders/csv` - CSV import
- `POST /webhooks/whatsapp/inbound` - WhatsApp inbound
- `GET /api/analytics/dashboard` - Analytics data
- `GET/PUT /api/merchant/persona` - Persona settings
- `POST /api/test/*` - Test interface endpoints

## Deployment Strategy

- **Backend**: Vercel (Hono edge functions) or Railway/Render
- **Frontend**: Vercel (Next.js)
- **Database**: Supabase (managed PostgreSQL)
- **Queue**: Upstash Redis (serverless) or self-hosted Redis
- **Workers**: Separate worker process (Railway/Render)
