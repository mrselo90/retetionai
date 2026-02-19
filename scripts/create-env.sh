#!/bin/bash

# ReceteGuide Cloud Environment Setup Script
# Bu script tüm environment variables'ı toplar ve platform-specific dosyalar oluşturur

set -e

echo "🚀 ReceteGuide Cloud Environment Setup"
echo "======================================"
echo ""
echo "Bu script cloud deployment için gerekli tüm environment variables'ı toplayacak."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Supabase
echo -e "${YELLOW}📦 Supabase Configuration${NC}"
read -p "Supabase URL (https://xxxxx.supabase.co): " SUPABASE_URL
read -p "Supabase Anon Key: " SUPABASE_ANON_KEY
read -p "Supabase Service Role Key: " SUPABASE_SERVICE_KEY
echo ""

# Redis
echo -e "${YELLOW}🔴 Redis Configuration (Upstash)${NC}"
read -p "Redis URL (redis://default:xxxxx@xxxxx.upstash.io:6379): " REDIS_URL
echo ""

# OpenAI
echo -e "${YELLOW}🤖 OpenAI Configuration${NC}"
read -p "OpenAI API Key (sk-...): " OPENAI_API_KEY
echo ""

# Shopify
echo -e "${YELLOW}🛍️  Shopify Configuration${NC}"
read -p "Shopify API Key: " SHOPIFY_API_KEY
read -p "Shopify API Secret: " SHOPIFY_API_SECRET
echo ""

# Twilio (WhatsApp)
echo -e "${YELLOW}📱 Twilio/WhatsApp Configuration${NC}"
read -p "Twilio Account SID (ACxxxxx): " TWILIO_ACCOUNT_SID
read -p "Twilio Auth Token: " TWILIO_AUTH_TOKEN
read -p "Twilio WhatsApp Number (whatsapp:+14155238886): " TWILIO_WHATSAPP_NUMBER
echo ""

# Sentry (Optional)
echo -e "${YELLOW}🔍 Sentry Configuration (Optional - Enter to skip)${NC}"
read -p "Sentry DSN: " SENTRY_DSN
read -p "Sentry Org: " SENTRY_ORG
read -p "Sentry Project: " SENTRY_PROJECT
echo ""

# Frontend URL
echo -e "${YELLOW}🌐 Frontend URL${NC}"
read -p "Frontend URL (https://your-app.vercel.app): " FRONTEND_URL
echo ""

# API URL
echo -e "${YELLOW}🔌 API URL${NC}"
read -p "API URL (https://your-api.com): " API_URL
echo ""

# Generate secrets
echo -e "${GREEN}🔐 Generating secure secrets...${NC}"
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)
echo "✅ Secrets generated!"
echo ""

# Create output directory
mkdir -p .env-output


# Vercel Web Environment
echo -e "${GREEN}📋 Creating Vercel Web environment file...${NC}"
cat > .env-output/vercel.env << EOF
# Vercel Web Environment Variables
# Copy these to Vercel Dashboard > Settings > Environment Variables

NODE_ENV=production

# Supabase (Public)
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY

# API
NEXT_PUBLIC_API_URL=$API_URL

# Shopify (Public)
NEXT_PUBLIC_SHOPIFY_API_KEY=$SHOPIFY_API_KEY

# Sentry
SENTRY_DSN=$SENTRY_DSN
SENTRY_ORG=$SENTRY_ORG
SENTRY_PROJECT=$SENTRY_PROJECT
SENTRY_AUTH_TOKEN=<your-sentry-auth-token>

# Next.js
NEXT_TELEMETRY_DISABLED=1
EOF

# GitHub Actions Secrets
echo -e "${GREEN}📋 Creating GitHub Actions secrets list...${NC}"
cat > .env-output/github-secrets.txt << EOF
# GitHub Actions Secrets
# Add these to GitHub Repository > Settings > Secrets and variables > Actions

# Supabase
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres

# API
NEXT_PUBLIC_API_URL=$API_URL


# Vercel
VERCEL_TOKEN=<get-from-vercel-dashboard>
VERCEL_ORG_ID=<get-from-vercel-dashboard>
VERCEL_PROJECT_ID=<get-from-vercel-dashboard>
VERCEL_DOMAIN=<your-app.vercel.app>

