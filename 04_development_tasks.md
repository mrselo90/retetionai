# Recete Retention Agent — Geliştirme Task Listesi

Bu doküman, PRD, Technical Spec ve UX Guidelines dokümanlarına dayalı olarak hazırlanmış **MVP geliştirme task listesidir**. Frontend ve Backend olarak ayrılmış, öncelik sırasına göre düzenlenmiştir.

---

## Faz 0: Proje Altyapısı (Foundation)

### Backend (BE)

| # | Task | Açıklama | Öncelik | Durum |
|---|------|----------|---------|-------|
| BE-0.1 | **Monorepo kurulumu** | Node.js + TypeScript + Hono; pnpm workspace (api, workers, shared) | 🔴 Kritik | ⬜ |
| BE-0.2 | **Supabase setup** | PostgreSQL + pgvector; RLS policies; ortam değişkenleri | 🔴 Kritik | ⬜ |
| BE-0.3 | **Redis + BullMQ setup** | Queue altyapısı (scheduled messages, scrape jobs, analytics) | 🔴 Kritik | ⬜ |
| BE-0.4 | **Auth altyapısı** | Merchant signup/login (Supabase Auth veya custom JWT); API key üretimi | 🔴 Kritik | ⬜ |

### Frontend (FE)

| # | Task | Açıklama | Öncelik | Durum |
|---|------|----------|---------|-------|
| FE-0.1 | **Frontend monorepo** | Next.js 14 (App Router) + TypeScript + Tailwind; Supabase client | 🔴 Kritik | ⬜ |
| FE-0.2 | **Auth sayfaları** | Login, Signup, Forgot Password; Supabase Auth entegrasyonu | 🔴 Kritik | ⬜ |
| FE-0.3 | **Layout & Navigation** | Sidebar (Dashboard, Ürünler, Entegrasyonlar, Ayarlar), Header, Responsive | 🔴 Kritik | ⬜ |

---

## Faz 1: Merchant Onboarding & Entegrasyonlar

### Backend

| # | Task | Açıklama | Öncelik | Durum |
|---|------|----------|---------|-------|
| BE-1.1 | **Merchant CRUD** | `merchants` tablosu; persona_settings JSONB; API key yönetimi | 🔴 Kritik | ⬜ |
| BE-1.2 | **Integrations tablosu** | `integrations` (provider, auth_type, auth_data, status) | 🔴 Kritik | ⬜ |
| BE-1.3 | **Shopify OAuth Connector** | OAuth 2.0 flow; access token saklama; webhook subscription (order/fulfillment) | 🔴 Kritik | ⬜ |
| BE-1.4 | **WooCommerce Connector** | API Key/Secret doğrulama; webhook kurulumu; order polling (opsiyonel) | 🟡 Yüksek | ⬜ |
| BE-1.5 | **Ticimax Connector** | API token doğrulama; sipariş çekme; polling veya webhook (varsa) | 🟡 Yüksek | ⬜ |
| BE-1.6 | **Webhook ingestion endpoint** | `POST /webhooks/commerce/event`; normalize event → `external_events`; idempotency | 🔴 Kritik | ⬜ |
| BE-1.7 | **CSV import endpoint** | `POST /api/import/orders/csv`; async job; satır validation; `sync_jobs` tracking | 🟡 Yüksek | ⬜ |
| BE-1.8 | **Event normalizer** | Shopify/Woo/Ticimax/CSV → normalize `order_delivered` vb. | 🔴 Kritik | ⬜ |
| BE-1.9 | **Order/User upsert** | `orders`, `users` tablolarına idempotent insert/update | 🔴 Kritik | ⬜ |

### Frontend

