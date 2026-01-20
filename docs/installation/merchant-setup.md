# Merchant Setup Guide

Complete step-by-step guide for merchants to set up GlowGuide.

## Prerequisites

Before you begin, ensure you have:
- ✅ E-commerce store (Shopify, WooCommerce, or custom)
- ✅ WhatsApp Business Account (or access to Meta Business Manager)
- ✅ Admin access to your store
- ✅ Email address for account creation

## Step 1: Create Account

### 1.1 Sign Up

1. Visit GlowGuide signup page
2. Enter your information:
   - **Email**: Your business email
   - **Password**: Strong password (min 8 characters)
   - **Store Name**: Your business/store name
3. Click "Sign Up"

### 1.2 Email Confirmation

1. Check your email inbox
2. Click the confirmation link
3. You'll be redirected to GlowGuide
4. **Save your API key** (shown only once!)

**Important**: Your API key starts with `gg_live_`. Save it securely!

### 1.3 First Login

1. Go to login page
2. Enter email and password
3. Click "Login"
4. You'll see the dashboard

---

## Step 2: Connect Your Store

Choose the integration method that fits your store:

### Option A: Shopify (Recommended)

**Best for**: Shopify stores

1. Go to "Integrations" → "Shopify"
2. Click "Connect Shopify"
3. Enter your Shopify store domain (e.g., `mystore.myshopify.com`)
4. Click "Connect"
5. You'll be redirected to Shopify
6. Review permissions and click "Install app"
7. You'll be redirected back to GlowGuide
8. Integration status should show "Active" ✅

**What happens next:**
- Orders automatically sync
- Customers are added to database
- Webhooks are configured automatically

### Option B: CSV Import

**Best for**: One-time import, non-Shopify stores

1. Prepare your CSV file with this format:

```csv
order_id,customer_phone,customer_name,order_date,delivery_date,order_status
ORD-001,+905551234567,John Doe,2024-01-15,2024-01-20,delivered
ORD-002,+905559876543,Jane Smith,2024-01-16,2024-01-21,delivered
```

**Required columns:**
- `order_id`: Unique order identifier
- `customer_phone`: E.164 format (+905551234567)
- `order_date`: ISO date (YYYY-MM-DD)

**Optional columns:**
- `customer_name`: Customer full name
- `delivery_date`: When order was delivered
- `order_status`: created, delivered, cancelled, returned

2. Go to "Integrations" → "CSV Import"
3. Click "Choose File" and select your CSV
4. Click "Upload and Import"
5. Wait for processing
6. Review imported orders

### Option C: API Integration

**Best for**: Custom platforms, programmatic control

1. Get your API key from "Settings" → "API Keys"
2. Send events to `/webhooks/commerce/event` endpoint
3. See API documentation for details

**Example:**

```bash
curl -X POST https://api.glowguide.ai/webhooks/commerce/event \
  -H "X-Api-Key: gg_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "order_delivered",
    "external_order_id": "ORD-001",
    "occurred_at": "2024-01-20T10:00:00Z",
    "customer": {
      "phone": "+905551234567",
      "name": "John Doe"
    },
    "order": {
      "status": "delivered",
      "delivered_at": "2024-01-20T10:00:00Z"
    }
  }'
```

---

## Step 3: Add Products

### 3.1 Add Your First Product

1. Go to "Products" → "Add Product"
2. Enter:
   - **Product Name**: Display name (e.g., "Premium Coffee Beans")
   - **Product URL**: Link to product page
3. Click "Save"

### 3.2 Scrape Product Content

1. Click on the product you just added
2. Click "Scrape Product"
3. Wait 5-10 seconds
4. Review scraped content:
   - Title ✅
   - Description ✅
   - Usage instructions ✅
   - Images ✅

### 3.3 Generate Embeddings

1. After scraping, click "Generate Embeddings"
2. Wait 30-60 seconds
3. You'll see:
   - Number of chunks created
   - Total tokens used

**Why embeddings?** They enable the AI to answer product questions accurately.

### 3.4 Repeat for All Products

Add all your products following the same process. You can also:
- Use "Bulk Scrape" for multiple products
- Use "Bulk Generate Embeddings" for faster processing

---

## Step 4: Configure WhatsApp

### 4.1 Get WhatsApp Business API Credentials

You need:
- **Access Token**: From Meta Business Manager
- **Phone Number ID**: Your WhatsApp Business phone number ID
- **Verify Token**: Custom token for webhook verification

