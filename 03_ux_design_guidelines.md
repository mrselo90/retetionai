# UX & UI Guidelines: Admin Panel & Chat Experience

## 1. Merchant Admin Paneli Tasarımı

### A. Dashboard "Health Monitor"
Kullanıcıyı sayılara boğmak yerine renk kodları kullanın.
* **Header:** "Günaydın! Bugün 345 müşterinle konuştum. Mutluluk skoru: 4.8/5 🌟"
* **Kartlar:**
    * **Aktif Kullanıcı (DAU):** Sparkline grafik ile son 7 günün trendi.
    * **Engellenen İade:** "Tahmini Kurtarılan Ciro: ₺15.400" (Yeşil renk).
    * **Sorunlu Ürünler:** "X Serumu hakkında bugün 5 şikayet geldi." (Kırmızı uyarı).

### A1. Kritik durumlar (Action Required)
Dashboard üstünde “Action Required” şeridi:
* Telefonu olmayan/invalid siparişler
* Opt-in alınmamış kullanıcılar
* Entegrasyon hataları (webhook düşmüyor, token expired)
* Kota/limit aşımı (pricing plan)

### B. Persona Builder (Ayar Ekranı)
Merchant'ın kod yazmadan botun kişiliğini ayarladığı alan.
* **Bot İsmi:** [Input] (Örn: Asistan)
* **Slider Kontrolleri:**
    * **Ton:** [ 👔 Resmi ] ---------o------- [ 🥳 Samimi ]
    * **Emoji:** [ 🚫 Yok ] ---------------o-- [ 🦄 Bol ]
    * **Cevap Boyu:** [ ⚡️ Kısa/Net ] ---o------------ [ 📖 Detaylı ]
* **Canlı Önizleme:** Sağ tarafta bir telefon mockup'ı. Slider değiştikçe örnek mesaj anlık olarak değişmeli.

### C. Ürün Ekleme (Knowledge Base Wizard)
* Basit bir input alanı: "Ürün Linkini Yapıştır".
* Yükleniyor animasyonu ("Site taranıyor...", "Bilgiler öğreniliyor...", "Vektörize ediliyor...").
* Sonuç ekranı: Çekilen özet metin gösterilir, Merchant'a "Onayla" veya "Düzenle" seçeneği sunulur.

### D. Entegrasyon Merkezi (Shopify / WooCommerce / Ticimax / Manuel)
Amaç: Merchant’ın 10-15 dakikada “ilk değer”i görmesi (test siparişi → test mesajı).

#### D1. Platform seçimi ekranı
Kartlar:
* Shopify
* WooCommerce
* Ticimax
* Manuel (CSV / API / Webhook)
Her kartın altında: “Tahmini kurulum süresi” ve “Gerekli yetkiler”.

#### D2. Kurulum wizard’ı (adım adım)
Adımlar (provider’a göre değişen içerikle aynı iskelet):
1. **Bağlan**
   - Shopify: “Connect with Shopify” (OAuth)
   - Woo/Ticimax: API Key/Secret girişleri + doğrulama butonu
2. **Alan eşleştir (Field Mapping)**
   - Telefon alanı (zorunlu)
   - Teslimat alanı / fulfillment status (zorunlu)
   - Ürün alanları (product_id/name/url)
   - “Platform checklist” linki: Shopify/Woo/Ticimax mapping rehberi (tech dokümandaki bölüm)
3. **Event testi**
   - “Test Event gönder” veya “Son 1 siparişten test et”
   - Başarı kriterleri: event alındı + order oluştu + mesaj job kuyruğa düştü
4. **Backfill (opsiyonel)**
   - Son 7/30 gün siparişlerini içeri al (analytics ve follow-up için)
5. **Canlıya al**
   - Toggle: “Otomatik mesajlaşmayı aktif et”
   - Uyarı: trial/plan limitleri ve opt-out kuralları

#### D3. Manuel entegrasyon UX’i
1. **CSV ile içeri aktar**
   - Template indir (örnek CSV)
   - Upload → “Import job” ilerleme ekranı (satır sayısı, hata sayısı)
   - Hata listesi: invalid phone, missing delivered_at, unknown columns
2. **API / Webhook ile bağlan**
   - “API Key oluştur” + “Webhook URL kopyala”
   - Kod snippet’leri yerine: “payload örneği” ve “Test Event” butonu
   - Signature doğrulama bilgisi (HMAC) ve retry politikası (UI’da özet)

## 2. Son Kullanıcı (WhatsApp) Tasarımı

### A. Konuşma Tasarımı (Conversation Design)
* **One Breath Rule:** Mesajlar göz ucuyla okunabilir olmalı. Maksimum 3 cümle.
* **Rich Media:**
    * Ürün fotoğrafı ile başla (Görsel hafıza).
    * Kritik uyarılar için ⚠️ emojisi ile madde işareti kullan.
* **CTA (Eylem Çağrısı):** Açık uçlu sorular yerine yönlendirici sorular.
    * *Yanlış:* "Sorun var mı?"
    * *Doğru:* "Kullanım miktarını ayarlayabildin mi? (Evet/Hayır)"

