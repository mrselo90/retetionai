const fs = require('fs');
const envContent = fs.readFileSync('./packages/api/.env', 'utf-8');
const SUPABASE_URL = envContent.match(/SUPABASE_URL=(.*)/)?.[1]?.trim() || process.env.SUPABASE_URL;
const SUPABASE_KEY = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY;

async function check() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id,name,url,raw_text&limit=3`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
check();