| # | Task | Açıklama | Öncelik | Durum |
|---|------|----------|---------|-------|
| FE-1.1 | **Entegrasyon Merkezi** | Platform kartları (Shopify, Woo, Ticimax, Manuel); kurulum durumu | 🔴 Kritik | ⬜ |
| FE-1.2 | **Shopify OAuth wizard** | "Connect with Shopify" → OAuth redirect → callback → başarı | 🔴 Kritik | ⬜ |
| FE-1.3 | **Woo/Ticimax API Key wizard** | API Key/Secret form → doğrulama → webhook URL gösterimi | 🟡 Yüksek | ⬜ |
| FE-1.4 | **Field Mapping ekranı** | Telefon, teslimat, ürün alanları mapping; doğrulama kuralları | 🟡 Yüksek | ⬜ |
| FE-1.5 | **Test Event UI** | "Test event gönder" butonu; sonuç gösterimi (başarı/hata) | 🟡 Yüksek | ⬜ |
| FE-1.6 | **CSV Import ekranı** | Template indir; upload; job progress; hata listesi | 🟡 Yüksek | ⬜ |
| FE-1.7 | **API/Webhook kurulum ekranı** | API Key oluştur; webhook URL kopyala; payload örneği; test butonu | 🟢 Orta | ⬜ |

---

## Faz 2: Knowledge Base (Ürün Bilgisi)

### Backend

| # | Task | Açıklama | Öncelik | Durum |
|---|------|----------|---------|-------|
| BE-2.1 | **Scraper service** | Puppeteer ile URL'den içerik çekme; HTML temizleme | 🔴 Kritik | ⬜ |
| BE-2.2 | **Chunking & Embedding** | Metni chunk'lara böl; OpenAI Embedding API; `knowledge_chunks` insert | 🔴 Kritik | ⬜ |
| BE-2.3 | **Products CRUD** | `products` tablosu; merchant_id, external_id, name, url, raw_text | 🔴 Kritik | ⬜ |
| BE-2.4 | **Scrape job queue** | BullMQ job; retry; status tracking (`sync_jobs`) | 🟡 Yüksek | ⬜ |
| BE-2.5 | **Manuel içerik override** | Product'a custom instructions ekleme (JSONB) | 🟢 Orta | ⬜ |

### Frontend

| # | Task | Açıklama | Öncelik | Durum |
|---|------|----------|---------|-------|
| FE-2.1 | **Ürün listesi sayfası** | Tablo: ürün adı, URL, chunk sayısı, durum | 🔴 Kritik | ⬜ |
| FE-2.2 | **Ürün ekleme wizard** | URL input → scrape progress animasyonu → önizleme → onayla/düzenle | 🔴 Kritik | ⬜ |
| FE-2.3 | **Ürün detay/düzenleme** | Çekilen içerik görüntüleme; manuel override alanı; kaydet | 🟡 Yüksek | ⬜ |

---

## Faz 3: AI Agent (RAG Pipeline + Conversation)

### Backend

| # | Task | Açıklama | Öncelik | Durum |
|---|------|----------|---------|-------|
| BE-3.1 | **Conversations tablosu** | `conversations` (user_id, order_id, history JSONB, current_state) | 🔴 Kritik | ⬜ |
| BE-3.2 | **WhatsApp webhook handler** | `POST /webhooks/whatsapp/inbound`; message normalization | 🔴 Kritik | ⬜ |
| BE-3.3 | **Intent router** | Gelen mesajı sınıflandır: soru / şikayet / sohbet / opt-out | 🔴 Kritik | ⬜ |
| BE-3.4 | **RAG retrieval** | Kullanıcının siparişindeki ürün → `knowledge_chunks` vektör araması | 🔴 Kritik | ⬜ |
| BE-3.5 | **LLM generation** | System prompt + persona settings + context + sohbet geçmişi → GPT-4o | 🔴 Kritik | ⬜ |
| BE-3.6 | **WhatsApp send service** | Twilio/BSP API ile mesaj gönderimi; template vs session message | 🔴 Kritik | ⬜ |
| BE-3.7 | **Guardrails** | Kriz kelimeleri (yanık, acı, dava) → insan yönlendirme; tıbbi tavsiye bloklama | 🔴 Kritik | ⬜ |
| BE-3.8 | **Upsell logic** | Memnuniyet kontrolü + tamamlayıcı ürün önerisi (basit kural tabanlı MVP) | 🟡 Yüksek | ⬜ |

