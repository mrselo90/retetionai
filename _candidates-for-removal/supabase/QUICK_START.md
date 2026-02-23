# Supabase Quick Start - Migration Çalıştırma

## ✅ Database Bağlantısı Hazır

Database connection string hazır:
```
postgresql://postgres:ZouJWMAZueSr1oZI@db.clcqmasqkfdcmznwdrbx.supabase.co:5432/postgres
```

## 🔑 API Keys'i Alın (2 dakika)

1. [Supabase Dashboard](https://supabase.com/dashboard/project/clcqmasqkfdcmznwdrbx) → Projenize gidin
2. Sol menüden **"Settings"** → **"API"** seçin
3. Şu bilgileri kopyalayın:
   - **Project URL**: `https://clcqmasqkfdcmznwdrbx.supabase.co` (zaten var)
   - **anon public** key → `.env` dosyasındaki `SUPABASE_ANON_KEY`'e yapıştırın
   - **service_role** key → `.env` dosyasındaki `SUPABASE_SERVICE_ROLE_KEY`'e yapıştırın

## 🚀 Migration'ları Çalıştırın (5 dakika)

### Yöntem 1: SQL Editor (Önerilen)

1. Supabase Dashboard → Sol menüden **"SQL Editor"** seçin
2. **"New Query"** butonuna tıklayın
3. `supabase/migrations/001_initial_schema.sql` dosyasını açın
4. Tüm içeriği kopyalayıp SQL Editor'e yapıştırın
5. **"Run"** butonuna tıklayın (veya Cmd+Enter)
6. ✅ Başarılı mesajını görün
7. Yeni bir query açın
8. `supabase/migrations/002_rls_policies.sql` dosyasını açın
9. Tüm içeriği kopyalayıp SQL Editor'e yapıştırın
10. **"Run"** butonuna tıklayın
11. ✅ Başarılı mesajını görün

### Yöntem 2: psql ile (Alternatif)

```bash
psql "postgresql://postgres:ZouJWMAZueSr1oZI@db.clcqmasqkfdcmznwdrbx.supabase.co:5432/postgres" -f supabase/migrations/001_initial_schema.sql
psql "postgresql://postgres:ZouJWMAZueSr1oZI@db.clcqmasqkfdcmznwdrbx.supabase.co:5432/postgres" -f supabase/migrations/002_rls_policies.sql
```

## ✅ Doğrulama

Migration'lar başarılı olduktan sonra, SQL Editor'de şu sorguyu çalıştırın:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Şu 11 tablo görünmeli:
- analytics_events
- conversations
- external_events
- integrations
- knowledge_chunks
- merchants
- orders
- products
- scheduled_tasks
- sync_jobs
- users

## 🎯 Sonraki Adım

Migration'lar tamamlandıktan sonra:
1. API keys'leri `.env` dosyasına ekleyin
2. `/van BE-0.3: Redis + BullMQ setup` ile devam edin
