# Supabase Migration Çalıştırma Talimatları

## Yöntem 1: Supabase Dashboard (Önerilen - En Hızlı)

### Adım 1: Supabase Projesi Oluşturun
1. [supabase.com](https://supabase.com) → Sign in / Sign up
2. "New Project" → Proje adı: `recete-retention-agent`
3. Database password belirleyin (kaydedin!)
4. Region seçin (en yakın bölge)
5. Proje oluşturulmasını bekleyin (2-3 dakika)

### Adım 2: SQL Editor'den Migration'ları Çalıştırın
1. Supabase Dashboard → Sol menüden **"SQL Editor"** seçin
2. **"New Query"** butonuna tıklayın
3. `001_initial_schema.sql` dosyasının içeriğini kopyalayıp yapıştırın
4. **"Run"** butonuna tıklayın (veya Cmd+Enter)
5. Başarılı olduğunu doğrulayın (✅)
6. Yeni bir query açın
7. `002_rls_policies.sql` dosyasının içeriğini kopyalayıp yapıştırın
8. **"Run"** butonuna tıklayın
9. Başarılı olduğunu doğrulayın (✅)

### Adım 3: API Keys'i Alın
1. Sol menüden **"Settings"** → **"API"** seçin
2. Şu bilgileri kopyalayın:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ gizli tutun!)

### Adım 4: Environment Variables'ı Ayarlayın
```bash
cd /Users/sboyuk/Desktop/retention-agent-ai
cp .env.example .env
# .env dosyasını düzenleyin ve yukarıdaki değerleri yapıştırın
```

---

## Yöntem 2: Supabase CLI ile (Gelişmiş)

### Adım 1: Supabase Projesi Oluşturun
(Yukarıdaki Adım 1 ile aynı)

### Adım 2: Projeyi Link Edin
```bash
cd /Users/sboyuk/Desktop/retention-agent-ai
supabase link --project-ref your-project-ref
```
(Project ref'i Supabase Dashboard → Settings → General'den bulabilirsiniz)

### Adım 3: Migration'ları Push Edin
```bash
supabase db push
```

---

## Migration Dosyaları

- `001_initial_schema.sql` - Tüm tablolar, indexler, trigger'lar
- `002_rls_policies.sql` - Row Level Security policies

## Doğrulama

Migration'lar başarılı olduktan sonra, SQL Editor'de şu sorguyu çalıştırın:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Şu tablolar görünmeli:
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

## Sorun Giderme

### pgvector extension hatası
Eğer `vector` extension bulunamazsa:
```sql
CREATE EXTENSION IF NOT EXISTS "vector";
```

### RLS policy hatası
Eğer RLS policy'ler çalışmazsa, önce `001_initial_schema.sql`'in başarıyla çalıştığından emin olun.
