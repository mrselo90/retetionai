# Project Brief: GlowGuide Retention Agent

## Project Overview

**GlowGuide Retention Agent** is a white-label SaaS platform that provides post-purchase AI assistance for e-commerce merchants. The system uses WhatsApp to deliver proactive product guidance, usage instructions, and contextual upsell recommendations to end-users, while helping merchants reduce return rates and increase LTV (Lifetime Value).

## Core Value Proposition

- **For Merchants**: Reduces return rates, increases LTV, automates customer support
- **For End-Users**: Provides product usage guidance, proactive check-ins, and personalized recommendations

## Target Market

- **Primary**: Dermokozmetik (dermocosmetics) product buyers
- **Merchants**: Mid-to-large scale cosmetic and skincare brands struggling with return rates and customer support capacity

## Key Differentiators

1. **Proactive, not reactive**: System triggers automatically when order is delivered
2. **Product-aware AI**: RAG-based system that understands specific product details
3. **Multi-platform integration**: Shopify (OAuth), WooCommerce, Ticimax, and manual options
4. **White-label SaaS**: Fully customizable persona and branding

## Success Metrics (MVP)

- **Interaction Rate**: >35% (users responding to first message)
- **Return Rate Reduction**: 10% decrease vs control group
- **Repeat Purchase Rate**: 15% increase
- **Opt-out Rate**: <3%

## Project Status

- **Phase**: ✅ Deployed & Live
- **Deployment**: DigitalOcean Droplet (209.97.134.215)
- **URL**: http://209.97.134.215
- **Process Manager**: PM2 (auto-start on reboot)
- **Reverse Proxy**: Nginx

## Repository Structure

```
retention-agent-ai/
├── packages/
│   ├── api/          # Backend API (Hono + TypeScript)
│   ├── web/          # Frontend (Next.js 16 App Router)
│   ├── workers/      # Background workers (BullMQ)
│   └── shared/       # Shared types & utilities
├── supabase/         # Database migrations
├── memory-bank/      # Project documentation
├── docs/             # Guides & API docs
└── scripts/          # Utility scripts
```

## Related Documents

- `memory-bank/techContext.md` - Technical specifications
- `memory-bank/systemPatterns.md` - Architecture & patterns
- `memory-bank/activeContext.md` - Current development focus
- `memory-bank/productContext.md` - Product modules & flows
