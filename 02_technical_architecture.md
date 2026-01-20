# Technical Specification: AI Retention Platform

## 1. Teknoloji Yığını (Tech Stack)
* **Backend:** Node.js (TypeScript) + Hono (Lightweight framework).
* **Database:** Supabase (PostgreSQL). Hem Relational veri hem Vector verisi (pgvector) tek yerde.
* **Queue:** BullMQ + Redis (Zamanlanmış mesajlar ve scrape jobları için).
* **LLM Orchestration:** LangChain.js.
* **LLM Model:** GPT-4o (Reasoning & Complex Queries) + GPT-3.5-Turbo (Sentiment Analysis & Summarization - Cost optimization).
* **Messaging Provider:** WhatsApp Business API (Twilio veya BSP).

## 2. Veri Mimarisi (Database Schema)

### Core Tables (Multi-Tenant)
* `merchants`: (id, name, api_keys, webhook_secret, persona_settings JSONB).
* `integrations`: (id, merchant_id, provider, status, auth_type, auth_data JSONB, created_at).
* `products`: (id, merchant_id, external_id, name, url, raw_text, vector_id).
* `users`: (id, merchant_id, phone, name, consent_status).
* `orders`: (id, merchant_id, user_id, status, delivery_date).

### Intelligence Tables
* `knowledge_chunks`: (id, product_id, chunk_text, embedding vector(1536)).
* `conversations`: (id, user_id, order_id, history JSONB, current_state).
* `analytics_events`: (id, merchant_id, event_type, value, sentiment_score, created_at).
* `sync_jobs`: (id, merchant_id, integration_id, job_type, status, started_at, finished_at, meta JSONB).
* `external_events`: (id, merchant_id, integration_id, source, event_type, payload JSONB, received_at, idempotency_key).

## 3. Sistem Akışları (Data Flows)

### A. Ürün İçeriği Alma (Ingestion Pipeline)
1.  Merchant admin panelinden ürün URL'ini girer (`POST /api/scrape`).
2.  **Scraper Service (Puppeteer):** Sayfaya gider, HTML'i parse eder, ana içeriği (main content) temizler.
3.  **Embedding Service:** Metni anlamsal parçalara böler, OpenAI Embedding API'ye gönderir.
4.  Sonuçlar `knowledge_chunks` tablosuna `merchant_id` etiketiyle kaydedilir.

### B. Entegrasyonlar (Platform Connector + Manuel)
Amaç: Shopify / WooCommerce / Ticimax vb. platformlardan sipariş ve teslimat event’lerini alıp, **idempotent** şekilde işlemek.

#### B1. Entegrasyon modları
1. **Platform Connector (Native)**
   - `provider = shopify | woocommerce | ticimax | ...`
   - Auth: OAuth (Shopify) veya API Key/Secret (Woo/Ticimax varyantları)
2. **Manuel Entegrasyon**
   - **CSV Import** (admin panel upload)
   - **HTTP API Push** (merchant → GlowGuide)
   - **Webhook (Merchant → GlowGuide)** (merchant kendi event’ini yolluyor)

#### B2. Normalleştirilmiş event modeli
Tüm kaynaklar aşağıdaki normalize event’lere map edilir:
- `order_created`
- `order_delivered` (kritik)
- `order_cancelled`
- `order_return_requested` / `order_returned`
- (opsiyonel) `shipment_status_changed`

Minimum payload (normalize edilmiş):
- `merchant_id`
- `external_order_id`
- `event_type`
- `occurred_at`
- `customer`: `{ phone, name? }`
- `order`: `{ status, delivered_at?, created_at }`
- `items[]`: `{ external_product_id?, name, url? }`
- `consent_status` (varsa)

#### B2.1 Teslimat kaynağı ve üretim stratejisi
`order_delivered` event’i aşağıdaki kaynaklardan gelebilir:
1. **Platform fulfillment/delivery statüsü** (native connector)
2. **Kargo/lojistik event’i** (merchant push/webhook veya ayrı connector)
3. **Manual override** (admin panel aksiyonu veya CSV alanı `delivered_at`)

