# Product Requirements Document (PRD): Recete Retention SaaS

## 1. Yönetici Özeti (Executive Summary)
E-ticaret firmaları için tasarlanmış, **"White-Label"** (Markalanabilir) bir satış sonrası yapay zeka asistanıdır. WhatsApp üzerinden son kullanıcıya bakım koçluğu, kullanım talimatı ve doğru zamanda ürün önerisi sunar. Firmalar için ise iade oranlarını düşüren ve LTV'yi (Müşteri Yaşam Boyu Değeri) artıran bir otomasyon platformudur.

## 2. Hedef Kitle ve Persona
* **Müşteri (Merchant):** İade oranlarından muzdarip, müşteri desteğine yetişemeyen orta/büyük ölçekli kozmetik ve bakım markaları.
* **Son Kullanıcı (End-User):** Ürünü satın alan ancak nasıl kullanacağını unutan/bilmeyen, rutin oluşturma disiplinine ihtiyaç duyan tüketici.

## 3. Özellik Seti (Scope)

### Modül A: Son Kullanıcı Deneyimi (WhatsApp Bot)
1.  **Olay Bazlı Tetikleme:** Kargo "Teslim Edildi" statüsüne geçtiğinde otomatik "Hoş geldin" mesajı.
2.  **Akıllı Onboarding:** Ürüne özel, adım adım ilk kullanım rehberi (RAG tabanlı).
3.  **Proaktif Check-in (Şablon Bazlı):** Varsayılan şablon: T+3 ve T+14 (isteğe bağlı T+25). Merchant, şablonu seçebilir/düzenleyebilir.
4.  **Contextual Upsell:** Ürün bitmeye yakın (sipariş/ürün bilgisi + tahmini tüketim) veya memnuniyet onaylandığında tamamlayıcı ürün önerisi.

### Modül B: Merchant Admin Paneli (SaaS Dashboard)
1.  **Entegrasyon Merkezi:** Shopify / WooCommerce / Ticimax vb. platform bağlantılarının yönetildiği alan + manuel entegrasyon seçenekleri.
2.  **Knowledge Base (Veri Girişi):**
    * **URL Scraper:** Ürün linkini yapıştır -> Açıklamayı ve özellikleri otomatik çek.
    * **Manuel Düzenleme:** Botun cevabını override etme (Örn: "Bu ürün için 'hamileler kullanamaz' uyarısını ekle").
3.  **Persona Tuner (Kişilik Ayarı):**
    * Marka ses tonunu ayarlamak için görsel sliderlar (Detaylar UX dökümanında).
4.  **Analytics Dashboard:** Tüm KPI'ların izlendiği ana ekran.

### Modül C: Entegrasyonlar (Platformlar + Manuel)
Amaç: Merchant’ın **kod yazmadan** veya **minimum teknik eforla** sistemi devreye alabilmesi; teslimat tetikleyicileri ve sipariş bağlamının güvenilir şekilde gelmesi.

#### C1. Desteklenen entegrasyon modları
1. **Platform Connector (Native)**
   - Shopify
   - WooCommerce
   - Ticimax
   - (Backlog / sıradaki: İkas, IdeaSoft, Magento, özel altyapılar)
2. **Manuel Entegrasyon (Platform bağımsız)**
   - **CSV/Excel Import**: Sipariş + müşteri + ürün satırları.
   - **HTTP API (Push)**: Merchant kendi sisteminden sipariş/teslimat event’i gönderir.
   - **Webhook (Merchant → Recete)**: Merchant bir event yayınlar, Recete tüketir.

#### C2. Minimum gerekli veri (MVP)
MVP’nin çalışması için en az şu alanların gelmesi gerekir:
- **Merchant Kimliği**: `merchant_id` / API key
- **Sipariş**: `order_id`, `created_at`, `status`
- **Teslimat**: `delivery_date` veya `delivered_at` (tetikleyici)
- **Kullanıcı**: `phone` (WhatsApp için), `name` (opsiyonel), `consent_status` (opt-in/opt-out)
- **Ürün**: `product_id` veya en azından ürün adı + URL (knowledge base eşleştirmesi için)

#### C3. Gerekli event’ler (önerilen)
- `order_created`
- `order_delivered` (kritik: T+0 onboarding tetikleyicisi)
- `order_cancelled`
- `order_returned` / `return_requested`
- (opsiyonel) `fulfillment_updated` / `shipment_status_changed`

