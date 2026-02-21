const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './packages/api/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixUrls() {
  const { data: products, error: e1 } = await supabase.from('products').select('*').like('url', 'https://shopify.com/products/%');
  if (e1) { console.error('fetch err', e1); return; }
  
  if (!products || products.length === 0) { console.log('No broken urls found.'); return; }
  
  const merchantIds = [...new Set(products.map(p => p.merchant_id))];
  const { data: integrations, error: e2 } = await supabase.from('integrations').select('*').in('merchant_id', merchantIds).eq('provider', 'shopify');
  if (e2) { console.error('int err', e2); return; }
  
  const shopMap = {};
  if (integrations) integrations.forEach(i => { shopMap[i.merchant_id] = i.auth_data.shop; });
  
  let count = 0;
  for (const p of products) {
    const shop = shopMap[p.merchant_id];
    if (shop) {
      const newUrl = p.url.replace('https://shopify.com', `https://${shop}`);
      const { error: e3 } = await supabase.from('products').update({ url: newUrl }).eq('id', p.id);
      if (e3) { console.error('upd err', e3); continue; }
      count++;
      console.log(`Fixed ${p.id} -> ${newUrl}`);
    }
  }
  console.log(`Total fixed: ${count}`);
}
fixUrls().catch(console.error);
