# 🚀 DEPLOYMENT INSTRUCTIONS

## Current Status
✅ **Git**: All code is pushed to `origin/main` (commit: e1cbc9d)  
⏳ **Server**: Waiting for SSH connection (server may be upgrading)

## What's Been Deployed to Git

### Performance Optimizations (5 commits)
1. **e1cbc9d** - Documentation for migration 010
2. **7c02459** - Fixed duplicate index issue
3. **84aa12a** - Fixed table name (knowledge_chunks)
4. **3be2c5a** - Fixed column name (execute_at)
5. **5e755db** - Core performance optimizations

### Changes Include:
- ✅ Analytics query optimization (60 DB queries → 2)
- ✅ Batch product chunks endpoint
- ✅ 15 database indexes for performance
- ✅ Redis caching with 5-minute TTL
- ✅ Enhanced Redis connection reliability
- ✅ Next.js performance optimizations
- ✅ Security headers and compression

## Deploy to Your Server (2 Options)

### Option 1: Automated Script (Recommended)

Once your server is accessible, copy and run the deployment script:

```bash
# On your local machine, copy the script to server
scp deploy.sh root@<YOUR_SERVER_IP>:/root/

# SSH into your server
ssh root@<YOUR_SERVER_IP>

# Run the deployment script
cd /root
chmod +x deploy.sh
./deploy.sh
```

The script will automatically:
1. Pull latest code
2. Install dependencies
3. Run database migration
4. Build application
5. Restart services
6. Verify everything is working

### Option 2: Manual Deployment

If you prefer manual steps:

```bash
# SSH into your server
ssh root@<YOUR_SERVER_IP>

# Navigate to project
cd /root/retetionai

# Pull latest code
git pull origin main

# Install dependencies
pnpm install

# Run database migration (IMPORTANT!)
psql $DATABASE_URL -f supabase/migrations/010_performance_indexes.sql

# Build application
pnpm build

# Restart services
pm2 restart all --update-env

# Check status
pm2 list
pm2 logs --lines 50
```

## Critical: Database Migration

The performance improvements require running the database migration:

```bash
psql $DATABASE_URL -f supabase/migrations/010_performance_indexes.sql
```

This will create 13 new indexes that significantly improve query performance.

### Expected Migration Output:
```
CREATE INDEX  ← Success!
or
NOTICE: relation "idx_..." already exists, skipping  ← Also success!
```

## Verification Steps

After deployment, verify everything is working:

### 1. Check Services
```bash
pm2 list
# All should show "online"
```

### 2. Test API
```bash
curl http://localhost:3002/api/health
# Should return health status
```

### 3. Test Web Server
```bash
curl -I http://localhost:3001/
# Should return HTTP 200 or 307
```

### 4. Test Redis
```bash
redis-cli ping
# Should return PONG
```

### 5. Verify Database Indexes
```bash
psql $DATABASE_URL -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';"
# Should show increased index count
```

### 6. Test Performance
```bash
# Test analytics endpoint (should be < 1 second)
time curl -s -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3002/api/analytics/dashboard > /dev/null
```

## Expected Performance Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Analytics Dashboard | 5.3s | < 1s | **80% faster** |
| Products Page | 2-3s | < 500ms | **75% faster** |
| Product Chunks | 200-550ms each | < 100ms total | **90% faster** |
| Redis Uptime | 95% | 99.9% | **+4.9%** |
| Overall API | Baseline | -30-50% | **Significant** |

## Troubleshooting

### If Services Don't Start
```bash
pm2 logs --lines 100
# Look for error messages
```

### If Migration Fails
Check the error message. Common issues:
- **Column doesn't exist**: Already fixed in commit 3be2c5a
- **Table doesn't exist**: Already fixed in commit 84aa12a
- **Index already exists**: This is OK! Migration uses IF NOT EXISTS

### If Redis Connection Fails
```bash
# Check Redis is running
systemctl status redis-server

# Restart Redis if needed
systemctl restart redis-server
```

### If Build Fails
```bash
# Clear build cache
rm -rf packages/*/dist packages/*/.next

# Rebuild
pnpm build
```

## Rollback Plan

If you need to rollback:

```bash
cd /root/retetionai
git log --oneline  # Find the commit before 5e755db
git reset --hard <PREVIOUS_COMMIT>
pnpm install
pnpm build
pm2 restart all
```

## Support Files

- **PERFORMANCE_OPTIMIZATIONS.md** - Detailed technical documentation
- **MIGRATION_010_STATUS.md** - Migration status and verification
- **deploy.sh** - Automated deployment script
- **supabase/migrations/010_performance_indexes.sql** - Database migration

## Contact

If you encounter any issues during deployment, check:
1. PM2 logs: `pm2 logs --lines 100`
2. System resources: `free -h` and `df -h`
3. Database connection: `psql $DATABASE_URL -c "SELECT 1"`

---

**Ready to Deploy**: ✅
**Latest Commit**: Pushed to origin/main
**Frontend**: Vercel (Auto-deployed)
**Backend**: Manual (Run `./deploy.sh` on server)
