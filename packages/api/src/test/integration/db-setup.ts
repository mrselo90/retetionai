/**
 * Test Database Setup
 * Utilities for setting up and managing test database state
 */

import { createTestMerchant, createTestUser, createTestProduct, createTestOrder, createTestIntegration } from '../fixtures';

/**
 * Test database state manager
 */
export class TestDatabase {
  private merchants: any[] = [];
  private users: any[] = [];
  private products: any[] = [];
  private orders: any[] = [];
  private conversations: any[] = [];
  private messages: any[] = [];
  private apiKeys: any[] = [];

  /**
   * Create a test merchant
   */
  async createMerchant(overrides?: any) {
    const merchant = createTestMerchant(overrides);
    this.merchants.push(merchant);
    
    return merchant;
  }

  /**
   * Create a test user
   */
  async createUser(merchantId: string, overrides?: any) {
    const user = createTestUser(merchantId, overrides);
    this.users.push(user);
    
    return user;
  }

  /**
   * Create a test product
   */
  async createProduct(merchantId: string, overrides?: any) {
    const product = createTestProduct(merchantId, overrides);
    this.products.push(product);
    
    return product;
  }

  /**
   * Create a test order
   */
  async createOrder(merchantId: string, userId: string, overrides?: any) {
    const order = createTestOrder(merchantId, userId, overrides);
    this.orders.push(order);
    
    return order;
  }

  /**
   * Create a test integration
   */
  async createIntegration(merchantId: string, overrides?: any) {
    const integration = createTestIntegration(merchantId, overrides);
    // Store in a property if needed
    // For now, just return it
    
    return integration;
  }

  /**
   * Get merchant by ID
   */
  getMerchant(id: string) {
    return this.merchants.find(m => m.id === id);
  }

  /**
   * Get user by ID
   */
  getUser(id: string) {
    return this.users.find(u => u.id === id);
  }

  /**
   * Get product by ID
   */
  getProduct(id: string) {
    return this.products.find(p => p.id === id);
  }

  /**
   * Get order by ID
   */
  getOrder(id: string) {
    return this.orders.find(o => o.id === id);
  }

  /**
   * Clear all test data
   */
  clear() {
    this.merchants = [];
    this.users = [];
    this.products = [];
    this.orders = [];
    this.conversations = [];
    this.messages = [];
    this.apiKeys = [];
  }

}

/**
 * Create a test database instance
 */
export function createTestDatabase() {
  return new TestDatabase();
}
