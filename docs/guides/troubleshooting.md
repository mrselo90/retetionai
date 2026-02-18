# Troubleshooting Guide

## Common Issues and Solutions

This guide covers common issues you may encounter and how to resolve them.

---

## Application Won't Start

### Issue: Port Already in Use

**Error**: `EADDRINUSE: address already in use :::3000`

**Solution**:
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 PID

# Or use a different port
PORT=3001 pnpm dev
```

### Issue: Database Connection Failed

**Error**: `Connection refused` or `ECONNREFUSED`

**Solution**:
```bash
# Check if Supabase is running
supabase status

# Start Supabase
supabase start

# Verify DATABASE_URL in .env
echo $DATABASE_URL
```

### Issue: Redis Connection Failed

**Error**: `Redis connection to localhost:6379 failed`

**Solution**:
```bash
# Check if Redis is running
redis-cli ping

# Start Redis (macOS)
brew services start redis

# Start Redis (Linux)
sudo systemctl start redis

# Verify REDIS_URL in .env
echo $REDIS_URL
```

---

## WhatsApp Integration Issues

### Issue: Webhook Not Receiving Messages

**Symptoms**: Messages sent to WhatsApp number but no webhook calls

**Solutions**:

1. **Verify webhook URL is accessible**:
   ```bash
   curl https://your-domain.com/api/webhooks/whatsapp
   ```

2. **Check webhook configuration in Meta**:
   - Go to WhatsApp → Configuration
   - Verify webhook URL matches your domain
   - Ensure webhook is subscribed to `messages` field

3. **Verify verify token**:
   - Check `WHATSAPP_VERIFY_TOKEN` in .env
   - Must match token in Meta configuration

4. **Check application logs**:
   ```bash
   # View recent logs
   tail -f logs/app.log
   
   # Or check console output
   pnpm dev
   ```

### Issue: Messages Not Sending

**Error**: `Invalid OAuth access token`

**Solutions**:

1. **Verify access token**:
   ```bash
   curl -X GET "https://graph.facebook.com/v21.0/me" \
     -H "Authorization: Bearer $WHATSAPP_ACCESS_TOKEN"
   ```

2. **Check token hasn't expired**:
   - Temporary tokens expire after 24 hours
   - Generate offline token for production

3. **Verify phone number ID**:
   ```bash
   echo $WHATSAPP_PHONE_NUMBER_ID
   ```

4. **Check rate limits**:
   - Tier 1: 1,000 messages/24h
   - Wait or request tier upgrade

### Issue: "This message type is not supported"

**Cause**: Trying to send unsupported message type

**Solution**:
- Current implementation supports text messages only
- For media messages, extend `sendWhatsAppMessage` function
- See [WhatsApp Media Messages](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/media-messages)

---

## Database Issues

### Issue: Migration Failed

**Error**: `Migration failed: relation already exists`

**Solution**:
```bash
# Reset database
supabase db reset

# Or manually drop and recreate
psql -U postgres -c "DROP DATABASE postgres;"
psql -U postgres -c "CREATE DATABASE postgres;"

