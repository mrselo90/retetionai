/**
 * Webhook Load Test
 * Tests webhook ingestion endpoints under load
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import crypto from 'k6/crypto';

// Custom metrics
const errorRate = new Rate('errors');
const webhookDuration = new Trend('webhook_duration');

export const options = {
  stages: [
    { duration: '30s', target: 100 },  // Ramp up to 100 req/s
    { duration: '1m', target: 200 },  // Ramp up to 200 req/s
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.01'],
    webhook_duration: ['p(95)<500'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3001';
const API_KEY = __ENV.API_KEY || 'gg_live_test123456789012345678901234567890';

export default function () {
  // Test generic webhook endpoint
  const webhookStart = Date.now();
  const webhookPayload = {
    event_type: 'order_created',
    order_id: `ORD-${randomString(10)}`,
    customer: {
      phone: `+90555${Math.floor(Math.random() * 10000000)}`,
      name: 'Load Test Customer',
    },
    order: {
      status: 'paid',
      total: Math.random() * 1000,
    },
    occurred_at: new Date().toISOString(),
  };

  const webhookResponse = http.post(
    `${BASE_URL}/webhooks/commerce/event`,
    JSON.stringify(webhookPayload),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': API_KEY,
      },
      tags: { name: 'Webhook' },
    }
  );
  webhookDuration.add(Date.now() - webhookStart);

  const webhookSuccess = check(webhookResponse, {
    'webhook status is 200': (r) => r.status === 200,
    'webhook has response body': (r) => r.body.length > 0,
  });

  if (!webhookSuccess) {
    errorRate.add(1);
  }

  sleep(0.5);
}

export function handleSummary(data) {
  return {
    'stdout': JSON.stringify(data, null, 2),
    'load-tests/results/webhooks.json': JSON.stringify(data, null, 2),
  };
}
