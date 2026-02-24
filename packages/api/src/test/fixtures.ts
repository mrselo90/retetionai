/**
 * Test Fixtures
 * Sample data for testing
 */

import { randomUUID } from 'crypto';

// ============================================================================
// Merchant Fixtures
// ============================================================================

export const createTestMerchant = (overrides?: Partial<any>) => ({
  id: randomUUID(),
  name: 'Test Merchant',
  webhook_secret: 'test-webhook-secret',
  persona_settings: {
    bot_name: 'Test Bot',
    tone: 'friendly',
    emoji: '🌟',
    response_length: 'medium',
    temperature: 0.7,
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

// ============================================================================
// Product Fixtures
// ============================================================================

export const createTestProduct = (merchantId: string, overrides?: Partial<any>) => ({
  id: randomUUID(),
  merchant_id: merchantId,
  external_id: 'PROD-123',
  name: 'Test Product',
  url: 'https://example.com/product',
  raw_text: 'This is a test product description with details about the product.',
  vector_id: randomUUID(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

// ============================================================================
// User Fixtures
// ============================================================================

export const createTestUser = (merchantId: string, overrides?: Partial<any>) => ({
  id: randomUUID(),
  merchant_id: merchantId,
  phone: '+905551112233', // Will be encrypted in real usage
  name: 'Test User',
  consent_status: 'opt_in',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

// ============================================================================
// Order Fixtures
// ============================================================================

export const createTestOrder = (merchantId: string, userId: string, overrides?: Partial<any>) => ({
  id: randomUUID(),
  merchant_id: merchantId,
  user_id: userId,
  external_order_id: 'ORD-123',
  status: 'delivered',
  delivery_date: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

// ============================================================================
// Integration Fixtures
// ============================================================================

export const createTestIntegration = (merchantId: string, overrides?: Partial<any>) => ({
  id: randomUUID(),
  merchant_id: merchantId,
  provider: 'shopify',
  status: 'active',
  auth_type: 'oauth',
  auth_data: {
    shop: 'test-shop.myshopify.com',
    access_token: 'test-access-token',
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

// ============================================================================
// Conversation Fixtures
// ============================================================================

export const createTestConversation = (userId: string, orderId: string | null, overrides?: Partial<any>) => ({
  id: randomUUID(),
  user_id: userId,
  order_id: orderId,
  history: [
    {
      role: 'user',
      content: 'Hello',
      timestamp: new Date().toISOString(),
    },
    {
      role: 'assistant',
      content: 'Hi! How can I help you?',
      timestamp: new Date().toISOString(),
    },
  ],
  current_state: 'active',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

// ============================================================================
// Knowledge Chunk Fixtures
// ============================================================================

export const createTestKnowledgeChunk = (productId: string, overrides?: Partial<any>) => ({
  id: randomUUID(),
  product_id: productId,
  chunk_text: 'This is a test knowledge chunk with product information.',
  embedding: new Array(1536).fill(0).map(() => Math.random()),
  chunk_index: 0,
  created_at: new Date().toISOString(),
  ...overrides,
});

// ============================================================================
// Event Fixtures
// ============================================================================

export const createTestShopifyEvent = (overrides?: Partial<any>) => ({
  id: 123456,
  order_number: 1001,
  email: 'customer@example.com',
  phone: '+905551112233',
  financial_status: 'paid',
  fulfillment_status: 'fulfilled',
  line_items: [
    {
      id: 789,
      product_id: 456,
      name: 'Test Product',
      quantity: 1,
      price: '99.99',
    },
  ],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const createTestNormalizedEvent = (merchantId: string, integrationId: string, overrides?: Partial<any>) => ({
  merchant_id: merchantId,
  integration_id: integrationId,
  source: 'shopify',
  event_type: 'order_delivered',
  external_order_id: 'ORD-123',
  occurred_at: new Date().toISOString(),
  customer: {
    phone: '+905551112233',
    name: 'Test Customer',
  },
  order: {
    status: 'delivered',
    delivered_at: new Date().toISOString(),
  },
  items: [
    {
      external_product_id: 'PROD-123',
      name: 'Test Product',
      url: 'https://example.com/product',
    },
  ],
  ...overrides,
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a complete test scenario with merchant, products, users, orders
 */
export function createTestScenario() {
  const merchant = createTestMerchant();
  const product = createTestProduct(merchant.id);
  const user = createTestUser(merchant.id);
  const order = createTestOrder(merchant.id, user.id);
  const integration = createTestIntegration(merchant.id);
  const conversation = createTestConversation(user.id, order.id);
  const knowledgeChunk = createTestKnowledgeChunk(product.id);

  return {
    merchant,
    product,
    user,
    order,
    integration,
    conversation,
    knowledgeChunk,
  };
}
