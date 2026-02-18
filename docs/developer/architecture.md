# Architecture Overview

Technical architecture and design decisions for Recete Retention Agent.

## System Architecture

### High-Level Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│     API      │────▶│  Database   │
│  (Next.js)  │     │   (Hono)     │     │ (Supabase)  │
└─────────────┘     └─────────────┘     └─────────────┘
                            │
                            ▼
                    ┌─────────────┐
                    │   Workers    │
                    │  (BullMQ)    │
                    └─────────────┘
                            │
                            ▼
                    ┌─────────────┐
                    │    Redis     │
                    │   (Queue)    │
                    └─────────────┘
```

## Monorepo Structure

```
retention-agent-ai/
├── packages/
│   ├── api/          # Backend API (Hono)
│   ├── web/          # Frontend (Next.js)
│   ├── workers/      # Background workers (BullMQ)
│   └── shared/       # Shared utilities
├── supabase/          # Database migrations
└── docs/              # Documentation
```

## Technology Stack

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Hono (lightweight, edge-compatible)
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL + pgvector)
- **Queue**: BullMQ + Redis
- **LLM**: OpenAI (GPT-4o, GPT-3.5-Turbo)
- **Messaging**: WhatsApp Business API (Meta)

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Auth**: Supabase Auth
- **State**: React hooks

### Infrastructure
- **Database**: Supabase Cloud
- **Cache/Queue**: Redis (Upstash or self-hosted)
- **Monitoring**: Sentry
- **Logging**: Pino
- **Metrics**: Prometheus

## Data Flow

### 1. Order Event Flow

```
Store (Shopify/CSV/API)
    ↓
Webhook Receiver (/webhooks/commerce/*)
    ↓
Event Normalization
    ↓
External Events Table
    ↓
Order Processor Worker
    ↓
Users & Orders Tables
    ↓
Message Scheduler
    ↓
Scheduled Messages Queue
```

### 2. WhatsApp Message Flow

```
Customer WhatsApp Message
    ↓
Meta Webhook (/webhooks/whatsapp)
    ↓
Message Parser
    ↓
Conversation Manager
    ↓
AI Agent (Intent + RAG)
    ↓
Guardrails Check
    ↓
Response Generator
    ↓
WhatsApp API
    ↓
Customer Receives Response
```

### 3. RAG Query Flow

```
Customer Question
    ↓
Intent Classification
    ↓
RAG Query (if question)
    ↓
Embedding Generation (query)
    ↓
Vector Search (pgvector)
    ↓
Knowledge Chunks Retrieved
    ↓
Context Formatting
    ↓
LLM Generation (with context)
    ↓
Response
```

## Database Schema

### Core Tables

- **merchants**: Merchant accounts
- **users**: Customer records (encrypted phone)
- **orders**: Order records
- **products**: Product catalog
- **knowledge_chunks**: Product embeddings (pgvector)
- **conversations**: Chat sessions
- **messages**: Individual messages
- **integrations**: Store integrations
- **external_events**: Incoming events
- **scheduled_tasks**: Message scheduling

### Multi-Tenancy

- **Row-Level Security (RLS)**: All tables use RLS policies
- **Merchant Isolation**: Data filtered by `merchant_id`
- **Encryption**: Phone numbers encrypted (AES-256-GCM)

## Queue System

### Queues

1. **scheduled-messages**: Post-delivery messages (T+3, T+14)
2. **scrape-jobs**: Product scraping tasks
3. **analytics**: Analytics event processing
4. **api-key-expiration**: Daily cleanup job

### Workers

- **Scheduled Messages Worker**: Sends WhatsApp messages
- **Scrape Jobs Worker**: Scrapes product pages
- **Analytics Worker**: Processes analytics events
- **API Key Expiration Worker**: Cleans expired keys

## Security

### Authentication

- **JWT**: For web app users (Supabase Auth)
- **API Keys**: For programmatic access (SHA-256 hashed)

### Data Protection

- **Encryption**: Phone numbers (AES-256-GCM)
- **Hashing**: API keys (SHA-256)
- **RLS**: Database-level isolation
- **Rate Limiting**: Per IP, API key, merchant

### Compliance

- **GDPR**: Data export, deletion, consent
- **Security Headers**: CSP, HSTS, etc.
- **Input Validation**: Zod schemas

## API Design

### RESTful Endpoints

- `/api/auth/*` - Authentication
- `/api/merchants/*` - Merchant management
- `/api/products/*` - Product CRUD
- `/api/integrations/*` - Integration management
- `/api/conversations/*` - Conversation viewing
- `/api/analytics/*` - Analytics data
- `/webhooks/*` - Webhook receivers

### Authentication

- **Bearer Token**: `Authorization: Bearer <jwt>`
- **API Key**: `X-Api-Key: gg_live_<key>`

### Rate Limiting

- **IP**: 100 req/min
- **API Key**: 1000 req/hour
- **Merchant**: 5000 req/hour

## Monitoring & Observability

### Logging

- **Structured Logging**: Pino (JSON format)
- **Correlation IDs**: Per request
- **Log Levels**: debug, info, warn, error

### Metrics

- **Prometheus**: HTTP, DB, Queue metrics
- **Endpoint**: `/metrics`
- **Dashboards**: Grafana (optional)

### Error Tracking

- **Sentry**: Frontend + Backend
- **Performance**: Transaction tracing
- **Alerts**: Error rate, performance

## Deployment

### Environments

- **Development**: Local (localhost)
- **Staging**: Staging server
- **Production**: Production server

### Process Management

- **API**: PM2 or systemd
- **Workers**: PM2 or systemd
- **Frontend**: Vercel or similar

### Environment Variables

See `.env.example` for required variables:
- Database (Supabase)
- Redis
- OpenAI API
- WhatsApp credentials
- Sentry DSN

## Development Workflow

### Local Setup

1. Clone repository
2. Install dependencies: `pnpm install`
3. Set up environment variables
4. Run migrations: See `supabase/RUN_MIGRATIONS.md`
5. Start services:
   - API: `pnpm --filter @glowguide/api dev`
   - Workers: `pnpm --filter @glowguide/workers dev`
   - Web: `pnpm --filter @glowguide/web dev`

### Code Structure

- **Routes**: `packages/api/src/routes/`
- **Middleware**: `packages/api/src/middleware/`
- **Lib**: `packages/api/src/lib/`
- **Schemas**: `packages/api/src/schemas/`
- **Types**: `packages/api/src/types/`

### Testing

- **Unit Tests**: Vitest (planned)
- **Integration Tests**: API endpoints (planned)
- **E2E Tests**: Playwright (planned)

## Performance Considerations

### Database

- **Indexes**: On frequently queried columns
- **pgvector**: For similarity search
- **Connection Pooling**: Via Supabase

### Caching

- **Redis**: Queue and rate limiting
- **Future**: Response caching

### Optimization

- **Batch Processing**: For embeddings
- **Async Processing**: Via queues
- **Connection Reuse**: HTTP keep-alive

## Future Enhancements

### Planned Features

- Multi-language support
- Advanced analytics
- Custom webhooks
- White-label customization
- Mobile app

### Scalability

- Horizontal scaling (API, Workers)
- Database read replicas
- CDN for static assets
- Load balancing

---

## Related Documentation

- **Technical Architecture**: `02_technical_architecture.md`
- **Product Requirements**: `01_product_requirements.md`
- **API Documentation**: `/api/docs`
- **Database Schema**: `supabase/migrations/`
