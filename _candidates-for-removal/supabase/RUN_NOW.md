# 🚀 Migration'ı Şimdi Çalıştırın

## Tek Dosyada Tüm Setup

`000_complete_setup.sql` dosyası tüm database setup'ını içerir (schema + RLS policies).

## Adımlar (2 dakika)

1. [Supabase Dashboard](https://supabase.com/dashboard/project/clcqmasqkfdcmznwdrbx) → Projenize gidin
2. Sol menüden **"SQL Editor"** seçin
3. **"New Query"** butonuna tıklayın
4. `supabase/migrations/000_complete_setup.sql` dosyasını açın
5. **Tüm içeriği** kopyalayın (Cmd+A, Cmd+C)
6. SQL Editor'e yapıştırın (Cmd+V)
7. **"Run"** butonuna tıklayın (veya Cmd+Enter)
8. ✅ Başarılı mesajını bekleyin

## Doğrulama

Migration başarılı olduktan sonra, SQL Editor'de şu sorguyu çalıştırın:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

**11 tablo** görünmeli:
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

## Service Role Key

Migration tamamlandıktan sonra:
1. Settings → API → **service_role** key'i alın
2. `.env` dosyasındaki `SUPABASE_SERVICE_ROLE_KEY` değerine yapıştırın

## Sonraki Adım

Migration tamamlandıktan sonra:
```
/van BE-0.3: Redis + BullMQ setup
```
