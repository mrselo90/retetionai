# Load Testing Guide

## Overview

This guide outlines load testing strategies for Recete Retention Agent to ensure it can handle production traffic.

## Testing Tools

### 1. k6 (Recommended)

**Installation:**
```bash
brew install k6  # macOS
# or download from https://k6.io
```

**Features:**
- Scriptable in JavaScript
- Real browser metrics
- Cloud execution
- CI/CD integration

### 2. Artillery

**Installation:**
```bash
npm install -g artillery
```

**Features:**
- YAML-based configuration
- Real-time metrics
- Distributed testing
- Plugin ecosystem

### 3. Apache Bench (ab)

**Installation:**
```bash
# Built into macOS/Linux
ab -n 1000 -c 10 https://api.glowguide.ai/health
```

**Features:**
- Simple command-line tool
- Quick tests
- Basic metrics

## Test Scenarios

### 1. Health Check Endpoint

**Goal**: Verify basic API availability

```javascript
// k6 test
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
};

export default function () {
  const res = http.get('https://api.glowguide.ai/health');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 100ms': (r) => r.timings.duration < 100,
  });
}
```

### 2. API Authentication

**Goal**: Test authentication endpoints

```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 },
  ],
};

export default function () {
  const payload = JSON.stringify({
    email: 'test@example.com',
    password: 'testpassword',
  });
  
  const params = {
    headers: { 'Content-Type': 'application/json' },
  };
  
  const res = http.post('https://api.glowguide.ai/api/auth/login', payload, params);
  check(res, {
    'login successful': (r) => r.status === 200,
  });
}
```

### 3. Product Listing

**Goal**: Test product listing with authentication

```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 20,
  duration: '2m',
};

export default function () {
  // Get auth token first
  const loginRes = http.post('https://api.glowguide.ai/api/auth/login', 
    JSON.stringify({ email: 'test@example.com', password: 'testpassword' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  const token = loginRes.json().token;
  
  // Test product listing
  const res = http.get('https://api.glowguide.ai/api/products', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
    'has products': (r) => r.json().products.length > 0,
  });
}
```

### 4. RAG Query

**Goal**: Test RAG query performance

```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 10,
  duration: '1m',
};

export default function () {
  const token = __ENV.API_TOKEN;
  
  const payload = JSON.stringify({
    query: 'How do I use this product?',
    merchantId: __ENV.MERCHANT_ID,
  });
  
  const res = http.post('https://api.glowguide.ai/api/rag/query', payload, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 2s': (r) => r.timings.duration < 2000,
    'has results': (r) => r.json().results.length > 0,
  });
}
```

### 5. WhatsApp Webhook

**Goal**: Test webhook handling

```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 5,
  duration: '1m',
};

export default function () {
  const payload = JSON.stringify({
    // WhatsApp webhook payload
    messages: [{
      from: '1234567890',
      text: 'Hello',
    }],
  });
  
  const res = http.post('https://api.glowguide.ai/webhooks/whatsapp', payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
}
```

## Performance Targets

### API Endpoints

| Endpoint | Target p95 | Target p99 | Max RPS |
|----------|------------|------------|---------|
| Health | 50ms | 100ms | 1000 |
| Login | 200ms | 500ms | 100 |
| Products List | 200ms | 500ms | 200 |
| Product Detail | 150ms | 300ms | 300 |
| RAG Query | 2s | 5s | 50 |
| Webhook | 100ms | 200ms | 500 |

### Database

- **Query Time**: p95 < 50ms
- **Connection Pool**: 25-100 connections
- **Concurrent Queries**: < 200

### Redis

- **Command Time**: p95 < 5ms
- **Memory Usage**: < 80%
- **Hit Rate**: > 80%

## Stress Testing

### Ramp-up Test

Gradually increase load to find breaking point:

```javascript
export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up
    { duration: '2m', target: 100 },   // Stay
    { duration: '1m', target: 200 },   // Increase
    { duration: '2m', target: 200 },   // Stay
    { duration: '1m', target: 0 },      // Ramp down
  ],
};
```

### Spike Test

Test sudden traffic spikes:

```javascript
export const options = {
  stages: [
    { duration: '10s', target: 10 },
    { duration: '10s', target: 500 },  // Spike
    { duration: '30s', target: 500 },
    { duration: '10s', target: 10 },
  ],
};
```

## Monitoring During Tests

### Key Metrics

1. **Response Time**: p50, p95, p99
2. **Error Rate**: < 1%
3. **Throughput**: Requests per second
4. **Resource Usage**: CPU, Memory, Network
5. **Database**: Query time, connection count
6. **Redis**: Memory, hit rate, latency

### Tools

- **k6 Cloud**: Real-time metrics
- **Grafana**: Custom dashboards
- **Prometheus**: Metrics collection
- **Sentry**: Error tracking

## Test Execution

### Local Testing

```bash
# Run k6 test
k6 run load-test.js

# Run with environment variables
k6 run --env API_TOKEN=xxx --env MERCHANT_ID=yyy load-test.js
```

### CI/CD Integration

```yaml
# .github/workflows/load-test.yml
name: Load Test
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run k6
        uses: grafana/k6-action@v0.2.0
        with:
          filename: tests/load-test.js
```

## Capacity Planning

### Current Capacity

Based on load tests:
- **API**: ~500 req/s per instance
- **Workers**: ~100 jobs/s per worker
- **Database**: ~200 concurrent queries
- **Redis**: ~10,000 ops/s

### Scaling Recommendations

- **API**: Scale horizontally (2-10 instances)
- **Workers**: Scale based on queue length (2-20 workers)
- **Database**: Use read replicas for reads
- **Redis**: Use cluster for high throughput

## Test Results Analysis

### Success Criteria

- ✅ p95 response time < target
- ✅ Error rate < 1%
- ✅ No memory leaks
- ✅ Database stable
- ✅ Redis stable

### Failure Scenarios

- ❌ Response time > target
- ❌ Error rate > 1%
- ❌ Memory leaks
- ❌ Database connection exhaustion
- ❌ Redis memory full

## Continuous Testing

### Schedule

- **Daily**: Smoke tests (5 minutes)
- **Weekly**: Full load tests (30 minutes)
- **Before Release**: Stress tests (1 hour)

### Alerts

Set up alerts for:
- High error rates
- Slow response times
- Resource exhaustion
- Service degradation
