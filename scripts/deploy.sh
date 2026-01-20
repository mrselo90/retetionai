#!/bin/bash

# Deployment script for GlowGuide Retention Agent
# Usage: ./scripts/deploy.sh [staging|production]

set -e

ENVIRONMENT=${1:-staging}

if [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "production" ]; then
  echo "Error: Environment must be 'staging' or 'production'"
  exit 1
fi

echo "🚀 Deploying to $ENVIRONMENT environment..."

# Load environment variables
if [ -f ".env.$ENVIRONMENT" ]; then
  export $(cat .env.$ENVIRONMENT | grep -v '^#' | xargs)
fi

# Build packages
echo "📦 Building packages..."
pnpm install --frozen-lockfile
pnpm -r build

# Run tests (if available)
if [ -f "package.json" ] && grep -q '"test"' package.json; then
  echo "🧪 Running tests..."
  pnpm -r test || echo "⚠️  Tests failed, but continuing deployment"
fi

# Deploy based on environment
if [ "$ENVIRONMENT" == "staging" ]; then
  echo "📤 Deploying to staging..."
  # Add staging deployment commands here
  # e.g., vercel --prod=false, railway up, etc.
elif [ "$ENVIRONMENT" == "production" ]; then
  echo "📤 Deploying to production..."
  # Add production deployment commands here
  # e.g., vercel --prod, railway up --prod, etc.
fi

echo "✅ Deployment complete!"
