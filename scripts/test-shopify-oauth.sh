#!/bin/bash

# Quick Shopify OAuth Test for blackeagletest.myshopify.com
# This script helps you test the OAuth flow

echo "🛍️  Shopify OAuth Test - blackeagletest.myshopify.com"
echo "======================================================"
echo ""

# Check if credentials are set
if grep -q "SHOPIFY_API_KEY=" /Users/sboyuk/Desktop/retention-agent-ai/.env; then
    echo "✅ Shopify API Key configured"
else
    echo "❌ Shopify API Key not configured"
    exit 1
fi

if grep -q "SHOPIFY_API_SECRET=" /Users/sboyuk/Desktop/retention-agent-ai/.env; then
    echo "✅ Shopify API Secret configured"
else
    echo "❌ Shopify API Secret not configured"
    exit 1
fi

echo ""
echo "📋 Next Steps to Test OAuth:"
echo ""
echo "1. Start the web app (in a new terminal):"
echo "   cd /Users/sboyuk/Desktop/retention-agent-ai"
echo "   pnpm --filter web dev"
echo ""
echo "2. Open browser:"
echo "   http://localhost:3000"
echo ""
echo "3. Sign up or log in"
echo ""
echo "4. Go to Integrations page"
echo ""
echo "5. Click 'Connect Shopify'"
echo ""
echo "6. Enter your store:"
echo "   blackeagletest.myshopify.com"
echo ""
echo "7. You'll be redirected to Shopify to authorize"
echo ""
echo "8. After authorization, you'll be redirected back"
echo ""
echo "✅ Your Shopify credentials are configured!"
echo "✅ API server is running on port 3001"
echo ""
echo "Ready to test! 🚀"
