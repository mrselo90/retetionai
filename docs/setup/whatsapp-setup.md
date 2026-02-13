# WhatsApp Business API Setup Guide

## Overview

This guide explains how to set up WhatsApp Business API integration for the GlowGuide Retention Agent.

## Prerequisites

- Meta Business Account
- WhatsApp Business Account
- Verified phone number

## Setup Steps

### 1. Create a Meta App

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Click "My Apps" → "Create App"
3. Select "Business" as the app type
4. Fill in app details:
   - App Name: "GlowGuide Retention Agent"
   - Contact Email: your-email@example.com
   - Business Account: Select your business account

### 2. Add WhatsApp Product

1. In your app dashboard, click "Add Product"
2. Find "WhatsApp" and click "Set Up"
3. Follow the setup wizard to:
   - Select or create a WhatsApp Business Account
   - Add a phone number (or use test number)
   - Verify your business

### 3. Get API Credentials

#### Access Token

1. Go to WhatsApp → Getting Started
2. Under "Temporary access token", copy the token
3. **Note**: This is temporary. For production, generate a permanent token:
   - Go to Business Settings → System Users
   - Create a system user
   - Generate a token with `whatsapp_business_messaging` permission

#### Phone Number ID

1. In WhatsApp → Getting Started
2. Find "Phone number ID" under your test number
3. Copy this ID

#### Verify Token

1. Create a random string for webhook verification
2. Use a secure random generator:
   ```bash
   openssl rand -base64 32
   ```

### 4. Configure Environment Variables

Add to your `.env` file:

```bash
WHATSAPP_ACCESS_TOKEN=your-access-token-here
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id-here
WHATSAPP_VERIFY_TOKEN=your-verify-token-here
```

### 5. Set Up Webhooks

1. In WhatsApp → Configuration
2. Click "Edit" next to Webhook
3. Enter your webhook URL:
   ```
   https://your-domain.com/api/webhooks/whatsapp
   ```
4. Enter your verify token (from step 3)
5. Click "Verify and Save"
6. Subscribe to webhook fields:
   - `messages` (required)
   - `message_status` (optional, for delivery status)

### 6. Test the Integration

1. Send a test message to your WhatsApp number
2. Check application logs for incoming webhook
3. Verify response is sent back

## Production Checklist

- [ ] Generate permanent access token (system user)
- [ ] Verify business (required for production)
- [ ] Add payment method (for message pricing)
- [ ] Configure message templates (for proactive messages)
- [ ] Set up webhook URL with HTTPS
- [ ] Test webhook verification
- [ ] Test message sending and receiving
- [ ] Monitor rate limits and quotas

## Rate Limits

- **Tier 1** (default): 1,000 messages per 24 hours
- **Tier 2**: 10,000 messages per 24 hours
- **Tier 3**: 100,000 messages per 24 hours
- **Tier 4**: Unlimited

Tier upgrades are automatic based on message quality and volume.

## Message Templates

For proactive messages (outside 24-hour window), you need approved templates:

1. Go to WhatsApp → Message Templates
2. Create templates for:
   - Welcome messages
   - Order confirmations
   - Delivery updates
   - Post-purchase check-ins
3. Submit for approval (usually 1-2 business days)

## Troubleshooting

### Webhook Not Receiving Messages

- Verify webhook URL is publicly accessible
- Check verify token matches
- Ensure webhook fields are subscribed
- Check application logs for errors

### Messages Not Sending

- Verify access token is valid
- Check phone number ID is correct
- Ensure phone number is verified
- Check rate limits haven't been exceeded

### "This message type is not supported"

- Only text messages are supported in current implementation
- Media messages require additional handling

## Resources

- [WhatsApp Business Platform Documentation](https://developers.facebook.com/docs/whatsapp)
- [Cloud API Quick Start](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- [Webhook Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks)
- [Message Templates](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates)

## Support

For issues with WhatsApp Business API:
- [Meta Business Help Center](https://www.facebook.com/business/help)
- [Developer Community](https://developers.facebook.com/community/)
