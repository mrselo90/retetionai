/**
 * RAG Query Load Test
 * Tests RAG query endpoint under load
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const ragDuration = new Trend('rag_duration');

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 req/s (RAG is slower)
    { duration: '1m', target: 20 },    // Ramp up to 20 req/s
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // RAG queries can take longer
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.01'],
    rag_duration: ['p(95)<2000'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3001';
const JWT_TOKEN = __ENV.JWT_TOKEN || 'test-jwt-token';

const testQueries = [
  'What is the size of this product?',
  'How do I use this product?',
  'What are the ingredients?',
  'Is this product vegan?',
  'What is the return policy?',
];

export default function () {
  // Test RAG query endpoint
  const ragStart = Date.now();
  const randomQuery = testQueries[Math.floor(Math.random() * testQueries.length)];

  const ragResponse = http.post(
    `${BASE_URL}/api/rag/query`,
    JSON.stringify({
      query: randomQuery,
      merchantId: 'test-merchant-id',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${JWT_TOKEN}`,
      },
      tags: { name: 'RAGQuery' },
    }
  );
  ragDuration.add(Date.now() - ragStart);

  const ragSuccess = check(ragResponse, {
    'rag status is 200': (r) => r.status === 200,
    'rag has response': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.response !== undefined;
      } catch {
        return false;
      }
    },
  });

  if (!ragSuccess) {
    errorRate.add(1);
  }

  sleep(2); // RAG queries are slower, wait longer
}

export function handleSummary(data) {
  return {
    'stdout': JSON.stringify(data, null, 2),
    'load-tests/results/rag.json': JSON.stringify(data, null, 2),
  };
}
