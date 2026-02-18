# Environment Management Guide

## Overview

This guide covers environment setup and management for Recete Retention Agent across development, staging, and production.

## Environment Types

### 1. Development (Local)

**Purpose**: Local development and testing

**Characteristics**:
- Runs on `localhost`
- Uses local Supabase project
- Local Redis instance
- Debug logging enabled
- Hot reload enabled

### 2. Staging

**Purpose**: Pre-production testing

**Characteristics**:
- Separate Supabase project
- Separate Redis instance
- Production-like configuration
- Test data
- Accessible to team

### 3. Production

**Purpose**: Live application

**Characteristics**:
- Production Supabase project
- Production Redis instance
- Optimized configuration
- Real customer data
- High availability

## Environment Variables

### Development (.env)

```env
# Supabase
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Redis
REDIS_URL=redis://localhost:6379

# API
PORT=3001
NODE_ENV=development
LOG_LEVEL=debug

# Frontend
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:3001

# OpenAI
OPENAI_API_KEY=your-key

# Sentry (optional for dev)
SENTRY_DSN=
```

### Staging (.env.staging)

```env
# Supabase (Staging Project)
SUPABASE_URL=https://staging-project.supabase.co
SUPABASE_ANON_KEY=staging-anon-key
SUPABASE_SERVICE_ROLE_KEY=staging-service-key

# Redis (Staging Instance)
REDIS_URL=redis://staging-redis:6379

# API
PORT=3001
NODE_ENV=staging
LOG_LEVEL=info
ALLOWED_ORIGINS=https://staging.glowguide.ai

# Frontend
NEXT_PUBLIC_SUPABASE_URL=https://staging-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=staging-anon-key
NEXT_PUBLIC_API_URL=https://api-staging.glowguide.ai

# OpenAI
OPENAI_API_KEY=your-key

# Sentry
SENTRY_DSN=https://staging-sentry-dsn
SENTRY_ENVIRONMENT=staging
```

### Production (.env.production)

```env
# Supabase (Production Project)
SUPABASE_URL=https://production-project.supabase.co
SUPABASE_ANON_KEY=production-anon-key
SUPABASE_SERVICE_ROLE_KEY=production-service-key

# Redis (Production Instance)
REDIS_URL=redis://production-redis:6379

# API
PORT=3001
NODE_ENV=production
LOG_LEVEL=warn
ALLOWED_ORIGINS=https://app.glowguide.ai,https://glowguide.ai

# Frontend
NEXT_PUBLIC_SUPABASE_URL=https://production-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=production-anon-key
NEXT_PUBLIC_API_URL=https://api.glowguide.ai

# OpenAI
OPENAI_API_KEY=your-production-key

# Sentry
SENTRY_DSN=https://production-sentry-dsn
SENTRY_ENVIRONMENT=production

# Shopify
SHOPIFY_API_KEY=production-shopify-key
SHOPIFY_API_SECRET=production-shopify-secret

# WhatsApp
TWILIO_ACCOUNT_SID=production-account-sid
TWILIO_AUTH_TOKEN=production-auth-token
```

## Environment Setup

### Supabase Projects

#### Development

1. Create local Supabase project:
```bash
supabase init
supabase start
```

#### Staging

1. Create new Supabase project at https://supabase.com
2. Name: `glowguide-staging`
3. Copy project URL and keys
4. Run migrations:
```bash
supabase link --project-ref staging-project-ref
supabase db push
```

#### Production

1. Create new Supabase project
2. Name: `glowguide-production`
3. Copy project URL and keys
4. Run migrations:
```bash
supabase link --project-ref production-project-ref
supabase db push
```

### Redis Instances

#### Development

```bash
# Local Docker
docker run -d -p 6379:6379 redis:7-alpine
```

#### Staging

- Use Upstash Redis (serverless)
- Or managed Redis (Redis Cloud, AWS ElastiCache)

#### Production

- Use managed Redis with high availability
- Configure persistence
- Set up monitoring

## Deployment Configuration

### Vercel (Frontend)

#### Staging

```bash
vercel --env .env.staging
```

