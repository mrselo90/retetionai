# Supabase Email Gönderimi Kurulumu

## 📧 Email Göndermek İçin Gerekli Adımlar

### 1. Supabase Dashboard Ayarları

#### A. Email Auth Ayarları
1. **Supabase Dashboard**'a gidin: https://supabase.com/dashboard
2. Projenizi seçin
3. **Authentication** > **Settings** > **Email Auth** bölümüne gidin
4. Şu ayarları kontrol edin:
   - ✅ **Enable email confirmations**: ON (açık olmalı)
   - ✅ **Enable email signups**: ON
   - ✅ **Enable email change**: ON (opsiyonel)

#### B. Email Template'leri
1. **Authentication** > **Email Templates** bölümüne gidin
2. **Confirm signup** template'ini kontrol edin
3. Email içeriğini özelleştirebilirsiniz
4. **Redirect URL**'in doğru olduğundan emin olun:
   ```
   {{ .SiteURL }}/auth/callback?type=signup
   ```

#### C. URL Configuration
1. **Authentication** > **URL Configuration** bölümüne gidin
2. **Site URL** ayarlayın:
   - Development: `http://localhost:3000`
   - Production: `https://yourdomain.com`
3. **Redirect URLs** listesine ekleyin:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/auth/callback/**`
   - Production URL'inizi de ekleyin

### 2. Email Servisi Yapılandırması

#### A. Development (Varsayılan - Ücretsiz)
Supabase varsayılan olarak kendi email servisini kullanır:
- ✅ **Otomatik çalışır** - ekstra yapılandırma gerekmez
- ⚠️ **Limit**: Günde 4 email (free tier)
- 📧 **Email adresi**: `noreply@mail.app.supabase.io` (gönderen adres)

#### B. Production (SMTP - Önerilen)
Daha fazla email göndermek ve özel gönderen adresi için SMTP yapılandırın:

1. **Authentication** > **Settings** > **SMTP Settings** bölümüne gidin
2. **Enable Custom SMTP** seçeneğini açın
3. SMTP bilgilerinizi girin:

**Gmail Örneği:**
```
SMTP Host: smtp.gmail.com
SMTP Port: 587
SMTP User: your-email@gmail.com
SMTP Password: (App Password - 2FA açıksa)
Sender Email: your-email@gmail.com
Sender Name: GlowGuide
```

**SendGrid Örneği:**
```
SMTP Host: smtp.sendgrid.net
SMTP Port: 587
SMTP User: apikey
SMTP Password: (SendGrid API Key)
Sender Email: noreply@yourdomain.com
Sender Name: GlowGuide
```

**Resend Örneği:**
```
SMTP Host: smtp.resend.com
SMTP Port: 587
SMTP User: resend
SMTP Password: (Resend API Key)
Sender Email: noreply@yourdomain.com
Sender Name: GlowGuide
```

### 3. Email Gönderimini Test Etme

#### A. Supabase Dashboard'dan Test
1. **Authentication** > **Users** bölümüne gidin
2. Bir kullanıcı oluşturun veya mevcut kullanıcıyı seçin
3. **Send magic link** veya **Resend confirmation email** butonuna tıklayın
4. Email'in gelip gelmediğini kontrol edin

#### B. Uygulama Üzerinden Test
1. **Signup sayfasına** gidin: http://localhost:3000/signup
2. Yeni bir hesap oluşturun
3. Email'inizi kontrol edin (spam klasörüne de bakın)
4. Email'deki confirmation link'ine tıklayın

### 4. Sorun Giderme

#### Email Gelmiyor?
1. **Spam klasörünü** kontrol edin
2. **Supabase Dashboard** > **Logs** > **Auth Logs** bölümüne bakın
3. Email gönderim hatalarını kontrol edin
4. **Rate limiting** kontrolü yapın (günde 4 email limiti var)

#### Email Gönderim Hataları
- **SMTP hatası**: SMTP bilgilerini kontrol edin
- **Rate limit**: Günlük email limitini aştınız
- **Invalid sender**: Gönderen email adresini doğrulayın
- **DNS hatası**: SPF/DKIM kayıtlarını kontrol edin (production için)

### 5. Production İçin Öneriler

#### A. Email Servisi Seçimi
- **SendGrid**: Güvenilir, iyi dokümantasyon
- **Resend**: Modern, developer-friendly
- **AWS SES**: Düşük maliyet, yüksek volume
- **Postmark**: Transactional email için ideal

#### B. DNS Yapılandırması
Production'da custom domain kullanıyorsanız:
1. **SPF Record** ekleyin
2. **DKIM Record** ekleyin
3. **DMARC Policy** ayarlayın (opsiyonel)

#### C. Email Template Özelleştirme
1. **Authentication** > **Email Templates** bölümüne gidin
2. Template'leri özelleştirin:
   - Logo ekleyin
   - Marka renklerini kullanın
   - Türkçe içerik ekleyin
3. **Preview** ile test edin

### 6. Environment Variables

Email yapılandırması için gerekli environment variable'lar:

```bash
# Frontend URL (email redirect için)
FRONTEND_URL=http://localhost:3000

# Production için
FRONTEND_URL=https://yourdomain.com
```

### 7. Hızlı Kontrol Listesi

- [ ] Supabase Dashboard'da email confirmations açık
- [ ] Site URL doğru yapılandırılmış
- [ ] Redirect URLs eklenmiş
- [ ] Email template'leri kontrol edilmiş
- [ ] SMTP yapılandırılmış (production için)
- [ ] Test email gönderilmiş ve kontrol edilmiş
- [ ] Spam klasörü kontrol edilmiş

### 8. Development İçin Hızlı Başlangıç

Development için en hızlı yol:
1. Supabase Dashboard > Authentication > Settings > Email Auth
2. "Enable email confirmations" = ON
3. Site URL = `http://localhost:3000`
4. Redirect URLs = `http://localhost:3000/auth/callback`
5. **Kaydet** ve test edin!

Email'ler otomatik olarak gönderilmeye başlayacaktır. 🚀
