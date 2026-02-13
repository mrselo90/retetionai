#!/bin/bash

# GCP Deployment Script for GlowGuide Retention Agent
# Bu script tüm GCP deployment adımlarını otomatikleştirir

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   GlowGuide Retention Agent - GCP Deployment Script      ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI not found. Please install it first.${NC}"
    echo "   https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Get project configuration
echo -e "${YELLOW}📋 Project Configuration${NC}"
read -p "GCP Project ID: " PROJECT_ID
read -p "Region (default: us-central1): " REGION
REGION=${REGION:-us-central1}

# Set project
gcloud config set project $PROJECT_ID

echo ""
echo -e "${GREEN}✅ Using project: $PROJECT_ID${NC}"
echo -e "${GREEN}✅ Using region: $REGION${NC}"
echo ""

# Enable required APIs
echo -e "${YELLOW}🔧 Enabling required GCP APIs...${NC}"
gcloud services enable \
  run.googleapis.com \
  sql-component.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  cloudbuild.googleapis.com \
  containerregistry.googleapis.com \
  artifactregistry.googleapis.com \
  cloudresourcemanager.googleapis.com \
  compute.googleapis.com \
  storage-api.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  secretmanager.googleapis.com

echo -e "${GREEN}✅ APIs enabled${NC}"
echo ""

# Create Artifact Registry repository
echo -e "${YELLOW}📦 Creating Artifact Registry repository...${NC}"
if ! gcloud artifacts repositories describe glowguide --location=$REGION &> /dev/null; then
    gcloud artifacts repositories create glowguide \
      --repository-format=docker \
      --location=$REGION \
      --description="GlowGuide container images"
    echo -e "${GREEN}✅ Artifact Registry repository created${NC}"
else
    echo -e "${BLUE}ℹ️  Artifact Registry repository already exists${NC}"
fi
echo ""

# Configure Docker
echo -e "${YELLOW}🐳 Configuring Docker for Artifact Registry...${NC}"
gcloud auth configure-docker ${REGION}-docker.pkg.dev
echo -e "${GREEN}✅ Docker configured${NC}"
echo ""

# Create Cloud SQL instance
echo -e "${YELLOW}🗄️  Setting up Cloud SQL (PostgreSQL)...${NC}"
read -p "Create new Cloud SQL instance? (y/n): " CREATE_SQL
if [ "$CREATE_SQL" = "y" ]; then
    read -p "Database password: " -s DB_PASSWORD
    echo ""
    
    gcloud sql instances create glowguide-db \
      --database-version=POSTGRES_15 \
      --tier=db-f1-micro \
      --region=$REGION \
      --storage-type=SSD \
      --storage-size=10GB \
      --backup \
      --backup-start-time=03:00 \
      --maintenance-window-day=SUN \
      --maintenance-window-hour=04 \
      --root-password=$DB_PASSWORD
    
    gcloud sql databases create glowguide --instance=glowguide-db
    gcloud sql users create glowguide --instance=glowguide-db --password=$DB_PASSWORD
    
    echo -e "${GREEN}✅ Cloud SQL instance created${NC}"
else
    echo -e "${BLUE}ℹ️  Skipping Cloud SQL creation${NC}"
fi
echo ""

# Create Memorystore Redis
echo -e "${YELLOW}🔴 Setting up Memorystore (Redis)...${NC}"
read -p "Create new Redis instance? (y/n): " CREATE_REDIS
if [ "$CREATE_REDIS" = "y" ]; then
    gcloud redis instances create glowguide-redis \
      --size=1 \
      --region=$REGION \
      --tier=basic \
      --redis-version=redis_7_0
    
    echo -e "${GREEN}✅ Redis instance created${NC}"
else
    echo -e "${BLUE}ℹ️  Skipping Redis creation${NC}"
fi
echo ""

# Create Cloud Storage bucket
echo -e "${YELLOW}💾 Creating Cloud Storage bucket...${NC}"
if ! gsutil ls gs://glowguide-backups-$PROJECT_ID &> /dev/null; then
    gsutil mb -l $REGION gs://glowguide-backups-$PROJECT_ID
    
    # Set lifecycle policy
    cat > /tmp/lifecycle.json << EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": 90}
      }
    ]
  }
}
EOF
    gsutil lifecycle set /tmp/lifecycle.json gs://glowguide-backups-$PROJECT_ID
    
    echo -e "${GREEN}✅ Cloud Storage bucket created${NC}"
