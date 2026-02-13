# WhatsApp Bot Akışı: Baştan Sona Yapı

Bu dokümanda botun WhatsApp üzerinden müşteriyle nasıl iletişim kurduğu, tanımlı sınırlamaların, komutların ve ürün bilgilerinin nerede kullanıldığı özetlenir.

---

## 1. Genel Akış

```
WhatsApp (müşteri mesajı)
    → Webhook (POST /webhooks/whatsapp)
    → Kullanıcı bul (telefon → user)
    → Sipariş bul (son sipariş, opsiyonel)
    → Konuşma oluştur/al
    → Mesajı kaydet
    → generateAIResponse(...)
    → Cevabı WhatsApp’a gönder
```

- **Kod:** `packages/api/src/routes/whatsapp.ts` (webhook), `packages/api/src/lib/aiAgent.ts` (cevap üretimi).
- **Ortam:** `DEFAULT_MERCHANT_ID` ve WhatsApp kimlik bilgileri (Meta) tanımlı olmalı.

---

## 2. Sınırlamalar (Guardrails)

Bot, hem kullanıcı mesajını hem de kendi cevabını **sınırlama kurallarına** göre kontrol eder.

### 2.1 Kullanıcı mesajı (girdi)

- **Kriz / acil ifadeler** (örn. yanık, zehirlenme, acil, intihar): Cevap verilmez; güvenli bir metin döner ve insan yönlendirmesi işaretlenir.
- **Tıbbi tavsiye talepleri** (tedavi, ilaç, doktor, teşhis vb.): Tıbbi tavsiye verilmez; “sağlık uzmanına danışın” benzeri güvenli cevap.

### 2.2 AI cevabı (çıktı)

- Üretilen cevap da aynı kriterlere göre taranır; uygunsa güvenli cevapla değiştirilir.

### Nerede tanımlı?

- **Kod:** `packages/api/src/lib/guardrails.ts`
- **Türkçe/İngilizce anahtar kelimeler** sabit listelerde (CRISIS_KEYWORDS, MEDICAL_ADVICE_KEYWORDS). Yeni kural eklemek için bu dosyaya ekleme yapılır.

---

## 3. Komutlar / Talimatlar (Bot Bilgisi)

Sizin girdiğiniz “komutlar” ve sınırlamalar **Bot Bilgisi (AI Kuralları)** ile sisteme verilir ve her cevap üretiminde **sistem prompt’una** eklenir.

### 3.1 Nerede girilir?

- **Arayüz:** Dashboard → **Ayarlar** → **Bot Bilgisi (AI Kuralları)**  
  (`/dashboard/settings/bot-info`)
- **API:** `GET/PATCH /api/merchants/me/bot-info` (merchant_bot_info tablosu).

### 3.2 Anahtarlar (komut alanları)

| Anahtar | Arayüzdeki ad | Kullanım |
|--------|----------------|----------|
| `brand_guidelines` | Marka & Kurallar | Marka sesi, değerler, müşteriye hitap |
| `bot_boundaries` | Bot Sınırları | Bot ne yapmalı/yapmamalı, tıbbi tavsiye verme, insan yönlendirme |
| `recipe_overview` | Tarif & Kullanım Genel Bilgisi | Genel kozmetik tarif / kullanım özeti |
| `custom_instructions` | Ek Talimatlar | Diğer özel kurallar |

### 3.3 AI’da kullanım

- **Kod:** `packages/api/src/lib/aiAgent.ts` → `getMerchantBotInfo(merchantId)` → `buildSystemPrompt(..., botInfo)`.
- Prompt’ta “Merchant instructions for this bot” bölümünde bu metinler LLM’e verilir; bot cevabı buna göre şekillenir.

---

## 4. Ürün Bilgileri (RAG + Tarifler)

Bot, **sistemde tanımlı ürünlerin bilgilerine** (RAG + kullanım talimatları) dayanarak soru cevaplar.

### 4.1 Ne zaman kullanılır?

- Sadece **soru (question)** niyeti tespit edildiğinde.
- **Sipariş varsa:** Önce o siparişteki ürünler için RAG + o ürünlere ait “kullanım talimatı / tarif” alanları kullanılır.
- **Sipariş yoksa veya siparişte ürün bilgisi yoksa:** Mağazadaki **tüm ürünler** üzerinde RAG yapılır; böylece müşteri siparişi olmasa da ürün kataloğundan cevap alabilir.

### 4.2 RAG (knowledge_chunks)

