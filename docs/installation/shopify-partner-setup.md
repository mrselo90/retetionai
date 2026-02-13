# Shopify Partner App Setup Guide

## Overview
This guide walks you through creating a Shopify Partner account and setting up your app for marketplace submission.

## Step 1: Create Shopify Partner Account

1. Go to [Shopify Partners](https://partners.shopify.com/)
2. Click **Join now** (or **Log in** if you have an account)
3. Fill in your details:
   - Email
   - Password
   - Business name
4. Verify your email

## Step 2: Create Development Store

1. In Partner Dashboard, go to **Stores**
2. Click **Add store** > **Development store**
3. Fill in details:
   - **Store name**: glowguide-dev
   - **Store purpose**: Test an app or theme
   - **Login**: Create admin credentials
4. Click **Save**

## Step 3: Create Shopify App

1. In Partner Dashboard, go to **Apps**
2. Click **Create app**
3. Select **Public app** (for App Store)
4. Fill in app details:
   - **App name**: GlowGuide Retention Agent
   - **App URL**: `https://your-domain.com`
   - **Allowed redirection URL(s)**:
     ```
     https://your-domain.com/api/integrations/shopify/oauth/callback
     ```

## Step 4: Configure App Settings

### App Info
- **App name**: GlowGuide Retention Agent
- **Developer name**: Your Company Name
- **Support email**: support@your-domain.com
- **Privacy policy URL**: `https://your-domain.com/privacy-policy`

### App Setup
1. Go to **Configuration** tab
2. Set **App URL**: `https://your-domain.com`
3. Set **Allowed redirection URL(s)**:
   ```
   https://your-domain.com/api/integrations/shopify/oauth/callback
   ```

### API Scopes
Select the following scopes:
- ✅ `read_products` - Read product data
- ✅ `read_orders` - Read order data
- ✅ `read_customers` - Read customer data
- ✅ `write_webhooks` - Create webhooks

## Step 5: Get API Credentials

1. In your app settings, find **API credentials**
2. Copy the following:
   - **API key**: `your_shopify_api_key`
   - **API secret key**: `your_shopify_api_secret`

3. Add to `.env`:
   ```bash
   SHOPIFY_API_KEY=your_shopify_api_key
   SHOPIFY_API_SECRET=your_shopify_api_secret
   SHOPIFY_SCOPES=read_products,read_orders,read_customers,write_webhooks
   ```

## Step 6: Configure Billing

1. Go to **Billing** tab
2. Click **Set up billing**
3. Configure your pricing plans:

### Free Plan
- **Name**: Free
- **Price**: $0/month
- **Trial days**: 14
- **Features**: 100 messages/month, 1 integration

### Pro Plan
- **Name**: Pro
- **Price**: $29/month
- **Trial days**: 14
- **Features**: 5,000 messages/month, unlimited integrations

### Enterprise Plan
- **Name**: Enterprise
- **Price**: Custom pricing
- **Contact sales**: Yes

## Step 7: Set Up Webhooks

Configure webhooks to receive order events:

1. In app settings, go to **Webhooks**
2. Add webhook subscriptions:
   - **orders/create**: `https://your-domain.com/webhooks/commerce/shopify`
   - **orders/updated**: `https://your-domain.com/webhooks/commerce/shopify`
   - **orders/fulfilled**: `https://your-domain.com/webhooks/commerce/shopify`
   - **orders/cancelled**: `https://your-domain.com/webhooks/commerce/shopify`

## Step 8: Test in Development Store

1. Install your app in the development store:
   ```
   https://your-domain.com/api/integrations/shopify/oauth/start?shop=glowguide-dev.myshopify.com
   ```

2. Authorize the app
3. Verify installation in development store admin

## Step 9: Prepare for App Store Submission

### Required Assets
- [ ] App icon (512x512px)
- [ ] Screenshots (minimum 5, 1280x720px)
- [ ] Demo video (2-3 minutes)

### Required Documentation
- [ ] Privacy policy (hosted)
- [ ] Terms of service (hosted)
- [ ] Support documentation
- [ ] Installation guide

### App Listing Information
- **App name**: GlowGuide Retention Agent
- **Tagline**: AI-powered WhatsApp assistant for post-purchase customer engagement
- **Description**: (See APP_LISTING.md)
- **Pricing**: Free plan + paid plans
- **Support email**: support@your-domain.com
- **Support URL**: `https://your-domain.com/support`

## Step 10: Submit for Review

1. In Partner Dashboard, go to your app
2. Click **Submit for review**
3. Fill in submission form:
   - Test store credentials
   - Test instructions
   - Demo video
   - Screenshots
4. Click **Submit**

## Review Process

- **Initial review**: 5-7 business days
- **Re-review** (if needed): 3-5 business days
- **Approval**: 1-2 business days

## Environment Variables Summary

```bash
# Shopify OAuth (Required for marketplace)
SHOPIFY_API_KEY=your_shopify_api_key_here
SHOPIFY_API_SECRET=your_shopify_api_secret_here
SHOPIFY_SCOPES=read_products,read_orders,read_customers,write_webhooks

# App URLs
API_URL=https://your-domain.com
NEXT_PUBLIC_API_URL=https://your-domain.com
```

## Troubleshooting

### OAuth Error: "Invalid redirect_uri"
- Verify redirect URL matches exactly in app settings
- Ensure HTTPS is enabled

### Webhook Not Received
- Check webhook URL is publicly accessible
- Verify HMAC signature validation
- Check server logs

### App Not Installing
- Verify API scopes are correct
- Check app URL is accessible
- Ensure OAuth flow is implemented correctly

## Next Steps

1. ✅ Create Shopify Partner account
2. ✅ Create development store
3. ✅ Create and configure app
4. ✅ Test OAuth flow
5. ✅ Test webhook delivery
6. ✅ Prepare app store listing
7. ✅ Submit for review

## Resources

- [Shopify Partner Dashboard](https://partners.shopify.com/)
- [Shopify App Development Docs](https://shopify.dev/apps)
- [App Store Requirements](https://shopify.dev/apps/store/requirements)
- [OAuth Documentation](https://shopify.dev/apps/auth/oauth)
