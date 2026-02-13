/**
 * Products Load Test
 * Tests product endpoints under load
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const productListDuration = new Trend('product_list_duration');
const productGetDuration = new Trend('product_get_duration');

export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Ramp up to 50 req/s
    { duration: '1m', target: 100 },  // Ramp up to 100 req/s
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.01'],
    product_list_duration: ['p(95)<300'],
    product_get_duration: ['p(95)<200'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3001';
const JWT_TOKEN = __ENV.JWT_TOKEN || 'test-jwt-token';

export default function () {
  // Test product list endpoint
  const listStart = Date.now();
  const listResponse = http.get(`${BASE_URL}/api/products`, {
    headers: {
      'Authorization': `Bearer ${JWT_TOKEN}`,
    },
    tags: { name: 'ProductList' },
  });
  productListDuration.add(Date.now() - listStart);

  const listSuccess = check(listResponse, {
    'product list status is 200': (r) => r.status === 200,
    'product list has products array': (r) => {
      try {
        const data = JSON.parse(r.body);
        return Array.isArray(data.products);
      } catch {
        return false;
      }
    },
  });

  if (!listSuccess) {
    errorRate.add(1);
  }

  sleep(1);

  // Test product get endpoint (if we have product IDs)
  // Note: This would require setup data
  sleep(1);
}

export function handleSummary(data) {
  return {
    'stdout': JSON.stringify(data, null, 2),
    'load-tests/results/products.json': JSON.stringify(data, null, 2),
  };
}