#### Production

```bash
vercel --prod --env .env.production
```

### Railway (API & Workers)

#### Staging

1. Create new Railway project
2. Add environment variables from `.env.staging`
3. Deploy from `develop` branch

#### Production

1. Create new Railway project
2. Add environment variables from `.env.production`
3. Deploy from `main` branch

### Docker Compose

#### Staging

```bash
# Use staging environment file
docker-compose --env-file .env.staging up -d
```

#### Production

```bash
# Use production environment file
docker-compose --env-file .env.production up -d
```

## Environment-Specific Features

### Development

- **Hot Reload**: Enabled
- **Debug Logging**: Full logs
- **Error Details**: Full stack traces
- **CORS**: Permissive (localhost)

### Staging

- **Hot Reload**: Disabled
- **Debug Logging**: Info level
- **Error Details**: Sanitized
- **CORS**: Restricted to staging domain
- **Rate Limiting**: Relaxed

### Production

- **Hot Reload**: Disabled
- **Debug Logging**: Warn/Error only
- **Error Details**: Sanitized
- **CORS**: Strict (production domains)
- **Rate Limiting**: Strict
- **Monitoring**: Full (Sentry, Prometheus)

## Secrets Management

### Option 1: Environment Files (Development)

```bash
# .env (gitignored)
SUPABASE_URL=...
```

### Option 2: Platform Secrets (Staging/Production)

**Vercel:**
```bash
vercel env add SUPABASE_URL
```

**Railway:**
- Use Railway dashboard to add secrets

**AWS:**
```bash
aws secretsmanager create-secret \
  --name glowguide/production/supabase-url \
  --secret-string "https://..."
```

### Option 3: Secret Management Tools

- **HashiCorp Vault**
- **AWS Secrets Manager**
- **Google Secret Manager**
- **Azure Key Vault**

## Environment Validation

### Validation Script

```typescript
// scripts/validate-env.ts
const requiredVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'REDIS_URL',
  'OPENAI_API_KEY',
];

for (const varName of requiredVars) {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
}
```

### Runtime Checks

```typescript
// packages/api/src/index.ts
if (process.env.NODE_ENV === 'production') {
  if (!process.env.SUPABASE_URL?.startsWith('https://')) {
    throw new Error('Production requires HTTPS Supabase URL');
  }
}
```

## Environment Switching

### Local Development

```bash
# Use development environment
cp .env.example .env
# Edit .env with local values
```

### Deploy to Staging

```bash
# Set staging environment
export NODE_ENV=staging
# Or use .env.staging
```

### Deploy to Production

```bash
# Set production environment
export NODE_ENV=production
# Or use .env.production
```

## Monitoring Per Environment

### Sentry

```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV, // development, staging, production
});
```

### Logging

```typescript
logger.info({
  environment: process.env.NODE_ENV,
  // ... other context
});
```

## Checklist

### Development
- [ ] Local Supabase running
- [ ] Local Redis running
- [ ] `.env` file configured
- [ ] Hot reload working
- [ ] Debug logging enabled

### Staging
- [ ] Staging Supabase project created
- [ ] Staging Redis instance created
- [ ] Staging domain configured
- [ ] Environment variables set
- [ ] Migrations applied
- [ ] Test data seeded
- [ ] Monitoring configured

### Production
- [ ] Production Supabase project created
- [ ] Production Redis instance created
- [ ] Production domains configured
- [ ] SSL certificates installed
- [ ] Environment variables set
- [ ] Migrations applied
- [ ] Monitoring configured
- [ ] Backup strategy in place
- [ ] Disaster recovery plan ready

## Best Practices

1. **Never commit secrets**: Use `.env.example` as template
2. **Separate projects**: One Supabase/Redis per environment
3. **Version control**: Track `.env.example` but not `.env`
4. **Rotation**: Rotate secrets regularly
5. **Validation**: Validate environment on startup
6. **Documentation**: Document all required variables

## Resources

- [12-Factor App: Config](https://12factor.net/config)
- [Environment Variables Best Practices](https://www.twilio.com/blog/environment-variables-python)