#### C3.1 Teslimat bilgisinin kaynağı (MVP)
`order_delivered` üretmek için (sırayla tercih):
1. **E-ticaret platformu fulfillment statüsü** (Shopify/Woo/Ticimax)
2. **Kargo/lojistik sağlayıcı webhook’u** (varsa; merchant yönlendirir veya Recete connector eklenir)
3. **Manuel teslim edildi işaretleme** (admin panel veya CSV alanı: `delivered_at`)

#### C4. Alan eşleştirme ve doğrulama
- Platformlardan gelen alanlar admin panelinde “**Field Mapping**” ekranında doğrulanır (ör. telefon alanı, teslimat alanı).
- İlk kurulumda “**Test Event**” ile tek bir sipariş üzerinden uçtan uca doğrulama yapılır (event alındı → kullanıcı bulundu → mesaj kuyruğa düştü → WhatsApp gönderimi).

#### C5. Edge-case’ler (MVP’de kural seti)
- **Teslimat bilgisi yoksa**: “Kargo statüsü teslim edildi” gelene kadar onboarding tetiklenmez.
- **Telefon yok/invalid**: Mesaj atılmaz, admin panelde “Action Required” kuyruğuna düşer.
- **Opt-out**: Kullanıcı “DUR” vb. ile opt-out olduysa tüm otomatik akış durur.
- **Return/Cancel**: Akış durur; varsa planlı görevler iptal edilir.

## 4. Başarı Metrikleri (KPIs)

### Leading Indicators (Öncü Göstergeler - Anlık Sağlık)
* **DAU (Daily Active Users):** Bot ile aktif konuşan tekil kullanıcı sayısı.
* **Message Volume:** Gönderilen/Alınan toplam mesaj sayısı.
* **Interaction Rate:** Botun attığı ilk mesaja cevap verilme oranı (Hedef > %35).
* **Sentiment Score:** Konuşmaların duygu analizi ortalaması (1-5 arası).

### Lagging Indicators (Artçı Göstergeler - Finansal Başarı)
* **Return Rate Delta:** Botu kullanan vs. kullanmayan kitle arasındaki iade oranı farkı.
* **Repeat Purchase Rate:** Upsell önerisi sonrası gerçekleşen satış oranı.
* **Deflection Rate:** İnsan desteğine ihtiyaç duymadan çözülen sorun oranı.

## 5. Güvenlik ve Sınırlamalar (Guardrails)
* **Tıbbi Tavsiye Yasağı:** Bot asla reçete yazmaz, tıbbi tanı koymaz.
* **Kriz Yönetimi:** "Yanık", "Acı", "Dava", "Şikayet" kelimelerinde bot susar ve insana yönlendirir.

## 6. Pricing & Paketler (Öneri)
Not: Fiyatlar placeholder’dır; model ve limit mantığı “ürünleşmiş” olmalıdır.

### 6.1 Fiyatlandırma prensibi
- **Değer metriği**: Mesaj hacmi + aktif kullanıcı (MAU) + entegrasyon sayısı (multi-store) kombinasyonu.
- **Maliyet metriği**: WhatsApp gönderim maliyeti + LLM token tüketimi + scraping/embedding.
- Paketler, “MVP’de en çok kullandıran” kısımları net limitler ile kapsar; aşım (overage) kontrollü satılır.

### 6.2 Paketler
#### Starter
- Hedef: küçük/orta markalar (tek mağaza, hızlı kurulum)
- Dahil:
  - 1 entegrasyon (Shopify/Woo/Ticimax veya Manuel)
  - Persona Builder + Knowledge Base
  - Standart otomasyon şablonları (T+0, T+3, T+14)
  - Analytics (temel)
- Limitler (örnek):
  - Aylık **MAU**: 2.000
  - Aylık **mesaj**: 20.000 (in/out toplam)

#### Growth
- Hedef: büyüyen markalar (yüksek trafik, daha fazla kontrol)
- Dahil:
  - 2 entegrasyon / store
  - Gelişmiş analytics (cohort, return-delta raporu)
  - Check-in şablonlarını düzenleme (T+ günleri konfigüre)
  - “Action Required” iş kuyruğu (telefon yok, opt-in yok vb.)
- Limitler (örnek):
  - Aylık **MAU**: 10.000
  - Aylık **mesaj**: 120.000