### Frontend

| # | Task | Açıklama | Öncelik | Durum |
|---|------|----------|---------|-------|
| FE-3.1 | **Konuşmalar listesi** | Kullanıcı listesi; son mesaj; sentiment badge | 🟡 Yüksek | ⬜ |
| FE-3.2 | **Konuşma detay** | Sohbet geçmişi (WhatsApp benzeri UI); read-only (MVP) | 🟡 Yüksek | ⬜ |

---

## Faz 4: Proaktif Mesajlaşma (Scheduled Tasks)

### Backend

| # | Task | Açıklama | Öncelik | Durum |
|---|------|----------|---------|-------|
| BE-4.1 | **Scheduled tasks tablosu** | `scheduled_tasks` (type, execute_at, status, user_id, order_id) | 🔴 Kritik | ⬜ |
| BE-4.2 | **Task scheduler** | `order_delivered` → T+0 welcome, T+3 check-in, T+14 check-in job'ları oluştur | 🔴 Kritik | ⬜ |
| BE-4.3 | **Task executor worker** | BullMQ delayed job; execute_at gelince → mesaj üret + gönder | 🔴 Kritik | ⬜ |
| BE-4.4 | **Task cancellation** | Return/cancel/opt-out → ilgili task'ları iptal et | 🟡 Yüksek | ⬜ |
| BE-4.5 | **Check-in şablon yönetimi** | Merchant bazlı T+X günleri; varsayılan şablonlar | 🟢 Orta | ⬜ |

### Frontend

| # | Task | Açıklama | Öncelik | Durum |
|---|------|----------|---------|-------|
| FE-4.1 | **Check-in şablon ayarları** | T+3, T+14, T+25 toggle'ları; custom gün girişi | 🟢 Orta | ⬜ |

---

## Faz 5: Persona Builder

### Backend

| # | Task | Açıklama | Öncelik | Durum |
|---|------|----------|---------|-------|
| BE-5.1 | **Persona settings API** | GET/PUT `/api/merchant/persona`; JSONB (ton, emoji, cevap_boyu, bot_name) | 🟡 Yüksek | ⬜ |
| BE-5.2 | **Prompt template engine** | Persona settings → system prompt dinamik üretimi | 🟡 Yüksek | ⬜ |

### Frontend

| # | Task | Açıklama | Öncelik | Durum |
|---|------|----------|---------|-------|
| FE-5.1 | **Persona Builder UI** | Bot ismi input; Ton/Emoji/Cevap boyu slider'ları; canlı önizleme mockup | 🟡 Yüksek | ⬜ |

---

## Faz 6: Analytics Dashboard

### Backend

| # | Task | Açıklama | Öncelik | Durum |
|---|------|----------|---------|-------|
| BE-6.1 | **Analytics events** | Her mesaj/event → `analytics_events` async insert | 🟡 Yüksek | ⬜ |
| BE-6.2 | **Sentiment analysis** | Gelen mesaj → GPT-3.5 sentiment score (1-5) | 🟡 Yüksek | ⬜ |
| BE-6.3 | **Daily stats materialized view** | DAU, message volume, interaction rate, sentiment avg | 🟡 Yüksek | ⬜ |
| BE-6.4 | **Analytics API** | GET `/api/analytics/dashboard`; date range; merchant_id | 🟡 Yüksek | ⬜ |

### Frontend

