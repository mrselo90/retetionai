# ☁️ GCP Deployment Guide - GlowGuide Retention Agent

Bu rehber, ürünün tamamını Google Cloud Platform (GCP) üzerinde çalıştırmak için detaylı adımları içerir.

## 📋 İçindekiler

1. [GCP Neden?](#gcp-neden)
2. [Mimari Tasarım](#mimari-tasarım)
3. [Maliyet Analizi](#maliyet-analizi)
4. [Adım Adım Kurulum](#adım-adım-kurulum)
5. [Otomatik Deployment](#otomatik-deployment)
6. [Monitoring ve Logging](#monitoring-ve-logging)
7. [Scaling Stratejisi](#scaling-stratejisi)
8. [Backup ve Recovery](#backup-ve-recovery)

---

## 🎯 GCP Neden?

### Avantajlar

✅ **Cloud Run**: Serverless container deployment, otomatik scaling
✅ **Cloud SQL**: Managed PostgreSQL, otomatik backup
✅ **Memorystore**: Managed Redis, high availability
✅ **Global CDN**: Düşük latency, yüksek performans
✅ **IAM**: Güçlü güvenlik ve erişim kontrolü
✅ **Cloud Build**: Native CI/CD pipeline
✅ **Stackdriver**: Entegre monitoring ve logging
✅ **Generous Free Tier**: İlk başlangıç için ücretsiz kaynaklar

### GCP vs Diğer Platformlar

| Özellik | GCP | AWS | Azure | Hybrid |
|---------|-----|-----|-------|--------|
| Kurulum Kolaylığı | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Maliyet (Başlangıç) | $55-100/ay | $75-150/ay | $55-120/ay | $10-30/ay |
| Otomatik Scaling | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Kubernetes Desteği | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Global Network | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| AI/ML Entegrasyonu | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |

---

## 🏗️ Mimari Tasarım

### Önerilen GCP Mimarisi

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   Cloud Load Balancer  │
         │    (Global HTTPS)      │
         └───────────┬─────────────┘
                     │
         ┌───────────┴──────────────┐
         │                          │
         ▼                          ▼
┌─────────────────┐        ┌─────────────────┐
│   Cloud Run     │        │   Cloud Run     │
│   (Frontend)    │        │   (API)         │
│   Next.js       │        │   Hono.js       │
│   Auto-scale    │        │   Auto-scale    │
└─────────────────┘        └────────┬────────┘
                                    │
                     ┌──────────────┼──────────────┐
                     │              │              │
                     ▼              ▼              ▼
            ┌────────────┐  ┌──────────────┐  ┌──────────────┐
            │ Cloud Run  │  │  Cloud SQL   │  │ Memorystore  │
            │ (Workers)  │  │ (PostgreSQL) │  │   (Redis)    │
            │ BullMQ     │  │   pgvector   │  │              │
            └────────────┘  └──────────────┘  └──────────────┘
                     │
                     ▼
            ┌────────────────┐
            │  Cloud Storage │
            │   (Backups)    │
            └────────────────┘
                     │
                     ▼
            ┌────────────────┐
            │  Cloud Logging │
            │  Cloud Monitor │
            │     Sentry     │
            └────────────────┘
```

### Servis Detayları

| Servis | GCP Ürünü | Amaç | Scaling |
|--------|-----------|------|---------|
| **Frontend** | Cloud Run | Next.js web app | 0-1000 instances |
| **API** | Cloud Run | Hono.js REST API | 0-1000 instances |
| **Workers** | Cloud Run | BullMQ job processor | 1-100 instances |
| **Database** | Cloud SQL | PostgreSQL + pgvector | Vertical + Read replicas |
| **Cache** | Memorystore | Redis cache | 1-5GB memory |
| **Storage** | Cloud Storage | File storage, backups | Unlimited |
| **CDN** | Cloud CDN | Static asset delivery | Global |
| **Load Balancer** | Cloud Load Balancing | HTTPS traffic routing | Global |

---

## 💰 Maliyet Analizi

### Başlangıç Seviyesi (0-100 kullanıcı/gün)

| Servis | Konfigürasyon | Maliyet/Ay |
|--------|---------------|------------|
| **Cloud Run (Frontend)** | 1 vCPU, 512MB RAM, 100K requests | $5 |
| **Cloud Run (API)** | 1 vCPU, 1GB RAM, 500K requests | $15 |
| **Cloud Run (Workers)** | 1 vCPU, 1GB RAM, always-on | $20 |
| **Cloud SQL** | db-f1-micro (1 vCPU, 3.75GB RAM) | $10 |
| **Memorystore** | Basic tier, 1GB | $10 |
| **Cloud Storage** | 10GB storage, 100GB transfer | $1 |
| **Cloud Load Balancer** | Forwarding rules + traffic | $5 |
| **Cloud Logging** | 10GB logs | $1 |
| **Egress** | 100GB outbound | $10 |
| **Toplam** | | **~$77/ay** |

### Orta Seviye (100-1000 kullanıcı/gün)

| Servis | Konfigürasyon | Maliyet/Ay |
|--------|---------------|------------|
| **Cloud Run (Frontend)** | 2 vCPU, 1GB RAM, 1M requests | $15 |
| **Cloud Run (API)** | 2 vCPU, 2GB RAM, 5M requests | $60 |
| **Cloud Run (Workers)** | 2 vCPU, 2GB RAM, always-on | $40 |
| **Cloud SQL** | db-n1-standard-1 (1 vCPU, 3.75GB) | $50 |
| **Memorystore** | Standard tier, 5GB, HA | $50 |
| **Cloud Storage** | 100GB storage, 1TB transfer | $10 |
| **Cloud Load Balancer** | Forwarding rules + traffic | $15 |
| **Cloud Logging** | 50GB logs | $5 |
| **Egress** | 1TB outbound | $100 |
| **Toplam** | | **~$345/ay** |

### Büyük Ölçek (1000+ kullanıcı/gün)

| Servis | Konfigürasyon | Maliyet/Ay |
|--------|---------------|------------|
| **Cloud Run (Frontend)** | 4 vCPU, 2GB RAM, 10M requests | $50 |
| **Cloud Run (API)** | 4 vCPU, 4GB RAM, 50M requests | $300 |
| **Cloud Run (Workers)** | 4 vCPU, 4GB RAM, 3 instances | $120 |
| **Cloud SQL** | db-n1-standard-4 + read replica | $300 |
| **Memorystore** | Standard tier, 10GB, HA | $100 |
| **Cloud Storage** | 1TB storage, 10TB transfer | $100 |
| **Cloud Load Balancer** | High traffic | $50 |
| **Cloud Logging** | 200GB logs | $20 |
| **Egress** | 10TB outbound | $1000 |
| **Toplam** | | **~$2040/ay** |

### Maliyet Optimizasyonu İpuçları

1. **Committed Use Discounts**: 1-3 yıllık taahhüt ile %57'ye kadar indirim
2. **Sustained Use Discounts**: Otomatik %30'a kadar indirim
3. **Preemptible Instances**: Workers için %80 indirim
4. **Cloud CDN**: Egress maliyetlerini azaltır
5. **Cold Start Optimization**: Cloud Run minimum instances ayarı

---

## 🚀 Adım Adım Kurulum

### Ön Gereksinimler

```bash
# 1. GCP hesabı oluştur
# https://console.cloud.google.com

# 2. Billing hesabı bağla
# https://console.cloud.google.com/billing

# 3. gcloud CLI kur
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# 4. gcloud'u yapılandır
gcloud init
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# 5. Gerekli API'leri aktif et
gcloud services enable \
  run.googleapis.com \
  sql-component.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  cloudbuild.googleapis.com \
  containerregistry.googleapis.com \
  cloudresourcemanager.googleapis.com \
  compute.googleapis.com \
  storage-api.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com
```

### Adım 1: Cloud SQL (PostgreSQL) Kurulumu

```bash
# 1. Cloud SQL instance oluştur
gcloud sql instances create glowguide-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --storage-type=SSD \
  --storage-size=10GB \
  --backup \
  --backup-start-time=03:00 \
  --maintenance-window-day=SUN \
  --maintenance-window-hour=04

# 2. Database oluştur
gcloud sql databases create glowguide \
  --instance=glowguide-db

# 3. Kullanıcı oluştur
gcloud sql users create glowguide \
  --instance=glowguide-db \
  --password=YOUR_SECURE_PASSWORD

# 4. pgvector extension kur
gcloud sql connect glowguide-db --user=postgres
# SQL prompt'ta:
CREATE EXTENSION IF NOT EXISTS vector;
\q

# 5. Connection string'i al
gcloud sql instances describe glowguide-db \
  --format="value(connectionName)"
# Output: project:region:instance-name

# Connection string:
# postgresql://glowguide:PASSWORD@/glowguide?host=/cloudsql/PROJECT:REGION:glowguide-db
```

### Adım 2: Memorystore (Redis) Kurulumu

```bash
# 1. Redis instance oluştur
gcloud redis instances create glowguide-redis \
  --size=1 \
  --region=us-central1 \
  --tier=basic \
  --redis-version=redis_7_0

# 2. Redis bilgilerini al
gcloud redis instances describe glowguide-redis \
  --region=us-central1 \
  --format="value(host,port)"

# Redis URL:
# redis://REDIS_HOST:6379
```

### Adım 3: Cloud Storage Bucket Oluştur

```bash
# 1. Bucket oluştur
gsutil mb -l us-central1 gs://glowguide-backups

# 2. Lifecycle policy ayarla (90 gün sonra sil)
cat > lifecycle.json << EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": 90}
      }
    ]
  }
}
EOF

gsutil lifecycle set lifecycle.json gs://glowguide-backups
```

### Adım 4: Secrets Manager'da Secret'ları Sakla

```bash
# 1. Supabase Service Key
echo -n "YOUR_SUPABASE_SERVICE_KEY" | \
  gcloud secrets create supabase-service-key --data-file=-

# 2. OpenAI API Key
echo -n "YOUR_OPENAI_API_KEY" | \
  gcloud secrets create openai-api-key --data-file=-

# 3. Shopify API Secret
echo -n "YOUR_SHOPIFY_API_SECRET" | \
  gcloud secrets create shopify-api-secret --data-file=-

# 4. Twilio Auth Token
echo -n "YOUR_TWILIO_AUTH_TOKEN" | \
  gcloud secrets create twilio-auth-token --data-file=-

# 5. JWT Secret
openssl rand -base64 32 | \
  gcloud secrets create jwt-secret --data-file=-

# 6. Encryption Key
openssl rand -base64 32 | \
  gcloud secrets create encryption-key --data-file=-

# 7. Database Password
echo -n "YOUR_DB_PASSWORD" | \
  gcloud secrets create db-password --data-file=-
```

### Adım 5: Docker Image'ları Build Et ve Push Et

```bash
# 1. Project root'a git
cd /Users/sboyuk/Desktop/retention-agent-ai

# 2. Artifact Registry repository oluştur
gcloud artifacts repositories create glowguide \
  --repository-format=docker \
  --location=us-central1 \
  --description="GlowGuide container images"

# 3. Docker'ı Artifact Registry için yapılandır
gcloud auth configure-docker us-central1-docker.pkg.dev

# 4. API image'ını build et ve push et
docker build -t us-central1-docker.pkg.dev/YOUR_PROJECT_ID/glowguide/api:latest \
  --target api \
  -f Dockerfile .

docker push us-central1-docker.pkg.dev/YOUR_PROJECT_ID/glowguide/api:latest

# 5. Workers image'ını build et ve push et
docker build -t us-central1-docker.pkg.dev/YOUR_PROJECT_ID/glowguide/workers:latest \
  --target workers \
  -f Dockerfile .

docker push us-central1-docker.pkg.dev/YOUR_PROJECT_ID/glowguide/workers:latest

# 6. Web image'ını build et ve push et
docker build -t us-central1-docker.pkg.dev/YOUR_PROJECT_ID/glowguide/web:latest \
  --target web \
  -f Dockerfile .

docker push us-central1-docker.pkg.dev/YOUR_PROJECT_ID/glowguide/web:latest
```

### Adım 6: Cloud Run Services Deploy Et

#### 6.1. API Service

```bash
# 1. Service account oluştur
gcloud iam service-accounts create glowguide-api \
  --display-name="GlowGuide API Service Account"

# 2. Secret erişimi ver
for secret in supabase-service-key openai-api-key shopify-api-secret \
              twilio-auth-token jwt-secret encryption-key db-password; do
  gcloud secrets add-iam-policy-binding $secret \
    --member="serviceAccount:glowguide-api@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done

# 3. Cloud SQL bağlantı izni ver
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:glowguide-api@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

# 4. API service'i deploy et
gcloud run deploy glowguide-api \
  --image=us-central1-docker.pkg.dev/YOUR_PROJECT_ID/glowguide/api:latest \
  --platform=managed \
  --region=us-central1 \
  --service-account=glowguide-api@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --add-cloudsql-instances=YOUR_PROJECT_ID:us-central1:glowguide-db \
  --set-env-vars="NODE_ENV=production,PORT=3001" \
  --set-secrets="SUPABASE_SERVICE_KEY=supabase-service-key:latest,OPENAI_API_KEY=openai-api-key:latest,SHOPIFY_API_SECRET=shopify-api-secret:latest,TWILIO_AUTH_TOKEN=twilio-auth-token:latest,JWT_SECRET=jwt-secret:latest,ENCRYPTION_KEY=encryption-key:latest" \
  --set-env-vars="REDIS_URL=redis://REDIS_HOST:6379,SUPABASE_URL=https://YOUR_PROJECT.supabase.co,SHOPIFY_API_KEY=YOUR_SHOPIFY_KEY,TWILIO_ACCOUNT_SID=YOUR_TWILIO_SID,TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886" \
  --allow-unauthenticated \
  --cpu=1 \
  --memory=1Gi \
  --min-instances=0 \
  --max-instances=100 \
  --concurrency=80 \
  --timeout=300

# 5. API URL'i al
gcloud run services describe glowguide-api \
  --region=us-central1 \
  --format="value(status.url)"
```

#### 6.2. Workers Service

```bash
# 1. Service account oluştur
gcloud iam service-accounts create glowguide-workers \
  --display-name="GlowGuide Workers Service Account"

# 2. Secret erişimi ver
for secret in supabase-service-key openai-api-key twilio-auth-token encryption-key; do
  gcloud secrets add-iam-policy-binding $secret \
    --member="serviceAccount:glowguide-workers@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done

# 3. Cloud SQL bağlantı izni ver
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:glowguide-workers@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

# 4. Workers service'i deploy et
gcloud run deploy glowguide-workers \
  --image=us-central1-docker.pkg.dev/YOUR_PROJECT_ID/glowguide/workers:latest \
  --platform=managed \
  --region=us-central1 \
  --service-account=glowguide-workers@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --add-cloudsql-instances=YOUR_PROJECT_ID:us-central1:glowguide-db \
  --set-env-vars="NODE_ENV=production" \
  --set-secrets="SUPABASE_SERVICE_KEY=supabase-service-key:latest,OPENAI_API_KEY=openai-api-key:latest,TWILIO_AUTH_TOKEN=twilio-auth-token:latest,ENCRYPTION_KEY=encryption-key:latest" \
  --set-env-vars="REDIS_URL=redis://REDIS_HOST:6379,SUPABASE_URL=https://YOUR_PROJECT.supabase.co,TWILIO_ACCOUNT_SID=YOUR_TWILIO_SID,TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886" \
  --no-allow-unauthenticated \
  --cpu=1 \
  --memory=1Gi \
  --min-instances=1 \
  --max-instances=10 \
  --concurrency=1 \
  --timeout=3600
```

#### 6.3. Web (Frontend) Service

```bash
# 1. Service account oluştur
gcloud iam service-accounts create glowguide-web \
  --display-name="GlowGuide Web Service Account"

# 2. Web service'i deploy et
gcloud run deploy glowguide-web \
  --image=us-central1-docker.pkg.dev/YOUR_PROJECT_ID/glowguide/web:latest \
  --platform=managed \
  --region=us-central1 \
  --service-account=glowguide-web@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars="NODE_ENV=production,NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co,NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY,NEXT_PUBLIC_API_URL=https://glowguide-api-XXXXX-uc.a.run.app,NEXT_PUBLIC_SHOPIFY_API_KEY=YOUR_SHOPIFY_KEY" \
  --allow-unauthenticated \
  --cpu=1 \
  --memory=512Mi \
  --min-instances=0 \
  --max-instances=100 \
  --concurrency=80 \
  --timeout=60

# 3. Web URL'i al
gcloud run services describe glowguide-web \
  --region=us-central1 \
  --format="value(status.url)"
```

### Adım 7: Load Balancer ve Custom Domain Kurulumu

```bash
# 1. Static IP rezerve et
gcloud compute addresses create glowguide-ip \
  --global

# 2. IP adresini al
gcloud compute addresses describe glowguide-ip \
  --global \
  --format="value(address)"

# 3. Serverless NEG (Network Endpoint Group) oluştur
gcloud compute network-endpoint-groups create glowguide-web-neg \
  --region=us-central1 \
  --network-endpoint-type=serverless \
  --cloud-run-service=glowguide-web

gcloud compute network-endpoint-groups create glowguide-api-neg \
  --region=us-central1 \
  --network-endpoint-type=serverless \
  --cloud-run-service=glowguide-api

# 4. Backend service oluştur
gcloud compute backend-services create glowguide-web-backend \
  --global

gcloud compute backend-services add-backend glowguide-web-backend \
  --global \
  --network-endpoint-group=glowguide-web-neg \
  --network-endpoint-group-region=us-central1

gcloud compute backend-services create glowguide-api-backend \
  --global

gcloud compute backend-services add-backend glowguide-api-backend \
  --global \
  --network-endpoint-group=glowguide-api-neg \
  --network-endpoint-group-region=us-central1

# 5. URL map oluştur
gcloud compute url-maps create glowguide-lb \
  --default-service=glowguide-web-backend

gcloud compute url-maps add-path-matcher glowguide-lb \
  --path-matcher-name=api-matcher \
  --default-service=glowguide-web-backend \
  --backend-service-path-rules="/api/*=glowguide-api-backend"

# 6. SSL sertifikası oluştur (managed)
gcloud compute ssl-certificates create glowguide-cert \
  --domains=app.yourdomain.com,api.yourdomain.com \
  --global

# 7. HTTPS proxy oluştur
gcloud compute target-https-proxies create glowguide-https-proxy \
  --ssl-certificates=glowguide-cert \
  --url-map=glowguide-lb

# 8. Forwarding rule oluştur
gcloud compute forwarding-rules create glowguide-https-rule \
  --address=glowguide-ip \
  --global \
  --target-https-proxy=glowguide-https-proxy \
  --ports=443

# 9. DNS kayıtlarını güncelle
# A record: app.yourdomain.com -> STATIC_IP
# A record: api.yourdomain.com -> STATIC_IP
```

### Adım 8: Database Migration'ları Çalıştır

```bash
# 1. Cloud SQL Proxy'yi indir
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.amd64
chmod +x cloud-sql-proxy

# 2. Proxy'yi başlat
./cloud-sql-proxy YOUR_PROJECT_ID:us-central1:glowguide-db &

# 3. Migration'ları çalıştır
cd /Users/sboyuk/Desktop/retention-agent-ai
export DATABASE_URL="postgresql://glowguide:PASSWORD@127.0.0.1:5432/glowguide"

# Supabase CLI ile
supabase db push --db-url $DATABASE_URL

# Veya manuel
for file in supabase/migrations/*.sql; do
  psql $DATABASE_URL < $file
done

# 4. Proxy'yi durdur
pkill cloud-sql-proxy
```

---

## 🔄 Otomatik Deployment (Cloud Build)

### Cloud Build Configuration

`cloudbuild.yaml` oluştur:

```yaml
steps:
  # Build shared package
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'shared', '--target', 'shared-builder', '.']
  
  # Build and push API
  - name: 'gcr.io/cloud-builders/docker'
    args: [
      'build',
      '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/glowguide/api:$SHORT_SHA',
      '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/glowguide/api:latest',
      '--target', 'api',
      '.'
    ]
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'us-central1-docker.pkg.dev/$PROJECT_ID/glowguide/api:$SHORT_SHA']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'us-central1-docker.pkg.dev/$PROJECT_ID/glowguide/api:latest']
  
  # Build and push Workers
  - name: 'gcr.io/cloud-builders/docker'
    args: [
      'build',
      '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/glowguide/workers:$SHORT_SHA',
      '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/glowguide/workers:latest',
      '--target', 'workers',
      '.'
    ]
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'us-central1-docker.pkg.dev/$PROJECT_ID/glowguide/workers:$SHORT_SHA']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'us-central1-docker.pkg.dev/$PROJECT_ID/glowguide/workers:latest']
  
  # Build and push Web
  - name: 'gcr.io/cloud-builders/docker'
    args: [
      'build',
      '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/glowguide/web:$SHORT_SHA',
      '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/glowguide/web:latest',
      '--target', 'web',
      '.'
    ]
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'us-central1-docker.pkg.dev/$PROJECT_ID/glowguide/web:$SHORT_SHA']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'us-central1-docker.pkg.dev/$PROJECT_ID/glowguide/web:latest']
  
  # Deploy API to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args: [
      'run', 'deploy', 'glowguide-api',
      '--image', 'us-central1-docker.pkg.dev/$PROJECT_ID/glowguide/api:$SHORT_SHA',
      '--region', 'us-central1',
      '--platform', 'managed'
    ]
  
  # Deploy Workers to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args: [
      'run', 'deploy', 'glowguide-workers',
      '--image', 'us-central1-docker.pkg.dev/$PROJECT_ID/glowguide/workers:$SHORT_SHA',
      '--region', 'us-central1',
      '--platform', 'managed'
    ]
  
  # Deploy Web to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args: [
      'run', 'deploy', 'glowguide-web',
      '--image', 'us-central1-docker.pkg.dev/$PROJECT_ID/glowguide/web:$SHORT_SHA',
      '--region', 'us-central1',
      '--platform', 'managed'
    ]

timeout: 1800s
options:
  machineType: 'N1_HIGHCPU_8'
```

### Cloud Build Trigger Oluştur

```bash
# 1. GitHub repository'yi bağla
gcloud builds triggers create github \
  --repo-name=retention-agent-ai \
  --repo-owner=mrselo90 \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml \
  --description="Deploy to production on main branch"

# 2. Manuel trigger
gcloud builds submit --config cloudbuild.yaml .
```

---

## 📊 Monitoring ve Logging

### Cloud Monitoring Dashboard Oluştur

```bash
# 1. Dashboard JSON'ı oluştur
cat > dashboard.json << 'EOF'
{
  "displayName": "GlowGuide Production Dashboard",
  "mosaicLayout": {
    "columns": 12,
    "tiles": [
      {
        "width": 6,
        "height": 4,
        "widget": {
          "title": "API Request Count",
          "xyChart": {
            "dataSets": [{
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"glowguide-api\"",
                  "aggregation": {
                    "alignmentPeriod": "60s",
                    "perSeriesAligner": "ALIGN_RATE"
                  }
                }
              }
            }]
          }
        }
      }
    ]
  }
}
EOF

# 2. Dashboard'u oluştur
gcloud monitoring dashboards create --config-from-file=dashboard.json
```

### Uptime Check Oluştur

```bash
# API uptime check
gcloud monitoring uptime create glowguide-api-uptime \
  --display-name="GlowGuide API Uptime" \
  --resource-type=uptime-url \
  --host=glowguide-api-XXXXX-uc.a.run.app \
  --path=/health \
  --check-interval=60s

# Web uptime check
gcloud monitoring uptime create glowguide-web-uptime \
  --display-name="GlowGuide Web Uptime" \
  --resource-type=uptime-url \
  --host=glowguide-web-XXXXX-uc.a.run.app \
  --path=/ \
  --check-interval=60s
```

### Alert Policy Oluştur

```bash
# API error rate alert
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="API High Error Rate" \
  --condition-display-name="Error rate > 5%" \
  --condition-threshold-value=0.05 \
  --condition-threshold-duration=300s \
  --condition-filter='resource.type="cloud_run_revision" AND resource.labels.service_name="glowguide-api" AND metric.type="run.googleapis.com/request_count" AND metric.labels.response_code_class="5xx"'
```

### Log-based Metrics

```bash
# Create log-based metric for errors
gcloud logging metrics create api_errors \
  --description="Count of API errors" \
  --log-filter='resource.type="cloud_run_revision"
    resource.labels.service_name="glowguide-api"
    severity>=ERROR'
```

---

## 🔒 Güvenlik Best Practices

### 1. VPC Connector (Private Networking)

```bash
# VPC connector oluştur
gcloud compute networks vpc-access connectors create glowguide-connector \
  --region=us-central1 \
  --range=10.8.0.0/28

# Cloud Run service'lerini güncelle
gcloud run services update glowguide-api \
  --vpc-connector=glowguide-connector \
  --vpc-egress=private-ranges-only \
  --region=us-central1
```

### 2. Cloud Armor (DDoS Protection)

```bash
# Security policy oluştur
gcloud compute security-policies create glowguide-policy \
  --description="GlowGuide security policy"

# Rate limiting rule ekle
gcloud compute security-policies rules create 1000 \
  --security-policy=glowguide-policy \
  --expression="true" \
  --action=rate-based-ban \
  --rate-limit-threshold-count=100 \
  --rate-limit-threshold-interval-sec=60 \
  --ban-duration-sec=600

# Backend service'e attach et
gcloud compute backend-services update glowguide-api-backend \
  --security-policy=glowguide-policy \
  --global
```

### 3. IAM Roles ve Permissions

```bash
# Least privilege principle
# Her service account'a sadece ihtiyaç duyduğu izinleri ver

# API service account
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:glowguide-api@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

# Workers service account
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:glowguide-workers@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"
```

---

## 📈 Scaling Stratejisi

### Otomatik Scaling Konfigürasyonu

```bash
# API - Aggressive scaling
gcloud run services update glowguide-api \
  --min-instances=1 \
  --max-instances=100 \
  --concurrency=80 \
  --cpu-throttling \
  --region=us-central1

# Workers - Conservative scaling
gcloud run services update glowguide-workers \
  --min-instances=1 \
  --max-instances=10 \
  --concurrency=1 \
  --no-cpu-throttling \
  --region=us-central1

# Web - Moderate scaling
gcloud run services update glowguide-web \
  --min-instances=0 \
  --max-instances=50 \
  --concurrency=80 \
  --cpu-throttling \
  --region=us-central1
```

### Database Scaling

```bash
# Vertical scaling (tier upgrade)
gcloud sql instances patch glowguide-db \
  --tier=db-n1-standard-1

# Read replica oluştur
gcloud sql instances create glowguide-db-replica \
  --master-instance-name=glowguide-db \
  --tier=db-n1-standard-1 \
  --region=us-east1

# Connection pooling (PgBouncer)
# Cloud SQL Proxy otomatik connection pooling yapar
```

### Redis Scaling

```bash
# Tier upgrade
gcloud redis instances update glowguide-redis \
  --size=5 \
  --region=us-central1

# High availability
gcloud redis instances update glowguide-redis \
  --tier=standard \
  --region=us-central1
```

---

## 💾 Backup ve Recovery

### Otomatik Backup Stratejisi

```bash
# 1. Cloud SQL otomatik backup (zaten aktif)
gcloud sql instances patch glowguide-db \
  --backup-start-time=03:00 \
  --retained-backups-count=7

# 2. On-demand backup
gcloud sql backups create \
  --instance=glowguide-db \
  --description="Pre-deployment backup $(date +%Y%m%d)"

# 3. Export to Cloud Storage
gcloud sql export sql glowguide-db \
  gs://glowguide-backups/manual-backup-$(date +%Y%m%d).sql \
  --database=glowguide

# 4. Scheduled exports (Cloud Scheduler + Cloud Functions)
# Cloud Function oluştur (backup-function)
# Cloud Scheduler job oluştur
gcloud scheduler jobs create http daily-db-backup \
  --schedule="0 3 * * *" \
  --uri="https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/backup-function" \
  --http-method=POST
```

### Recovery Prosedürü

```bash
# 1. List backups
gcloud sql backups list --instance=glowguide-db

# 2. Restore from backup
gcloud sql backups restore BACKUP_ID \
  --backup-instance=glowguide-db \
  --backup-id=BACKUP_ID

# 3. Point-in-time recovery
gcloud sql instances clone glowguide-db glowguide-db-clone \
  --point-in-time='2024-01-20T10:00:00.000Z'

# 4. Import from Cloud Storage
gcloud sql import sql glowguide-db \
  gs://glowguide-backups/manual-backup-20240120.sql \
  --database=glowguide
```

---

## 🧪 Test ve Validation

### Health Check

```bash
# API health check
curl https://glowguide-api-XXXXX-uc.a.run.app/health

# Expected response:
# {
#   "status": "ok",
#   "timestamp": "2024-01-20T...",
#   "services": {
#     "redis": "connected",
#     "database": "connected"
#   }
# }

# Web health check
curl https://glowguide-web-XXXXX-uc.a.run.app

# Expected: 200 OK
```

### Load Testing

```bash
# Apache Bench ile load test
ab -n 1000 -c 10 https://glowguide-api-XXXXX-uc.a.run.app/health

# Locust ile load test
pip install locust

cat > locustfile.py << 'EOF'
from locust import HttpUser, task, between

class GlowGuideUser(HttpUser):
    wait_time = between(1, 3)
    
    @task
    def health_check(self):
        self.client.get("/health")
    
    @task(3)
    def get_products(self):
        self.client.get("/api/products")
EOF

locust -f locustfile.py --host=https://glowguide-api-XXXXX-uc.a.run.app
```

---

## 📋 Deployment Checklist

### Pre-Deployment

- [ ] GCP projesi oluşturuldu
- [ ] Billing hesabı bağlandı
- [ ] Gerekli API'ler aktif edildi
- [ ] gcloud CLI kuruldu ve yapılandırıldı
- [ ] Cloud SQL instance oluşturuldu
- [ ] Memorystore Redis oluşturuldu
- [ ] Secrets Manager'da secret'lar saklandı
- [ ] Docker image'ları build edildi
- [ ] Artifact Registry'ye push edildi

### Deployment

- [ ] API service deploy edildi
- [ ] Workers service deploy edildi
- [ ] Web service deploy edildi
- [ ] Database migration'ları çalıştırıldı
- [ ] Load Balancer kuruldu
- [ ] SSL sertifikası yapılandırıldı
- [ ] Custom domain bağlandı
- [ ] DNS kayıtları güncellendi

### Post-Deployment

- [ ] Health check'ler başarılı
- [ ] API endpoints yanıt veriyor
- [ ] Frontend açılıyor
- [ ] Workers job'ları işliyor
- [ ] Monitoring dashboard'ları aktif
- [ ] Uptime check'ler çalışıyor
- [ ] Alert policy'leri aktif
- [ ] Backup stratejisi çalışıyor
- [ ] Load testing yapıldı

---

## 🆘 Troubleshooting

### Cloud Run Service Başlamıyor

```bash
# Logs kontrol et
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=glowguide-api" \
  --limit=50 \
  --format=json

# Service detaylarını kontrol et
gcloud run services describe glowguide-api \
  --region=us-central1

# Yaygın sorunlar:
# 1. Environment variables eksik
# 2. Secret erişim izni yok
# 3. Cloud SQL connection hatası
# 4. Memory/CPU limitleri düşük
```

### Cloud SQL Connection Error

```bash
# Cloud SQL Proxy ile test et
./cloud-sql-proxy YOUR_PROJECT_ID:us-central1:glowguide-db

# Connection string'i kontrol et
gcloud sql instances describe glowguide-db \
  --format="value(connectionName)"

# IAM permissions kontrol et
gcloud projects get-iam-policy YOUR_PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:glowguide-api@*"
```

### Redis Connection Error

```bash
# Redis instance durumunu kontrol et
gcloud redis instances describe glowguide-redis \
  --region=us-central1

# VPC connector kontrol et
gcloud compute networks vpc-access connectors describe glowguide-connector \
  --region=us-central1

# Redis'e bağlan ve test et
redis-cli -h REDIS_HOST -p 6379
> PING
> PONG
```

### High Latency

```bash
# Cloud Trace ile latency analizi
gcloud services enable cloudtrace.googleapis.com

# Logs'ta slow queries ara
gcloud logging read "resource.type=cloud_run_revision AND jsonPayload.duration>1000" \
  --limit=50

# Çözümler:
# 1. Cloud CDN aktif et
# 2. Database query'leri optimize et
# 3. Redis cache'i artır
# 4. Min instances artır (cold start'ı azalt)
```

---

## 💡 Best Practices ve İpuçları

### 1. Maliyet Optimizasyonu

- **Committed Use Discounts** kullan (1-3 yıl)
- **Preemptible instances** kullan (workers için)
- **Cloud CDN** aktif et (egress maliyetini azaltır)
- **Log retention** süresini optimize et
- **Idle instances'ı** minimize et

### 2. Performance Optimization

- **Min instances** ayarla (cold start'ı önle)
- **Connection pooling** kullan
- **Redis caching** stratejisi optimize et
- **Database indexes** optimize et
- **CDN** kullan (static assets için)

### 3. Security

- **VPC Connector** kullan (private networking)
- **Cloud Armor** aktif et (DDoS protection)
- **IAM roles** minimize et (least privilege)
- **Secrets Manager** kullan (hardcoded secrets yok)
- **SSL/TLS** zorunlu kıl

### 4. Reliability

- **Health checks** yapılandır
- **Graceful shutdown** implement et
- **Retry logic** ekle
- **Circuit breakers** kullan
- **Multi-region** deployment (production için)

---

## 📞 Destek ve Kaynaklar

### GCP Dokümantasyon

- [Cloud Run Docs](https://cloud.google.com/run/docs)
- [Cloud SQL Docs](https://cloud.google.com/sql/docs)
- [Memorystore Docs](https://cloud.google.com/memorystore/docs)
- [Cloud Build Docs](https://cloud.google.com/build/docs)

### Community

- [GCP Slack](https://googlecloud-community.slack.com)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/google-cloud-platform)
- [GCP Reddit](https://reddit.com/r/googlecloud)

### Support

- [GCP Support](https://cloud.google.com/support)
- [GCP Status](https://status.cloud.google.com)

---

## 🎉 Sonuç

Bu rehberi takip ederek GlowGuide Retention Agent'ı tamamen GCP üzerinde çalıştırabilirsiniz.

**Özellikler:**
- ✅ Fully managed services (minimal bakım)
- ✅ Otomatik scaling (0'dan 1000+ instance'a)
- ✅ Global CDN ve load balancing
- ✅ Enterprise-grade güvenlik
- ✅ Comprehensive monitoring ve logging
- ✅ Otomatik backup ve disaster recovery

**Başlangıç Maliyeti:** $55-100/ay
**Kurulum Süresi:** 4-6 saat
**Bakım:** Minimal (otomatik yönetim)

Sorularınız için: [GitHub Issues](https://github.com/mrselo90/retetionai/issues)
