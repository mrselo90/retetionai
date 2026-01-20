# Test Guide - GlowGuide Retention Agent

## Servislerin Durumu

### Çalışan Servisler
- ✅ **Frontend**: http://localhost:3000
- ✅ **Redis**: localhost:6379
- ⏳ **API**: http://localhost:3001 (başlatılıyor...)
- ⏳ **Workers**: Background'da çalışıyor

## Test Adımları

### 1. Frontend'e Erişim
```bash
# Tarayıcıda aç:
open http://localhost:3000
```

### 2. İlk Kullanıcı Oluşturma
1. http://localhost:3000/signup sayfasına gidin
2. İşletme adı, email ve şifre girin
3. Kayıt olun
4. API key'i kopyalayın (sadece bir kez gösterilir!)

### 3. Dashboard Testi
1. Login olun (http://localhost:3000/login)
2. Dashboard'da şunları kontrol edin:
   - KPIs (Total Orders, Active Users, Messages Sent, Response Rate)
   - Critical Alerts
   - Recent Activity

### 4. Ürün Ekleme Testi
1. `/dashboard/products` sayfasına gidin
2. "Add Product" butonuna tıklayın
3. Bir ürün URL'si girin (örn: https://example.com/product)
4. Scrape işlemini bekleyin
5. Embeddings otomatik oluşturulacak

### 5. Entegrasyon Testi
1. `/dashboard/integrations` sayfasına gidin
2. "Add Integration" → "Manual" seçin
3. API key ve webhook URL'i kopyalayın
4. Test event göndermek için Test Interface'i kullanın

### 6. Test Interface Kullanımı
1. `/dashboard/test` sayfasına gidin
2. **Mock Events** sekmesi:
   - Event type seçin (order_delivered)
   - Customer phone: +905551234567
   - External Order ID: TEST-ORD-001
   - "Event Gönder" butonuna tıklayın
3. **WhatsApp Sim** sekmesi:
   - Phone: +905551234567 (yukarıdaki event'te kullandığınız)
   - Message: "Bu ürünü nasıl kullanmalıyım?"
   - "Mesaj Gönder" butonuna tıklayın
   - AI yanıtını görün
4. **RAG Test** sekmesi:
   - Query: "Bu ürün nasıl kullanılır?"
   - "RAG Test Et" butonuna tıklayın
5. **Scheduled Tasks** sekmesi:
   - Tüm scheduled task'ları görüntüleyin
   - Pending task'ları manuel tetikleyin
6. **System Health** sekmesi:
   - Database stats
   - Queue status
   - Task statistics

### 7. Conversations Testi
1. `/dashboard/conversations` sayfasına gidin
2. Test Interface'den WhatsApp mesajı gönderdikten sonra burada görünecek
3. Bir konuşmaya tıklayarak detayları görüntüleyin

### 8. Analytics Testi
1. `/dashboard/analytics` sayfasına gidin
2. Tarih aralığı seçin
3. Grafikleri ve metrikleri kontrol edin

### 9. Settings Testi
1. `/dashboard/settings` sayfasına gidin
2. Persona Builder'ı test edin:
   - Bot adı değiştirin
   - Tone seçin (friendly, professional, casual, formal)
   - Emoji toggle
   - Response length
   - Temperature slider
   - Canlı önizlemeyi görün
3. API keys yönetimi:
   - Yeni API key oluşturun
   - Mevcut key'leri görüntüleyin
   - Key silin

## API Endpoint Testleri

### Health Check
```bash
curl http://localhost:3001/health
```

### Signup
```bash
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123456",
    "name": "Test Merchant"
  }'
```

### Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123456"
  }'
```

### Mock Event (API Key ile)
```bash
curl -X POST http://localhost:3001/api/test/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "event_type": "order_delivered",
    "external_order_id": "TEST-ORD-001",
    "customer_phone": "+905551234567",
    "customer_name": "Test User",
    "order_status": "delivered",
    "delivery_date": "2026-01-19"
  }'
```

## Sorun Giderme

### API çalışmıyor
1. `.env` dosyasını kontrol edin
2. Redis'in çalıştığını doğrulayın: `redis-cli ping`
3. Port 3001'in kullanılabilir olduğunu kontrol edin
4. API loglarını kontrol edin

### Frontend çalışmıyor
1. Port 3000'in kullanılabilir olduğunu kontrol edin
2. `.env` dosyasında `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_ANON_KEY` olduğundan emin olun
3. Frontend loglarını kontrol edin

### Workers çalışmıyor
1. Redis'in çalıştığını doğrulayın
2. Workers loglarını kontrol edin
3. Queue'ların oluşturulduğunu kontrol edin

## Notlar

- İlk kullanıcı oluştururken API key'i mutlaka kopyalayın!
- Test için gerçek WhatsApp credentials gerekmez (Test Interface kullanın)
- OpenAI API key'i `.env` dosyasına eklenmeli (RAG ve AI responses için)
- Supabase migration'ları çalıştırılmış olmalı

## Hızlı Test Senaryosu

1. Signup → Login
2. Product ekle (scrape + embeddings)
3. Test Interface → Mock Event gönder
4. Test Interface → WhatsApp mesaj gönder
5. Conversations → Mesajı görüntüle
6. Analytics → Metrikleri kontrol et
