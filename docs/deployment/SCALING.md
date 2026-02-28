# Scaling Strategy

## Overview

This document outlines scaling strategies for Recete Retention Agent as it grows.

## Current Architecture

- **API**: Single Hono server instance
- **Workers**: Single BullMQ worker instance
- **Database**: PostgreSQL (Supabase)
- **Queue**: Redis (single instance)
- **Web**: Next.js (static/SSR)

## Scaling Approaches

### 1. Horizontal Scaling (Recommended)

Run multiple instances of API and Workers behind a load balancer.

#### API Scaling

```yaml
# docker-compose.yml example
services:
  api:
    deploy:
      replicas: 3
    # ... rest of config
```

**Benefits:**
- Increased throughput
- High availability
- Easy to scale up/down

**Considerations:**
- Stateless API design (✅ already stateless)
- Shared Redis for rate limiting
- Shared database connection pool

#### Worker Scaling

```yaml
services:
  workers:
    deploy:
      replicas: 5
    # ... rest of config
```

**Benefits:**
- Faster job processing
- Better queue throughput
- Parallel processing

**Considerations:**
- Idempotent jobs (✅ already idempotent)
- Shared Redis queue
- No job duplication

### 2. Database Scaling

#### Connection Pooling

Use PgBouncer for connection pooling:

```yaml
services:
  pgbouncer:
    image: pgbouncer/pgbouncer
    environment:
      DATABASES_HOST: postgres
      DATABASES_PORT: 5432
      DATABASES_USER: postgres
      DATABASES_PASSWORD: ${POSTGRES_PASSWORD}
      POOL_MODE: transaction
      MAX_CLIENT_CONN: 1000
      DEFAULT_POOL_SIZE: 25
```

#### Read Replicas

For read-heavy workloads:
- Use Supabase read replicas
- Route read queries to replicas
- Write queries to primary

#### Vertical Scaling

- Upgrade database instance size
- Increase CPU/RAM
- Use faster storage (SSD)

### 3. Redis Scaling

#### Redis Cluster

For high availability and performance:

```yaml
services:
  redis:
    image: redis:7-alpine
    command: redis-server --cluster-enabled yes
    # ... cluster config
```

#### Redis Sentinel

For automatic failover:

```yaml
services:
  redis-sentinel:
    image: redis:7-alpine
    command: redis-sentinel /etc/redis/sentinel.conf
```

### 4. CDN for Static Assets

Use Cloudflare or similar for:
- Next.js static assets
- Images
- Fonts
- CSS/JS bundles

**Benefits:**
- Reduced server load
- Faster global delivery
- Lower bandwidth costs

### 5. Caching Strategy

#### Application-Level Caching

- **Redis**: Cache frequently accessed data
- **In-memory**: Cache computed results
- **TTL**: Set appropriate expiration times

#### Database Query Caching

- Cache expensive queries
- Invalidate on updates
- Use Redis for query results

## Load Balancing

### Nginx Configuration

```nginx
upstream api_backend {
    least_conn;
    server api1:3001;
    server api2:3001;
    server api3:3001;
}

server {
    listen 80;
    server_name api.recete.co.uk;

    location / {
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### Cloud Load Balancers

- **AWS ALB**: Application Load Balancer
- **Google Cloud Load Balancer**
- **Azure Load Balancer**
- **Cloudflare Load Balancer**

## Monitoring Scaling Metrics

### Key Metrics to Watch

1. **API:**
   - Request rate (requests/second)
   - Response time (p50, p95, p99)
   - Error rate
   - CPU/Memory usage

2. **Workers:**
   - Queue length
   - Job processing rate
   - Failed jobs
   - CPU/Memory usage

3. **Database:**
   - Connection count
   - Query performance
   - Replication lag
   - Disk I/O

4. **Redis:**
   - Memory usage
   - Hit rate
   - Connection count
   - Commands/second

## Auto-Scaling

### Kubernetes HPA (Horizontal Pod Autoscaler)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### Cloud Auto-Scaling

- **AWS**: Auto Scaling Groups
- **Google Cloud**: Managed Instance Groups
- **Azure**: Virtual Machine Scale Sets

## Performance Targets

### API
- **Response Time**: < 200ms (p95)
- **Throughput**: 1000 req/s per instance
- **Availability**: 99.9% uptime

### Workers
- **Job Processing**: < 5s average
- **Queue Latency**: < 1 minute
- **Throughput**: 100 jobs/s per worker

### Database
- **Query Time**: < 100ms (p95)
- **Connection Pool**: 25-100 connections
- **Replication Lag**: < 1 second

## Cost Optimization

1. **Right-sizing**: Match instance size to workload
2. **Reserved Instances**: For predictable workloads
3. **Spot Instances**: For workers (if fault-tolerant)
4. **Auto-scaling**: Scale down during low traffic
5. **Caching**: Reduce database load

## Scaling Checklist

Before scaling:

- [ ] Load testing completed
- [ ] Monitoring in place
- [ ] Auto-scaling configured
- [ ] Database connection pooling
- [ ] Redis cluster/sentinel setup
- [ ] CDN configured
- [ ] Backup strategy in place
- [ ] Disaster recovery plan

## Example Scaling Scenarios

### Scenario 1: High Traffic Spike

**Problem**: Black Friday traffic spike

**Solution**:
1. Auto-scale API to 10 instances
2. Auto-scale Workers to 20 instances
3. Enable read replicas
4. Increase Redis memory
5. Use CDN for static assets

### Scenario 2: Growing User Base

**Problem**: 10x user growth over 6 months

**Solution**:
1. Gradually increase API instances (2 → 5 → 10)
2. Add database read replicas
3. Implement Redis cluster
4. Optimize slow queries
5. Add caching layers

### Scenario 3: Geographic Expansion

**Problem**: Need to serve global users

**Solution**:
1. Deploy to multiple regions
2. Use CDN with edge locations
3. Database replication per region
4. Route traffic by region
5. Monitor latency per region