**How to get them:**
1. Go to [Meta Business Manager](https://business.facebook.com)
2. Create a WhatsApp Business App
3. Get your credentials from App Dashboard

### 4.2 Add Credentials to GlowGuide

1. Go to "Settings" → "Integrations"
2. Scroll to "WhatsApp Configuration"
3. Enter:
   - **Access Token**: Your Meta access token
   - **Phone Number ID**: Your phone number ID
   - **Verify Token**: Create a secure token (save it!)
4. Click "Save"

### 4.3 Configure Webhook in Meta

1. Go to Meta Business Manager → WhatsApp → Configuration
2. Set webhook URL: `https://api.glowguide.ai/webhooks/whatsapp`
3. Set verify token (same as in GlowGuide)
4. Subscribe to events:
   - `messages`
   - `message_status`
5. Save webhook

### 4.4 Test Webhook

1. Send a test message to your WhatsApp Business number
2. Check "Conversations" in GlowGuide
3. You should see the message appear

---

## Step 5: Customize Your Bot

### 5.1 Set Bot Persona

1. Go to "Settings" → "Persona"
2. Adjust settings:

**Tone:**
- Friendly: Warm, approachable
- Professional: Formal, business-like
- Casual: Relaxed, conversational

**Style:**
- Emoji Usage: None, Light, Heavy
- Response Length: Short, Medium, Long

**Temperature:**
- 0.0-0.3: Factual, precise
- 0.4-0.7: Balanced (recommended)
- 0.8-1.0: Creative, varied

3. Click "Save"
4. Preview changes in real-time

### 5.2 Test Bot Responses

1. Send a test message via WhatsApp
2. Review AI response
3. Adjust persona if needed
4. Repeat until satisfied

---

## Step 6: Test Everything

### 6.1 Test Flow

1. **Send Test Message**: Message your WhatsApp Business number
2. **Check Response**: AI should respond within 3 seconds
3. **Ask Product Question**: Ask about a product you added
4. **Verify Answer**: Check if answer is accurate
5. **Check Dashboard**: Verify conversation appears

### 6.2 Verify Integration

1. **Create Test Order**: Place a test order in your store
2. **Check Sync**: Verify order appears in GlowGuide
3. **Check Customer**: Verify customer is added
4. **Send Message**: Customer should be able to message

### 6.3 Monitor Analytics

1. Go to "Analytics"
2. Check metrics:
   - DAU (should show 1 if you tested)
   - Message volume
   - Response time
   - Sentiment

---

## Step 7: Go Live!

### 7.1 Final Checklist

Before going live, verify:
- ✅ Store integration is active
- ✅ Products are added and have embeddings
- ✅ WhatsApp is configured and tested
- ✅ Bot persona is set
- ✅ Test messages work correctly
- ✅ Webhook is receiving messages

### 7.2 Launch

1. **Announce to Customers**: Let customers know they can message you
2. **Monitor Closely**: Watch conversations for first few days
3. **Respond to Escalations**: Handle human escalations promptly
4. **Review Analytics**: Check performance daily

### 7.3 Ongoing Maintenance

**Daily:**
- Check conversations
- Review escalated conversations
- Monitor analytics

**Weekly:**
- Review common questions
- Update product info if needed
- Adjust bot persona based on feedback

**Monthly:**
- Review analytics trends
- Update product content
- Optimize based on data

---

## Troubleshooting

### "Integration Not Working"

**Solutions:**
- Check integration status
- Verify webhook URL is correct
- Reconnect if needed
- Check error logs

### "Products Not Scraping"

**Solutions:**
- Verify URL is publicly accessible
- Check if page loads in browser
- Try re-scraping
- Contact support if persists

### "WhatsApp Not Receiving Messages"

**Solutions:**
- Verify webhook is configured in Meta
- Check credentials are correct
- Test webhook URL
- Verify phone number is active

### "AI Not Responding"

**Solutions:**
- Check WhatsApp credentials
- Verify product embeddings are generated
- Check API status
- Review error logs

---

## Need Help?

- **User Guide**: See other guides in docs/user-guide/
- **API Documentation**: `/api/docs`
- **Support**: support@glowguide.ai
- **Status**: status.glowguide.ai

---

**Congratulations!** You're now ready to provide AI-powered customer support! 🎉
