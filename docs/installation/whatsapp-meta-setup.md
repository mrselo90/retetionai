# WhatsApp Meta Cloud API Setup Guide

## Overview
This guide walks you through setting up WhatsApp Business API using Meta Cloud API (recommended for production).

## Prerequisites
- Facebook Business Account
- Meta Business Manager access
- Phone number for WhatsApp Business (not currently in use)

## Step 1: Create Meta App

1. Go to [Meta for Developers](https://developers.facebook.com/apps)
2. Click **Create App**
3. Select **Business** as app type
4. Fill in app details:
   - **App Name**: Recete Retention Agent
   - **App Contact Email**: your-email@example.com
   - **Business Account**: Select your business

## Step 2: Add WhatsApp Product

1. In your app dashboard, click **Add Product**
2. Find **WhatsApp** and click **Set Up**
3. Select your **Business Portfolio**

## Step 3: Get API Credentials

### Temporary Access Token (for testing)
1. Go to **WhatsApp > API Setup**
2. Copy the **Temporary access token**
3. Copy the **Phone number ID**
4. Add to `.env`:
   ```bash
   WHATSAPP_ACCESS_TOKEN=your_temporary_token_here
   WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
   ```

### Permanent Access Token (for production)
1. Go to **WhatsApp > API Setup**
2. Click **Generate permanent token**
3. Select permissions: `whatsapp_business_messaging`
4. Copy the token and update `.env`

## Step 4: Configure Webhook

1. In **WhatsApp > Configuration**, find **Webhook**
2. Click **Edit**
3. Enter your webhook URL:
   ```
   https://your-domain.com/webhooks/whatsapp
   ```
4. Create a verify token (random string):
   ```bash
   WHATSAPP_VERIFY_TOKEN=your_random_verify_token_12345
   ```
5. Add to `.env` and click **Verify and Save**

6. Subscribe to webhook fields:
   - ✅ messages
   - ✅ message_status (optional)

## Step 5: Add Test Phone Number

1. In **WhatsApp > API Setup**, find **To** field
2. Click **Manage phone number list**
3. Add your test phone number (with country code)
4. Verify via SMS code

## Step 6: Test the Integration

### Send a Test Message

```bash
curl -X POST \
  "https://graph.facebook.com/v21.0/YOUR_PHONE_NUMBER_ID/messages" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "+905551234567",
    "type": "text",
    "text": {
      "body": "Hello from Recete! 👋"
    }
  }'
```

### Test Webhook Reception

1. Send a message to your WhatsApp Business number
2. Check your server logs for incoming webhook
3. Verify message is processed correctly

## Step 7: Production Setup

### 1. Business Verification
- Verify your business with Meta
- Required for higher message limits

### 2. Message Templates
- Create message templates in Meta Business Manager
- Required for proactive messages (T+0, T+3, T+14)

### 3. Phone Number Migration
- Move from test number to production number
- Update phone number ID in `.env`

### 4. Rate Limits
- **Tier 1** (default): 1,000 conversations/24h
- **Tier 2**: 10,000 conversations/24h (after verification)
- **Tier 3**: 100,000 conversations/24h (request from Meta)

## Environment Variables Summary

Add these to your `.env` file:

```bash
# WhatsApp Meta Cloud API
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxx
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_VERIFY_TOKEN=your_custom_verify_token_here
```

## Troubleshooting

### Error: "Invalid access token"
- Token expired (temporary tokens last 24h)
- Generate permanent token

### Error: "Webhook verification failed"
- Verify token mismatch
- Check webhook URL is accessible
- Ensure HTTPS is enabled

### Error: "Recipient phone number not valid"
- Phone must be in E.164 format: `+905551234567`
- For testing, number must be added to test list

### Messages not being received
- Check webhook subscription
- Verify webhook URL is publicly accessible
- Check server logs for errors

## Alternative: Twilio WhatsApp

If you prefer Twilio:

1. Create Twilio account
2. Get WhatsApp-enabled phone number
3. Update `.env`:
   ```bash
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token_here
   WHATSAPP_PHONE_NUMBER=+14155238886
   ```

## Next Steps

1. ✅ Configure WhatsApp credentials
2. ✅ Test message sending
3. ✅ Test webhook reception
4. ✅ Create message templates
5. ✅ Request business verification
6. ✅ Increase rate limits

## Resources

- [Meta WhatsApp Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [WhatsApp Business Platform](https://business.whatsapp.com/)
- [Message Templates Guide](https://developers.facebook.com/docs/whatsapp/message-templates)