| # | Task | Açıklama | Öncelik | Durum |
|---|------|----------|---------|-------|
| FE-6.1 | **Dashboard "Health Monitor"** | Header özeti; DAU sparkline; engellenen iade; sorunlu ürünler | 🟡 Yüksek | ⬜ |
| FE-6.2 | **Action Required banner** | Telefon yok, opt-in yok, entegrasyon hata, kota aşımı | 🟡 Yüksek | ⬜ |
| FE-6.3 | **Analytics detay sayfası** | Tarih filtresi; grafikler (mesaj hacmi, sentiment, return delta) | 🟢 Orta | ⬜ |

---

## Faz 7: Plan Limitleri & Billing (SaaS)

### Backend

| # | Task | Açıklama | Öncelik | Durum |
|---|------|----------|---------|-------|
| BE-7.1 | **Plans tablosu** | Starter/Growth/Enterprise; limitler (mau, messages, integrations) | 🟢 Orta | ⬜ |
| BE-7.2 | **Usage tracking** | Aylık MAU, message count; merchant bazlı aggregation | 🟢 Orta | ⬜ |
| BE-7.3 | **Quota enforcement** | Outbound message öncesi limit check; soft/hard block | 🟢 Orta | ⬜ |
| BE-7.4 | **Stripe integration** | Subscription oluşturma; webhook (payment success/fail) | 🟢 Orta | ⬜ |

### Frontend

| # | Task | Açıklama | Öncelik | Durum |
|---|------|----------|---------|-------|
| FE-7.1 | **Plan seçimi ekranı** | Paket karşılaştırma; özellik listesi; "Başla" butonu | 🟢 Orta | ⬜ |
| FE-7.2 | **Kullanım özeti** | Aylık MAU/mesaj kullanımı; limit bar; upgrade CTA | 🟢 Orta | ⬜ |
| FE-7.3 | **Billing sayfası** | Mevcut plan; fatura geçmişi; kart güncelleme | 🟢 Orta | ⬜ |

---

## Faz 8: Test & Development Interface

### Backend

| # | Task | Açıklama | Öncelik | Durum |
|---|------|----------|---------|-------|
| BE-8.1 | **Mock event API** | `POST /api/test/events`; normalize event payload → event normalizer → order/user upsert → task scheduler | 🟡 Yüksek | ⬜ |
| BE-8.2 | **WhatsApp message simulator** | `POST /api/test/messages/inbound`; mock kullanıcı mesajı → intent router → RAG → LLM → cevap döndür | 🟡 Yüksek | ⬜ |
| BE-8.3 | **RAG test endpoint** | `POST /api/test/rag/query`; product_id + soru → embedding → vector search → top chunks döndür | 🟢 Orta | ⬜ |
| BE-8.4 | **Scheduled task management API** | GET `/api/test/tasks`; PUT `/api/test/tasks/:id/trigger` (manuel tetikleme); DELETE `/api/test/tasks/:id` (iptal) | 🟡 Yüksek | ⬜ |
| BE-8.5 | **System health API** | GET `/api/test/health`; queue stats, DB record counts, analytics snapshot | 🟢 Orta | ⬜ |
| BE-8.6 | **Persona preview API** | POST `/api/test/persona/preview`; persona settings + örnek soru → LLM cevap döndür | 🟢 Orta | ⬜ |
| BE-8.7 | **Guardrails test endpoint** | POST `/api/test/guardrails`; mesaj içeriği → kriz kelime kontrolü → yönlendirme kararı | 🟢 Orta | ⬜ |
| BE-8.8 | **Test data cleanup** | DELETE `/api/test/cleanup`; test merchant'ın tüm verilerini temizle (orders, users, conversations, tasks) | 🟢 Orta | ⬜ |

### Frontend

