# Frequently Asked Questions (FAQ)

## General

### What is Recete?

Recete is a white-label SaaS platform that provides AI-powered customer support via WhatsApp. It helps e-commerce merchants automate post-purchase customer assistance.

### How does it work?

1. Connect your store (Shopify, CSV, or API)
2. Add your products
3. Configure WhatsApp
4. AI automatically responds to customer messages

### What languages does it support?

Currently supports Turkish and English. More languages coming soon.

### Is there a free trial?

Yes! Sign up to get started with a free trial. See pricing for details.

---

## Setup & Integration

### How do I connect my Shopify store?

1. Go to "Integrations" → "Shopify"
2. Click "Connect Shopify"
3. Authorize Recete in Shopify
4. Done! Orders will sync automatically.

### Can I use it without Shopify?

Yes! You can:
- Import orders via CSV
- Send events via API
- Use manual integration

### How do I add products?

1. Go to "Products" → "Add Product"
2. Enter name and URL
3. Click "Scrape" to extract content
4. Click "Generate Embeddings" to enable AI

### How do I set up WhatsApp?

1. Get WhatsApp Business API credentials from Meta
2. Go to "Settings" → "Integrations"
3. Add credentials
4. Configure webhook in Meta Business Manager

---

## AI & Responses

### How accurate are AI responses?

AI responses are highly accurate when:
- Product information is complete
- Embeddings are generated
- Product is linked to customer's order

### Can I customize the AI's personality?

Yes! Go to "Settings" → "Persona" to adjust:
- Tone (Friendly, Professional, Casual)
- Style (Emoji usage, response length)
- Temperature (Creativity level)

### What if the AI gives a wrong answer?

1. Review the conversation
2. Check product information
3. Update product content if needed
4. Re-generate embeddings

### Can the AI handle complaints?

Yes! The AI is trained to:
- Apologize when appropriate
- Offer solutions
- Escalate to human if needed

---

## Conversations

### How do I view customer conversations?

Go to "Conversations" to see all customer interactions.

### Can I respond manually?

Yes! You can send manual messages via WhatsApp. The conversation will be recorded.

### What happens when a conversation escalates?

You'll be notified. Review the conversation and contact the customer directly.

### How long are conversations stored?

Conversations are stored indefinitely. You can export or delete them via GDPR tools.

---

## Billing & Plans

### How much does it cost?

See pricing page for current plans. Contact sales for enterprise pricing.

### What's included in each plan?

- **Free**: Limited messages/month
- **Pro**: Higher message limits, priority support
- **Enterprise**: Unlimited, custom features

### How is usage calculated?

Usage is based on:
- Number of messages sent
- API calls made
- Storage used

### Can I change plans?

Yes! Upgrade or downgrade anytime from "Settings" → "Billing".

---

## Technical

### What's an API key?

An API key is a secret token that allows programmatic access to Recete. Use it to send events via API.

### How do I rotate my API key?

1. Go to "Settings" → "API Keys"
2. Click "Rotate" next to a key
3. New key is created, old key has 24h grace period

### What's the rate limit?

- **IP-based**: 100 requests/minute
- **API Key**: 1000 requests/hour
- **Merchant**: 5000 requests/hour

### How do I check API status?

Visit `/health` endpoint or check status page.

---

## Troubleshooting

### Messages not being received

**Check:**
- WhatsApp webhook is configured
- Credentials are correct
- Webhook URL is accessible
- Phone number is verified

### AI not responding

**Check:**
- WhatsApp credentials are set
- Product embeddings are generated
- API status is healthy
- Rate limits not exceeded

### Integration not syncing

**Check:**
- Integration status is "Active"
- Webhooks are configured
- API key is valid
- Network connectivity

### Scraping failed

**Check:**
- Product URL is accessible
- Page doesn't require authentication
- URL is correct
- Try re-scraping

---

## Privacy & Security

### Is customer data secure?

Yes! We use:
- Encryption at rest and in transit
- Multi-tenant data isolation
- GDPR compliance
- Regular security audits

### Can customers opt out?

Yes! Customers can:
- Reply "STOP" to opt out
- Request data deletion
- Unsubscribe via settings

### Do you store phone numbers?

Yes, but they're encrypted using AES-256-GCM. Only you can decrypt them.

### Can I export customer data?

Yes! Go to "Settings" → "GDPR" → "Export Data"

---

## Support

### How do I contact support?

- **Email**: support@glowguide.ai
- **In-app**: Settings → Support
- **Documentation**: See guides in this section

### What's the response time?

- **Free Plan**: 48 hours
- **Pro Plan**: 24 hours
- **Enterprise**: 4 hours

### Do you offer training?

Yes! We offer:
- Onboarding sessions
- Webinars
- Custom training for enterprise

---

## Still Have Questions?

- **Documentation**: Browse other guides
- **API Docs**: Visit `/api/docs`
- **Support**: support@glowguide.ai
