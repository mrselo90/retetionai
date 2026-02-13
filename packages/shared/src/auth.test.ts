/**
 * Auth Module Tests
 * Tests for API key generation, hashing, and validation
 */

import { describe, it, expect } from 'vitest';
import { generateApiKey, hashApiKey, isValidApiKeyFormat } from './auth';

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

  it('should generate keys with correct prefix', () => {
    const key = generateApiKey();
    expect(key.startsWith('gg_live_')).toBe(true);
  });

  it('should generate keys with correct length', () => {
    const key = generateApiKey();
    // Format: gg_live_ + 32 chars = 40 chars total
    expect(key.length).toBe(40);
  });
});

describe('hashApiKey', () => {
  it('should hash API key using SHA-256', () => {
    const key = 'gg_live_test123456789012345678901234567890';
    const hash = hashApiKey(key);
    
    expect(hash).toBeDefined();
    expect(hash).not.toBe(key);
    expect(hash.length).toBe(64); // SHA-256 produces 64 char hex string
  });

  it('should produce same hash for same key', () => {
    const key = 'gg_live_test123456789012345678901234567890';
    const hash1 = hashApiKey(key);
    const hash2 = hashApiKey(key);
    
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different keys', () => {
    const key1 = 'gg_live_test123456789012345678901234567890';
    const key2 = 'gg_live_test987654321098765432109876543210';
    const hash1 = hashApiKey(key1);
    const hash2 = hashApiKey(key2);
    
    expect(hash1).not.toBe(hash2);
  });
});

describe('isValidApiKeyFormat', () => {
  it('should validate correct API key format', () => {
    // Use valid hex characters only (a-f0-9), exactly 32 chars after prefix
    const validKey = 'gg_live_abcdef12345678901234567890ab'; // 8 + 32 = 40 chars
    // But the key needs exactly 32 hex chars, let's use a generated one
    const generatedKey = generateApiKey();
    expect(isValidApiKeyFormat(generatedKey)).toBe(true);
  });

  it('should reject keys with wrong prefix', () => {
    const invalidKey = 'gg_test_abcdef123456789012345678901234';
    expect(isValidApiKeyFormat(invalidKey)).toBe(false);
  });

  it('should reject keys with wrong length', () => {
    const shortKey = 'gg_live_short';
    const longKey = 'gg_live_abcdef123456789012345678901234567890';
    
    expect(isValidApiKeyFormat(shortKey)).toBe(false);
    expect(isValidApiKeyFormat(longKey)).toBe(false);
  });

  it('should reject keys with invalid characters', () => {
    const invalidKey = 'gg_live_abcdef-123456789012345678901234';
    expect(isValidApiKeyFormat(invalidKey)).toBe(false);
  });

  it('should reject empty string', () => {
    expect(isValidApiKeyFormat('')).toBe(false);
  });

  it('should reject null or undefined', () => {
    expect(isValidApiKeyFormat(null as any)).toBe(false);
    expect(isValidApiKeyFormat(undefined as any)).toBe(false);
  });
});
