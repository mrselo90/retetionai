#!/bin/bash

# AI Bot Functionality Test Script
# Tests all critical components of the GlowGuide AI bot

set -e

API_URL="${API_URL:-http://localhost:3001}"
MERCHANT_ID="${TEST_MERCHANT_ID:-}"
API_KEY="${TEST_API_KEY:-}"

echo "🧪 GlowGuide AI Bot Test Suite"
echo "================================"
echo "API URL: $API_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to run tests
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo -n "Testing: $test_name... "
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Test 1: Health Check
echo "📊 System Health Tests"
echo "----------------------"

run_test "API Health Endpoint" \
    "curl -s -f $API_URL/health | jq -e '.status == \"ok\"'"

run_test "API Root Endpoint" \
    "curl -s -f $API_URL/ | jq -e '.message'"

run_test "OpenAPI Documentation" \
    "curl -s -f $API_URL/api/docs"

echo ""

# Test 2: AI Components (Unit-level checks)
echo "🤖 AI Component Tests"
echo "---------------------"

# Check if OpenAI API key is configured
if [ -n "$OPENAI_API_KEY" ]; then
    echo -e "${GREEN}✓${NC} OpenAI API key configured"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠${NC} OpenAI API key not configured (check .env)"
    ((TESTS_FAILED++))
fi

# Check if Redis is accessible
if redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Redis connection working"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠${NC} Redis not accessible (check REDIS_URL)"
    ((TESTS_FAILED++))
fi

echo ""

# Test 3: Authentication Tests
echo "🔐 Authentication Tests"
echo "-----------------------"

# Test signup endpoint (schema validation)
run_test "Signup endpoint exists" \
    "curl -s -X POST $API_URL/api/auth/signup \
    -H 'Content-Type: application/json' \
    -d '{\"email\":\"test@example.com\",\"password\":\"test123\"}' \
    | jq -e 'has(\"error\") or has(\"user\")'"

# Test login endpoint (schema validation)
run_test "Login endpoint exists" \
    "curl -s -X POST $API_URL/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{\"email\":\"test@example.com\",\"password\":\"test123\"}' \
    | jq -e 'has(\"error\") or has(\"token\")'"

echo ""

# Test 4: API Endpoints
echo "🌐 API Endpoint Tests"
echo "---------------------"

run_test "Products endpoint (unauthenticated)" \
    "curl -s $API_URL/api/products | jq -e 'has(\"error\")'"

run_test "Integrations endpoint (unauthenticated)" \
    "curl -s $API_URL/api/integrations | jq -e 'has(\"error\")'"

run_test "Conversations endpoint (unauthenticated)" \
    "curl -s $API_URL/api/conversations | jq -e 'has(\"error\")'"

echo ""

# Test 5: Webhook Endpoints
echo "🔗 Webhook Tests"
echo "----------------"

run_test "WhatsApp webhook endpoint exists" \
    "curl -s -X POST $API_URL/webhooks/whatsapp \
    -H 'Content-Type: application/json' \
    -d '{}' | jq -e '.'"

run_test "Shopify webhook endpoint exists" \
    "curl -s -X POST $API_URL/webhooks/commerce/shopify \
    -H 'Content-Type: application/json' \
    -d '{}' | jq -e '.'"

echo ""

# Test 6: Rate Limiting
echo "⏱️  Rate Limiting Tests"
echo "----------------------"

# Make multiple rapid requests to test rate limiting
RATE_LIMIT_TRIGGERED=false
for i in {1..15}; do
    response=$(curl -s -w "%{http_code}" -o /dev/null $API_URL/health)
    if [ "$response" == "429" ]; then
        RATE_LIMIT_TRIGGERED=true
        break
    fi
done

if [ "$RATE_LIMIT_TRIGGERED" == "true" ]; then
    echo -e "${GREEN}✓${NC} Rate limiting is working"
    ((TESTS_PASSED++))
else
    echo -e "${YELLOW}⚠${NC} Rate limiting not triggered (may need adjustment)"
    ((TESTS_FAILED++))
fi

echo ""

# Test 7: Security Headers
echo "🔒 Security Header Tests"
echo "------------------------"

HEADERS=$(curl -s -I $API_URL/health)

check_header() {
    local header_name="$1"
    if echo "$HEADERS" | grep -qi "$header_name"; then
        echo -e "${GREEN}✓${NC} $header_name present"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} $header_name missing"
        ((TESTS_FAILED++))
    fi
}

check_header "X-Content-Type-Options"
check_header "X-Frame-Options"
check_header "Strict-Transport-Security"

echo ""

# Test 8: CORS Configuration
echo "🌍 CORS Tests"
echo "-------------"

CORS_RESPONSE=$(curl -s -H "Origin: http://localhost:3000" \
    -H "Access-Control-Request-Method: GET" \
    -X OPTIONS $API_URL/health -I)

if echo "$CORS_RESPONSE" | grep -qi "Access-Control-Allow-Origin"; then
    echo -e "${GREEN}✓${NC} CORS headers present"
    ((TESTS_PASSED++))
else
    echo -e "${RED}✗${NC} CORS headers missing"
    ((TESTS_FAILED++))
fi

echo ""

# Test 9: Database Connection
echo "💾 Database Tests"
echo "-----------------"

# Check if Supabase URL is configured
if [ -n "$SUPABASE_URL" ]; then
    echo -e "${GREEN}✓${NC} Supabase URL configured"
    ((TESTS_PASSED++))
    
    # Try to ping Supabase
    if curl -s -f "$SUPABASE_URL/rest/v1/" -H "apikey: $SUPABASE_ANON_KEY" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Supabase connection working"
        ((TESTS_PASSED++))
    else
        echo -e "${YELLOW}⚠${NC} Supabase connection failed"
        ((TESTS_FAILED++))
    fi
else
    echo -e "${RED}✗${NC} Supabase URL not configured"
    ((TESTS_FAILED++))
fi

echo ""

# Test 10: Monitoring & Metrics
echo "📈 Monitoring Tests"
echo "-------------------"

run_test "Metrics endpoint exists" \
    "curl -s -f $API_URL/metrics | grep -q 'http_requests_total'"

echo ""

# Summary
echo "================================"
echo "📊 Test Summary"
echo "================================"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "\n${YELLOW}⚠️  Some tests failed. Review the output above.${NC}"
    exit 1
fi