- Ürün açıklamaları parçalanıp embedding üretilir; `knowledge_chunks` tablosunda saklanır.
- Müşteri sorusu için benzerlik araması yapılır; en uygun parçalar LLM bağlamına eklenir.
- **Kod:** `packages/api/src/lib/rag.ts` (`queryKnowledgeBase`), `packages/api/src/lib/aiAgent.ts` (Step 2).

### 4.3 Kullanım talimatı / tarif (product_instructions)

- Ürün bazlı “nasıl kullanılır / tarif” metinleri (Shopify map veya manuel) `product_instructions` / merchant_bot_info ile ilişkili yapıda tutulur.
- **Sipariş varken** ilgili sipariş ürünlerinin talimatları sistem prompt’una “Product usage instructions (recipes)” olarak eklenir.

### 4.4 Ürün / embedding nerede tanımlanır?

- **Ürünler:** Dashboard → Ürünler, Shopify map, CSV veya manuel ekleme.
- **Embedding üretimi:** Ürün detayında “Embedding üret” / “Generate embeddings” ile ilgili ürünün metni RAG’e alınır.
- **Kod:** `packages/api/src/lib/knowledgeBase.ts`, `packages/api/src/routes/products.ts`.

---

## 5. Persona (Ton, Stil, Sıcaklık)

Mağaza adı ve “nasıl konuşacak” ayarları **persona_settings** ile gelir; sistem prompt’unu etkiler.

- **Arayüz:** Dashboard → **Ayarlar** (Bot adı, Ton, Emoji, Yanıt uzunluğu, Yaratıcılık/Temperature).
- **Veritabanı:** `merchants.persona_settings` (JSON).
- **Kod:** `packages/api/src/lib/aiAgent.ts` → `buildSystemPrompt(merchantName, persona, ...)`; LLM çağrısında `temperature: persona.temperature`.

---

## 6. Cevap Üretim Sırası (generateAIResponse)

1. **Guardrails (girdi):** Kullanıcı mesajı kriz/tıbbi tavsiye vb. içeriyorsa güvenli cevap dön, gerekirse insan yönlendir.
2. **Intent:** Mesaj niyeti sınıflandırılır (question / complaint / chat / opt_out).
3. **RAG + tarifler:** Niyet “question” ise sipariş ürünleri veya tüm mağaza ürünleriyle RAG; sipariş varsa ilgili kullanım talimatları eklenir.
4. **Merchant + persona + bot info:** Mağaza adı, persona_settings, getMerchantBotInfo (komutlar/sınırlamalar) alınır.
5. **Sistem prompt:** Hepsi birleştirilir (persona + bot bilgisi + RAG/tarif bağlamı + niyete özel talimat).
6. **LLM:** Son 10 mesaj + şu anki mesaj ile GPT-4o çağrılır.
7. **Guardrails (çıktı):** Üretilen cevap aynı kurallarla kontrol edilir; gerekirse güvenli cevapla değiştirilir.
8. **Upsell (opsiyonel):** Chat niyeti + sipariş varsa memnuniyet/upsell mantığı çalışabilir.

---

## 7. Özet Tablo

| Bileşen | Nerede tanımlanır? | AI’da nerede kullanılır? |
|--------|---------------------|---------------------------|
| Sınırlamalar (kriz, tıbbi) | `guardrails.ts` (kod) | Girdi/çıktı kontrolü |
| Komutlar / kurallar | Dashboard → Bot Bilgisi, `merchant_bot_info` | buildSystemPrompt → botInfo |
| Persona (ton, sıcaklık) | Dashboard → Ayarlar, `merchants.persona_settings` | buildSystemPrompt → persona, LLM temperature |
| Ürün bilgisi (RAG) | Ürünler + Embedding üret, `knowledge_chunks` | queryKnowledgeBase → ragContext |
| Kullanım talimatı / tarif | Ürün sayfası / Shopify map, product_instructions | getProductInstructionsByProductIds → recipeBlocks (sipariş varken) |

---

## 8. Yapılan İyileştirme (RAG)

- **Eski:** RAG yalnızca **sipariş varken** ve o siparişteki ürünlerle çalışıyordu; sipariş yoksa ürün bilgisi kullanılmıyordu.
- **Yeni:** Soru niyeti olduğunda:
  - Sipariş ve sipariş ürünleri varsa: Önce sipariş ürünleriyle RAG + ilgili kullanım talimatları.
  - Sipariş yoksa veya siparişte ürün bilgisi yoksa: **Tüm mağaza ürünleri** üzerinde RAG yapılır; böylece “sistemde tanımlı ürünlerin bilgilerine” her zaman dayanılabilir.

Bu sayede bot, siparişi olmayan müşterilere de katalogdaki ürün bilgisiyle cevap verebilir.
