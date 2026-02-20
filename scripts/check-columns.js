require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli!');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
    console.log('🔍 Checking specific columns using REST API...\n');

    try {
        // Check products.enriched_text
        const { error: err1 } = await supabase
            .from('products')
            .select('enriched_text')
            .limit(1);

        if (err1) {
            console.error('❌ Missing column: products.enriched_text', err1.message);
        } else {
            console.log('✅ Column exists: products.enriched_text');
        }

        // Check merchants.notification_phone
        const { error: err2 } = await supabase
            .from('merchants')
            .select('notification_phone')
            .limit(1);

        if (err2) {
            console.error('❌ Missing column: merchants.notification_phone', err2.message);
        } else {
            console.log('✅ Column exists: merchants.notification_phone');
        }

        if (!err1 && !err2) {
            console.log('\n🎉 All DB schema consistency checks passed successfully!');
            process.exit(0);
        } else {
            console.error('\n⚠️ Some columns are missing! Please apply the SQL migrations via Supabase SQL Editor.');
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Error testing columns:', error);
        process.exit(1);
    }
}

checkColumns();
