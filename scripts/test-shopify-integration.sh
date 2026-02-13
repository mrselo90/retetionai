#!/bin/bash

# Shopify Integration Test Script
# Tests OAuth flow and webhook setup for blackeagletest.myshopify.com

set -e

SHOP="blackeagletest.myshopify.com"
API_URL="${API_URL:-http://localhost:3001}"

echo "🛍️  Shopify Integration Test"
echo "================================"
echo "Shop: $SHOP"
echo "API URL: $API_URL"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if Shopify credentials are configured
echo "📋 Checking Shopify Configuration"
echo "----------------------------------"

if [ -z "$SHOPIFY_API_KEY" ]; then
    echo -e "${RED}✗ SHOPIFY_API_KEY not set${NC}"
    echo ""
    echo "Please add your Shopify API credentials to .env:"
    echo "SHOPIFY_API_KEY=your_api_key_here"
    echo "SHOPIFY_API_SECRET=your_api_secret_here"
    echo ""
    echo "Get credentials from: https://partners.shopify.com/"
    exit 1
else
    echo -e "${GREEN}✓ SHOPIFY_API_KEY configured${NC}"
fi

if [ -z "$SHOPIFY_API_SECRET" ]; then
    echo -e "${RED}✗ SHOPIFY_API_SECRET not set${NC}"
    exit 1
else
    echo -e "${GREEN}✓ SHOPIFY_API_SECRET configured${NC}"
fi

echo ""

# Check if API server is running
echo "🔍 Checking API Server"
echo "----------------------"

if curl -s -f "$API_URL/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ API server is running${NC}"
else
    echo -e "${RED}✗ API server is not running${NC}"
    echo ""
    echo "Please start the API server:"
    echo "pnpm --filter api dev"
    exit 1
fi

echo ""

# Test OAuth flow (requires authentication)
echo "🔐 OAuth Flow Test"
echo "------------------"

echo -e "${YELLOW}Note: OAuth flow requires a logged-in user${NC}"
echo ""
echo "To test OAuth flow:"
echo "1. Start the web app: ${BLUE}pnpm --filter web dev${NC}"
echo "2. Open browser: ${BLUE}http://localhost:3000${NC}"
echo "3. Sign up / Log in"
echo "4. Go to Integrations page"
echo "5. Click 'Connect Shopify'"
echo "6. Enter shop: ${BLUE}$SHOP${NC}"
echo ""

# Check if user wants to continue with API test
read -p "Do you have a JWT token to test the API directly? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter your JWT token: " JWT_TOKEN
    
    if [ -z "$JWT_TOKEN" ]; then
        echo -e "${RED}✗ No token provided${NC}"
        exit 1
    fi
    
    echo ""
    echo "Testing OAuth start endpoint..."
    
    RESPONSE=$(curl -s -X GET "$API_URL/api/integrations/shopify/oauth/start?shop=$SHOP" \
        -H "Authorization: Bearer $JWT_TOKEN")
    
    if echo "$RESPONSE" | jq -e '.authUrl' > /dev/null 2>&1; then
        AUTH_URL=$(echo "$RESPONSE" | jq -r '.authUrl')
        echo -e "${GREEN}✓ OAuth start endpoint working${NC}"
        echo ""
        echo "Authorization URL generated:"
        echo -e "${BLUE}$AUTH_URL${NC}"
        echo ""
        echo "Open this URL in your browser to authorize the app"
    else
        echo -e "${RED}✗ OAuth start endpoint failed${NC}"
        echo "Response: $RESPONSE"
        exit 1
    fi
fi

echo ""

# Webhook information
echo "📡 Webhook Setup"
echo "----------------"

echo "For local testing, you need to expose your localhost to the internet."
echo ""
echo "Option 1: Use ngrok (recommended for testing)"
echo "  1. Install ngrok: ${BLUE}brew install ngrok${NC}"
echo "  2. Start ngrok: ${BLUE}ngrok http 3001${NC}"
echo "  3. Copy the HTTPS URL (e.g., https://abc123.ngrok.io)"
echo "  4. Update .env: ${BLUE}API_URL=https://abc123.ngrok.io${NC}"
echo "  5. Restart API server"
echo "  6. Subscribe to webhooks via API or frontend"
echo ""
echo "Option 2: Deploy to staging/production"
echo "  - Webhooks will work automatically with public URL"
echo ""

echo "Webhook endpoint: ${BLUE}$API_URL/webhooks/commerce/shopify${NC}"
echo ""

# Summary
echo "================================"
echo "📊 Test Summary"
echo "================================"
echo ""
echo "✅ Next Steps:"
echo "1. Get Shopify API credentials from partners.shopify.com"
echo "2. Add credentials to .env file"
echo "3. Restart API server"
echo "4. Test OAuth flow via web app (http://localhost:3000)"
echo "5. For webhook testing, use ngrok or deploy to staging"
echo ""
echo "📚 Full guide: docs/testing/SHOPIFY_INTEGRATION_TEST.md"
echo ""
