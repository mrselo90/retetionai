# Testing Shopify Integration with blackeagletest.myshopify.com

## Quick Start Guide

You have a Shopify development store: **blackeagletest.myshopify.com**

This guide will help you test the Shopify integration with your development store.

## Prerequisites

Before you can test, you need Shopify API credentials. Here's how to get them:

### Option 1: Use Existing Shopify Partner App (Recommended)

If you already have a Shopify Partner app:

1. Go to [Shopify Partners Dashboard](https://partners.shopify.com/)
2. Click on **Apps** → Select your app
3. Go to **App setup** → **API credentials**
4. Copy:
   - **API key** (Client ID)
   - **API secret key** (Client secret)

### Option 2: Create New Shopify Partner App

If you don't have an app yet:

1. Go to [Shopify Partners](https://partners.shopify.com/)
2. Click **Apps** → **Create app**
3. Select **Public app**
4. Fill in:
   - **App name**: Recete Retention Agent (Dev)
   - **App URL**: `http://localhost:3000` (for testing)
   - **Allowed redirection URL(s)**:
     ```
     http://localhost:3000/api/integrations/shopify/oauth/callback
     ```
5. Save and copy the API credentials

## Step 1: Configure Environment Variables

Update your `.env` file with your Shopify credentials:

```bash
# Shopify OAuth (Required for marketplace)
SHOPIFY_API_KEY=your_actual_api_key_here
SHOPIFY_API_SECRET=your_actual_api_secret_here
SHOPIFY_SCOPES=read_products,read_orders,read_customers,write_webhooks

# Frontend URL (for OAuth callback)
FRONTEND_URL=http://localhost:3000
```

## Step 2: Restart API Server

After updating `.env`, restart the API server:

```bash
# Stop current server (Ctrl+C in the terminal)
# Then restart:
pnpm --filter api dev
```

## Step 3: Test OAuth Flow

### Method 1: Using cURL (Backend Test)

```bash
# 1. Start OAuth flow (replace YOUR_MERCHANT_ID with actual ID from database)
curl -X GET "http://localhost:3001/api/integrations/shopify/oauth/start?shop=blackeagletest.myshopify.com" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Response will include authUrl - open this in your browser
```

### Method 2: Using Frontend (Recommended)

1. Start the web app:
   ```bash
   pnpm --filter web dev
   ```

2. Open browser: `http://localhost:3000`

3. Sign up / Log in

4. Go to **Integrations** page

5. Click **Connect Shopify**

6. Enter store URL: `blackeagletest.myshopify.com`

7. You'll be redirected to Shopify to authorize the app

8. After authorization, you'll be redirected back to the app

## Step 4: Verify Integration

After successful OAuth, verify the integration:

```bash
# Get integrations for your merchant
curl -X GET "http://localhost:3001/api/integrations" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected response:
# {
#   "integrations": [
#     {
#       "id": "...",
#       "provider": "shopify",
#       "status": "active",
#       "auth_data": {
#         "shop": "blackeagletest.myshopify.com",
#         "access_token": "...",
#         "scope": "read_orders,read_fulfillments,read_products,read_customers"
#       }
#     }
#   ]
# }
```

## Step 5: Subscribe to Webhooks

After integration is active, subscribe to Shopify webhooks:

```bash
curl -X POST "http://localhost:3001/api/integrations/shopify/webhooks/subscribe" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Expected response:
# {
#   "message": "Webhook subscription completed",
#   "results": [
#     { "topic": "orders/create", "status": "created", "webhookId": "..." },
#     { "topic": "orders/fulfilled", "status": "created", "webhookId": "..." },
#     { "topic": "orders/updated", "status": "created", "webhookId": "..." }
#   ]
# }
```

## Step 6: Test Webhook Delivery

### Create a Test Order in Shopify

1. Go to your Shopify admin: `https://blackeagletest.myshopify.com/admin`

2. Go to **Orders** → **Create order**

3. Add a product, customer, and complete the order

4. Check your API server logs for incoming webhook:
   ```
   [INFO] Received Shopify webhook: orders/create
   ```

### Verify Webhook in Shopify

1. In Shopify admin, go to **Settings** → **Notifications**

2. Scroll to **Webhooks**

3. You should see 3 webhooks pointing to:
   ```
   http://localhost:3001/webhooks/commerce/shopify
   ```

## Step 7: Fetch Products from Shopify

Test fetching products from your store:

```bash
curl -X GET "http://localhost:3001/api/integrations/shopify/products?first=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected response:
# {
#   "products": [
#     {
#       "id": "gid://shopify/Product/...",
#       "title": "Product Name",
#       "handle": "product-handle",
#       "description": "...",
#       "images": [...]
#     }
#   ],
#   "hasNextPage": false,
#   "endCursor": null
# }
```

## Troubleshooting

### Error: "SHOPIFY_API_KEY is not configured"

**Solution**: Make sure you've added your Shopify API credentials to `.env` and restarted the server.

### Error: "Invalid redirect_uri"

**Solution**: 
1. Check that your redirect URI in Shopify Partner dashboard matches exactly:
   ```
   http://localhost:3000/api/integrations/shopify/oauth/callback
   ```
2. Make sure there are no trailing slashes

### Error: "Invalid HMAC signature"

**Solution**: 
1. Verify your `SHOPIFY_API_SECRET` is correct
2. Don't modify the OAuth callback URL parameters

### Webhooks Not Received

**Solution**:
1. For local testing, you need to expose your localhost to the internet
2. Use ngrok:
   ```bash
   ngrok http 3001
   ```
3. Update `API_URL` in `.env` to your ngrok URL:
   ```bash
   API_URL=https://your-ngrok-url.ngrok.io
   ```
4. Restart server and re-subscribe to webhooks

## Next Steps

After successful testing:

1. ✅ OAuth flow working
2. ✅ Webhooks subscribed
3. ✅ Products fetched
4. ✅ Test order created and webhook received

You can then:
- Import products from Shopify
- Test the full order → WhatsApp message flow
- Test AI conversation with product context

## Production Deployment

For production:

1. Update `.env.production` with production Shopify credentials
2. Update redirect URI to production URL:
   ```
   https://your-domain.com/api/integrations/shopify/oauth/callback
   ```
3. Update webhook URL to production:
   ```
   https://your-domain.com/webhooks/commerce/shopify
   ```

## Resources

- [Shopify OAuth Documentation](https://shopify.dev/apps/auth/oauth)
- [Shopify Webhooks Documentation](https://shopify.dev/apps/webhooks)
- [Shopify Admin API](https://shopify.dev/api/admin)
