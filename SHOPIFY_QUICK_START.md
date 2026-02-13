# Quick Reference: Shopify Integration with blackeagletest.myshopify.com

## Your Development Store
**Store URL**: blackeagletest.myshopify.com  
**Admin URL**: https://blackeagletest.myshopify.com/admin

## Quick Setup (3 Steps)

### 1. Get Shopify API Credentials

Go to [Shopify Partners Dashboard](https://partners.shopify.com/) and get your API credentials.

**Add to `.env`:**
```bash
SHOPIFY_API_KEY=your_api_key_here
SHOPIFY_API_SECRET=your_api_secret_here
```

### 2. Restart API Server

```bash
# Stop current server (Ctrl+C)
# Then restart:
pnpm --filter api dev
```

### 3. Test OAuth Flow

```bash
# Start web app
pnpm --filter web dev

# Open browser: http://localhost:3000
# Go to Integrations → Connect Shopify
# Enter: blackeagletest.myshopify.com
```

## Test Script

Run the interactive test script:

```bash
./scripts/test-shopify-integration.sh
```

## For Webhook Testing

Webhooks need a public URL. Use ngrok for local testing:

```bash
# Install ngrok
brew install ngrok

# Start ngrok
ngrok http 3001

# Copy the HTTPS URL and update .env:
API_URL=https://your-ngrok-url.ngrok.io

# Restart server
```

## Full Documentation

See: [`docs/testing/SHOPIFY_INTEGRATION_TEST.md`](file:///Users/sboyuk/Desktop/retention-agent-ai/docs/testing/SHOPIFY_INTEGRATION_TEST.md)