#### Enterprise
- Hedef: multi-brand / yüksek hacim / özel güvenlik
- Dahil:
  - Sınırsız entegrasyon (SLA ile)
  - SSO, özel veri saklama (region), özel model/prompt
  - Özel onboarding + entegrasyon desteği
  - SLA & öncelikli destek
- Limitler: sözleşmeye bağlı

### 6.3 Add-on’lar
- **Ek Mesaj Paketi (Overage)**: 10.000 mesaj blokları
- **Ek Store/Entegrasyon**: her ek mağaza başına
- **Rich Media** (video/gif hosting) ve gelişmiş içerik kütüphanesi

### 6.3.1 Üçüncü parti ücretleri (not)
- WhatsApp Business / BSP mesajlaşma ücretleri ve operatör ücretleri ülke/şablon tipine göre değişebilir; paket fiyatına **dahil** veya **ayrı yansıtılan** model sözleşmede netleştirilir.

### 6.4 Trial & Aktivasyon
- 14 gün deneme veya “ilk 500 MAU/5.000 mesaj ücretsiz”
- Trial’da: 1 entegrasyon, temel analytics, watermark opsiyonel

### Modül D: Test & Development Interface (Geliştirme Arayüzü)
Amaç: Tüm sistem bileşenlerini **gerçek entegrasyonlar olmadan** test edebilmek; geliştirme, QA ve demo süreçlerini hızlandırmak.

#### D1. Mock Event Simülatörü
- **Event gönderme:** `order_created`, `order_delivered`, `order_cancelled`, `order_returned` event'lerini manuel olarak tetikleme
- **Payload editor:** JSON editor ile normalize event payload'u düzenleme
- **Sonuç görüntüleme:** Event alındı → order/user oluştu → scheduled task oluşturuldu → mesaj kuyruğa düştü akışını adım adım görüntüleme

#### D2. WhatsApp Mesaj Simülatörü
- **Gelen mesaj simülasyonu:** Kullanıcıdan gelen mesajı mock etme (telefon numarası + mesaj içeriği)
- **Giden mesaj görüntüleme:** Bot'un ürettiği cevabı gerçek zamanlı görüntüleme (LLM çıktısı)
- **Konuşma geçmişi:** Mock konuşmaları görüntüleme ve temizleme

#### D3. RAG Pipeline Testi
- **Ürün bilgisi sorgulama:** Seçili ürün için knowledge chunks görüntüleme
- **Vektör arama testi:** Soru metni → embedding → similarity search → top chunks sonuçları
- **LLM prompt önizleme:** System prompt + persona + context + chunks → final prompt görüntüleme

#### D4. Scheduled Task Yönetimi
- **Task listesi:** Tüm scheduled task'ları görüntüleme (type, execute_at, status, user_id, order_id)
- **Manuel tetikleme:** T+0, T+3, T+14 task'larını hemen çalıştırma (execute_at'i override)
- **Task iptal:** Seçili task'ları iptal etme

#### D5. Sistem Durumu (System Health)
- **Queue durumu:** BullMQ job'ları (pending, active, completed, failed)
- **Database state:** Orders, users, conversations, products tablolarından son N kayıt görüntüleme
- **Analytics snapshot:** DAU, message volume, sentiment score (test verileri ile)

#### D6. Persona Testi
- **Canlı önizleme:** Persona ayarlarını değiştir → örnek soru sor → bot cevabını anlık görüntüle
- **A/B test:** İki farklı persona ayarını karşılaştırma (aynı soruya iki farklı cevap)

#### D7. Guardrails Testi
- **Kriz kelime testi:** "Yanık", "Acı", "Dava" gibi kelimelerle mesaj gönder → insan yönlendirme akışını doğrula
- **Tıbbi tavsiye bloklama:** Tıbbi içerikli sorulara bot'un "tıbbi tavsiye veremem" cevabını test et

#### D8. Entegrasyon Testi (Mock)
- **Shopify mock:** OAuth olmadan Shopify event'lerini simüle etme
- **WooCommerce mock:** API key olmadan WooCommerce order event'lerini simüle etme
- **CSV import test:** Örnek CSV dosyası ile import akışını test etme

## 7. MVP Çıkış Kriterleri (Go/No-Go)
- İlk 3 merchant'ta:
  - Interaction Rate > %30
  - Opt-out rate < %3
  - En az 1 platform connector + manuel entegrasyon sorunsuz çalışıyor
- **Test Interface:** Tüm sistem bileşenleri test arayüzü üzerinden doğrulanabilir durumda