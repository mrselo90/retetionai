const { createClient } = require('@supabase/supabase-js');

// Use anon key from .env.local
const supabaseUrl = 'https://clcqmasqkfdcmznwdrbx.supabase.co';
const supabaseKey = 'sb_publishable_4pEKYh0OrftI7oQhSkD2dg_PpfMpHY-'; // Replace with actual key from file if needed, but this looks like the one

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkIntegration() {
    console.log('Querying integration...');

    // First get the merchant ID for the current user/session context if possible, 
    // but since we are running as script, we'll just search for the integration by provider
    // Assuming there's only one or we'll list them all
    const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .eq('provider', 'shopify');

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No Shopify integrations found.');
        return;
    }

    console.log(`Found ${data.length} integrations.`);
    data.forEach(integration => {
        console.log('--- Integration ---');
        console.log('ID:', integration.id);
        console.log('Merchant ID:', integration.merchant_id);
        console.log('Status:', integration.status);
        console.log('Auth Data:', JSON.stringify(integration.auth_data, null, 2));

        // Check scopes specifically
        if (integration.auth_data && integration.auth_data.scope) {
            console.log('Scopes:', integration.auth_data.scope);
        } else {
            console.log('Scopes: Missing in auth_data');
        }
    });
}

checkIntegration();
