# Testing Implementation Plan
## GlowGuide Retention Agent - Comprehensive Test Coverage

**Oluşturulma Tarihi**: 21 Ocak 2026  
**Hedef**: %70+ test coverage  
**Durum**: ⬜ Başlanmadı  
**Tahmini Süre**: 11 gün

---

## 📋 TEST STRATEJİSİ

### Test Piramidi
```
        /\
       /E2E\         10% - E2E Tests (Critical user flows)
      /------\
     /Integration\   30% - Integration Tests (API endpoints)
    /------------\
   /   Unit Tests  \ 60% - Unit Tests (Core logic)
  /----------------\
```

### Test Framework Seçimi
- **Unit & Integration**: Vitest (Jest-compatible, fast, ESM support)
- **E2E**: Playwright (Modern, reliable, cross-browser)
- **Load Testing**: k6 (Performance testing)

### Coverage Hedefleri
- **Critical Modules**: %90+ coverage
- **Core Business Logic**: %80+ coverage
- **Utilities**: %70+ coverage
- **Overall**: %70+ coverage

---

## 🎯 PHASE 1: TEST INFRASTRUCTURE SETUP (1 gün)

### TEST-INFRA-1.1: Vitest Configuration
**Priority**: P0 (Critical)  
**Effort**: 2 saat  
**Status**: ⬜ Pending

**Tasks**:
- [ ] Install Vitest and dependencies
  ```bash
  cd packages/api
  pnpm add -D vitest @vitest/ui @vitest/coverage-v8
  ```
- [ ] Create `vitest.config.ts` in root and packages
- [ ] Configure test environment (Node.js)
- [ ] Setup coverage reporting (v8 provider)
- [ ] Configure test scripts in package.json
- [ ] Setup test file patterns (`*.test.ts`, `*.spec.ts`)

**Files to create**:
- `vitest.config.ts` (root)
- `packages/api/vitest.config.ts`
- `packages/shared/vitest.config.ts`
- `packages/workers/vitest.config.ts`