### B. Hata Yönetimi
* Eğer bot cevabı bilmiyorsa: "Bu çok spesifik bir durum. Seni yanıltmak istemem, bu konuyu uzman ekibimize iletiyorum." (Dürüstlük güven sağlar).

### C. Opt-out ve izin yönetimi
* Kullanıcı "DUR" yazınca: anında onay mesajı + otomasyon durur.
* Opt-in yoksa: Bot proaktif mesaj atmaz; merchant panelde "Opt-in needed" olarak görünür.

## 3. Test & Development Interface (Geliştirme Arayüzü)

Amaç: Tüm sistem bileşenlerini gerçek entegrasyonlar olmadan test edebilmek. **Sadece development/test ortamında** erişilebilir olmalı (production'da gizli veya devre dışı).

### A. Ana Sayfa (Tab Navigation)
Sol sidebar'da "Test Interface" linki (sadece dev/test ortamında görünür). Ana sayfa tab navigation:
* **Events** - Mock event simülatörü
* **Messages** - WhatsApp mesaj simülatörü
* **RAG** - RAG pipeline testi
* **Tasks** - Scheduled task yönetimi
* **Health** - Sistem durumu
* **Persona** - Persona testi
* **Guardrails** - Guardrails testi

### B. Mock Event Simülatörü
* **Event Type Seçimi:** Dropdown (order_created, order_delivered, order_cancelled, order_returned)
* **JSON Editor:** Monaco Editor veya basit textarea; normalize event payload şablonu (örnek JSON)
* **"Gönder" Butonu:** Event gönder → loading → sonuç akışı göster:
  * ✅ Event alındı
  * ✅ Order/User oluşturuldu (ID'ler)
  * ✅ Scheduled task oluşturuldu (T+0, T+3, T+14)
  * ✅ Mesaj kuyruğa düştü (job ID)
* **Hata durumu:** Kırmızı alert; hata mesajı + stack trace (opsiyonel)

### C. WhatsApp Mesaj Simülatörü
* **Telefon Numarası Input:** +90 formatında (validation)
* **Mesaj Input:** Textarea; placeholder: "Kullanıcı mesajını buraya yazın"
* **"Gönder" Butonu:** Mesaj gönder → bot cevabı görüntüle
* **Konuşma Geçmişi:** WhatsApp benzeri chat UI; mock mesajlar (gelen/giden); "Temizle" butonu
* **LLM Detayları:** Expandable section: intent classification, RAG chunks kullanıldı mı, sentiment score

### D. RAG Pipeline Testi
* **Ürün Seçimi:** Dropdown (merchant'ın ürünleri)
* **Soru Input:** Textarea; placeholder: "Ürün hakkında soru sorun"
* **"Sorgula" Butonu:** RAG pipeline çalıştır
* **Sonuçlar:**
  * **Top Chunks:** Listelenmiş chunks (similarity score ile)
  * **LLM Prompt Önizleme:** System prompt + persona + context + chunks → final prompt (expandable)
  * **Bot Cevabı:** LLM'in ürettiği cevap

### E. Scheduled Task Yönetimi
* **Task Listesi:** Tablo:
  * Type (welcome, checkin_t3, checkin_t14)
  * Execute At (tarih/saat)
  * Status (pending, completed, failed, cancelled)
  * User ID / Order ID
  * Actions: "Hemen Çalıştır", "İptal Et"
* **Filtreleme:** Status, Type dropdown'ları
* **Manuel Tetikleme:** "Hemen Çalıştır" → onay modalı → task çalıştır → sonuç göster

### F. Sistem Durumu (Health)
* **Queue Stats:** Kartlar:
  * Pending jobs (sayı)
  * Active jobs (sayı)
  * Completed (bugün)
  * Failed (bugün, kırmızı)
* **Database State:** Tablo:
  * Orders (son 10 kayıt)
  * Users (son 10 kayıt)
  * Conversations (son 10 kayıt)
  * Products (sayı)
* **Analytics Snapshot:** Mini dashboard (DAU, message volume, sentiment avg)

### G. Persona Testi
* **Persona Ayarları:** Persona Builder'daki aynı slider'lar (burada test için)
* **Örnek Soru Input:** Textarea
* **"Test Et" Butonu:** Persona ayarları + soru → LLM cevap üret
* **A/B Karşılaştırma:** İki persona ayarı yan yana; aynı soruya iki cevap karşılaştır

### H. Guardrails Testi
* **Kriz Kelime Listesi:** Checkbox listesi (Yanık, Acı, Dava, Şikayet, vb.)
* **Test Mesajı Input:** Textarea; kriz kelimeleri içeren mesaj yaz
* **"Test Et" Butonu:** Guardrails kontrolü çalıştır
* **Sonuç:** 
  * ✅ Normal mesaj → bot cevap verebilir
  * ⚠️ Kriz kelimesi tespit edildi → insan yönlendirme (açıklama)

### I. Test Data Cleanup
* **"Tüm Test Verilerini Temizle" Butonu:** Kırmızı, dikkat çekici
* **Onay Modalı:** "Bu işlem geri alınamaz. Devam etmek istiyor musunuz?"
* **Temizleme Progress:** Loading bar; temizlenen tablolar (orders, users, conversations, tasks)
* **Sonuç:** ✅ Temizleme tamamlandı (kaç kayıt silindi)