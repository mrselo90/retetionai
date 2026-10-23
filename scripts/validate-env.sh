#!/bin/bash
# Environment validation script for ReceteGuide Retention Agent
# Validates required and optional environment variables

set -e

echo "🔍 Validating environment variables..."
echo ""

# Required variables
REQUIRED_VARS=(
  "SUPABASE_URL"
  "SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
  "DATABASE_URL"
  "REDIS_URL"
  "OPENAI_API_KEY"
  "JWT_SECRET"
  "ENCRYPTION_KEY"
)

# Optional variables (warnings only)
OPTIONAL_VARS=(
  "WHATSAPP_ACCESS_TOKEN"
  "WHATSAPP_PHONE_NUMBER_ID"
  "WHATSAPP_VERIFY_TOKEN"
  "SHOPIFY_API_KEY"
  "SHOPIFY_API_SECRET"
  "NEW_RELIC_LICENSE_KEY"
)

# Track validation status
ERRORS=0
WARNINGS=0

echo "📋 Required Variables:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check required variables
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ ERROR: $var is not set"
    ERRORS=$((ERRORS + 1))
  else
    # Show first 10 chars for verification (don't expose full secrets)
    VALUE="${!var}"
    PREVIEW="${VALUE:0:10}..."
    echo "✅ $var is set ($PREVIEW)"
  fi
done

echo ""
echo "📋 Optional Variables:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check optional variables
for var in "${OPTIONAL_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo "⚠️  WARNING: $var is not set"
    WARNINGS=$((WARNINGS + 1))
  else
    VALUE="${!var}"
    PREVIEW="${VALUE:0:10}..."
    echo "✅ $var is set ($PREVIEW)"
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Validation Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Required variables: ${#REQUIRED_VARS[@]}"
echo "Optional variables: ${#OPTIONAL_VARS[@]}"
echo "Errors: $ERRORS"
echo "Warnings: $WARNINGS"
echo ""

if [ $ERRORS -gt 0 ]; then
  echo "❌ Validation FAILED: $ERRORS required variable(s) missing"
  echo ""
  echo "💡 To fix:"
  echo "   1. Copy .env.example to .env"
  echo "   2. Fill in all required variables"
  echo "   3. Run this script again"
  exit 1
fi

if [ $WARNINGS -gt 0 ]; then
  echo "⚠️  Validation PASSED with warnings: $WARNINGS optional variable(s) missing"
  echo ""
  echo "💡 Note: Optional variables enable additional features:"
  echo "   - WhatsApp: Required for WhatsApp Business API integration"
  echo "   - Shopify: Required for Shopify app installation"
  echo "   - New Relic: Required for APM and performance monitoring"
  exit 0
fi

echo "✅ Validation PASSED: All variables configured correctly"
exit 0
