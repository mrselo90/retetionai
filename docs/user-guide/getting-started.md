# Getting Started with Recete

Welcome to Recete Retention Agent! This guide will help you get started with setting up AI-powered post-purchase customer assistance via WhatsApp.

## What is Recete?

Recete is a white-label SaaS platform that helps e-commerce merchants provide automated customer support via WhatsApp. It uses AI to answer customer questions, handle complaints, and even suggest complementary products.

## Quick Start (5 minutes)

### Step 1: Sign Up

1. Visit the Recete signup page
2. Enter your email, password, and store name
3. Check your email and confirm your account
4. You'll receive your API key (save it securely!)

### Step 2: Connect Your Store

Choose one of three integration methods:

**Option A: Shopify Integration (Recommended)**
- Click "Integrations" → "Shopify"
- Click "Connect Shopify"
- Authorize Recete in your Shopify store
- Orders will sync automatically

**Option B: CSV Import**
- Click "Integrations" → "CSV Import"
- Upload a CSV file with order data
- Format: `order_id, customer_phone, customer_name, order_date, delivery_date`

**Option C: Manual Integration (API)**
- Use your API key to send events
- POST to `/webhooks/commerce/event`
- See API documentation for details

### Step 3: Add Products

1. Go to "Products" → "Add Product"
2. Enter product name and URL
3. Click "Scrape" to extract product information
4. Click "Generate Embeddings" to enable AI responses

### Step 4: Configure WhatsApp

1. Go to "Settings" → "Integrations"
2. Add your WhatsApp Business API credentials:
   - Access Token
   - Phone Number ID
   - Verify Token
3. Configure webhook URL in Meta Business Manager

### Step 5: Customize Your Bot

1. Go to "Settings" → "Persona"
2. Adjust:
   - **Tone**: Friendly, Professional, Casual
   - **Style**: Emoji usage, response length
   - **Temperature**: Creativity level (0.0-1.0)

### Step 6: Test It!

1. Send a WhatsApp message to your business number
2. Ask a question about a product
3. The AI will respond automatically!

## Next Steps

- **View Conversations**: See all customer interactions in "Conversations"
- **Check Analytics**: Monitor performance in "Analytics"
- **Manage API Keys**: Rotate or revoke keys in "Settings"

## Need Help?

- **Documentation**: See other guides in this section
- **API Docs**: Visit `/api/docs` for API documentation
- **Support**: Contact support@recete.co.uk

---

**Congratulations!** You're now ready to provide AI-powered customer support via WhatsApp! 🎉