# Run migrations
pnpm db:migrate
```

### Issue: Slow Queries

**Symptoms**: API responses taking > 1 second

**Solutions**:

1. **Check missing indexes**:
   ```sql
   -- Find slow queries
   SELECT * FROM pg_stat_statements 
   ORDER BY mean_exec_time DESC 
   LIMIT 10;
   ```

2. **Add indexes**:
   ```sql
   CREATE INDEX idx_users_phone ON users(phone_number);
   CREATE INDEX idx_orders_merchant ON orders(merchant_id);
   ```

3. **Enable query caching**:
   - Check `ENABLE_CACHE=true` in .env
   - Verify Redis is running

### Issue: Connection Pool Exhausted

**Error**: `remaining connection slots are reserved`

**Solution**:
```typescript
// Increase pool size in database config
const pool = new Pool({
  max: 20, // Increase from default 10
  idleTimeoutMillis: 30000,
});
```

---

## API Issues

### Issue: 401 Unauthorized

**Cause**: Invalid or missing authentication

**Solutions**:

1. **Check JWT token**:
   ```bash
   # Decode token to verify
   echo "YOUR_TOKEN" | base64 -d
   ```

2. **Verify JWT_SECRET**:
   ```bash
   echo $JWT_SECRET
   # Must match between environments
   ```

3. **Check token expiration**:
   - Default expiration: 24 hours
   - Generate new token if expired

4. **For API key auth**:
   ```bash
   # Verify API key header
   curl -X GET https://your-domain.com/api/products \
     -H "X-API-Key: YOUR_API_KEY"
   ```

### Issue: 429 Too Many Requests

**Cause**: Rate limit exceeded

**Solutions**:

1. **Check rate limit settings**:
   ```bash
   echo $RATE_LIMIT_MAX
   echo $RATE_LIMIT_WINDOW_MS
   ```

2. **Implement exponential backoff**:
   ```typescript
   async function retryWithBackoff(fn, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await fn();
       } catch (error) {
         if (error.status === 429 && i < maxRetries - 1) {
           await new Promise(resolve => 
             setTimeout(resolve, Math.pow(2, i) * 1000)
           );
         } else {
           throw error;
         }
       }
     }
   }
   ```

3. **Request rate limit increase**:
   - Contact support
   - Upgrade plan if needed

### Issue: 500 Internal Server Error

**Cause**: Unhandled exception in application

**Solutions**:

1. **Check application logs**:
   ```bash
   tail -f logs/error.log
   ```

2. **Check Sentry** (if configured):
   - Go to Sentry dashboard
   - Find recent errors
   - Review stack trace

3. **Enable debug mode**:
   ```bash
   NODE_ENV=development pnpm dev
   ```

---

## AI Agent Issues

### Issue: AI Responses Are Slow

**Symptoms**: Responses taking > 5 seconds

**Solutions**:

1. **Check OpenAI API status**:
   - Visit [OpenAI Status](https://status.openai.com/)

2. **Reduce context size**:
   ```typescript
   // Limit conversation history
   const recentMessages = messages.slice(-10);
   ```

3. **Use streaming**:
   ```typescript
   const stream = await openai.chat.completions.create({
     model: 'gpt-4',
     messages,
     stream: true,
   });
   ```

4. **Cache common responses**:
   - Enable Redis caching
   - Cache FAQ responses

### Issue: AI Responses Are Off-Brand

**Cause**: System prompt not properly configured

**Solutions**:

1. **Update system prompt**:
   - Go to Dashboard → Settings → AI Configuration
   - Add brand voice guidelines
   - Include do's and don'ts

2. **Use recipe mappings**:
   - Create recipes for common scenarios
   - Ensure consistent responses

3. **Enable guardrails**:
   - Set up content filters
   - Configure escalation rules

### Issue: Guardrails Blocking Valid Responses

**Symptoms**: Too many escalations to human

**Solutions**:

1. **Review guardrail rules**:
   ```bash
   curl -X GET https://your-domain.com/api/merchants/me/guardrails \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

2. **Adjust sensitivity**:
   - Lower PII detection threshold
   - Reduce toxic content sensitivity
   - Update blocked topics list

3. **Check escalation logs**:
   ```bash
   grep "escalation" logs/app.log
   ```

---

## Performance Issues

### Issue: High Memory Usage

**Symptoms**: Application using > 1GB RAM

**Solutions**:

1. **Check for memory leaks**:
   ```bash
   # Monitor memory usage
   node --inspect pnpm dev
   # Open chrome://inspect
   ```

2. **Limit concurrent requests**:
   ```typescript
   // Add request queue
   const queue = new PQueue({ concurrency: 10 });
   ```

