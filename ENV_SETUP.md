# Environment Variables Setup

## Supabase Configuration

Aşağıdaki bilgileri `.env` dosyasına ekleyin:

```env
# Supabase Configuration
SUPABASE_URL=https://clcqmasqkfdcmznwdrbx.supabase.co
SUPABASE_ANON_KEY=sb_publishable_4pEKYh0OrftI7oQhSkD2dg_PpfMpHY-
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Database
DATABASE_URL=postgresql://postgres:ZouJWMAZueSr1oZI@db.clcqmasqkfdcmznwdrbx.supabase.co:5432/postgres
```

## Service Role Key'i Alın

1. [Supabase Dashboard](https://supabase.com/dashboard/project/clcqmasqkfdcmznwdrbx) → Projenize gidin
2. Sol menüden **"Settings"** → **"API"** seçin
3. **"service_role"** key'i bulun (⚠️ gizli tutun, RLS bypass eder!)
4. `.env` dosyasındaki `SUPABASE_SERVICE_ROLE_KEY` değerine yapıştırın

## .env Dosyasını Oluşturun

```bash
cd /Users/sboyuk/Desktop/retention-agent-ai
cat > .env << 'EOF'
# Supabase Configuration
SUPABASE_URL=https://clcqmasqkfdcmznwdrbx.supabase.co
SUPABASE_ANON_KEY=sb_publishable_4pEKYh0OrftI7oQhSkD2dg_PpfMpHY-
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Database
DATABASE_URL=postgresql://postgres:ZouJWMAZueSr1oZI@db.clcqmasqkfdcmznwdrbx.supabase.co:5432/postgres

# Redis (for BullMQ)
REDIS_URL=redis://localhost:6379

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# WhatsApp (Twilio)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
WHATSAPP_PHONE_NUMBER=your_whatsapp_phone_number

# Shopify (optional, for OAuth)
SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_API_SECRET=your_shopify_api_secret

# App Configuration
NODE_ENV=development
PORT=3001
API_URL=http://localhost:3001
EOF
```

Sonra service_role key'i manuel olarak ekleyin.
