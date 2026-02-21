const fs = require('fs');

// Load environment variables manually since we are running isolated
const envContent = fs.readFileSync('./packages/api/.env', 'utf-8');
const SUPABASE_URL = envContent.match(/SUPABASE_URL=(.*)/)?.[1]?.trim() || process.env.SUPABASE_URL;
const SUPABASE_KEY = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

async function fetchSupabase(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }
    };
    if (body) {
        options.body = JSON.stringify(body);
    }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, options);
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Supabase error: ${res.status} ${err}`);
    }
    return res.json();
}

async function fixUrls() {
    try {
        console.log('Fetching broken products...');
        const products = await fetchSupabase(`products?url=like.https://shopify.com/products/*&select=id,merchant_id,url`);

        if (!products || products.length === 0) {
            console.log('No broken urls found.');
            return;
        }

        console.log(`Found ${products.length} broken products.`);

        const merchantIds = [...new Set(products.map(p => p.merchant_id))].join(',');
        const integrations = await fetchSupabase(`integrations?merchant_id=in.(${merchantIds})&provider=eq.shopify&select=merchant_id,auth_data`);

        const shopMap = {};
        for (const i of integrations) {
            shopMap[i.merchant_id] = i.auth_data.shop;
        }

        let count = 0;
        for (const p of products) {
            const shop = shopMap[p.merchant_id];
            if (shop) {
                const newUrl = p.url.replace('https://shopify.com', `https://${shop}`);
                await fetchSupabase(`products?id=eq.${p.id}`, 'PATCH', { url: newUrl });
                count++;
                console.log(`Fixed ${p.id} -> ${newUrl}`);
            }
        }
        console.log(`Total fixed: ${count}`);
    } catch (err) {
        console.error('Error during migration:', err);
    }
}

fixUrls();
