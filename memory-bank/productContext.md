# Product Context: Recete Retention Agent

## Product Modules

### Modül A: End-User Experience (WhatsApp Bot)
1. **Event-Based Triggering**: Automatic "welcome" message when order status changes to "delivered"
2. **Smart Onboarding**: Product-specific, step-by-step first-use guide (RAG-based)
3. **Proactive Check-in**: Template-based (default: T+3 and T+14 days, optional T+25)
4. **Contextual Upsell**: Complementary product recommendations when product is near end or satisfaction confirmed

### Modül B: Merchant Admin Panel (SaaS Dashboard)
1. **Integration Hub**: Manage Shopify/WooCommerce/Ticimax connections + manual integration options
2. **Knowledge Base**: URL scraper + manual content override
3. **Persona Tuner**: Visual sliders for brand voice customization
4. **Analytics Dashboard**: All KPIs in one place

### Modül C: Integrations
- **Platform Connectors**: Shopify (OAuth), WooCommerce (API Key), Ticimax (API Token)
- **Manual Options**: CSV/Excel import, HTTP API push, Webhook

### Modül D: Test & Development Interface
- Mock event simulator, WhatsApp message simulator, RAG pipeline tester, scheduled task management, system health monitoring

## Key User Flows

### Merchant Onboarding
1. Sign up → Choose plan → Connect platform (Shopify/Woo/Ticimax) or manual setup
2. Field mapping → Test event → Backfill (optional) → Go live
3. Add products (URL scraper) → Configure persona → Monitor analytics

### End-User Journey
1. Order delivered → T+0: Welcome message + product guide
2. T+3: Check-in ("Are you using it? Any issues?")
3. T+14: Follow-up check-in
4. Product near end → Upsell recommendation
5. User can opt-out anytime ("DUR" command)

## Edge Cases & Guardrails

- **No delivery info**: Onboarding doesn't trigger until delivery confirmed
- **Invalid phone**: Message not sent, appears in "Action Required" queue
- **Opt-out**: All automation stops immediately
- **Return/Cancel**: Flow stops, scheduled tasks cancelled
- **Crisis keywords**: "Yanık", "Acı", "Dava", "Şikayet" → Human escalation
- **Medical advice**: Bot never provides medical prescriptions or diagnoses

## Pricing Tiers

- **Starter**: 1 integration, 2K MAU/month, 20K messages/month
- **Growth**: 2 integrations, 10K MAU/month, 120K messages/month
- **Enterprise**: Unlimited integrations, custom limits, SLA