else
    echo -e "${BLUE}ℹ️  Cloud Storage bucket already exists${NC}"
fi
echo ""

# Create secrets
echo -e "${YELLOW}🔐 Setting up secrets in Secret Manager...${NC}"
read -p "Create secrets? (y/n): " CREATE_SECRETS
if [ "$CREATE_SECRETS" = "y" ]; then
    echo "Enter your secrets (press Enter to skip):"
    
    read -p "Supabase Service Key: " SUPABASE_KEY
    if [ ! -z "$SUPABASE_KEY" ]; then
        echo -n "$SUPABASE_KEY" | gcloud secrets create supabase-service-key --data-file=- 2>/dev/null || \
        echo -n "$SUPABASE_KEY" | gcloud secrets versions add supabase-service-key --data-file=-
    fi
    
    read -p "OpenAI API Key: " OPENAI_KEY
    if [ ! -z "$OPENAI_KEY" ]; then
        echo -n "$OPENAI_KEY" | gcloud secrets create openai-api-key --data-file=- 2>/dev/null || \
        echo -n "$OPENAI_KEY" | gcloud secrets versions add openai-api-key --data-file=-
    fi
    
    read -p "Shopify API Secret: " SHOPIFY_SECRET
    if [ ! -z "$SHOPIFY_SECRET" ]; then
        echo -n "$SHOPIFY_SECRET" | gcloud secrets create shopify-api-secret --data-file=- 2>/dev/null || \
        echo -n "$SHOPIFY_SECRET" | gcloud secrets versions add shopify-api-secret --data-file=-
    fi
    
    read -p "Twilio Auth Token: " TWILIO_TOKEN
    if [ ! -z "$TWILIO_TOKEN" ]; then
        echo -n "$TWILIO_TOKEN" | gcloud secrets create twilio-auth-token --data-file=- 2>/dev/null || \
        echo -n "$TWILIO_TOKEN" | gcloud secrets versions add twilio-auth-token --data-file=-
    fi
    
    # Generate JWT secret
    JWT_SECRET=$(openssl rand -base64 32)
    echo -n "$JWT_SECRET" | gcloud secrets create jwt-secret --data-file=- 2>/dev/null || \
    echo -n "$JWT_SECRET" | gcloud secrets versions add jwt-secret --data-file=-
    
    # Generate encryption key
    ENCRYPTION_KEY=$(openssl rand -base64 32)
    echo -n "$ENCRYPTION_KEY" | gcloud secrets create encryption-key --data-file=- 2>/dev/null || \
    echo -n "$ENCRYPTION_KEY" | gcloud secrets versions add encryption-key --data-file=-
    
    echo -e "${GREEN}✅ Secrets created${NC}"
else
    echo -e "${BLUE}ℹ️  Skipping secrets creation${NC}"
fi
echo ""

# Build and push Docker images
echo -e "${YELLOW}🏗️  Building and pushing Docker images...${NC}"
read -p "Build and push images? (y/n): " BUILD_IMAGES
if [ "$BUILD_IMAGES" = "y" ]; then
    cd "$(dirname "$0")/.."
    
    echo "Building API image..."
    docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/glowguide/api:latest \
      --target api \
      -f Dockerfile .
    docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/glowguide/api:latest
    
    echo "Building Workers image..."
    docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/glowguide/workers:latest \
      --target workers \
      -f Dockerfile .
    docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/glowguide/workers:latest
    
    echo "Building Web image..."
    docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/glowguide/web:latest \
      --target web \
      -f Dockerfile .
    docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/glowguide/web:latest
    
    echo -e "${GREEN}✅ Docker images built and pushed${NC}"
else
    echo -e "${BLUE}ℹ️  Skipping image build${NC}"
fi
echo ""

