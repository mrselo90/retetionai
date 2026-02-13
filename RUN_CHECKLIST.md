# What You Need to Run This Application

## 1. Node & pnpm

- **Node.js** >= 18
- **pnpm** >= 8  
  Install: `npm install -g pnpm`

## 2. Environment file (required)

Create a **`.env`** file at the **project root** with at least:

```env
# Required for API
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
REDIS_URL=redis://localhost:6379

# Required for Web (frontend)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:3001

# App
NODE_ENV=development
API_URL=http://localhost:3001
PORT=3001
```

Get Supabase keys: [Supabase Dashboard](https://supabase.com/dashboard) → your project → Settings → API.

## 3. Redis (for API queues)

- **Redis** must be running (e.g. `redis://localhost:6379`).
- Install: macOS `brew install redis` then `brew services start redis`, or use Docker: `docker run -d -p 6379:6379 redis`.

## 4. Database migrations (recommended)

Run Supabase migrations so tables exist:

- In Supabase: SQL Editor → run the files in `supabase/migrations/` in order (000 → 007), or use Supabase CLI.

## 5. Optional (for full features later)

- **OPENAI_API_KEY** – AI/WhatsApp consultant
- **TWILIO_*** – WhatsApp messaging
- **SHOPIFY_API_KEY**, **SHOPIFY_API_SECRET** – Shopify OAuth
- **SENTRY_DSN** – Error tracking

---

## Quick run (after the above)

```bash
# From project root
pnpm install
pnpm dev          # API on http://localhost:3001
pnpm dev:web      # Web on http://localhost:3000 (in another terminal)
# Or both: pnpm dev:all
```

- **Frontend**: http://localhost:3000  
- **API**: http://localhost:3001  
- **Signup/Login**: http://localhost:3000/signup, http://localhost:3000/login