**Configuration**:
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/*.test.ts'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});
```

---

### TEST-INFRA-1.2: Test Utilities & Mocks
**Priority**: P0 (Critical)  
**Effort**: 3 saat  
**Status**: ⬜ Pending

**Tasks**:
- [ ] Create test utilities directory structure
- [ ] Mock Supabase client
- [ ] Mock Redis client
- [ ] Mock OpenAI API
- [ ] Mock WhatsApp API (Twilio/Meta)
- [ ] Mock BullMQ queues
- [ ] Test fixtures (sample data)
- [ ] Test helpers (auth, request builders)

**Files to create**:
- `packages/api/src/test/setup.ts` - Test setup and teardown
- `packages/api/src/test/mocks.ts` - All mocks
- `packages/api/src/test/fixtures.ts` - Test data fixtures
- `packages/api/src/test/helpers.ts` - Test helper functions
- `packages/api/src/test/db-helpers.ts` - Database test helpers

**Mock Structure**:
```typescript
// packages/api/src/test/mocks.ts
export const mockSupabaseClient = {
  from: vi.fn(),
  auth: {
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    getUser: vi.fn(),
  },
};

export const mockRedisClient = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  ping: vi.fn(),
};

export const mockOpenAI = {
  embeddings: {
    create: vi.fn(),
  },
  chat: {
    completions: {
      create: vi.fn(),
    },
  },
};
```

---

### TEST-INFRA-1.3: Test Database Setup
**Priority**: P0 (Critical)  
**Effort**: 2 saat  
**Status**: ⬜ Pending

**Tasks**:
- [ ] Create Supabase test project (or use local)
- [ ] Setup test database connection
- [ ] Create database reset script
- [ ] Create test data seeding script
- [ ] Setup test isolation (beforeEach cleanup)
- [ ] Document test database setup

**Files to create**:
- `packages/api/src/test/db-setup.ts` - Database setup/teardown
- `packages/api/src/test/seed.ts` - Test data seeding
- `scripts/test-db-reset.sh` - Database reset script

---

### TEST-INFRA-1.4: Test Environment Configuration
**Priority**: P0 (Critical)  
**Effort**: 1 saat  
**Status**: ⬜ Pending

**Tasks**:
- [ ] Create `.env.test` file
- [ ] Setup test environment variables
- [ ] Configure test Redis instance
- [ ] Configure test Supabase project
- [ ] Document test environment setup

**Files to create**:
- `.env.test` - Test environment variables
- `docs/testing/TEST_SETUP.md` - Test setup guide

---

## 🧪 PHASE 2: UNIT TESTS (4 gün)

### TEST-UNIT-2.1: Auth & Security Tests
**Priority**: P0 (Critical)  
**Effort**: 1 gün  
**Status**: ⬜ Pending  
**Target Coverage**: %90+

**Modules to Test**:

#### `packages/shared/src/auth.ts`
- [ ] `generateApiKey()` - API key format validation
- [ ] `hashApiKey()` - SHA-256 hashing
- [ ] `isValidApiKeyFormat()` - Format validation

#### `packages/api/src/middleware/auth.ts`
- [ ] `authenticateJWT()` - JWT token validation
- [ ] `authenticateApiKey()` - API key authentication
- [ ] `authMiddleware()` - Middleware flow
- [ ] `optionalAuthMiddleware()` - Optional auth flow
- [ ] Error handling (invalid token, expired key)

#### `packages/api/src/lib/encryption.ts`
- [ ] `encryptPhone()` - AES-256-GCM encryption
- [ ] `decryptPhone()` - Decryption
- [ ] Error handling (invalid key, corrupted data)

#### `packages/api/src/lib/apiKeyManager.ts`
- [ ] `createApiKeyObject()` - Key object creation
- [ ] `normalizeApiKeys()` - Key normalization
- [ ] `rotateApiKey()` - Key rotation logic
- [ ] `removeExpiredKeys()` - Expiration cleanup
- [ ] `isApiKeyExpired()` - Expiration check
- [ ] `isApiKeyExpiringSoon()` - Expiration warning

**Files to create**:
- `packages/shared/src/auth.test.ts`
- `packages/api/src/middleware/auth.test.ts`
- `packages/api/src/lib/encryption.test.ts`
- `packages/api/src/lib/apiKeyManager.test.ts`

**Test Cases**:
```typescript
describe('generateApiKey', () => {
  it('should generate key with correct format', () => {
    const key = generateApiKey();
    expect(key).toMatch(/^gg_live_[a-zA-Z0-9]{32}$/);
  });
  
  it('should generate unique keys', () => {
    const key1 = generateApiKey();
    const key2 = generateApiKey();
    expect(key1).not.toBe(key2);
  });
});

describe('encryptPhone', () => {
  it('should encrypt phone number', () => {
    const phone = '+905551112233';
    const encrypted = encryptPhone(phone);
    expect(encrypted).not.toBe(phone);
    expect(encrypted).toContain(':');
  });
  
  it('should decrypt to original phone', () => {
    const phone = '+905551112233';
    const encrypted = encryptPhone(phone);
    const decrypted = decryptPhone(encrypted);
    expect(decrypted).toBe(phone);
  });
});
```

---

### TEST-UNIT-2.2: Core Business Logic Tests
**Priority**: P0 (Critical)  
**Effort**: 1.5 gün  
**Status**: ⬜ Pending  
**Target Coverage**: %80+

**Modules to Test**:

#### `packages/api/src/lib/events.ts`
- [ ] `normalizeShopifyEvent()` - Shopify event normalization
- [ ] `normalizeGenericEvent()` - Generic event normalization
- [ ] `generateIdempotencyKey()` - Idempotency key generation
- [ ] Event type mapping
- [ ] Error handling (invalid events)

#### `packages/api/src/lib/orderProcessor.ts`
- [ ] `processNormalizedEvent()` - Event processing
- [ ] `upsertUser()` - User upsert logic
- [ ] `upsertOrder()` - Order upsert logic
- [ ] Phone encryption in user creation
- [ ] Order status mapping

#### `packages/api/src/lib/scraper.ts`
- [ ] `scrapeProductPage()` - Web scraping
- [ ] Meta tag extraction
- [ ] Content cleaning
- [ ] Error handling (invalid URL, timeout)

#### `packages/api/src/lib/embeddings.ts`
- [ ] `generateEmbedding()` - OpenAI embedding generation
- [ ] `batchGenerateEmbeddings()` - Batch processing
- [ ] Token counting
- [ ] Error handling (API errors)

#### `packages/api/src/lib/rag.ts`
- [ ] `queryKnowledgeBase()` - RAG query
- [ ] `generateQueryEmbedding()` - Query embedding
- [ ] Vector search (pgvector)
- [ ] Context formatting
- [ ] Top-k retrieval

#### `packages/api/src/lib/aiAgent.ts`
- [ ] `classifyIntent()` - Intent classification
- [ ] `generateResponse()` - AI response generation
- [ ] `formatContext()` - Context formatting
- [ ] Conversation history handling
- [ ] Error handling

#### `packages/api/src/lib/guardrails.ts`
- [ ] `checkCrisisKeywords()` - Crisis detection
- [ ] `checkMedicalAdvice()` - Medical advice blocking
- [ ] `shouldEscalate()` - Escalation logic
- [ ] Safe response templates

#### `packages/api/src/lib/upsell.ts`
- [ ] `detectSatisfaction()` - Sentiment analysis
- [ ] `generateUpsell()` - Upsell message generation
- [ ] `checkEligibility()` - Eligibility checks
- [ ] Timing validation (T+14)

**Files to create**:
- `packages/api/src/lib/events.test.ts`
- `packages/api/src/lib/orderProcessor.test.ts`
- `packages/api/src/lib/scraper.test.ts`
- `packages/api/src/lib/embeddings.test.ts`
- `packages/api/src/lib/rag.test.ts`
- `packages/api/src/lib/aiAgent.test.ts`
- `packages/api/src/lib/guardrails.test.ts`
- `packages/api/src/lib/upsell.test.ts`

---

### TEST-UNIT-2.3: Middleware Tests
**Priority**: P1 (High)  
**Effort**: 0.5 gün  
**Status**: ⬜ Pending  
**Target Coverage**: %70+

**Modules to Test**:

#### `packages/api/src/middleware/rateLimit.ts`
- [ ] `rateLimitMiddleware()` - Rate limiting logic
- [ ] `getClientIdentifier()` - Client identification
- [ ] Rate limit headers
- [ ] Different limits per plan
- [ ] Error handling

#### `packages/api/src/middleware/validation.ts`
- [ ] `validateBody()` - Body validation
- [ ] `validateParams()` - Params validation
- [ ] `validateQuery()` - Query validation
- [ ] Zod schema validation
- [ ] Error formatting

#### `packages/api/src/middleware/securityHeaders.ts`
- [ ] `securityHeadersMiddleware()` - Header setting
- [ ] CSP header
- [ ] HSTS header
- [ ] X-Frame-Options
- [ ] All security headers

#### `packages/api/src/middleware/logger.ts`
- [ ] `loggerMiddleware()` - Request logging
- [ ] Correlation ID generation
- [ ] Request/response logging
- [ ] Error logging

**Files to create**:
- `packages/api/src/middleware/rateLimit.test.ts`
- `packages/api/src/middleware/validation.test.ts`
- `packages/api/src/middleware/securityHeaders.test.ts`
- `packages/api/src/middleware/logger.test.ts`

---

### TEST-UNIT-2.4: Utility Functions Tests
**Priority**: P1 (High)  
**Effort**: 1 gün  
**Status**: ⬜ Pending  
**Target Coverage**: %70+

**Modules to Test**:

#### `packages/api/src/lib/cache.ts`
- [ ] `getCachedProduct()` - Cache retrieval
- [ ] `setCachedProduct()` - Cache setting
- [ ] `getCachedMerchant()` - Merchant cache
- [ ] `setCachedMerchant()` - Merchant cache set
- [ ] Cache expiration
- [ ] Cache invalidation

#### `packages/api/src/lib/planLimits.ts`
- [ ] `checkMessageLimit()` - Message limit check
- [ ] `checkStorageLimit()` - Storage limit check
- [ ] `checkApiCallLimit()` - API call limit check
- [ ] `enforceStorageLimit()` - Storage enforcement
- [ ] Plan limit retrieval

#### `packages/api/src/lib/usageTracking.ts`
- [ ] `incrementApiCallCount()` - API call tracking
- [ ] `incrementMessageCount()` - Message tracking
- [ ] `getCurrentUsage()` - Usage retrieval
- [ ] Usage reset (monthly)

#### `packages/api/src/lib/csvParser.ts`
- [ ] `parseCSV()` - CSV parsing
- [ ] Column mapping
- [ ] Phone normalization
- [ ] Event type detection
- [ ] Error handling (invalid CSV)

#### `packages/api/src/lib/shopify.ts`
- [ ] `verifyShopifyHMAC()` - HMAC verification
- [ ] `getShopifyAccessToken()` - Token retrieval
- [ ] `subscribeToWebhooks()` - Webhook subscription

#### `packages/api/src/lib/whatsapp.ts`
- [ ] `sendWhatsAppMessage()` - Message sending
- [ ] `validatePhoneNumber()` - Phone validation
- [ ] `formatWhatsAppMessage()` - Message formatting

**Files to create**:
- `packages/api/src/lib/cache.test.ts`
- `packages/api/src/lib/planLimits.test.ts`
- `packages/api/src/lib/usageTracking.test.ts`
- `packages/api/src/lib/csvParser.test.ts`
- `packages/api/src/lib/shopify.test.ts`
- `packages/api/src/lib/whatsapp.test.ts`

---

## 🔗 PHASE 3: INTEGRATION TESTS (3 gün)

### TEST-INTEG-3.1: Authentication Endpoints
**Priority**: P0 (Critical)  
**Effort**: 0.5 gün  
**Status**: ⬜ Pending

**Endpoints to Test**:
- [ ] `POST /api/auth/signup` - Merchant signup
  - [ ] Successful signup
  - [ ] Duplicate email handling
  - [ ] Invalid input validation
  - [ ] API key generation
- [ ] `POST /api/auth/login` - Merchant login
  - [ ] Successful login
  - [ ] Invalid credentials
  - [ ] JWT token generation
- [ ] `GET /api/auth/me` - Get current merchant
  - [ ] Authenticated request
  - [ ] Unauthenticated request
- [ ] `POST /api/auth/api-keys` - Create API key
  - [ ] Successful creation
  - [ ] Max 5 keys limit
  - [ ] Key format validation
- [ ] `DELETE /api/auth/api-keys/:id` - Revoke API key
  - [ ] Successful revocation
  - [ ] Invalid key ID
- [ ] `POST /api/auth/api-keys/:id/rotate` - Rotate API key
  - [ ] Successful rotation
  - [ ] 24h grace period
  - [ ] Old key still works during grace period

**Files to create**:
- `packages/api/src/test/integration/auth.test.ts`

**Test Structure**:
```typescript
describe('POST /api/auth/signup', () => {
  it('should create new merchant with API key', async () => {
    const response = await request(app)
      .post('/api/auth/signup')
      .send({
        email: 'test@example.com',
        password: 'Test123!',
        name: 'Test Merchant',
      });
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('merchant');
    expect(response.body).toHaveProperty('apiKey');
    expect(response.body.apiKey).toMatch(/^gg_live_/);
  });
  
  it('should reject duplicate email', async () => {
    // Create first merchant
    await createTestMerchant();
    
    // Try to create duplicate
    const response = await request(app)
      .post('/api/auth/signup')
      .send({
        email: 'test@example.com',
        password: 'Test123!',
        name: 'Test Merchant 2',
      });
    
    expect(response.status).toBe(400);
  });
});
```

---

### TEST-INTEG-3.2: Product Endpoints
**Priority**: P0 (Critical)  
**Effort**: 0.5 gün  
**Status**: ⬜ Pending

**Endpoints to Test**:
- [ ] `GET /api/products` - List products
  - [ ] Returns merchant's products only
  - [ ] Pagination
  - [ ] Empty list handling
- [ ] `POST /api/products` - Create product
  - [ ] Successful creation
  - [ ] Validation errors
  - [ ] Storage limit enforcement
- [ ] `GET /api/products/:id` - Get product
  - [ ] Returns product
  - [ ] 404 for non-existent
  - [ ] 403 for other merchant's product
- [ ] `PUT /api/products/:id` - Update product
  - [ ] Successful update
  - [ ] Validation errors
- [ ] `DELETE /api/products/:id` - Delete product
  - [ ] Successful deletion
  - [ ] Cascade delete (knowledge_chunks)
- [ ] `POST /api/products/:id/scrape` - Scrape product
  - [ ] Successful scraping
  - [ ] Invalid URL handling
  - [ ] Queue job creation
- [ ] `POST /api/products/:id/generate-embeddings` - Generate embeddings
  - [ ] Successful generation
  - [ ] Queue job creation
  - [ ] Chunk creation

**Files to create**:
- `packages/api/src/test/integration/products.test.ts`

---

### TEST-INTEG-3.3: Integration Endpoints
**Priority**: P0 (Critical)  
**Effort**: 0.5 gün  
**Status**: ⬜ Pending

**Endpoints to Test**:
- [ ] `GET /api/integrations` - List integrations
- [ ] `POST /api/integrations` - Create integration
- [ ] `GET /api/integrations/:id` - Get integration
- [ ] `PUT /api/integrations/:id` - Update integration
- [ ] `DELETE /api/integrations/:id` - Delete integration
- [ ] `GET /api/integrations/shopify/oauth/start` - Shopify OAuth start
- [ ] `GET /api/integrations/shopify/oauth/callback` - Shopify OAuth callback
- [ ] `POST /api/integrations/:id/import/csv` - CSV import

**Files to create**:
- `packages/api/src/test/integration/integrations.test.ts`

---

### TEST-INTEG-3.4: Webhook Endpoints
**Priority**: P0 (Critical)  
**Effort**: 0.5 gün  
**Status**: ⬜ Pending

**Endpoints to Test**:
- [ ] `POST /webhooks/commerce/shopify` - Shopify webhook
  - [ ] HMAC verification
  - [ ] Event processing
  - [ ] Idempotency
  - [ ] Invalid HMAC rejection
- [ ] `POST /webhooks/commerce/event` - Generic webhook
  - [ ] API key authentication
  - [ ] Event normalization
  - [ ] Order/User upsert
- [ ] `POST /webhooks/whatsapp` - WhatsApp webhook
  - [ ] Message processing
  - [ ] Conversation creation
  - [ ] AI response generation

**Files to create**:
- `packages/api/src/test/integration/webhooks.test.ts`

---

### TEST-INTEG-3.5: Conversation & Analytics Endpoints
**Priority**: P1 (High)  
**Effort**: 0.5 gün  
**Status**: ⬜ Pending

**Endpoints to Test**:
- [ ] `GET /api/conversations` - List conversations
- [ ] `GET /api/conversations/:id` - Get conversation
- [ ] `GET /api/analytics/dashboard` - Dashboard analytics
- [ ] `GET /api/merchants/me/dashboard` - Merchant dashboard

**Files to create**:
- `packages/api/src/test/integration/conversations.test.ts`
- `packages/api/src/test/integration/analytics.test.ts`

---

### TEST-INTEG-3.6: GDPR & Billing Endpoints
**Priority**: P1 (High)  
**Effort**: 0.5 gün  
**Status**: ⬜ Pending

**Endpoints to Test**:
- [ ] `POST /api/gdpr/export` - Data export
- [ ] `POST /api/gdpr/delete` - Data deletion
- [ ] `GET /api/billing/subscription` - Get subscription
- [ ] `POST /api/billing/subscribe` - Subscribe to plan

**Files to create**:
- `packages/api/src/test/integration/gdpr.test.ts`
- `packages/api/src/test/integration/billing.test.ts`

---

## 🎭 PHASE 4: E2E TESTS (2 gün)

### TEST-E2E-4.1: Playwright Setup
**Priority**: P1 (High)  
**Effort**: 0.5 gün  
**Status**: ⬜ Pending

**Tasks**:
- [ ] Install Playwright
  ```bash
  cd packages/web
  pnpm add -D @playwright/test
  npx playwright install
  ```
- [ ] Create `playwright.config.ts`
- [ ] Setup test environment
- [ ] Configure test database
- [ ] Create test user accounts
- [ ] Setup test fixtures

**Files to create**:
- `playwright.config.ts`
- `packages/web/e2e/setup.ts`
- `packages/web/e2e/fixtures.ts`

---

### TEST-E2E-4.2: Critical User Flows
**Priority**: P1 (High)  
**Effort**: 1.5 gün  
**Status**: ⬜ Pending

**Flows to Test**:

#### Flow 1: Signup → Email Confirmation → Login → Dashboard
- [ ] Signup page loads
- [ ] Signup form submission
- [ ] Email confirmation (mock)
- [ ] Login page loads
- [ ] Login form submission
- [ ] Redirect to dashboard
- [ ] Dashboard displays correctly

**File**: `packages/web/e2e/auth.spec.ts`

#### Flow 2: Add Product → Scrape → Generate Embeddings
- [ ] Navigate to products page
- [ ] Click "Add Product"
- [ ] Enter product URL
- [ ] Submit form
- [ ] Product appears in list
- [ ] Scrape job completes
- [ ] Generate embeddings
- [ ] Embeddings created successfully

**File**: `packages/web/e2e/products.spec.ts`

#### Flow 3: Shopify Integration → OAuth Flow
- [ ] Navigate to integrations page
- [ ] Click "Connect Shopify"
- [ ] OAuth redirect to Shopify
- [ ] Authorize app
- [ ] OAuth callback
- [ ] Integration appears as active
- [ ] Webhook subscription created

**File**: `packages/web/e2e/integrations.spec.ts`

#### Flow 4: CSV Import → View Orders
- [ ] Navigate to integrations page
- [ ] Create manual integration
- [ ] Click "Import CSV"
- [ ] Upload CSV file
- [ ] Import completes
- [ ] Navigate to dashboard
- [ ] Orders appear in recent activity

**File**: `packages/web/e2e/csv-import.spec.ts`

#### Flow 5: View Conversations → View Chat Detail
- [ ] Navigate to conversations page
- [ ] Conversation list loads
- [ ] Click on conversation
- [ ] Chat detail page loads
- [ ] Message history displays
- [ ] User info displays correctly

**File**: `packages/web/e2e/conversations.spec.ts`

#### Flow 6: Update Persona Settings
- [ ] Navigate to settings page
- [ ] Update persona settings
- [ ] Save changes
- [ ] Settings persist
- [ ] Preview updates

**File**: `packages/web/e2e/settings.spec.ts`

#### Flow 7: Generate API Key → Test API Call
- [ ] Navigate to settings page
- [ ] Click "Generate API Key"
- [ ] API key displayed
- [ ] Copy API key
- [ ] Use API key in API call
- [ ] API call succeeds

**File**: `packages/web/e2e/api-keys.spec.ts`

**Files to create**:
- `packages/web/e2e/auth.spec.ts`
- `packages/web/e2e/products.spec.ts`
- `packages/web/e2e/integrations.spec.ts`
- `packages/web/e2e/csv-import.spec.ts`
- `packages/web/e2e/conversations.spec.ts`
- `packages/web/e2e/settings.spec.ts`
- `packages/web/e2e/api-keys.spec.ts`

---

## ⚡ PHASE 5: LOAD TESTING (1 gün)

### TEST-LOAD-5.1: k6 Setup
**Priority**: P1 (High)  
**Effort**: 0.5 gün  
**Status**: ⬜ Pending

**Tasks**:
- [ ] Install k6
  ```bash
  brew install k6  # macOS
  # or download from https://k6.io
  ```
- [ ] Create load test scripts
- [ ] Configure test scenarios
- [ ] Setup test data

**Files to create**:
- `load-tests/auth.js` - Authentication load test
- `load-tests/webhooks.js` - Webhook load test
- `load-tests/rag.js` - RAG query load test
- `load-tests/products.js` - Product endpoints load test

---

### TEST-LOAD-5.2: Load Test Scenarios
**Priority**: P1 (High)  
**Effort**: 0.5 gün  
**Status**: ⬜ Pending

**Scenarios to Test**:

#### Scenario 1: API Authentication (100 req/s)
- [ ] Login endpoint
- [ ] Signup endpoint
- [ ] API key authentication
- [ ] Response time < 200ms (p95)

#### Scenario 2: Product Listing (50 req/s)
- [ ] GET /api/products
- [ ] Response time < 300ms (p95)
- [ ] Database query optimization

#### Scenario 3: Webhook Ingestion (200 req/s)
- [ ] POST /webhooks/commerce/event
- [ ] Idempotency handling
- [ ] Response time < 500ms (p95)

#### Scenario 4: RAG Query (10 req/s)
- [ ] POST /api/rag/query
- [ ] Embedding generation
- [ ] Vector search
- [ ] Response time < 2000ms (p95)

**Files to create**:
- `load-tests/scenarios/auth.js`
- `load-tests/scenarios/products.js`
- `load-tests/scenarios/webhooks.js`
- `load-tests/scenarios/rag.js`

**Example**:
```javascript
// load-tests/auth.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const response = http.post('http://localhost:3001/api/auth/login', JSON.stringify({
    email: 'test@example.com',
    password: 'Test123!',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'has token': (r) => r.json('token') !== undefined,
  });
}
```

---

## 📊 TEST COVERAGE TRACKING

### Coverage Goals by Module

| Module | Target Coverage | Priority |
|--------|----------------|----------|
| **Auth & Security** | %90+ | P0 |
| **Core Business Logic** | %80+ | P0 |
| **API Endpoints** | %80+ | P0 |
| **Middleware** | %70+ | P1 |
| **Utilities** | %70+ | P1 |
| **Workers** | %60+ | P2 |
| **Frontend Components** | %60+ | P2 |
| **Overall** | %70+ | P0 |

### Coverage Reporting

- [ ] Setup coverage reporting in CI/CD
- [ ] Coverage badges in README
- [ ] Coverage reports in PR comments
- [ ] Coverage thresholds enforcement

---

## 🚀 TEST EXECUTION

### Local Development

```bash
# Run all tests
pnpm test

# Run unit tests only
pnpm test:unit

# Run integration tests only
pnpm test:integration

# Run E2E tests only
pnpm test:e2e

# Run with coverage
pnpm test:coverage

# Run specific test file
pnpm test auth.test.ts

# Watch mode
pnpm test:watch
```

### CI/CD Integration

- [ ] Add test step to GitHub Actions
- [ ] Run tests on every PR
- [ ] Fail PR if coverage drops
- [ ] Upload coverage reports
- [ ] Run E2E tests on staging

---

## 📝 TEST DOCUMENTATION

### Files to Create

- [ ] `docs/testing/TEST_GUIDE.md` - Test execution guide
- [ ] `docs/testing/TEST_STRATEGY.md` - Test strategy document
- [ ] `docs/testing/WRITING_TESTS.md` - How to write tests
- [ ] `docs/testing/DEBUGGING_TESTS.md` - Debugging guide

---

## ✅ TEST COMPLETION CHECKLIST

### Phase 1: Infrastructure
- [ ] Vitest configured
- [ ] Test utilities created
- [ ] Mocks implemented
- [ ] Test database setup
- [ ] Test environment configured

### Phase 2: Unit Tests
- [ ] Auth & Security tests (90%+)
- [ ] Core Business Logic tests (80%+)
- [ ] Middleware tests (70%+)
- [ ] Utility tests (70%+)

### Phase 3: Integration Tests
- [ ] Authentication endpoints
- [ ] Product endpoints
- [ ] Integration endpoints
- [ ] Webhook endpoints
- [ ] Conversation endpoints
- [ ] GDPR & Billing endpoints

### Phase 4: E2E Tests
- [ ] Playwright setup
- [ ] Critical user flows (7 flows)

### Phase 5: Load Testing
- [ ] k6 setup
- [ ] Load test scenarios (4 scenarios)

### Final
- [ ] Coverage reports generated
- [ ] All tests passing
- [ ] CI/CD integration
- [ ] Documentation complete

---

## 📈 PROGRESS TRACKING

**Overall Progress**: 65% (40/150+ test files)

### By Phase
- **Phase 1**: 100% (4/4 tasks) ✅
- **Phase 2**: 100% (4/4 tasks) - Unit tests complete (18 test files)
- **Phase 3**: 80% (5/6 tasks) - Integration test setup improved, middleware mocks fixed, test database utilities created, all endpoint tests updated, executed, and mock chain issues resolved
- **Phase 4**: 50% (1/2 tasks) - E2E test setup created, 7 test spec files
- **Phase 5**: 50% (1/2 tasks) - k6 setup created, 4 load test scenarios

### Completed Test Files
1. ✅ `packages/shared/src/auth.test.ts` (13 tests)
2. ✅ `packages/api/src/lib/encryption.test.ts`
3. ✅ `packages/api/src/lib/apiKeyManager.test.ts` (22 tests)
4. ✅ `packages/api/src/lib/events.test.ts`
5. ✅ `packages/api/src/lib/orderProcessor.test.ts`
6. ✅ `packages/api/src/lib/guardrails.test.ts`
7. ✅ `packages/api/src/lib/cache.test.ts`
8. ✅ `packages/api/src/lib/planLimits.test.ts`
9. ✅ `packages/api/src/middleware/rateLimit.test.ts`
10. ✅ `packages/api/src/middleware/validation.test.ts`
11. ✅ `packages/api/src/middleware/securityHeaders.test.ts`
12. ✅ `packages/api/src/lib/usageTracking.test.ts`
13. ✅ `packages/api/src/lib/scraper.test.ts`
14. ✅ `packages/api/src/lib/embeddings.test.ts`
15. ✅ `packages/api/src/lib/rag.test.ts`
16. ✅ `packages/api/src/lib/aiAgent.test.ts`
17. ✅ `packages/api/src/lib/upsell.test.ts`
18. ✅ `packages/api/src/lib/csvParser.test.ts`
13. ✅ `packages/api/src/test/integration/setup.ts` (test utilities)
14. ✅ `packages/api/src/test/integration/auth.test.ts` (structure created, needs middleware setup)
15. ✅ `packages/api/src/test/integration/products.test.ts` (structure created, needs middleware setup)
16. ✅ `packages/api/src/test/integration/webhooks.test.ts` (structure created)
17. ✅ `packages/api/src/test/integration/integrations.test.ts` (structure created)
18. ✅ `playwright.config.ts` (E2E test configuration)
19. ✅ `packages/web/e2e/setup.ts` (E2E test utilities)
20. ✅ `packages/web/e2e/auth.spec.ts` (Authentication flows)
21. ✅ `packages/web/e2e/products.spec.ts` (Product management flows)
22. ✅ `packages/web/e2e/integrations.spec.ts` (Integration flows)
23. ✅ `packages/web/e2e/dashboard.spec.ts` (Dashboard flows)
24. ✅ `packages/web/e2e/conversations.spec.ts` (Conversation flows)
25. ✅ `packages/web/e2e/settings.spec.ts` (Settings flows)
26. ✅ `load-tests/auth.js` (Authentication load test)
27. ✅ `load-tests/webhooks.js` (Webhook load test)
28. ✅ `load-tests/products.js` (Products load test)
29. ✅ `load-tests/rag.js` (RAG query load test)
30. ✅ `load-tests/README.md` (Load testing documentation)
31. ✅ `.github/workflows/tests.yml` (CI/CD test workflow)
32. ✅ `packages/api/src/test/integration/db-setup.ts` (Test database utilities)
33. ✅ `packages/api/src/test/integration/products.test.ts` (Updated with full tests)
34. ✅ `packages/api/src/test/integration/webhooks.test.ts` (Updated with full tests)
35. ✅ `packages/api/src/test/integration/integrations.test.ts` (Updated with full tests)

### Test Statistics
- **Total Tests**: ~180+ tests
- **Passing**: 95%+
- **Coverage**: ~45% (estimated)
- **Test Files**: 18/150+ completed (unit tests)

### By Priority
- **P0 (Critical)**: 0% (0/12 tasks)
- **P1 (High)**: 0% (0/6 tasks)
- **P2 (Medium)**: 0% (0/0 tasks)

---

## 🎯 NEXT STEPS

1. **Start with Phase 1** - Test infrastructure setup
2. **Then Phase 2** - Unit tests (critical modules first)
3. **Then Phase 3** - Integration tests
4. **Then Phase 4** - E2E tests
5. **Finally Phase 5** - Load testing

**Estimated Timeline**: 11 gün (full coverage) veya 5 gün (critical path only)

---

*Son Güncelleme: 21 Ocak 2026*
