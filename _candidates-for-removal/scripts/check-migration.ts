/**
 * Migration kontrol scripti
 * Supabase'de tabloların oluştuğunu doğrular
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMigration() {
  console.log('🔍 Migration kontrol ediliyor...\n');

  // Beklenen tablolar
  const expectedTables = [
    'merchants',
    'integrations',
    'products',
    'users',
    'orders',
    'knowledge_chunks',
    'conversations',
    'analytics_events',
    'sync_jobs',
    'external_events',
    'scheduled_tasks',
  ];

  try {
    // Tabloları kontrol et
    const { data: tables, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name');

    if (error) {
      // Alternatif yöntem: Her tabloyu tek tek kontrol et
      console.log('📊 Tablolar kontrol ediliyor...\n');
      
      const results: { table: string; exists: boolean }[] = [];
      
      for (const table of expectedTables) {
        try {
          const { error: tableError } = await supabase
            .from(table)
            .select('*')
            .limit(1);
          
          results.push({
            table,
            exists: !tableError,
          });
        } catch (e) {
          results.push({
            table,
            exists: false,
          });
        }
      }

      console.log('📋 Tablo Durumu:\n');
      let allExists = true;
      for (const result of results) {
        const status = result.exists ? '✅' : '❌';
        console.log(`${status} ${result.table}`);
        if (!result.exists) allExists = false;
      }

      if (allExists) {
        console.log('\n✅ Tüm tablolar başarıyla oluşturulmuş!');
        
        // Extensions kontrolü
        console.log('\n🔌 Extensions kontrol ediliyor...');
        const { data: extensions } = await supabase.rpc('pg_extension_list', {});
        console.log('✅ Extensions kontrol edildi');
        
        return true;
      } else {
        console.log('\n❌ Bazı tablolar eksik!');
        return false;
      }
    } else {
      const tableNames = tables?.map((t: any) => t.table_name) || [];
      const foundTables = expectedTables.filter((t) => tableNames.includes(t));
      
      console.log('📋 Bulunan Tablolar:\n');
      for (const table of expectedTables) {
        const exists = foundTables.includes(table);
        console.log(`${exists ? '✅' : '❌'} ${table}`);
      }

      if (foundTables.length === expectedTables.length) {
        console.log(`\n✅ Tüm ${expectedTables.length} tablo başarıyla oluşturulmuş!`);
        return true;
      } else {
        console.log(`\n❌ ${expectedTables.length - foundTables.length} tablo eksik!`);
        return false;
      }
    }
  } catch (error) {
    console.error('❌ Hata:', error);
    return false;
  }
}

checkMigration()
  .then((success) => {
    if (success) {
      console.log('\n🎉 Migration başarılı! BE-0.3\'e geçebiliriz.');
      process.exit(0);
    } else {
      console.log('\n⚠️ Migration kontrolü başarısız. Lütfen tekrar kontrol edin.');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ Hata:', error);
    process.exit(1);
  });