#### B3. Idempotency ve tekrar işleme
- Her event için `idempotency_key` oluşturulur: `source + event_type + external_order_id + occurred_at` (veya upstream event_id).
- `external_events` tablosunda unique constraint ile tekrarlar drop edilir.
- İşleme (order upsert + task schedule) **at-least-once** teslimatta güvenli olmalıdır.

#### B4. Manual CSV Import sözleşmesi (MVP)
CSV header önerisi:
- `external_order_id, created_at, delivered_at, status, customer_phone, customer_name, product_name, product_url, product_external_id`
Davranış:
- Satır bazlı item’lar aynı `external_order_id` altında gruplanır.
- Telefon invalid ise order “action_required” bayrağı ile işaretlenir (mesaj yok).

### B. Konuşma Döngüsü (RAG Pipeline)
1.  Webhook'tan gelen mesaj alınır.
2.  **Router:** Mesaj bir şikayet mi, soru mu yoksa sohbet mi?
3.  **Retrieval:** Eğer soru ise, kullanıcının sipariş ettiği ürünle ilgili `knowledge_chunks` içinde vektör araması yapılır.
4.  **Generation:** Bulunan bilgi + Merchant'ın Persona Ayarları + Sohbet Geçmişi LLM'e gönderilir.
5.  Cevap üretilir ve WhatsApp'tan gönderilir.

### C. Analytics Pipeline
1.  Her mesajlaşma olayı asenkron olarak `analytics_events` tablosuna yazılır.
2.  Küçük bir LLM (Side-car model), gelen mesajın duygu durumunu (Sentiment) 1-5 arası puanlar ve kaydeder.
3.  Dashboard sorguları, bu ham tablo yerine günlük olarak güncellenen `daily_stats` (Materialized View) üzerinden çalışır.

## 4. API Sözleşmeleri (Taslak)
### 4.1 Webhook/Push (Merchant → GlowGuide)
- `POST /webhooks/commerce/event`
  - Auth: `X-Api-Key` (merchant) + opsiyonel HMAC signature
  - Body: normalize event (B2)
  - Response: `202 Accepted`

### 4.2 CSV Import
- `POST /api/import/orders/csv`
  - Multipart upload + async `sync_jobs`
  - Response: `job_id`

### 4.3 Inbound WhatsApp
- `POST /webhooks/whatsapp/inbound`
  - Provider doğrulaması + message normalization

## 5. Plan bazlı limitler (SaaS)
Amaç: pricing paketleri ile uyumlu teknik throttle.
- Limit örnekleri:
  - Aylık `messages_total`
  - Aylık `mau`
  - `integrations_count`
- Enforcement:
  - Her outbound message öncesi quota check (soft/hard limit)
  - Aşımda: kuyruğa alma + admin uyarısı veya hard block (pakete göre)

## 6. Güvenlik
* **Data Isolation:** Her sorguda `WHERE merchant_id = X` filtresi zorunludur (RLS - Row Level Security).
* **PII:** Telefon numaraları şifreli saklanır.

## 7. Platform Bazlı Field Mapping Checklist + Örnek Payload’lar (MVP)
Amaç: Entegrasyon kurulumunu “kanıtlanabilir” hale getirmek (test event → normalize event → mesaj job).

### 7.1 GlowGuide Normalize Event (Referans Şema)
Örnek `order_delivered`:
```json
{
  "merchant_id": "m_123",
  "integration_id": "i_abc",
  "source": "shopify",
  "event_type": "order_delivered",
  "occurred_at": "2026-01-19T10:12:00Z",
  "external_order_id": "SHP-100045",
  "customer": { "phone": "+905551112233", "name": "Ayşe" },
  "order": { "status": "delivered", "created_at": "2026-01-17T09:00:00Z", "delivered_at": "2026-01-19T10:12:00Z" },
  "items": [
    { "external_product_id": "p_987", "name": "C Vitamini Serum", "url": "https://merchant.com/products/c-serum" }
  ],
  "consent_status": "opt_in"
}
```

