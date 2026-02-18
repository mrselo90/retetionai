# Deployment Guide

## Overview

Recete Retention Agent is a monorepo application with three main services:
- **API**: Hono-based REST API server
- **Workers**: BullMQ background job processors
- **Web**: Next.js frontend application

## Prerequisites

- Node.js 20.x
- pnpm 8.x
- Docker & Docker Compose (for containerized deployment)
- PostgreSQL (Supabase or self-hosted)
- Redis

## Environment Variables

See [ENV_SETUP.md](../../ENV_SETUP.md) for complete environment variable documentation.

### Required Variables

**API:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `REDIS_URL`
- `OPENAI_API_KEY`
- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`

**Web:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL`

## Deployment Options

### Option 1: Docker Compose (Recommended for Development/Staging)

```bash
# Copy environment file
cp .env.example .env

# Edit .env with your values
nano .env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Option 2: Manual Deployment

#### 1. Install Dependencies

```bash
pnpm install --frozen-lockfile
```

#### 2. Build Packages

```bash
# Build shared package first
cd packages/shared && pnpm build && cd ../..

# Build API
cd packages/api && pnpm build && cd ../..

# Build Workers
cd packages/workers && pnpm build && cd ../..

# Build Web
cd packages/web && pnpm build && cd ../..
```

#### 3. Run Services

**API:**
```bash
cd packages/api
NODE_ENV=production node dist/index.js
```

**Workers:**
```bash
cd packages/workers
NODE_ENV=production node dist/index.js
```

**Web:**
```bash
cd packages/web
NODE_ENV=production pnpm start
```

### Option 3: Platform-Specific Deployment

#### Vercel (Web Frontend)

```bash
cd packages/web
vercel --prod
```

#### Railway (API & Workers)

1. Connect your GitHub repository
2. Set environment variables
3. Deploy automatically on push

#### Render

1. Create three services:
   - API service (Node.js)
   - Workers service (Node.js)
   - Web service (Static Site or Web Service)
2. Set environment variables
3. Deploy

## CI/CD Pipeline

The project includes a GitHub Actions workflow (`.github/workflows/ci.yml`) that:

1. **Lints and type-checks** code on every push
2. **Builds** all packages
3. **Runs tests** (if available)
4. **Deploys** to staging (on `develop` branch)
5. **Deploys** to production (on `main` branch)

### Manual Deployment Script

```bash
./scripts/deploy.sh staging
./scripts/deploy.sh production
```

## Database Migrations

Before deploying, ensure database migrations are run:

```bash
# Using Supabase CLI
supabase db push

# Or manually via SQL
psql $DATABASE_URL < supabase/migrations/001_initial_schema.sql
psql $DATABASE_URL < supabase/migrations/002_rls_policies.sql
psql $DATABASE_URL < supabase/migrations/003_api_key_rotation.sql
psql $DATABASE_URL < supabase/migrations/004_subscription_system.sql
```

## Health Checks

After deployment, verify services are running:

- **API Health**: `GET https://your-api-url/health`
- **Web**: `https://your-web-url`

## Monitoring

- **Sentry**: Error tracking (configured automatically)
- **Prometheus Metrics**: `GET /metrics` endpoint
- **Logs**: Structured JSON logs via Pino

## Rollback

If deployment fails:

1. **Docker Compose**: `docker-compose down && docker-compose up -d`
2. **Manual**: Restart services with previous version
3. **Platform**: Use platform-specific rollback features

## Troubleshooting

### API Not Starting

- Check environment variables
- Verify database connection
- Check Redis connection
- Review logs: `docker-compose logs api`

### Workers Not Processing Jobs

- Verify Redis connection
- Check queue configuration
- Review worker logs: `docker-compose logs workers`

### Web Build Fails

- Check Next.js environment variables
- Verify API URL is accessible
- Review build logs

## Security Checklist

Before production deployment:

- [ ] All environment variables set
- [ ] API keys rotated
- [ ] Database backups configured
- [ ] Rate limiting enabled
- [ ] Security headers configured
- [ ] HTTPS enabled
- [ ] CORS configured correctly
- [ ] Sentry DSN configured

## Scaling

For production scaling:

1. **Horizontal Scaling**: Run multiple API/Worker instances
2. **Load Balancing**: Use nginx or cloud load balancer
3. **Database**: Use connection pooling (PgBouncer)
4. **Redis**: Use Redis Cluster for high availability
5. **CDN**: Use Cloudflare or similar for static assets

See [SCALING.md](./SCALING.md) for detailed scaling strategies.
