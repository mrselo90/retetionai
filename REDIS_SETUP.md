# Redis Setup Guide

## Local Development

### Option 1: Docker (Recommended)

```bash
docker run -d \
  --name redis-glowguide \
  -p 6379:6379 \
  redis:7-alpine
```

### Option 2: Homebrew (macOS)

```bash
brew install redis
brew services start redis
```

### Option 3: Cloud Redis (Production)

- **Upstash Redis** (Serverless, recommended for MVP)
  - Go to [upstash.com](https://upstash.com)
  - Create Redis database
  - Copy connection URL → `REDIS_URL` in `.env`

- **Redis Cloud** (Managed)
  - Go to [redis.com/cloud](https://redis.com/cloud)
  - Create database
  - Copy connection URL → `REDIS_URL` in `.env`

## Environment Variable

Add to `.env`:

```env
REDIS_URL=redis://localhost:6379
```

For cloud Redis:
```env
REDIS_URL=rediss://default:password@host:port
```

## Verify Connection

Run workers to test:

```bash
cd packages/workers
pnpm dev
```

You should see:
```
✅ Redis connected
✅ Redis ready
🚀 GlowGuide Workers starting...
✅ 3 workers started
```

## Queue Types

1. **scheduled-messages**: T+0, T+3, T+14 messages
2. **scrape-jobs**: Product URL scraping
3. **analytics**: Async analytics processing

## Monitoring

Use BullMQ Board (optional):
```bash
npm install -g @bull-board/cli
bull-board --redis redis://localhost:6379
```