### 7.2 Shopify Connector (Checklist)
#### Yetkiler / erişimler
- Webhook subscription oluşturma yetkisi (Admin API)
- Read orders, read customers, read fulfillments

#### Kritik alanlar (map)
- **Order ID**: `order.id` veya `order.name` (harici referans)
- **Order Created At**: `order.created_at`
- **Delivery/fulfillment**:
  - `fulfillments[].status` + `fulfillments[].updated_at`
  - “delivered” semantiği platformda net değilse, kargo tracking event’i veya manual override ile tamamla
- **Customer phone**:
  - `order.shipping_address.phone` → yoksa `order.billing_address.phone` → yoksa `customer.phone`
  - Phone E.164 formatına normalize edilmeli
- **Customer name**: `order.shipping_address.first_name` + `last_name` (fallback: `customer.first_name/last_name`)
- **Line items**: `line_items[].product_id` + `line_items[].name`
- **Product URL** (opsiyonel): Shopify’da direkt URL yerine handle ile oluşturulabilir: `/products/{handle}`

#### Ham webhook örneği (kısaltılmış)
```json
{
  "id": 100045,
  "name": "#100045",
  "created_at": "2026-01-17T09:00:00Z",
  "customer": { "first_name": "Ayşe", "last_name": "Yılmaz", "phone": "+905551112233" },
  "shipping_address": { "phone": "+905551112233" },
  "line_items": [{ "product_id": 987, "name": "C Vitamini Serum" }],
  "fulfillments": [{ "status": "success", "updated_at": "2026-01-19T10:12:00Z" }]
}
```

### 7.3 WooCommerce Connector (Checklist)
#### Yetkiler / erişimler
- REST API consumer key/secret (read/write webhooks)
- Orders read

#### Kritik alanlar (map)
- **Order ID**: `id`
- **Order Created At**: `date_created_gmt` (tercih) / `date_created`
- **Order Status**: `status` (ör. `completed`)
- **Delivery**:
  - Woo’da “delivered” statüsü çoğunlukla yoktur; MVP’de iki seçenek:
    - `completed` → delivered kabul et (merchant onayı ile)
    - Kargo entegrasyonu / manual delivered_at ile “order_delivered” üret
- **Customer phone**: `billing.phone` (çoğunlukla en güvenilir alan)
- **Customer name**: `billing.first_name` + `billing.last_name` (fallback: shipping)
- **Line items**: `line_items[].product_id` + `name`
- **Product URL** (opsiyonel): ürün endpoint’inden `permalink` ile zenginleştirilebilir (async enrichment)

#### Ham order payload örneği (kısaltılmış)
```json
{
  "id": 20012,
  "status": "completed",
  "date_created_gmt": "2026-01-17T09:00:00Z",
  "billing": { "first_name": "Ayşe", "last_name": "Yılmaz", "phone": "05551112233" },
  "line_items": [{ "product_id": 321, "name": "C Vitamini Serum" }]
}
```

### 7.4 Ticimax Connector (Checklist)
Not: Ticimax entegrasyon detayları müşteriye göre değişebilir; bu checklist “minimum sözleşme”dir.

#### Yetkiler / erişimler
- Sipariş sorgulama ve durum/teslimat bilgisi erişimi (API token / kullanıcı)
- (varsa) webhook veya periyodik polling izni

#### Kritik alanlar (map)
- **Order ID**: platform order number / id
- **Order Created At**: sipariş tarihi
- **Delivery/Status**:
  - “Kargoya verildi / teslim edildi” ayrımını netleştir
  - Teslim edildi bilgisi yoksa: kargo takip entegrasyonu veya admin panel manual delivered_at
- **Customer phone**: teslimat / fatura telefon alanı (format normalize)
- **Customer name**: ad soyad
- **Line items**: ürün adı + (varsa) ürün kodu / id
- **Product URL**: ürün sayfası linki (varsa) — yoksa knowledge base eşleştirmesi ürün adı üzerinden yapılır

#### Ticimax için test stratejisi (öneri)
- Wizard’da “Son 1 siparişi çek” → mapping doğrula → “delivered simülasyonu” (manual) → test mesajı