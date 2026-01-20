# Migration'ları Çalıştırma - Hızlı Kılavuz

## Database Bilgileri
- **Connection String**: `postgresql://postgres:ZouJWMAZueSr1oZI@db.clcqmasqkfdcmznwdrbx.supabase.co:5432/postgres`
- **Project URL**: `https://clcqmasqkfdcmznwdrbx.supabase.co`

## Adım 1: API Keys'i Alın

1. [Supabase Dashboard](https://supabase.com/dashboard/project/clcqmasqkfdcmznwdrbx) → Projenize gidin
2. Sol menüden **"Settings"** → **"API"** seçin
3. Şu bilgileri kopyalayın:
   - **anon public** key → `.env` dosyasındaki `SUPABASE_ANON_KEY`'e yapıştırın
   - **service_role** key → `.env` dosyasındaki `SUPABASE_SERVICE_ROLE_KEY`'e yapıştırın

## Adım 2: Migration'ları Çalıştırın

### Yöntem A: SQL Editor (En Kolay)

1. Supabase Dashboard → **"SQL Editor"** → **"New Query"**
2. `supabase/migrations/001_initial_schema.sql` dosyasını açın ve tüm içeriği kopyalayın
3. SQL Editor'e yapıştırın ve **"Run"** (Cmd+Enter)
4. ✅ Başarılı mesajını bekleyin
5. Yeni query açın
6. `supabase/migrations/002_rls_policies.sql` dosyasını açın ve tüm içeriği kopyalayın
7. SQL Editor'e yapıştırın ve **"Run"**
8. ✅ Başarılı mesajını bekleyin

### Yöntem B: psql (Terminal)

Eğer psql yüklüyse:

```bash
cd /Users/sboyuk/Desktop/retention-agent-ai
psql "postgresql://postgres:ZouJWMAZueSr1oZI@db.clcqmasqkfdcmznwdrbx.supabase.co:5432/postgres" -f supabase/migrations/001_initial_schema.sql
psql "postgresql://postgres:ZouJWMAZueSr1oZI@db.clcqmasqkfdcmznwdrbx.supabase.co:5432/postgres" -f supabase/migrations/002_rls_policies.sql
```

## Adım 3: Doğrulama

SQL Editor'de şu sorguyu çalıştırın:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

11 tablo görünmeli: analytics_events, conversations, external_events, integrations, knowledge_chunks, merchants, orders, products, scheduled_tasks, sync_jobs, users
