# System Patterns & Architecture

## Tech Stack

- **Backend**: Node.js (TypeScript) + Hono (lightweight framework)
- **Database**: Supabase (PostgreSQL + pgvector for vector search)
- **Queue**: BullMQ + Redis (scheduled messages, scrape jobs, analytics)
- **LLM**: GPT-4o (complex queries) + GPT-3.5-Turbo (sentiment analysis)
- **LLM Orchestration**: LangChain.js
- **Messaging**: WhatsApp Business API (Twilio or BSP)
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind

## Database Schema (Multi-Tenant)

### Core Tables
- `merchants`: id, name, api_keys, webhook_secret, persona_settings (JSONB). persona_settings includes: bot_name, tone, emoji, response_length, temperature, product_instructions_scope ('order_only' | 'rag_products_too'), whatsapp_sender_mode ('merchant_own' | 'corporate').
- `integrations`: id, merchant_id, provider, status, auth_type, auth_data (JSONB). provider can be 'shopify' | 'woocommerce' | 'ticimax' | 'manual' | 'whatsapp'. For provider='whatsapp', auth_data: phone_number_id, access_token, verify_token, phone_number_display (optional). getWhatsAppCredentials(merchantId) reads from this table first (provider=whatsapp, status in active/pending), then falls back to env (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN).
- `products`: id, merchant_id, external_id, name, url, raw_text, vector_id
- `users`: id, merchant_id, phone, name, consent_status
- `orders`: id, merchant_id, user_id, status, delivery_date
- `product_instructions`: id, merchant_id, product_id (FK products), usage_instructions (TEXT), recipe_summary, created_at, updated_at — UNIQUE(merchant_id, product_id). Used for T+0 beauty-consultant prompt and for RAG when answering customer questions (Shopify Perfect Match).
- `merchant_bot_info`: id, merchant_id, key (TEXT), value (TEXT), created_at, updated_at — UNIQUE(merchant_id, key). Merchant-editable AI guidelines: brand_guidelines, bot_boundaries, recipe_overview, custom_instructions. Injected into AI system prompt for customer Q&A.

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

## Integration Patterns

### Platform Connector (Native)
- Shopify: OAuth 2.0 flow, webhook subscriptions
- WooCommerce: API Key/Secret, webhook setup
- Ticimax: API token, polling or webhook

### Manual Integration
- CSV Import: Async job with validation
- HTTP API Push: POST /webhooks/commerce/event
- Webhook: Merchant publishes, GlowGuide consumes

## Deployment Patterns

### Cloud Deployment Options

#### Option 1: Hybrid (Recommended for MVP)
- **Frontend**: Vercel (Next.js) - $0-20/ay
- **Backend API**: Railway - $5-20/ay
- **Workers**: Railway - $5-15/ay
- **Database**: Supabase - $0-25/ay
- **Redis**: Upstash - $0-10/ay
- **Total**: $10-90/ay (başlangıç: $10-30/ay)
- **Pros**: Fast setup, low cost, easy management
- **Cons**: Multiple platforms, less integrated monitoring

#### Option 2: GCP (Recommended for Scale)
- **Frontend**: Cloud Run (Next.js) - Auto-scale 0-100 instances
- **Backend API**: Cloud Run (Hono.js) - Auto-scale 0-100 instances
- **Workers**: Cloud Run (BullMQ) - Always-on 1-10 instances
- **Database**: Cloud SQL (PostgreSQL + pgvector) - Managed, auto-backup
- **Cache**: Memorystore (Redis) - Managed, high availability
- **Storage**: Cloud Storage (Backups) - 90-day retention
- **CDN**: Cloud CDN - Global content delivery
- **Load Balancer**: Cloud Load Balancing - Global HTTPS
- **Secrets**: Secret Manager - Secure secret storage
- **Monitoring**: Cloud Monitoring + Cloud Logging - Integrated
- **CI/CD**: Cloud Build - Automated deployments
- **Total**: 
  - Başlangıç (0-100 kullanıcı): ~$77/ay
  - Orta (100-1000 kullanıcı): ~$345/ay
  - Büyük (1000+ kullanıcı): ~$2040/ay
- **Pros**: Enterprise-grade, integrated services, global scale, minimal maintenance
- **Cons**: Higher cost initially, steeper learning curve

### GCP Architecture Pattern

```
Internet → Cloud Load Balancer (Global HTTPS)
  ├─→ Cloud Run (Frontend) - 0-100 instances, 512MB RAM
  └─→ Cloud Run (API) - 0-100 instances, 1GB RAM
      ├─→ Cloud Run (Workers) - 1-10 instances, 1GB RAM
      ├─→ Cloud SQL (PostgreSQL + pgvector) - Managed
      ├─→ Memorystore (Redis) - Managed, HA
      └─→ Cloud Storage (Backups) - 90-day retention
```

### Deployment Automation Pattern

1. **GitHub Push** → Triggers GitHub Actions workflow
2. **Cloud Build** → Builds Docker images
3. **Artifact Registry** → Stores images
4. **Cloud Run** → Deploys services automatically
5. **Database Migrations** → Runs via Cloud Build step
6. **Health Checks** → Validates deployment
7. **Monitoring** → Updates dashboards

### Scaling Pattern

- **Horizontal Scaling**: Cloud Run auto-scales based on traffic (0-1000+ instances)
- **Vertical Scaling**: Cloud SQL tier upgrades (db-f1-micro → db-n1-standard-4)
- **Read Replicas**: Cloud SQL read replicas for read-heavy workloads
- **Redis Scaling**: Memorystore tier upgrade (basic → standard) + size increase
- **CDN**: Cloud CDN for static assets and API responses

### Security Pattern

- **VPC Connector**: Private networking between services
- **Cloud Armor**: DDoS protection and rate limiting
- **IAM Roles**: Least privilege access control
- **Secret Manager**: Secure secret storage and rotation
- **Cloud SQL**: Encrypted connections, private IP
- **Memorystore**: Private network access only
- **SSL/TLS**: Managed certificates, automatic renewal

## Consent (GDPR/KVKK)

- **Shopify**: `normalizeShopifyEvent` reads `order.customer.email_marketing_consent.state` and `order.customer.sms_marketing_consent.state`; maps to `consent_status`: `subscribed` → `opt_in`, `not_subscribed` → `opt_out`, else `pending`.
- **Queue gate**: `orderProcessor` only calls `scheduleOrderMessages` and queues T+0 welcome when `users.consent_status === 'opt_in'`.
- **orders/updated**: When topic is `orders/updated` and order is fulfilled (`fulfillment_status === 'fulfilled'` or fulfillments success), event is normalized as `order_delivered` with `delivered_at`.

## Normalized Event Model

All sources map to:
- `order_created`
- `order_delivered` (critical trigger)
- `order_cancelled`
- `order_return_requested` / `order_returned`

Minimum payload:
```json
{
  "merchant_id": "m_123",
  "external_order_id": "SHP-100045",
  "event_type": "order_delivered",
  "occurred_at": "2026-01-19T10:12:00Z",
  "customer": { "phone": "+905551112233", "name": "Ayşe" },
  "order": { "status": "delivered", "delivered_at": "2026-01-19T10:12:00Z" },
  "items": [{ "external_product_id": "p_987", "name": "C Vitamini Serum", "url": "..." }]
}
```
