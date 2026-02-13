# ☁️ Cloud Deployment Guide - GlowGuide Retention Agent

Bu rehber, ürünün tamamını cloud'da çalıştırmak için gereken tüm adımları detaylı olarak açıklar.

## 📋 İçindekiler

1. [Cloud Platformu Seçimi](#cloud-platformu-seçimi)
2. [Hızlı Başlangıç (Önerilen)](#hızlı-başlangıç-önerilen)
3. [Detaylı Kurulum](#detaylı-kurulum)
4. [Alternatif Platformlar](#alternatif-platformlar)
5. [Maliyet Tahmini](#maliyet-tahmini)
6. [Bakım ve İzleme](#bakım-ve-izleme)

---

## 🎯 Cloud Platformu Seçimi

### Önerilen Çözüm: Hybrid Yaklaşım (En İyi Performans/Maliyet)

| Servis | Platform | Neden? | Maliyet |
|--------|----------|--------|---------|
| **Frontend (Web)** | Vercel | Next.js için optimize, otomatik CDN, kolay deploy | $0-20/ay |
| **Backend (API)** | Railway | Kolay kurulum, otomatik scaling, log yönetimi | $5-20/ay |
| **Workers** | Railway | API ile aynı platformda, kolay yönetim | $5-15/ay |
| **Database** | Supabase | PostgreSQL + Auth + Storage, ücretsiz başlangıç | $0-25/ay |
| **Redis** | Upstash | Serverless Redis, kullanıma göre ödeme | $0-10/ay |
| **Monitoring** | Sentry | Hata takibi, performans izleme | $0-26/ay |

**Toplam Tahmini Maliyet:** $10-116/ay (başlangıç seviyesinde $10-30/ay)

---

## 🚀 Hızlı Başlangıç (Önerilen)

### Adım 1: Database (Supabase) Kurulumu

1. **Supabase Hesabı Oluştur**
   ```bash
   # https://supabase.com adresine git
   # "Start your project" tıkla
   # Yeni proje oluştur: "glowguide-production"
   ```

2. **Database Migration'ları Çalıştır**
   ```bash
   # Supabase CLI kur
   npm install -g supabase
   
   # Projeye bağlan
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   
   # Migration'ları çalıştır
   cd /Users/sboyuk/Desktop/retention-agent-ai
   supabase db push
   ```

3. **Supabase Bilgilerini Kaydet**
   - Project URL: `https://xxxxx.supabase.co`
   - Anon Key: `eyJhbGc...` (Public için)
   - Service Role Key: `eyJhbGc...` (Backend için)

### Adım 2: Redis (Upstash) Kurulumu

1. **Upstash Hesabı Oluştur**
   ```bash
   # https://upstash.com adresine git
   # "Create Database" tıkla
   # İsim: glowguide-redis
   # Region: En yakın bölge seç (örn: eu-west-1)
   ```

2. **Redis URL'i Kaydet**
   ```
   redis://default:xxxxx@xxxxx.upstash.io:6379
   ```

### Adım 3: Backend (API + Workers) - Railway

1. **Railway Hesabı Oluştur**
   ```bash
   # https://railway.app adresine git
   # GitHub ile giriş yap
   ```

2. **GitHub Repository Bağla**
   ```bash
   # Railway dashboard'da "New Project" tıkla
   # "Deploy from GitHub repo" seç
   # retention-agent-ai repository'sini seç
   ```

3. **API Servisi Kur**
   ```bash
   # Railway'de "New Service" tıkla
   # "Empty Service" seç
   # Settings:
   #   - Name: glowguide-api
   #   - Root Directory: packages/api
   #   - Build Command: pnpm install && cd ../shared && pnpm build && cd ../api && pnpm build
   #   - Start Command: node dist/index.js
   #   - Port: 3001
   ```

4. **API Environment Variables Ekle**
   ```env
   NODE_ENV=production
   PORT=3001
   
   # Supabase (Adım 1'den)
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_KEY=eyJhbGc...
   
   # Redis (Adım 2'den)
   REDIS_URL=redis://default:xxxxx@xxxxx.upstash.io:6379
   
   # OpenAI
   OPENAI_API_KEY=sk-...
   
   # Shopify
   SHOPIFY_API_KEY=your-shopify-key
   SHOPIFY_API_SECRET=your-shopify-secret
   
   # WhatsApp (Twilio)
   TWILIO_ACCOUNT_SID=ACxxxxx
   TWILIO_AUTH_TOKEN=xxxxx
   TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
   
   # Security
   JWT_SECRET=your-super-secret-jwt-key-min-32-chars
   ENCRYPTION_KEY=your-32-char-encryption-key-here
   
   # CORS
   ALLOWED_ORIGINS=https://your-app.vercel.app
   
   # Sentry (optional)
   SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
   ```

5. **Workers Servisi Kur**
   ```bash
   # Railway'de "New Service" tıkla
   # Settings:
   #   - Name: glowguide-workers
   #   - Root Directory: packages/workers
   #   - Build Command: pnpm install && cd ../shared && pnpm build && cd ../workers && pnpm build
   #   - Start Command: node dist/index.js
   ```

6. **Workers Environment Variables Ekle**
   ```env
   # API ile aynı environment variables
   # (PORT hariç)
   ```

### Adım 4: Frontend (Web) - Vercel

1. **Vercel Hesabı Oluştur**
   ```bash
   # https://vercel.com adresine git
   # GitHub ile giriş yap
   ```

2. **Proje Import Et**
   ```bash
   # Vercel dashboard'da "Add New" > "Project" tıkla
   # retention-agent-ai repository'sini seç
   # Framework Preset: Next.js
   # Root Directory: packages/web
   ```

3. **Environment Variables Ekle**
   ```env
   NODE_ENV=production
   
   # Supabase (Public keys)
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
   
   # API URL (Railway'den)
   NEXT_PUBLIC_API_URL=https://glowguide-api.up.railway.app
   
   # Shopify (Public key)
   NEXT_PUBLIC_SHOPIFY_API_KEY=your-shopify-key
   
   # Sentry (optional)
   SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
   SENTRY_ORG=your-org
   SENTRY_PROJECT=your-project
   ```

4. **Deploy**
   ```bash
   # Vercel otomatik deploy edecek
   # Deploy tamamlandığında URL: https://your-app.vercel.app
   ```

### Adım 5: CORS Ayarları Güncelle

Railway'deki API servisinde `ALLOWED_ORIGINS` değişkenini güncelle:
```env
ALLOWED_ORIGINS=https://your-app.vercel.app,https://your-custom-domain.com
```

### Adım 6: Domain Bağlama (Opsiyonel)

#### Vercel (Frontend)
```bash
# Vercel dashboard > Settings > Domains
# Custom domain ekle: app.yourdomain.com
# DNS kayıtlarını güncelle
```

#### Railway (API)
```bash
# Railway dashboard > Settings > Domains
# Custom domain ekle: api.yourdomain.com
# DNS kayıtlarını güncelle
```

---

## 🔧 Detaylı Kurulum

### Manuel Environment Setup Script

Tüm environment variables'ı tek seferde ayarlamak için:

```bash
# create-env.sh
#!/bin/bash

echo "🚀 GlowGuide Cloud Environment Setup"
echo "======================================"
echo ""

# Supabase
read -p "Supabase URL: " SUPABASE_URL
read -p "Supabase Anon Key: " SUPABASE_ANON_KEY
read -p "Supabase Service Key: " SUPABASE_SERVICE_KEY

# Redis
read -p "Redis URL: " REDIS_URL

# OpenAI
read -p "OpenAI API Key: " OPENAI_API_KEY

# Shopify
read -p "Shopify API Key: " SHOPIFY_API_KEY
read -p "Shopify API Secret: " SHOPIFY_API_SECRET

# Twilio
read -p "Twilio Account SID: " TWILIO_ACCOUNT_SID
read -p "Twilio Auth Token: " TWILIO_AUTH_TOKEN
read -p "Twilio WhatsApp Number: " TWILIO_WHATSAPP_NUMBER

# Generate secrets
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)

echo ""
echo "✅ Environment variables hazır!"
echo ""
echo "📋 Railway API için:"
echo "===================="
cat > railway-api.env << EOF
NODE_ENV=production
PORT=3001
SUPABASE_URL=$SUPABASE_URL
SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY
REDIS_URL=$REDIS_URL
OPENAI_API_KEY=$OPENAI_API_KEY
SHOPIFY_API_KEY=$SHOPIFY_API_KEY
SHOPIFY_API_SECRET=$SHOPIFY_API_SECRET
TWILIO_ACCOUNT_SID=$TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN=$TWILIO_AUTH_TOKEN
TWILIO_WHATSAPP_NUMBER=$TWILIO_WHATSAPP_NUMBER
JWT_SECRET=$JWT_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY
ALLOWED_ORIGINS=https://your-app.vercel.app
EOF

echo ""
echo "📋 Vercel Web için:"
echo "===================="
cat > vercel.env << EOF
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
NEXT_PUBLIC_API_URL=https://your-api.railway.app
NEXT_PUBLIC_SHOPIFY_API_KEY=$SHOPIFY_API_KEY
EOF

echo ""
echo "✅ Dosyalar oluşturuldu:"
echo "  - railway-api.env"
echo "  - vercel.env"
echo ""
echo "Bu dosyaları ilgili platformlara kopyalayın!"
```

### Health Check ve Test

Deploy sonrası test:

```bash
# API Health Check
curl https://your-api.railway.app/health

# Beklenen response:
# {"status":"ok","timestamp":"2024-01-20T...","services":{"redis":"connected","database":"connected"}}

# Frontend Check
curl https://your-app.vercel.app

# Beklenen: 200 OK
```

---

## 🔄 Alternatif Platformlar

### Seçenek 1: Tamamen AWS

| Servis | AWS Karşılığı | Maliyet |
|--------|---------------|---------|
| Frontend | CloudFront + S3 | $5-20/ay |
| API | ECS Fargate | $20-50/ay |
| Workers | ECS Fargate | $20-50/ay |
| Database | RDS PostgreSQL | $15-100/ay |
| Redis | ElastiCache | $15-50/ay |
| **Toplam** | | **$75-270/ay** |

**Kurulum:**
```bash
# 1. ECR'a Docker image push et
aws ecr create-repository --repository-name glowguide-api
docker build -t glowguide-api --target api .
docker tag glowguide-api:latest AWS_ACCOUNT.dkr.ecr.REGION.amazonaws.com/glowguide-api:latest
docker push AWS_ACCOUNT.dkr.ecr.REGION.amazonaws.com/glowguide-api:latest

# 2. ECS Task Definition oluştur
# 3. ECS Service oluştur
# 4. ALB (Load Balancer) kur
# 5. CloudFront + S3 için frontend deploy et
```

### Seçenek 2: Google Cloud Platform

| Servis | GCP Karşılığı | Maliyet |
|--------|---------------|---------|
| Frontend | Cloud Run | $5-20/ay |
| API | Cloud Run | $10-30/ay |
| Workers | Cloud Run | $10-30/ay |
| Database | Cloud SQL | $10-80/ay |
| Redis | Memorystore | $20-50/ay |
| **Toplam** | | **$55-210/ay** |

### Seçenek 3: Azure

| Servis | Azure Karşılığı | Maliyet |
|--------|-----------------|---------|
| Frontend | Static Web Apps | $0-9/ay |
| API | Container Apps | $15-40/ay |
| Workers | Container Apps | $15-40/ay |
| Database | PostgreSQL | $10-80/ay |
| Redis | Cache for Redis | $15-50/ay |
| **Toplam** | | **$55-219/ay** |

### Seçenek 4: DigitalOcean (En Basit)

```bash
# 1. Droplet oluştur (4GB RAM, $24/ay)
# 2. Docker Compose ile deploy et

# Droplet'e bağlan
ssh root@your-droplet-ip

# Projeyi kopyala
git clone https://github.com/mrselo90/retetionai.git
cd retetionai

# Environment variables ayarla
cp .env.example .env
nano .env

# Docker Compose ile başlat
docker-compose up -d

# Nginx reverse proxy kur
apt install nginx
# nginx.conf düzenle
```

**Maliyet:** $24-48/ay (tek droplet)

---

## 💰 Maliyet Tahmini

### Başlangıç Seviyesi (0-100 kullanıcı)

| Platform | Servis | Maliyet |
|----------|--------|---------|
| Vercel | Frontend (Hobby) | $0/ay |
| Railway | API + Workers | $10/ay |
| Supabase | Database (Free) | $0/ay |
| Upstash | Redis (Free) | $0/ay |
| Sentry | Monitoring (Free) | $0/ay |
| **Toplam** | | **$10/ay** |

### Orta Seviye (100-1000 kullanıcı)

| Platform | Servis | Maliyet |
|----------|--------|---------|
| Vercel | Frontend (Pro) | $20/ay |
| Railway | API + Workers | $30/ay |
| Supabase | Database (Pro) | $25/ay |
| Upstash | Redis (Pay as you go) | $10/ay |
| Sentry | Monitoring (Team) | $26/ay |
| **Toplam** | | **$111/ay** |

### Büyük Ölçek (1000+ kullanıcı)

| Platform | Servis | Maliyet |
|----------|--------|---------|
| Vercel | Frontend (Pro) | $20/ay |
| Railway | API + Workers (Scaled) | $100/ay |
| Supabase | Database (Pro+) | $100/ay |
| Upstash | Redis (Pay as you go) | $50/ay |
| Sentry | Monitoring (Business) | $80/ay |
| **Toplam** | | **$350/ay** |

---

## 📊 Bakım ve İzleme

### 1. Monitoring Setup

#### Sentry (Hata Takibi)

```bash
# 1. Sentry hesabı oluştur: https://sentry.io
# 2. Yeni proje oluştur: Node.js
# 3. DSN'i kopyala
# 4. Environment variables'a ekle:

SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
```

#### Uptime Monitoring (UptimeRobot)

```bash
# 1. UptimeRobot hesabı oluştur: https://uptimerobot.com
# 2. Yeni monitor ekle:
#    - Type: HTTPS
#    - URL: https://your-api.railway.app/health
#    - Interval: 5 minutes
# 3. Alert contacts ekle (email, SMS)
```

#### Log Management

**Railway:**
- Dashboard > Logs sekmesi
- Real-time log streaming
- Search ve filter

**Vercel:**
- Dashboard > Logs sekmesi
- Function logs
- Build logs

### 2. Backup Stratejisi

#### Supabase Backup

```bash
# Manuel backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Otomatik backup (Supabase Pro)
# Dashboard > Settings > Database > Point in Time Recovery
```

#### Redis Backup

```bash
# Upstash otomatik backup yapar
# Dashboard > Database > Backups
```

### 3. Güncelleme ve Deployment

#### Otomatik Deployment (GitHub Actions)

`.github/workflows/deploy.yml` oluştur:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      # API & Workers (Railway)
      - name: Deploy to Railway
        run: |
          curl -X POST ${{ secrets.RAILWAY_WEBHOOK_URL }}
      
      # Frontend (Vercel)
      - name: Deploy to Vercel
        run: |
          npm install -g vercel
          vercel --prod --token ${{ secrets.VERCEL_TOKEN }}
```

#### Manuel Deployment

```bash
# Railway
git push origin main  # Otomatik deploy

# Vercel
cd packages/web
vercel --prod
```

### 4. Scaling Stratejisi

#### Horizontal Scaling (Railway)

```bash
# Railway dashboard > Settings > Scaling
# Replicas: 2-5 (otomatik scaling)
```

#### Database Scaling (Supabase)

```bash
# Supabase dashboard > Settings > Database
# Plan upgrade: Pro -> Team -> Enterprise
```

#### Redis Scaling (Upstash)

```bash
# Upstash dashboard > Database > Scaling
# Otomatik scaling (pay as you go)
```

---

## ✅ Deployment Checklist

### Pre-Deployment

- [ ] Tüm environment variables hazır
- [ ] Database migration'ları test edildi
- [ ] API endpoints test edildi
- [ ] Frontend build başarılı
- [ ] Sentry DSN ayarlandı
- [ ] CORS ayarları doğru
- [ ] SSL sertifikaları hazır (otomatik)

### Deployment

- [ ] Supabase projesi oluşturuldu
- [ ] Migration'lar çalıştırıldı
- [ ] Upstash Redis oluşturuldu
- [ ] Railway API deploy edildi
- [ ] Railway Workers deploy edildi
- [ ] Vercel Frontend deploy edildi
- [ ] Domain bağlandı (opsiyonel)

### Post-Deployment

- [ ] Health check başarılı
- [ ] Frontend açılıyor
- [ ] Login çalışıyor
- [ ] API endpoints yanıt veriyor
- [ ] Workers job'ları işliyor
- [ ] Sentry hataları alıyor
- [ ] Uptime monitoring aktif
- [ ] Backup stratejisi aktif

---

## 🆘 Troubleshooting

### API Başlamıyor

```bash
# Railway logs kontrol et
railway logs

# Yaygın sorunlar:
# 1. Environment variables eksik
# 2. Database bağlantısı yok
# 3. Redis bağlantısı yok

# Çözüm:
# Railway dashboard > Variables kontrol et
```

### Frontend 500 Hatası

```bash
# Vercel logs kontrol et
vercel logs

# Yaygın sorunlar:
# 1. API URL yanlış
# 2. CORS hatası
# 3. Environment variables eksik

# Çözüm:
# Vercel dashboard > Settings > Environment Variables
```

### Database Connection Error

```bash
# Supabase status kontrol et
# https://status.supabase.com

# Connection string kontrol et
echo $SUPABASE_URL

# Çözüm:
# Supabase dashboard > Settings > API
# URL ve keys'i yeniden kopyala
```

---

## 📞 Destek ve Kaynaklar

### Dokümantasyon

- [Vercel Docs](https://vercel.com/docs)
- [Railway Docs](https://docs.railway.app)
- [Supabase Docs](https://supabase.com/docs)
- [Upstash Docs](https://docs.upstash.com)

### Community

- [Railway Discord](https://discord.gg/railway)
- [Vercel Discord](https://discord.gg/vercel)
- [Supabase Discord](https://discord.gg/supabase)

### Video Tutorials

- [Vercel Deployment](https://www.youtube.com/watch?v=...)
- [Railway Deployment](https://www.youtube.com/watch?v=...)
- [Supabase Setup](https://www.youtube.com/watch?v=...)

---

## 🎉 Sonuç

Bu rehberi takip ederek ürününüzü tamamen cloud'da çalıştırabilirsiniz. Önerilen yaklaşım:

1. **Hızlı Başlangıç** bölümünü takip edin (1-2 saat)
2. İlk deploy'u yapın ve test edin
3. Domain bağlayın (opsiyonel)
4. Monitoring ve backup'ları aktif edin
5. Kullanıcı sayısı arttıkça scale edin

**Başlangıç maliyeti:** $10-30/ay
**Kurulum süresi:** 2-4 saat
**Bakım:** Minimal (otomatik scaling ve backup)

Sorularınız için: [GitHub Issues](https://github.com/mrselo90/retetionai/issues)
