# Supabase Database Setup

This directory contains database migrations and setup scripts for GlowGuide Retention Agent.

## Migration Files

- `001_initial_schema.sql` - Initial database schema with all tables, indexes, and triggers
- `002_rls_policies.sql` - Row Level Security (RLS) policies for multi-tenant isolation

## Setup Instructions

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note down your project URL and API keys:
   - Project URL (SUPABASE_URL)
   - Anon/Public Key (SUPABASE_ANON_KEY)
   - Service Role Key (SUPABASE_SERVICE_ROLE_KEY)

### 2. Run Migrations

#### Option A: Using Supabase CLI (Recommended)

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

#### Option B: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run `001_initial_schema.sql` first
4. Then run `002_rls_policies.sql`

### 3. Enable pgvector Extension

The migration automatically enables the `vector` extension, but verify it's enabled:

```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

If not enabled, run:
```sql
CREATE EXTENSION IF NOT EXISTS "vector";
```

### 4. Verify Setup

Run this query to verify all tables are created:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

You should see:
- merchants
- integrations
- products
- users
- orders
- knowledge_chunks
- conversations
- analytics_events
- sync_jobs
- external_events
- scheduled_tasks

### 5. Set Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

## Database Schema Overview

### Core Tables
- **merchants**: Multi-tenant root table
- **integrations**: Platform connections (Shopify, WooCommerce, etc.)
- **products**: Product catalog with vector search support
- **users**: End-users/customers
- **orders**: Order tracking

### Intelligence Tables
- **knowledge_chunks**: RAG embeddings for product knowledge
- **conversations**: WhatsApp conversation history
- **analytics_events**: Event tracking for analytics
- **sync_jobs**: Async job tracking
- **external_events**: Event ingestion with idempotency
- **scheduled_tasks**: Scheduled message tasks

## Security

All tables have Row Level Security (RLS) enabled. Policies ensure:
- Each merchant can only access their own data
- Service role key bypasses RLS (use with caution)
- Application code must always filter by `merchant_id`

## Vector Search

The `knowledge_chunks` table uses pgvector for semantic search:
- Embedding dimension: 1536 (OpenAI)
- Index type: HNSW (fast approximate search)
- Distance function: Cosine similarity
