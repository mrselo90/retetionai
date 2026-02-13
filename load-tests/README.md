# Load Testing with k6

This directory contains load tests for the GlowGuide Retention Agent API.

## Prerequisites

Install k6:
```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D53
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows
# Download from https://k6.io/docs/getting-started/installation/
```

## Test Files

- `auth.js` - Authentication endpoints (login, signup)
- `webhooks.js` - Webhook ingestion endpoints
- `products.js` - Product management endpoints
- `rag.js` - RAG query endpoints

## Running Tests

### Authentication Load Test
```bash
k6 run load-tests/auth.js
```

### Webhook Load Test
```bash
API_KEY=your-api-key k6 run load-tests/webhooks.js
```

### Products Load Test
```bash
JWT_TOKEN=your-jwt-token k6 run load-tests/products.js
```

### RAG Query Load Test
```bash
JWT_TOKEN=your-jwt-token k6 run load-tests/rag.js
```

### All Tests
```bash
# Run all load tests
k6 run load-tests/auth.js
k6 run load-tests/webhooks.js
k6 run load-tests/products.js
k6 run load-tests/rag.js
```

## Environment Variables

- `API_URL` - API base URL (default: http://localhost:3001)
- `API_KEY` - API key for webhook tests
- `JWT_TOKEN` - JWT token for authenticated endpoints

## Test Scenarios

### Authentication (auth.js)
- **Target**: 100 req/s
- **Duration**: 2 minutes
- **Thresholds**: p95 < 500ms, error rate < 1%

### Webhooks (webhooks.js)
- **Target**: 200 req/s
- **Duration**: 2 minutes
- **Thresholds**: p95 < 500ms, error rate < 1%

### Products (products.js)
- **Target**: 100 req/s
- **Duration**: 2 minutes
- **Thresholds**: p95 < 300ms, error rate < 1%

### RAG Queries (rag.js)
- **Target**: 20 req/s (slower due to AI processing)
- **Duration**: 2 minutes
- **Thresholds**: p95 < 2000ms, error rate < 1%

## Results

Test results are saved to `load-tests/results/` directory in JSON format.

## Notes

- Make sure API and frontend servers are running before running load tests
- Adjust thresholds based on your infrastructure capacity
- Monitor server resources during load tests
- Use staging environment for load testing, not production
