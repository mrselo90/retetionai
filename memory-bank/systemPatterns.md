# System Patterns & Architecture

## Tech Stack

- **Backend**: Node.js (TypeScript) + Hono (lightweight framework)
- **Database**: Supabase (PostgreSQL + pgvector for vector search)
- **Queue**: BullMQ + Redis (scheduled messages, scrape jobs, analytics)
- **LLM**: GPT-4o (complex queries) + GPT-3.5-Turbo (sentiment analysis)
- **LLM Orchestration**: LangChain.js
- **Messaging**: WhatsApp Business API (Meta Cloud API)
- **Frontend**: Next.js 16 (App Router) + TypeScript + Tailwind

## Database Schema (Multi-Tenant)

### Core Tables
- `merchants`: id, name, api_keys, webhook_secret, persona_settings (JSONB). persona_settings includes: bot_name, tone, emoji, response_length, temperature, product_instructions_scope ('order_only' | 'rag_products_too'), whatsapp_sender_mode ('merchant_own' | 'corporate').
- `integrations`: id, merchant_id, provider, status, auth_type, auth_data (JSONB). provider can be 'shopify' | 'woocommerce' | 'ticimax' | 'manual' | 'whatsapp'. For provider='whatsapp', auth_data: phone_number_id, access_token, verify_token, phone_number_display (optional).
- `products`: id, merchant_id, external_id, name, url, raw_text, vector_id
- `users`: id, merchant_id, phone, name, consent_status
- `orders`: id, merchant_id, user_id, status, delivery_date
- `product_instructions`: id, merchant_id, product_id (FK products), usage_instructions (TEXT), recipe_summary, created_at, updated_at — UNIQUE(merchant_id, product_id).
- `merchant_bot_info`: id, merchant_id, key (TEXT), value (TEXT), created_at, updated_at — UNIQUE(merchant_id, key). Merchant-editable AI guidelines.

### Intelligence Tables
- `knowledge_chunks`: id, product_id, chunk_text, embedding (vector(1536))
- `conversations`: id, user_id, order_id, history (JSONB), current_state
- `analytics_events`: id, merchant_id, event_type, value, sentiment_score, created_at
- `sync_jobs`: id, merchant_id, integration_id, job_type, status, meta (JSONB)
- `external_events`: id, merchant_id, integration_id, source, event_type, payload (JSONB), idempotency_key

## Key System Flows

### 1. Product Ingestion Pipeline
1. Merchant enters product URL in admin panel
2. Scraper Service (Puppeteer) fetches and parses HTML
3. Embedding Service chunks text and sends to OpenAI Embedding API
4. Results stored in `knowledge_chunks` with merchant_id

### 2. Integration Flow (Event Normalization)
1. Platform connector or manual integration receives event
2. Event normalized to standard format (order_created, order_delivered, etc.)
3. Idempotency check (idempotency_key)
4. Order/User upsert
5. Scheduled tasks created (T+0, T+3, T+14)

### 3. Conversation Flow (RAG Pipeline)
1. WhatsApp webhook receives message
2. Intent router classifies: question / complaint / chat / opt-out
3. RAG retrieval: User's order product → vector search in knowledge_chunks
4. LLM generation: System prompt + persona + context + chat history → GPT-4o
5. Response sent via WhatsApp

### 4. Scheduled Task Execution
1. BullMQ delayed job scheduled at execute_at
2. Worker picks up job when time arrives
3. Message generated using LLM
4. Sent via WhatsApp
5. Analytics event recorded

## Security Patterns

- **Data Isolation**: Every query must include `WHERE merchant_id = X` (RLS)
- **PII Encryption**: Phone numbers encrypted at rest
- **Idempotency**: All events use idempotency_key to prevent duplicates
- **API Authentication**: X-Api-Key header + optional HMAC signature
- **Rate Limiting**: Sliding window (Redis-based) — IP: 100/min, API Key: 1000/hr
- **Security Headers**: CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- **Input Validation**: Zod schemas for all endpoints

## Integration Patterns

### Platform Connector (Native)
- Shopify: Token Exchange (embedded app) + OAuth 2.0 (fallback), webhook subscriptions (managed via shopify.app.toml)
- WooCommerce: API Key/Secret, webhook setup
- Ticimax: API token, polling or webhook

### Manual Integration
- CSV Import: Async job with validation
- HTTP API Push: POST /webhooks/commerce/event
- Webhook: Merchant publishes, Recete consumes

## Consent (GDPR/KVKK)

- **Shopify**: `normalizeShopifyEvent` reads marketing consent from order customer data; maps to `consent_status`: `subscribed` → `opt_in`, `not_subscribed` → `opt_out`, else `pending`.
- **Queue gate**: `orderProcessor` only schedules messages when `users.consent_status === 'opt_in'`.
- **orders/updated**: When order is fulfilled, event is normalized as `order_delivered`.

## Normalized Event Model

All sources map to:
- `order_created`
- `order_delivered` (critical trigger)
- `order_cancelled`
- `order_return_requested` / `order_returned`

## Deployment Architecture

```
Internet → Nginx (port 80)
  ├─→ /api/*    → API (PM2, port 3002)
  ├─→ /health   → API (PM2, port 3002)
  └─→ /*        → Frontend (PM2, port 3001)
                    ↓
              ├─→ Workers (PM2, BullMQ)
              ├─→ Redis (port 6379)
              └─→ Supabase (PostgreSQL, cloud)
```

- **Server**: DigitalOcean Droplet (209.97.134.215)
- **Process Manager**: PM2 (auto-restart, auto-start on reboot)
- **Reverse Proxy**: Nginx
- **Database**: Supabase (managed PostgreSQL)
- **Cache/Queue**: Redis (local)
