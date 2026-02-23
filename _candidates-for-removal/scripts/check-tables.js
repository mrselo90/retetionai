// Basit migration kontrol scripti
const https = require('https');

const SUPABASE_URL = 'https://clcqmasqkfdcmznwdrbx.supabase.co';
const SUPABASE_KEY = 'sb_secret_ICyWuC-HdKs6ZQtAlo4tAg_zuIgurJj';

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

// Her tabloyu kontrol et
async function checkTable(tableName) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'clcqmasqkfdcmznwdrbx.supabase.co',
      path: `/rest/v1/${tableName}?select=*&limit=1`,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 206);
    });

    req.on('error', () => resolve(false));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

async function checkAll() {
  console.log('🔍 Migration kontrol ediliyor...\n');
  
  let allExists = true;
  for (const table of expectedTables) {
    const exists = await checkTable(table);
    console.log(`${exists ? '✅' : '❌'} ${table}`);
    if (!exists) allExists = false;
  }

  if (allExists) {
    console.log(`\n✅ Tüm ${expectedTables.length} tablo başarıyla oluşturulmuş!`);
    console.log('🎉 Migration başarılı! BE-0.3\'e geçebiliriz.');
  } else {
    console.log('\n⚠️ Bazı tablolar eksik görünüyor.');
  }
}

checkAll();