3. **Clear caches periodically**:
   ```bash
   # Clear Redis cache
   redis-cli FLUSHDB
   ```

### Issue: High CPU Usage

**Symptoms**: CPU usage > 80%

**Solutions**:

1. **Profile application**:
   ```bash
   node --prof pnpm dev
   node --prof-process isolate-*.log > processed.txt
   ```

2. **Optimize database queries**:
   - Add indexes
   - Use query caching
   - Limit result sets

3. **Use worker threads**:
   - Move heavy processing to workers
   - Use BullMQ for background jobs

---

## Build and Deployment Issues

### Issue: TypeScript Build Fails

**Error**: `Cannot find module` or `Type error`

**Solutions**:

1. **Clean and rebuild**:
   ```bash
   pnpm clean
   pnpm build
   ```

2. **Check tsconfig.json**:
   - Verify paths are correct
   - Check module resolution
   - Ensure all packages referenced

3. **Update dependencies**:
   ```bash
   pnpm update
   ```

### Issue: ESLint Errors

**Error**: `Parsing error` or `Rule violations`

**Solutions**:

1. **Run lint fix**:
   ```bash
   pnpm lint:fix
   ```

2. **Check ESLint config**:
   ```bash
   cat eslint.config.js
   ```

3. **Update ESLint**:
   ```bash
   pnpm add -D eslint@latest
   ```

### Issue: Tests Failing

**Error**: Tests that passed locally fail in CI

**Solutions**:

1. **Check environment variables**:
   - Ensure test env vars are set in CI
   - Use `.env.test` for test config

2. **Clear test database**:
   ```bash
   pnpm test:reset
   ```

3. **Run tests in isolation**:
   ```bash
   pnpm test -- --no-coverage --run
   ```

---

## Getting Help

### Before Asking for Help

1. **Check logs**:
   - Application logs
   - Database logs
   - Redis logs
   - Sentry errors

2. **Search documentation**:
   - This troubleshooting guide
   - API documentation
   - Setup guides

3. **Search GitHub issues**:
   - Check existing issues
   - Look for similar problems

### How to Report Issues

Include the following information:

1. **Environment**:
   - OS and version
   - Node.js version
   - pnpm version
   - Package versions

2. **Steps to reproduce**:
   - Exact commands run
   - Configuration used
   - Sample data

3. **Error messages**:
   - Full error stack trace
   - Relevant log entries
   - Screenshots if applicable

4. **What you've tried**:
   - Solutions attempted
   - Results of each attempt

### Support Channels

- **Documentation**: [docs.recete.com](https://docs.recete.com)
- **GitHub Issues**: [github.com/recete/retention-agent](https://github.com/recete/retention-agent)
- **Email Support**: support@recete.com
- **Community Forum**: [community.recete.com](https://community.recete.com)

---

## Useful Commands

### Debugging

```bash
# View all environment variables
printenv | grep -E "DATABASE|REDIS|WHATSAPP|OPENAI"

# Test database connection
psql $DATABASE_URL -c "SELECT 1;"

# Test Redis connection
redis-cli -u $REDIS_URL ping

# Test API endpoint
curl -v http://localhost:3000/health

# View recent logs
tail -100 logs/app.log

# Monitor logs in real-time
tail -f logs/app.log | grep ERROR
```

### Maintenance

```bash
# Reset database
supabase db reset

# Clear Redis cache
redis-cli FLUSHALL

# Rebuild all packages
pnpm clean && pnpm build

# Update all dependencies
pnpm update --latest

# Run database migrations
pnpm db:migrate

# Seed test data
pnpm db:seed
```

### Monitoring

```bash
# Check application status
curl http://localhost:3000/health

# View database stats
psql $DATABASE_URL -c "SELECT * FROM pg_stat_database;"

# View Redis stats
redis-cli INFO stats

# Check disk space
df -h

# Check memory usage
free -h
```
