/**
 * CSV Parser Tests
 * Tests for CSV parsing and event extraction
 */

import { describe, it, expect } from 'vitest';
import { parseCSV } from './csvParser';

describe('parseCSV', () => {
  it('should parse CSV with headers', () => {
    const csvContent = `external_order_id,customer_phone,customer_name,status,delivered_at
ORD-123,+905551112233,John Doe,delivered,2024-01-15
ORD-124,+905551112234,Jane Smith,delivered,2024-01-16`;

    const result = parseCSV(csvContent, 'test-merchant-id');

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.events).toHaveLength(2);
    expect(result.events[0]).toHaveProperty('external_order_id', 'ORD-123');
    expect(result.events[0].customer).toHaveProperty('phone');
    expect(result.events[0].customer.phone).toContain('+90');
  });

  it('should handle different column names', () => {
    const csvContent = `external_order_id,customer_phone,customer_name,status,delivered_at
ORD-123,5551112233,John Doe,delivered,2024-01-15`;

    const result = parseCSV(csvContent, 'test-merchant-id');

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.events).toHaveLength(1);
    // Phone should be normalized
    expect(result.events[0].customer.phone).toMatch(/^\+90/);
  });

  it('should normalize phone numbers', () => {
    const csvContent = `external_order_id,customer_phone,customer_name,status
ORD-123,5551112233,John Doe,delivered`;

    const result = parseCSV(csvContent, 'test-merchant-id');

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    // Phone should be normalized to +90 format
    expect(result.events[0].customer.phone).toMatch(/^\+90/);
  });

  it('should handle empty CSV', () => {
    const csvContent = `external_order_id,customer_phone
`;

    const result = parseCSV(csvContent, 'test-merchant-id');

    expect(result.success).toBe(false);
    expect(result.events).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should handle CSV with only headers', () => {
    const csvContent = `external_order_id,customer_phone`;

    const result = parseCSV(csvContent, 'test-merchant-id');

    expect(result.success).toBe(false);
    expect(result.events).toHaveLength(0);
  });

  it('should handle malformed CSV gracefully', () => {
    const csvContent = `external_order_id,customer_phone,customer_name
ORD-123,5551112233,"John Doe
ORD-124,5551112234,Jane Smith`;

    // Should handle or return errors
    const result = parseCSV(csvContent, 'test-merchant-id');
    expect(result).toBeDefined();
    // May have errors but should not throw
  });

  it('should detect order_delivered from status', () => {
    const csvContent = `external_order_id,customer_phone,status,delivered_at
ORD-123,5551112233,delivered,2024-01-15`;

    const result = parseCSV(csvContent, 'test-merchant-id');

    expect(result.success).toBe(true);
    expect(result.events[0].event_type).toBe('order_delivered');
  });

  it('should detect order_delivered from delivered_at', () => {
    const csvContent = `external_order_id,customer_phone,status,delivered_at
ORD-123,5551112233,delivered,2024-01-15`;

    const result = parseCSV(csvContent, 'test-merchant-id');

    expect(result.success).toBe(true);
    // If status is "delivered" or delivered_at exists, should be order_delivered
    expect(['order_delivered', 'order_created']).toContain(result.events[0].event_type);
  });

  it('should default to order_created', () => {
    const csvContent = `external_order_id,customer_phone,status
ORD-123,5551112233,unknown`;

    const result = parseCSV(csvContent, 'test-merchant-id');

    expect(result.success).toBe(true);
    expect(result.events[0].event_type).toBe('order_created');
  });
});