# Sentry
SENTRY_ORG=$SENTRY_ORG
SENTRY_AUTH_TOKEN=<get-from-sentry-dashboard>

# Slack (Optional)
SLACK_WEBHOOK=<your-slack-webhook-url>
EOF

# Docker Compose Environment
echo -e "${GREEN}📋 Creating Docker Compose environment file...${NC}"
cat > .env-output/docker-compose.env << EOF
# Docker Compose Environment Variables
# Rename to .env in project root for docker-compose deployment

# Supabase
SUPABASE_URL=$SUPABASE_URL
SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY

# Redis
REDIS_URL=$REDIS_URL

# OpenAI
OPENAI_API_KEY=$OPENAI_API_KEY

# Shopify
SHOPIFY_API_KEY=$SHOPIFY_API_KEY
SHOPIFY_API_SECRET=$SHOPIFY_API_SECRET

# Twilio
TWILIO_ACCOUNT_SID=$TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN=$TWILIO_AUTH_TOKEN
TWILIO_WHATSAPP_NUMBER=$TWILIO_WHATSAPP_NUMBER

# Security
JWT_SECRET=$JWT_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY

# Frontend (Public)
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
NEXT_PUBLIC_API_URL=$API_URL
NEXT_PUBLIC_SHOPIFY_API_KEY=$SHOPIFY_API_KEY

# Sentry
SENTRY_DSN=$SENTRY_DSN
EOF

# Quick Reference
echo -e "${GREEN}📋 Creating quick reference guide...${NC}"
cat > .env-output/QUICK_REFERENCE.md << EOF
# Environment Variables Quick Reference

## 🔐 Generated Secrets

**JWT Secret:**
\`\`\`
$JWT_SECRET
\`\`\`

**Encryption Key:**
\`\`\`
$ENCRYPTION_KEY
\`\`\`

⚠️ **IMPORTANT:** Keep these secrets safe! Never commit them to git.

---

## 📦 Platform-Specific Files

### Server Services
- Go to your server dashboard
- Select your services (API, Workers)
- Go to environment variables section
- Copy/paste variables from Vercel or manual files

### Vercel Web
File: \`vercel.env\`
- Go to Vercel Dashboard
- Select Project
- Go to Settings > Environment Variables
- Add variables from file

### GitHub Actions
File: \`github-secrets.txt\`
- Go to GitHub Repository
- Settings > Secrets and variables > Actions
- Add each secret from file

### Docker Compose
File: \`docker-compose.env\`
- Rename to \`.env\` in project root
- Run: \`docker-compose up -d\`

---

## 🚀 Deployment Steps

1. **Supabase Setup**
   - Create project at https://supabase.com
   - Run migrations: \`supabase db push\`

2. **Server Setup**
   - Create API service
   - Create Workers service
   - Add environment variables

3. **Vercel Setup**
   - Import project
   - Add environment variables from file
   - Deploy

4. **Update CORS**
   - Update API `ALLOWED_ORIGINS` with your frontend URL

5. **Test**
   - API: $API_URL/health
   - Web: $FRONTEND_URL

---

## 📞 Support

- Vercel: https://vercel.com/support
- Supabase: https://supabase.com/support
EOF

echo ""
echo -e "${GREEN}✅ Environment files created successfully!${NC}"
echo ""
echo "📂 Files created in .env-output/:"
echo "  - vercel.env"
echo "  - github-secrets.txt"
echo "  - docker-compose.env"
echo "  - QUICK_REFERENCE.md"
echo ""
echo -e "${YELLOW}⚠️  SECURITY WARNING:${NC}"
echo "  - These files contain sensitive information"
echo "  - Never commit them to git"
echo "  - .env-output/ is already in .gitignore"
echo ""
echo -e "${GREEN}📖 Next Steps:${NC}"
echo "  1. Read .env-output/QUICK_REFERENCE.md"
echo "  2. Copy variables to respective platforms"
echo "  3. Deploy services"
echo "  4. Test deployment"
echo ""
echo -e "${GREEN}🎉 Ready to deploy to cloud!${NC}"
