# Recete Retention Agent

White-label SaaS platform for post-purchase AI assistance via WhatsApp.

## 🎯 Project Status

**Current Phase**: MVP Complete → Production Ready  
**Marketplace Readiness**: 40% (43 tasks remaining)  
**Target Launch**: March 2026 (Shopify App Store)

### What's Complete ✅
- ✅ Full MVP with all core features
- ✅ Modern, polished UI/UX
- ✅ Shopify OAuth integration
- ✅ WhatsApp messaging
- ✅ AI agent with RAG pipeline
- ✅ Analytics dashboard
- ✅ Multi-tenant architecture

### What's Next 🚀
- ⏳ Security & Compliance (GDPR, rate limiting)
- ⏳ Testing (70% coverage target)
- ⏳ Monitoring & Observability
- ⏳ API Documentation
- ⏳ Billing & Subscription system
- ⏳ Shopify App Store integration

---

## 📋 Quick Links

### For Development
- **[Getting Started (Marketplace Ready)](GETTING_STARTED_MARKETPLACE.md)** - Start here!
- **[Marketplace Readiness Assessment](MARKETPLACE_READINESS_ASSESSMENT.md)** - What's missing and why
- **[Tasks (Marketplace Ready)](memory-bank/tasks-marketplace-ready.md)** - Complete task list (43 tasks)
- **[Roadmap to Marketplace](memory-bank/roadmap-to-marketplace.md)** - 10-week timeline

### For Running the App
- **[Running the Application](RUNNING_APP.md)** - How to run locally
- **[Environment Setup](ENV_SETUP.md)** - Environment variables
- **[Supabase Setup](supabase/README.md)** - Database setup
- **[Redis Setup](REDIS_SETUP.md)** - Queue setup

### For Understanding the Project
- **[Product Requirements](01_product_requirements.md)** - What we're building
- **[Technical Architecture](02_technical_architecture.md)** - How it works
- **[UX Design Guidelines](03_ux_design_guidelines.md)** - Design principles

---

## 🏗️ Project Structure

This is a pnpm monorepo with the following packages:

```
retention-agent-ai/
├── packages/
│   ├── api/          # Backend API (Hono framework)
│   ├── workers/      # Background workers (BullMQ)
│   ├── shared/       # Shared types and utilities
│   └── web/          # Frontend (Next.js 14)
├── supabase/         # Database migrations
├── memory-bank/      # Development tracking
└── docs/             # Documentation
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- PostgreSQL (via Supabase)
- Redis
- OpenAI API key
- WhatsApp Business API credentials

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Run database migrations
cd supabase
supabase db push

# Build shared package
pnpm --filter @glowguide/shared build
```

### Development

```bash
# Terminal 1: Start API server (port 3001)
pnpm --filter api dev

# Terminal 2: Start workers
pnpm --filter workers dev

# Terminal 3: Start frontend (port 3000)
pnpm --filter web dev
```

### Production Mode

```bash
# Build all packages
pnpm build

# Start API
pnpm --filter api start

# Start workers
pnpm --filter workers start

# Start frontend
pnpm --filter web start
```

---

## 📚 Documentation

### Product & Design
- `01_product_requirements.md` - Product Requirements Document
- `02_technical_architecture.md` - Technical Architecture
- `03_ux_design_guidelines.md` - UX/UI Guidelines
- `04_development_tasks.md` - Original Development Task List

### Development
- `memory-bank/tasks.md` - MVP task tracking (COMPLETED)
- `memory-bank/tasks-marketplace-ready.md` - Marketplace readiness tasks (IN PROGRESS)
- `memory-bank/progress.md` - Development progress
- `memory-bank/activeContext.md` - Current development context

### Setup & Deployment
- `ENV_SETUP.md` - Environment variables guide
- `RUNNING_APP.md` - How to run the application
- `REDIS_SETUP.md` - Redis configuration
- `supabase/README.md` - Database setup
- `SUPABASE_EMAIL_SETUP.md` - Email configuration
- `SUPABASE_EMAIL_CONFIRMATION.md` - Email confirmation setup

### Marketplace Readiness
- `MARKETPLACE_READINESS_ASSESSMENT.md` - Gap analysis
- `GETTING_STARTED_MARKETPLACE.md` - Implementation guide
- `memory-bank/roadmap-to-marketplace.md` - Timeline & milestones

---

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run E2E tests
pnpm test:e2e
```

**Note**: Testing infrastructure is being set up as part of marketplace readiness (Week 3-4).

---

## 🔒 Security

- Multi-tenant data isolation (RLS policies)
- Phone number encryption (AES-256-GCM)
- API key hashing (SHA-256)
- JWT authentication
- HMAC webhook verification
- Rate limiting (in progress)
- GDPR compliance (in progress)

---

## 📊 Tech Stack

### Backend
- **Runtime**: Node.js (TypeScript)
- **Framework**: Hono (lightweight, edge-compatible)
- **Database**: Supabase (PostgreSQL + pgvector)
- **Queue**: BullMQ + Redis
- **LLM**: OpenAI (GPT-4o, GPT-3.5-Turbo)
- **Messaging**: WhatsApp Business API

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Auth**: Supabase Auth
- **State**: React hooks

### Infrastructure
- **Hosting**: TBD (Vercel, Railway, or AWS)
- **Database**: Supabase Cloud
- **Cache/Queue**: Upstash Redis
- **Monitoring**: Sentry (in progress)
- **Logging**: Pino (in progress)

---

## 🗺️ Roadmap

### Phase 1: Security & Compliance (Week 1-2) ⏳
- Rate limiting
- CORS configuration
- Security headers
- GDPR compliance
- Error tracking (Sentry)

### Phase 2: Testing & Quality (Week 2-4) ⏳
- Test infrastructure
- Unit tests (70% coverage)
- Integration tests
- E2E tests
- CI/CD pipeline

### Phase 3: Monitoring & Observability (Week 3-5) ⏳
- Structured logging
- Application metrics
- Uptime monitoring
- Performance monitoring

### Phase 4: Documentation (Week 4-6) ⏳
- API documentation (OpenAPI/Swagger)
- User guide
- Installation guide
- Developer documentation

### Phase 5: Billing & Subscription (Week 5-7) ⏳
- Subscription system (Stripe/Shopify Billing)
- Usage tracking
- Plan limits enforcement
- Billing dashboard

### Phase 6: Shopify App Store (Week 6-8) ⏳
- App Bridge integration
- Shopify Billing API
- App store listing
- App review submission

See `memory-bank/roadmap-to-marketplace.md` for detailed timeline.

---

## 🤝 Contributing

This is a private project. For development guidelines, see:
- `GETTING_STARTED_MARKETPLACE.md` - Implementation guide
- `memory-bank/tasks-marketplace-ready.md` - Task list

---

## 📝 License

Private - All rights reserved

---

## 📞 Support

For questions or issues:
- Email: support@glowguide.ai (coming soon)
- Documentation: See `/docs` folder
- Issues: Track in `memory-bank/` files

---

## 🎉 Acknowledgments

Built with:
- [Hono](https://hono.dev/) - Web framework
- [Supabase](https://supabase.com/) - Database & Auth
- [Next.js](https://nextjs.org/) - Frontend framework
- [OpenAI](https://openai.com/) - AI/LLM
- [BullMQ](https://docs.bullmq.io/) - Queue management

---

**Current Status**: MVP Complete ✅ | Marketplace Ready: 40% ⏳ | Target Launch: March 2026 🚀
