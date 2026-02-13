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
- **Auth**: Supabase Auth (email/password + Google OAuth). OAuth callback: `/auth/callback`; merchant created on first OAuth login if missing.
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

# WhatsApp (corporate fallback when merchant has no WhatsApp integration)
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=
# Platform support number (shown in dashboard footer and Integrations banner)
PLATFORM_WHATSAPP_NUMBER=+905545736900
# Frontend (optional; defaults to +905545736900 if unset)
NEXT_PUBLIC_PLATFORM_WHATSAPP_NUMBER=

# Shopify
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=

# Shopify Perfect Match: Background jobs use integration access_token (offline token from OAuth). Shopify Admin API calls (e.g. fetchShopifyProducts) use 429 retry with backoff (Retry-After or 5s).

# App
NODE_ENV=development
API_PORT=3001

# New Relic (APM – optional; used for Kubernetes deployment)
NEW_RELIC_LICENSE_KEY=
NEW_RELIC_APP_NAME=glowguide-api
NEW_RELIC_DISTRIBUTED_TRACING_ENABLED=true
NEW_RELIC_ENABLED=true
```

## API Endpoints (Key)

- `GET /api/config/platform-contact` - Returns `{ whatsapp_number }` (platform support number; public).
- `GET/POST/PUT/DELETE /api/integrations` - CRUD; provider can be `whatsapp` (auth_data: phone_number_id, access_token, verify_token, phone_number_display); list/GET sanitize tokens for WhatsApp.
- `POST /webhooks/commerce/event` - Event ingestion
- `POST /api/import/orders/csv` - CSV import
- `POST /webhooks/whatsapp/inbound` - WhatsApp inbound
- `GET /api/analytics/dashboard` - Analytics data
- `GET/PUT /api/merchant/persona` - Persona settings
- `POST /api/test/*` - Test interface endpoints

## Kubernetes + New Relic

- **Spec**: `docs/deployment/KUBERNETES_NEWRELIC_SPEC.md`. **Runbook**: `docs/deployment/KUBERNETES_RUNBOOK.md` (deploy order, rollback, scale, logs, required secrets, troubleshooting). **Helm + Alerts**: `docs/deployment/NEWRELIC_K8S_HELM_AND_ALERTS.md` (Phase 4 Helm install, Phase 5 NRQL/alert/dashboard).
- **Manifests**: `k8s/` — namespace, ConfigMap, secrets example, api/workers/web Deployments + Services, Ingress, Redis deployment. Apply script: `scripts/k8s-apply.sh`. Local: `scripts/k8s-local.sh` (build + deploy), `scripts/k8s-create-cluster.sh` (kind/minikube). Images: Dockerfile targets api, workers, web; optional CI: `.github/workflows/build-images.yml` (build and push on tag to GHCR).
- **New Relic**: Node.js agent loaded in api and workers via `node -r newrelic dist/index.js` (Dockerfile CMD); `newrelic.cjs` in api and workers with `agent_enabled` when license key set; license key from Secret. Kubernetes integration via Helm (nri-bundle); APM auto-attach disabled (in-image agent).
- **Ingress**: NGINX Ingress Controller — install: `scripts/k8s-ingress-install.sh`. App ingress: `k8s/ingress.yaml` — `/api-backend/(.*)` → api (rewrite `/$1`), `/api`, `/webhooks`, `/health`, `/metrics`, `/` → api or web. Access: `kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 80:80` then **http://localhost**.
- **Web → API**: Browser always uses same-origin (`packages/web/lib/api.ts`: `getApiBaseUrl()` returns `''` in browser), so requests go to `/api-backend/*` (current host). Server-side: web deployment sets `NEXT_PUBLIC_API_URL=http://api:3001` for Next.js rewrites to API service.

## Deployment Strategy

### Current Options

#### Option 1: Hybrid (Recommended for MVP)
- **Backend**: Vercel (Hono edge functions) or Railway/Render
- **Frontend**: Vercel (Next.js)
- **Database**: Supabase (managed PostgreSQL)
- **Queue**: Upstash Redis (serverless) or self-hosted Redis
- **Workers**: Separate worker process (Railway/Render)
- **Maliyet**: $10-30/ay (başlangıç)

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
- **Monitoring**: Cloud Monitoring + Cloud Logging - Integrated observability
- **CI/CD**: Cloud Build - Automated deployments
- **Maliyet**: 
  - Başlangıç (0-100 kullanıcı): ~$77/ay
  - Orta (100-1000 kullanıcı): ~$345/ay
  - Büyük (1000+ kullanıcı): ~$2040/ay

### GCP Deployment Architecture

```
Internet
   ↓
Cloud Load Balancer (Global HTTPS)
   ↓
   ├─→ Cloud Run (Frontend - Next.js)
   │   • Auto-scale: 0-100 instances
   │   • 512MB RAM, 1 vCPU
   │   • Concurrency: 80
   │
   └─→ Cloud Run (API - Hono.js)
       • Auto-scale: 0-100 instances
       • 1GB RAM, 1 vCPU
       • Concurrency: 80
       ↓
       ├─→ Cloud Run (Workers - BullMQ)
       │   • Always-on: 1-10 instances
       │   • 1GB RAM, 1 vCPU
       │   • Concurrency: 1
       │
       ├─→ Cloud SQL (PostgreSQL + pgvector)
       │   • Managed database
       │   • Auto-backup (daily at 03:00)
       │   • Point-in-time recovery
       │   • Read replicas (optional)
       │
       ├─→ Memorystore (Redis)
       │   • Managed cache
       │   • High availability (standard tier)
       │   • Auto-scaling
       │
       └─→ Cloud Storage (Backups)
           • 90-day retention policy
           • Lifecycle management
```

### GCP Deployment Files

- **GCP_DEPLOYMENT_GUIDE.md** (34KB) - Comprehensive deployment guide
  - Architecture design
  - Cost analysis
  - Step-by-step setup (8 main steps)
  - Monitoring & logging
  - Scaling strategy
  - Backup & recovery
  - Troubleshooting
  - Best practices

- **cloudbuild.yaml** - Cloud Build CI/CD pipeline
  - Automated Docker build
  - Artifact Registry push
  - Cloud Run deployment
  - Database migrations

- **scripts/gcp-deploy.sh** - Automated deployment script
  - Interactive setup
  - API activation
  - Resource creation
  - Service deployment
  - Monitoring setup

### GCP Deployment Steps

1. **Prerequisites** (15 min)
   - GCP account creation
   - Billing account setup
   - gcloud CLI installation
   - Project initialization

2. **Infrastructure Setup** (1-2 hours)
   - Enable required APIs (Cloud Run, Cloud SQL, Memorystore, etc.)
   - Create Artifact Registry repository
   - Create Cloud SQL instance (PostgreSQL 15)
   - Create Memorystore Redis instance
   - Create Cloud Storage bucket
   - Setup Secret Manager secrets

3. **Docker Images** (30 min)
   - Build API image
   - Build Workers image
   - Build Web image
   - Push to Artifact Registry

4. **Cloud Run Deployment** (1 hour)
   - Deploy API service
   - Deploy Workers service
   - Deploy Web service
   - Configure service accounts
   - Setup Cloud SQL connections
   - Configure environment variables

5. **Load Balancer & Domain** (30 min)
   - Reserve static IP
   - Create serverless NEGs
   - Create backend services
   - Create URL map
   - Setup SSL certificate
   - Configure DNS

6. **Database Migrations** (15 min)
   - Run Supabase migrations
   - Verify schema
   - Test connections

7. **Monitoring & Alerts** (30 min)
   - Create monitoring dashboard
   - Setup uptime checks
   - Configure alert policies
   - Setup log-based metrics

8. **Testing & Validation** (30 min)
   - Health check endpoints
   - Load testing
   - Performance validation

### GCP Security Features

- **VPC Connector**: Private networking between services
- **Cloud Armor**: DDoS protection and rate limiting
- **IAM Roles**: Least privilege access control
- **Secret Manager**: Secure secret storage and rotation
- **Cloud SQL**: Encrypted connections, private IP
- **Memorystore**: Private network access only
- **SSL/TLS**: Managed certificates, automatic renewal

### GCP Scaling Configuration

- **API**: Min 0, Max 100 instances, 80 concurrency
- **Workers**: Min 1, Max 10 instances, 1 concurrency
- **Web**: Min 0, Max 100 instances, 80 concurrency
- **Database**: Vertical scaling (tier upgrade) + read replicas
- **Redis**: Tier upgrade (basic → standard) + size increase

### GCP Cost Optimization

- **Committed Use Discounts**: 1-3 year commitments (up to 57% discount)
- **Sustained Use Discounts**: Automatic discounts (up to 30%)
- **Preemptible Instances**: For workers (up to 80% discount)
- **Cloud CDN**: Reduces egress costs
- **Min Instances**: Set to 0 for cost savings (except workers)
- **Log Retention**: Optimize retention periods

### GCP vs Hybrid Comparison

| Feature | GCP | Hybrid (Vercel+Railway) |
|---------|-----|-------------------------|
| **Setup Complexity** | ⭐⭐⭐⭐ (Moderate) | ⭐⭐⭐⭐⭐ (Easy) |
| **Cost (Start)** | $77/ay | $10-30/ay |
| **Cost (Scale)** | $345-2040/ay | $111-350/ay |
| **Auto-scaling** | ⭐⭐⭐⭐⭐ (Excellent) | ⭐⭐⭐⭐ (Good) |
| **Global CDN** | ⭐⭐⭐⭐⭐ (Built-in) | ⭐⭐⭐⭐ (Vercel) |
| **Monitoring** | ⭐⭐⭐⭐⭐ (Integrated) | ⭐⭐⭐ (External) |
| **Security** | ⭐⭐⭐⭐⭐ (Enterprise) | ⭐⭐⭐⭐ (Good) |
| **Maintenance** | ⭐⭐⭐⭐⭐ (Minimal) | ⭐⭐⭐⭐ (Low) |
| **Learning Curve** | ⭐⭐⭐ (Moderate) | ⭐⭐⭐⭐⭐ (Easy) |

### Recommended Deployment Path

1. **MVP Phase (0-100 users)**: Hybrid (Vercel + Railway + Supabase)
   - Fast setup, low cost
   - Perfect for validation

2. **Growth Phase (100-1000 users)**: Hybrid or GCP
   - Scaling needs emerge
   - Choose based on team expertise

3. **Scale Phase (1000+ users)**: GCP (Full migration)
   - Enterprise features needed
   - Global scale requirements
   - Advanced monitoring and security