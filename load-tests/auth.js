/**
 * Authentication Load Test
 * Tests authentication endpoints under load
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');
const signupDuration = new Trend('signup_duration');

export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Ramp up to 50 users
    { duration: '1m', target: 100 },  // Ramp up to 100 users
    { duration: '30s', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.01'],   // Less than 1% of requests should fail
    errors: ['rate<0.01'],
    login_duration: ['p(95)<300'],
    signup_duration: ['p(95)<1000'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3001';

export default function () {
  // Test login endpoint
  const loginStart = Date.now();
  const loginResponse = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: 'test@example.com',
      password: 'Test123!',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'Login' },
    }
  );
  loginDuration.add(Date.now() - loginStart);

  const loginSuccess = check(loginResponse, {
    'login status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'login has response body': (r) => r.body.length > 0,
  });

  if (!loginSuccess) {
    errorRate.add(1);
  }

  sleep(1);

  // Test signup endpoint (may fail due to duplicate, that's OK)
  const signupStart = Date.now();
  const signupResponse = http.post(
    `${BASE_URL}/api/auth/signup`,
    JSON.stringify({
      email: `test-${Date.now()}@example.com`,
      password: 'Test123!',
      name: 'Load Test Merchant',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'Signup' },
    }
  );
  signupDuration.add(Date.now() - signupStart);

  const signupSuccess = check(signupResponse, {
    'signup status is 201 or 409': (r) => r.status === 201 || r.status === 409,
    'signup has response body': (r) => r.body.length > 0,
  });

  if (!signupSuccess) {
    errorRate.add(1);
  }

  sleep(1);
}

export function handleSummary(data) {
  return {
    'stdout': JSON.stringify(data, null, 2),
    'load-tests/results/auth.json': JSON.stringify(data, null, 2),
  };
}
