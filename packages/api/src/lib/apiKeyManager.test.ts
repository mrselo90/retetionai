/**
 * API Key Manager Tests
 * Tests for API key management functions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createApiKeyObject,
  normalizeApiKeys,
  rotateApiKey,
  removeExpiredKeys,
  getApiKeyByHash,
  isApiKeyExpired,
  isApiKeyExpiringSoon,
} from './apiKeyManager';
import { generateApiKey, hashApiKey } from '@glowguide/shared';

describe('createApiKeyObject', () => {
  it('should create API key object with correct structure', () => {
    const name = 'Test API Key';
    const expiresInDays = 90;

    const { apiKey, keyObject } = createApiKeyObject(name, expiresInDays);

    expect(apiKey).toBeDefined();
    expect(apiKey).toMatch(/^gg_live_/);
    expect(keyObject).toHaveProperty('hash');
    expect(keyObject).toHaveProperty('name', name);
    expect(keyObject).toHaveProperty('created_at');
    expect(keyObject).toHaveProperty('expires_at');
    expect(keyObject.hash).toBe(hashApiKey(apiKey));
  });

  it('should set expiration date correctly', () => {
    const expiresInDays = 30;

    const { keyObject } = createApiKeyObject('Test Key', expiresInDays);
    const expiresAt = new Date(keyObject.expires_at!);
    const now = new Date();
    const expectedExpiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);

    // Allow 1 second difference for test execution time
    const diff = Math.abs(expiresAt.getTime() - expectedExpiresAt.getTime());
    expect(diff).toBeLessThan(1000);
  });

  it('should handle optional name', () => {
    const { keyObject } = createApiKeyObject(undefined, 90);

    expect(keyObject.name).toBeUndefined();
  });
});

describe('normalizeApiKeys', () => {
  it('should normalize legacy string array format', () => {
    const legacyKeys = [
      hashApiKey('gg_live_test123456789012345678901234567890'),
      hashApiKey('gg_live_test987654321098765432109876543210'),
    ];

    const normalized = normalizeApiKeys(legacyKeys);

    expect(normalized).toHaveLength(2);
    expect(normalized[0]).toHaveProperty('hash');
    expect(normalized[0]).toHaveProperty('created_at');
    expect(normalized[1]).toHaveProperty('hash');
  });

  it('should normalize object array format', () => {
    const objectKeys = [
      createApiKeyObject('Key 1', 90).keyObject,
      createApiKeyObject('Key 2', 90).keyObject,
    ];

    const normalized = normalizeApiKeys(objectKeys);

    expect(normalized).toHaveLength(2);
    expect(normalized[0]).toHaveProperty('hash');
    expect(normalized[0]).toHaveProperty('name', 'Key 1');
    expect(normalized[1]).toHaveProperty('name', 'Key 2');
  });

  it('should handle empty array', () => {
    const normalized = normalizeApiKeys([]);
    expect(normalized).toHaveLength(0);
  });

  it('should handle mixed format (legacy + object)', () => {
    const legacyHash = hashApiKey('gg_live_test123456789012345678901234567890');
    const objectKey = createApiKeyObject('Object Key', 90).keyObject;

    const normalized = normalizeApiKeys([legacyHash, objectKey]);

    expect(normalized).toHaveLength(2);
    expect(normalized[0]).toHaveProperty('hash', legacyHash);
    expect(normalized[1]).toHaveProperty('name', 'Object Key');
  });
});

describe('isApiKeyExpired', () => {
  it('should return false for non-expired key', () => {
    const { keyObject } = createApiKeyObject('Test Key', 90);

    expect(isApiKeyExpired(keyObject)).toBe(false);
  });

  it('should return true for expired key', () => {
    const { keyObject } = createApiKeyObject('Test Key', 90);
    // Manually set expiration to past
    keyObject.expires_at = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    expect(isApiKeyExpired(keyObject)).toBe(true);
  });

  it('should return false for key without expiration', () => {
    const key = generateApiKey();
    const keyObject = {
      hash: hashApiKey(key),
      created_at: new Date().toISOString(),
    };

    expect(isApiKeyExpired(keyObject)).toBe(false);
  });
});

describe('isApiKeyExpiringSoon', () => {
  it('should return true for key expiring within 7 days', () => {
    const { keyObject } = createApiKeyObject('Test Key', 90);
    // Manually set expiration to 5 days from now
    keyObject.expires_at = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

    expect(isApiKeyExpiringSoon(keyObject)).toBe(true);
  });

  it('should return false for key expiring after 7 days', () => {
    const { keyObject } = createApiKeyObject('Test Key', 90);
    // Manually set expiration to 10 days from now
    keyObject.expires_at = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();

    expect(isApiKeyExpiringSoon(keyObject)).toBe(false);
  });

  it('should return false for key without expiration', () => {
    const key = generateApiKey();
    const keyObject = {
      hash: hashApiKey(key),
      created_at: new Date().toISOString(),
    };

    expect(isApiKeyExpiringSoon(keyObject)).toBe(false);
  });
});

describe('removeExpiredKeys', () => {
  it('should remove expired keys', () => {
    const key1 = createApiKeyObject('Key 1', 90).keyObject; // Not expired
    const key2 = createApiKeyObject('Key 2', 90).keyObject;
    key2.expires_at = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // Expired
    const key3 = createApiKeyObject('Key 3', 30).keyObject; // Not expired

    const keys = [key1, key2, key3];

    const activeKeys = removeExpiredKeys(keys);

    expect(activeKeys).toHaveLength(2);
    expect(activeKeys[0].name).toBe('Key 1');
    expect(activeKeys[1].name).toBe('Key 3');
  });

  it('should keep all keys if none are expired', () => {
    const keys = [
      createApiKeyObject('Key 1', 90).keyObject,
      createApiKeyObject('Key 2', 30).keyObject,
    ];

    const activeKeys = removeExpiredKeys(keys);

    expect(activeKeys).toHaveLength(2);
  });

  it('should handle empty array', () => {
    const activeKeys = removeExpiredKeys([]);
    expect(activeKeys).toHaveLength(0);
  });
});

describe('getApiKeyByHash', () => {
  it('should find API key by hash', () => {
    const { apiKey: key1, keyObject: keyObj1 } = createApiKeyObject('Key 1', 90);
    const { apiKey: key2, keyObject: keyObj2 } = createApiKeyObject('Key 2', 90);
    const hash1 = hashApiKey(key1);
    const hash2 = hashApiKey(key2);

    const keys = [keyObj1, keyObj2];

    const found = getApiKeyByHash(keys, hash1);

    expect(found).toBeDefined();
    expect(found?.hash).toBe(hash1);
    expect(found?.name).toBe('Key 1');
  });

  it('should return undefined for non-existent hash', () => {
    const nonExistentHash = hashApiKey(generateApiKey());

    const keys = [
      createApiKeyObject('Key 1', 90).keyObject,
      createApiKeyObject('Key 2', 90).keyObject,
    ];

    const found = getApiKeyByHash(keys, nonExistentHash);

    expect(found).toBeUndefined();
  });

  it('should handle empty array', () => {
    const found = getApiKeyByHash([], 'some-hash');
    expect(found).toBeUndefined();
  });
});

describe('rotateApiKey', () => {
  it('should create new key and mark old key for rotation', () => {
    const oldKeyObject = createApiKeyObject('Old Key', 90).keyObject;
    const oldHash = oldKeyObject.hash;

    const result = rotateApiKey([oldKeyObject], oldHash, 'New Key');

    expect(result.newApiKey).toBeDefined();
    expect(result.newApiKey).toMatch(/^gg_live_/);
    expect(result.newKeyObject).toHaveProperty('hash');
    expect(result.newKeyObject).toHaveProperty('name', 'New Key');
    expect(result.updatedKeys).toHaveLength(2);
    // Old key should be marked with expiration in 24 hours
    const rotatedOldKey = result.updatedKeys.find(k => k.hash === oldHash);
    expect(rotatedOldKey).toBeDefined();
    expect(rotatedOldKey?.name).toContain('rotated');
  });

  it('should set grace period to 24 hours', () => {
    const oldKeyObject = createApiKeyObject('Old Key', 90).keyObject;
    const oldHash = oldKeyObject.hash;

    const result = rotateApiKey([oldKeyObject], oldHash, 'New Key');
    const rotatedOldKey = result.updatedKeys.find(k => k.hash === oldHash);
    const expiresAt = new Date(rotatedOldKey!.expires_at!);
    const now = new Date();
    const expectedExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Allow 1 second difference
    const diff = Math.abs(expiresAt.getTime() - expectedExpiresAt.getTime());
    expect(diff).toBeLessThan(1000);
  });

  it('should generate different hash for new key', () => {
    const oldKeyObject = createApiKeyObject('Old Key', 90).keyObject;
    const oldHash = oldKeyObject.hash;

    const result = rotateApiKey([oldKeyObject], oldHash, 'New Key');

    expect(result.newKeyObject.hash).not.toBe(oldHash);
  });
});
