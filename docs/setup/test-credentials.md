# Test Credentials and Environment Setup

## Overview

This document provides test credentials and configuration for development and testing environments.

## ⚠️ Security Warning

**NEVER use these credentials in production!**

These are test credentials for development and testing only. Production environments must use real, secure credentials.

## Test Environment Variables

### Database (Local Development)

```bash
# Supabase Local
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

### Redis (Local Development)

```bash
REDIS_URL=redis://localhost:6379
```

### Security Keys (Development Only)

```bash
# Generate with: openssl rand -base64 32
JWT_SECRET=dev-jwt-secret-change-in-production-min-32-chars
ENCRYPTION_KEY=dev-encryption-key-change-in-prod-32c
```

### OpenAI (Test Mode)

```bash
# Use your own OpenAI API key for testing
# Get from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-your-test-key-here
```

### WhatsApp (Test Number)

Meta provides a test phone number for development:

```bash
# Test credentials from Meta Business Manager
WHATSAPP_ACCESS_TOKEN=your-temporary-test-token
WHATSAPP_PHONE_NUMBER_ID=your-test-phone-number-id
WHATSAPP_VERIFY_TOKEN=test-verify-token-12345
```

**Getting Test Credentials**:
1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create a test app
3. Add WhatsApp product
4. Use the provided test number and token

### Default Merchant (Testing)

```bash
DEFAULT_MERCHANT_ID=00000000-0000-0000-0000-000000000001
```

## Test Data

### Test Merchant

```sql
INSERT INTO merchants (id, business_name, email, phone, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Test Merchant',
  'test@example.com',
  '+1234567890',
  NOW()
);
```

### Test User

```sql
INSERT INTO users (id, merchant_id, phone_number, name, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  '+1234567890',
  'Test User',
  NOW()
);
```

### Test Product

```sql
INSERT INTO products (id, merchant_id, external_id, name, price, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  'TEST-PROD-001',
  'Test Product',
  29.99,
  NOW()
);
```

## API Testing

### Test API Key

Generate a test API key:

```bash
curl -X POST http://localhost:3000/api/auth/api-keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Test API Key"
  }'
```

### Test Webhook

Send a test webhook:

```bash
curl -X POST http://localhost:3000/api/webhooks/commerce/event \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_TEST_API_KEY" \
  -d '{
    "event_type": "order.created",
    "order_id": "TEST-ORDER-001",
    "customer": {
      "phone": "+1234567890",
      "name": "Test Customer"
    },
    "items": [
      {
        "product_id": "TEST-PROD-001",
        "quantity": 1,
        "price": 29.99
      }
    ],
    "total": 29.99
  }'
```

## Test Phone Numbers

### WhatsApp Test Numbers

Meta provides these test numbers for development:

- **US**: +1 555-0100 to +1 555-0199
- **UK**: +44 7700 900000 to +44 7700 900999

**Note**: These numbers can receive messages but won't send real SMS/WhatsApp messages.

### Your Own Test Number

For full testing, use your own WhatsApp number:

1. Add your number in Meta Business Manager
2. Verify the number
3. Use it for testing (messages will be sent to your phone)

## Environment Files

### .env.development

```bash
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

# Redis
REDIS_URL=redis://localhost:6379

# OpenAI
OPENAI_API_KEY=sk-proj-your-test-key-here

# Security
JWT_SECRET=dev-jwt-secret-change-in-production-min-32-chars
ENCRYPTION_KEY=dev-encryption-key-change-in-prod-32c

# WhatsApp (optional for local dev)
WHATSAPP_ACCESS_TOKEN=your-test-token
WHATSAPP_PHONE_NUMBER_ID=your-test-phone-id
WHATSAPP_VERIFY_TOKEN=test-verify-token-12345

# Default Merchant
DEFAULT_MERCHANT_ID=00000000-0000-0000-0000-000000000001
```

### .env.test

```bash
NODE_ENV=test
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres_test
REDIS_URL=redis://localhost:6379/1
OPENAI_API_KEY=sk-test-mock-key
JWT_SECRET=test-jwt-secret-min-32-characters-long
ENCRYPTION_KEY=test-encryption-key-32-chars-long
```

## Running Tests

### Unit Tests

```bash
# Run all unit tests
pnpm test:unit

# Run specific test file
pnpm test packages/api/src/lib/aiAgent.test.ts

# Run with coverage
pnpm test:coverage
```

### Integration Tests

```bash
# Run integration tests
pnpm test:integration

# Requires running database and Redis
```

### E2E Tests

```bash
# Run E2E tests
pnpm test:e2e

# Run with UI
pnpm test:e2e:ui

# Run in headed mode (see browser)
pnpm test:e2e:headed
```

## Resetting Test Data

### Reset Database

```bash
# Drop and recreate database
supabase db reset

# Or manually
psql -U postgres -c "DROP DATABASE postgres_test;"
psql -U postgres -c "CREATE DATABASE postgres_test;"

# Run migrations
pnpm db:migrate
```

### Clear Redis

```bash
# Clear all Redis data
redis-cli FLUSHALL

# Clear specific database
redis-cli -n 1 FLUSHDB
```

## Troubleshooting

### Database Connection Issues

```bash
# Check if Supabase is running
supabase status

# Start Supabase
supabase start

# Check PostgreSQL connection
psql -U postgres -h localhost -p 54322 -d postgres
```

### Redis Connection Issues

```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# Start Redis (macOS)
brew services start redis

# Start Redis (Linux)
sudo systemctl start redis
```

### API Key Issues

If API key authentication fails:

1. Check JWT_SECRET matches between environments
2. Verify API key is not expired
3. Check API key hash in database
4. Regenerate API key if needed

## Security Checklist

Before deploying to production:

- [ ] Replace all test credentials with production credentials
- [ ] Generate strong JWT_SECRET (min 32 characters)
- [ ] Generate strong ENCRYPTION_KEY (32 characters)
- [ ] Use production database with SSL
- [ ] Use production Redis with authentication
- [ ] Set up real WhatsApp Business Account
- [ ] Configure Sentry for error tracking
- [ ] Enable rate limiting
- [ ] Set up monitoring and alerts

## Resources

- [Supabase Local Development](https://supabase.com/docs/guides/cli/local-development)
- [Redis Quick Start](https://redis.io/docs/getting-started/)
- [Meta Test Credentials](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- [OpenAI API Keys](https://platform.openai.com/api-keys)
