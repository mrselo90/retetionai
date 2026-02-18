# Performance Optimization Guide

## Overview

This document outlines performance optimizations implemented in Recete Retention Agent.

## Caching Strategy

### Redis Caching

We use Redis for caching frequently accessed data:

- **Merchant Data**: 5 minutes TTL
- **Product Data**: 10 minutes TTL
- **Plan Limits**: 30 minutes TTL
- **Usage Data**: 1 minute TTL (for real-time feel)
- **RAG Query Results**: 1 hour TTL
- **API Responses**: 1 minute TTL (selective)

### Cache Invalidation

Cache is automatically invalidated when:
- Merchant subscription changes
- Product is created/updated/deleted
- Usage is incremented
- Plan limits change

### Cache Warming

For frequently accessed data, consider implementing cache warming:
- Pre-load merchant data on startup
- Pre-load plan limits for active merchants
- Pre-load popular products

## Database Optimization

### Indexes

We've added comprehensive indexes for:
- JSONB queries (GIN indexes)
- Composite queries (merchant_id + status)
- Time-based queries (delivery_date, execute_at)
- Vector similarity searches (product_id + embedding)

### Query Optimization

**Best Practices:**
1. Use `SELECT` with specific columns (avoid `SELECT *`)
2. Use `LIMIT` for pagination
3. Use `WHERE` clauses with indexed columns
4. Avoid N+1 queries (use joins or batch queries)
5. Use connection pooling (PgBouncer)

**Example Optimizations:**
```sql
-- Bad: Full table scan
SELECT * FROM orders WHERE status = 'delivered';

-- Good: Uses index
SELECT id, merchant_id, user_id, status, delivery_date 
FROM orders 
WHERE merchant_id = $1 AND status = 'delivered'
ORDER BY delivery_date DESC
LIMIT 20;
```

### Connection Pooling

Use PgBouncer for connection pooling:
- **Pool Mode**: Transaction
- **Max Connections**: 1000
- **Default Pool Size**: 25 per database

## API Optimization

### Response Compression

Enable gzip compression for API responses:
```typescript
// In Hono middleware
app.use('*', async (c, next) => {
  await next();
  // Add compression headers
  c.header('Content-Encoding', 'gzip');
});
```

### Pagination

Always paginate large result sets:
- Default page size: 20
- Maximum page size: 100
- Use cursor-based pagination for large datasets

### Batch Operations

For bulk operations, use batch endpoints:
- Batch product creation
- Batch message sending
- Batch analytics queries

## Frontend Optimization

### Next.js Optimizations

1. **Static Generation**: Use `generateStaticParams` where possible
2. **Image Optimization**: Use Next.js Image component
3. **Code Splitting**: Dynamic imports for heavy components
4. **Caching**: Use Next.js caching headers

### API Request Optimization

1. **Debouncing**: Debounce search inputs
2. **Request Deduplication**: Use SWR or React Query
3. **Optimistic Updates**: Update UI before API response
4. **Lazy Loading**: Load data on demand

## Monitoring Performance

### Key Metrics

1. **API Response Time**:
   - p50: < 100ms
   - p95: < 200ms
   - p99: < 500ms

2. **Database Query Time**:
   - p95: < 50ms
   - p99: < 100ms

3. **Cache Hit Rate**:
   - Target: > 80%

4. **Queue Processing**:
   - Average job time: < 5s
   - Queue latency: < 1 minute

### Tools

- **Prometheus**: Application metrics
- **Sentry**: Performance monitoring
- **Supabase Dashboard**: Query performance
- **Redis CLI**: Cache statistics

## Performance Testing

### Load Testing

Use tools like:
- **k6**: Load testing
- **Artillery**: API load testing
- **Apache Bench**: Simple load testing

### Example k6 Test

```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '1m', target: 200 },
    { duration: '30s', target: 0 },
  ],
};

export default function () {
  const res = http.get('https://api.glowguide.ai/api/health');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
}
```

## Optimization Checklist

- [x] Redis caching implemented
- [x] Database indexes added
- [ ] Connection pooling configured
- [ ] Response compression enabled
- [ ] CDN configured (for static assets)
- [ ] Frontend code splitting
- [ ] API pagination
- [ ] Load testing completed
- [ ] Performance monitoring active

## Future Optimizations

1. **Read Replicas**: For read-heavy workloads
2. **CDN**: For static assets and API responses
3. **Edge Caching**: For global distribution
4. **Query Result Caching**: At database level
5. **Materialized Views**: For complex analytics queries