# Deploy to Cloud Run
echo -e "${YELLOW}🚀 Deploying to Cloud Run...${NC}"
read -p "Deploy services? (y/n): " DEPLOY_SERVICES
if [ "$DEPLOY_SERVICES" = "y" ]; then
    # Get Redis host
    REDIS_HOST=$(gcloud redis instances describe glowguide-redis --region=$REGION --format="value(host)")
    
    # Get Cloud SQL connection name
    SQL_CONNECTION=$(gcloud sql instances describe glowguide-db --format="value(connectionName)")
    
    echo "Deploying API..."
    gcloud run deploy glowguide-api \
      --image=${REGION}-docker.pkg.dev/${PROJECT_ID}/glowguide/api:latest \
      --platform=managed \
      --region=$REGION \
      --add-cloudsql-instances=$SQL_CONNECTION \
      --allow-unauthenticated \
      --cpu=1 \
      --memory=1Gi \
      --min-instances=0 \
      --max-instances=100 \
      --set-env-vars="NODE_ENV=production,PORT=3001,REDIS_URL=redis://${REDIS_HOST}:6379"
    
    echo "Deploying Workers..."
    gcloud run deploy glowguide-workers \
      --image=${REGION}-docker.pkg.dev/${PROJECT_ID}/glowguide/workers:latest \
      --platform=managed \
      --region=$REGION \
      --add-cloudsql-instances=$SQL_CONNECTION \
      --no-allow-unauthenticated \
      --cpu=1 \
      --memory=1Gi \
      --min-instances=1 \
      --max-instances=10 \
      --set-env-vars="NODE_ENV=production,REDIS_URL=redis://${REDIS_HOST}:6379"
    
    # Get API URL for Web deployment
    API_URL=$(gcloud run services describe glowguide-api --region=$REGION --format="value(status.url)")
    
    echo "Deploying Web..."
    gcloud run deploy glowguide-web \
      --image=${REGION}-docker.pkg.dev/${PROJECT_ID}/glowguide/web:latest \
      --platform=managed \
      --region=$REGION \
      --allow-unauthenticated \
      --cpu=1 \
      --memory=512Mi \
      --min-instances=0 \
      --max-instances=100 \
      --set-env-vars="NODE_ENV=production,NEXT_PUBLIC_API_URL=${API_URL}"
    
    echo -e "${GREEN}✅ Services deployed${NC}"
    
    # Get service URLs
    WEB_URL=$(gcloud run services describe glowguide-web --region=$REGION --format="value(status.url)")
    
    echo ""
    echo -e "${GREEN}🎉 Deployment Complete!${NC}"
    echo ""
    echo -e "${BLUE}Service URLs:${NC}"
    echo "  API:     $API_URL"
    echo "  Web:     $WEB_URL"
    echo ""
else
    echo -e "${BLUE}ℹ️  Skipping service deployment${NC}"
fi

# Setup monitoring
echo -e "${YELLOW}📊 Setting up monitoring...${NC}"
read -p "Setup monitoring? (y/n): " SETUP_MONITORING
if [ "$SETUP_MONITORING" = "y" ]; then
    # Create uptime checks
    gcloud monitoring uptime create glowguide-api-uptime \
      --display-name="GlowGuide API Uptime" \
      --resource-type=uptime-url \
      --host=$(echo $API_URL | sed 's|https://||') \
      --path=/health \
      --check-interval=60s 2>/dev/null || echo "Uptime check already exists"
    
    echo -e "${GREEN}✅ Monitoring configured${NC}"
else
    echo -e "${BLUE}ℹ️  Skipping monitoring setup${NC}"
fi
echo ""

# Summary
echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║              Deployment Summary                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo -e "${BLUE}📦 Resources Created:${NC}"
echo "  ✅ Artifact Registry repository"
echo "  ✅ Cloud SQL (PostgreSQL)"
echo "  ✅ Memorystore (Redis)"
echo "  ✅ Cloud Storage bucket"
echo "  ✅ Secret Manager secrets"
echo "  ✅ Cloud Run services (API, Workers, Web)"
echo ""
echo -e "${BLUE}🔗 Next Steps:${NC}"
echo "  1. Update CORS settings in API with Web URL"
echo "  2. Configure custom domain (optional)"
echo "  3. Setup Cloud CDN (optional)"
echo "  4. Run database migrations"
echo "  5. Test all endpoints"
echo ""
echo -e "${BLUE}📖 Documentation:${NC}"
echo "  See GCP_DEPLOYMENT_GUIDE.md for detailed instructions"
echo ""
echo -e "${GREEN}🎉 GCP deployment completed successfully!${NC}"