| # | Task | Açıklama | Öncelik | Durum |
|---|------|----------|---------|-------|
| FE-8.1 | **Test Interface ana sayfa** | Tab navigation: Events, Messages, RAG, Tasks, Health, Persona, Guardrails | 🟡 Yüksek | ⬜ |
| FE-8.2 | **Mock Event Simülatörü** | Event type seçimi; JSON editor (payload); "Gönder" butonu; sonuç akışı (adım adım) | 🟡 Yüksek | ⬜ |
| FE-8.3 | **WhatsApp Mesaj Simülatörü** | Telefon numarası input; mesaj input; "Gönder" → bot cevabı görüntüleme; konuşma geçmişi | 🟡 Yüksek | ⬜ |
| FE-8.4 | **RAG Pipeline Testi** | Ürün seçimi; soru input; "Sorgula" → chunks listesi + similarity scores; LLM prompt önizleme | 🟢 Orta | ⬜ |
| FE-8.5 | **Scheduled Task Yönetimi** | Task listesi (tablo); filtreleme (type, status); "Hemen Çalıştır" butonu; "İptal Et" butonu | 🟡 Yüksek | ⬜ |
| FE-8.6 | **Sistem Durumu** | Queue stats (pending/active/completed/failed); DB record counts; analytics snapshot | 🟢 Orta | ⬜ |
| FE-8.7 | **Persona Testi** | Persona ayarları (slider'lar); örnek soru input; "Test Et" → bot cevabı; A/B karşılaştırma | 🟢 Orta | ⬜ |
| FE-8.8 | **Guardrails Testi** | Kriz kelime listesi; test mesajı input; "Test Et" → yönlendirme kararı + açıklama | 🟢 Orta | ⬜ |
| FE-8.9 | **Test Data Cleanup** | "Tüm Test Verilerini Temizle" butonu; onay modalı; temizleme progress | 🟢 Orta | ⬜ |

---

## Sprint Planı (Önerilen)

| Sprint | Süre | Odak | Hedef Çıktı |
|--------|------|------|-------------|
| **Sprint 1** | 2 hafta | Faz 0 + BE-1.1/1.2/1.6/1.8/1.9 + FE-0.x + FE-1.1 | Temel altyapı + webhook ingestion çalışıyor |
| **Sprint 2** | 2 hafta | BE-1.3 (Shopify) + BE-2.x + FE-1.2 + FE-2.x | Shopify bağlantısı + ürün scraping çalışıyor |
| **Sprint 3** | 2 hafta | BE-3.x + BE-4.1/4.2/4.3 | AI agent konuşuyor + proaktif mesaj atıyor |
| **Sprint 4** | 2 hafta | BE-5.x + FE-3.x + FE-5.1 | Persona builder + konuşma görüntüleme |
| **Sprint 5** | 2 hafta | BE-1.4/1.5/1.7 + FE-1.3/1.4/1.5/1.6 | Woo + Ticimax + CSV import |
| **Sprint 6** | 2 hafta | BE-6.x + FE-6.x | Analytics dashboard |
| **Sprint 7** | 2 hafta | BE-7.x + FE-7.x + polish | Billing + launch hazırlığı |
| **Sprint 8** | 1 hafta | BE-8.x + FE-8.x | Test Interface (geliştirme ve QA için kritik) |

---

## Durum Açıklamaları

| Sembol | Anlam |
|--------|-------|
| ⬜ | Başlanmadı |
| 🔄 | Devam ediyor |
| ✅ | Tamamlandı |
| ❌ | İptal edildi |
| ⏸️ | Beklemede |

---

## Öncelik Açıklamaları

| Öncelik | Anlam |
|---------|-------|
| 🔴 Kritik | MVP için zorunlu; bloklamaz ise diğer tasklar başlayamaz |
| 🟡 Yüksek | MVP için gerekli; paralel çalışılabilir |
| 🟢 Orta | MVP sonrası veya nice-to-have; ertelenebilir |

---

## Notlar

- **Bağımlılıklar:** Faz 0 tamamlanmadan diğer fazlara geçilmemeli.
- **Paralel çalışma:** Backend ve Frontend task'ları aynı faz içinde paralel ilerleyebilir.
- **Test:** Her task için birim test + entegrasyon testi beklenir.
- **Dokümantasyon:** API endpoint'leri için OpenAPI spec tutulmalı.
