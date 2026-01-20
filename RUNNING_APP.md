# Running the Application

## ✅ Current Status

The application is successfully running in production mode!

## 🚀 Quick Start

### 1. Start the servers

```bash
# From project root
cd /Users/sboyuk/Desktop/retention-agent-ai

# Start API (port 3001)
pnpm --filter api dev > /tmp/api.log 2>&1 &

# Start Frontend (port 3000) - Production Mode
cd packages/web && pnpm start > /tmp/web.log 2>&1 &
```

### 2. Access the application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Signup Page**: http://localhost:3000/signup
- **Login Page**: http://localhost:3000/login

## 🔧 Fixed Issues

### 1. "EMFILE: too many open files" Error
**Problem**: Next.js file watcher exceeded macOS file descriptor limits in dev mode.

**Solution**: 
- Built the application in production mode using `pnpm build`
- Running with `pnpm start` instead of `pnpm dev`
- Updated `next.config.ts` to properly configure turbopack root
- Removed conflicting `package-lock.json` (using pnpm)

### 2. Suspense Boundary Errors
**Problem**: `useSearchParams()` requires Suspense boundary in Next.js 16.

**Solution**: Wrapped components using `useSearchParams()` in Suspense:
- `/app/auth/callback/page.tsx`
- `/app/dashboard/integrations/shopify/callback/page.tsx`

### 3. TypeScript Errors
**Problem**: Missing type definitions for API error fields.

**Solution**: Updated `ApiError` interface in `/packages/web/lib/api.ts` to include:
```typescript
export interface ApiError {
  error: string;
  message?: string;
  details?: string;
  code?: string;
  hint?: string;
}
```

## 📋 Verification

All endpoints are working:
- ✅ Frontend: 200 OK
- ✅ API: Responding correctly
- ✅ CORS: Configured properly
- ✅ Signup: Ready for testing
- ✅ Login: Ready for testing

## 📧 Email Confirmation

Email confirmation is **ENABLED** in Supabase. See `SUPABASE_EMAIL_CONFIRMATION.md` for:
- How to disable for development
- How to configure email sending
- Testing workflow

## 🧪 Testing the Application

1. Go to http://localhost:3000/signup
2. Fill in:
   - Business Name
   - Email
   - Password (min 6 characters)
   - Confirm Password
3. Click "Sign up"
4. Check your email for confirmation link (if email is configured)
5. After confirmation, you'll receive your API key
6. Login at http://localhost:3000/login

## 📊 Monitoring

Check logs:
```bash
# API logs
tail -f /tmp/api.log

# Frontend logs
tail -f /tmp/web.log
```

## 🛑 Stopping the Application

```bash
# Kill processes on ports
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

## 🔄 Rebuilding After Changes

If you make code changes:

```bash
# Rebuild frontend
cd packages/web
pnpm build

# Restart servers (API auto-reloads with tsx watch)
cd /Users/sboyuk/Desktop/retention-agent-ai
lsof -ti:3000 | xargs kill -9
cd packages/web && pnpm start > /tmp/web.log 2>&1 &
```

## 📦 Production Deployment

For actual production deployment:

1. Set environment variables in production
2. Use a process manager (PM2, systemd)
3. Set up reverse proxy (nginx, Caddy)
4. Enable SSL/TLS
5. Configure Supabase email sending
6. Set up Redis for queues
7. Deploy workers separately

## 🎉 Success!

Your GlowGuide Retention Agent is now running and ready for testing!
