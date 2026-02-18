/**
 * API Key Management utilities
 * Handles API key structure, rotation, expiration, and usage tracking
 */

import { hashApiKey, generateApiKey } from '@recete/shared';

/**
 * API Key object structure
 */
export interface ApiKeyObject {
  hash: string;
  created_at: string;
  expires_at: string | null; // null = never expires
  last_used_at: string | null;
  name?: string; // Optional name for the key
}

/**
 * Legacy API key format (just hash strings)
 */
type LegacyApiKey = string;

/**
 * Current API key format (objects)
 */
type CurrentApiKey = ApiKeyObject;

/**
 * API key format (can be legacy or current)
 */
type ApiKeyFormat = LegacyApiKey | CurrentApiKey;

/**
 * Check if API key is in legacy format
 */
export function isLegacyApiKey(key: ApiKeyFormat): key is LegacyApiKey {
  return typeof key === 'string';
}

/**
 * Convert legacy API key to new format
 */
export function migrateLegacyApiKey(hash: string): ApiKeyObject {
  return {
    hash,
    created_at: new Date().toISOString(), // Approximate creation time
    expires_at: null, // Legacy keys don't expire
    last_used_at: null,
  };
}

/**
 * Create new API key object
 */
export function createApiKeyObject(name?: string, expiresInDays: number = 90): {
  apiKey: string;
  keyObject: ApiKeyObject;
} {
  const apiKey = generateApiKey();
  const hash = hashApiKey(apiKey);
  const now = new Date();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  return {
    apiKey,
    keyObject: {
      hash,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      last_used_at: null,
      name: name || undefined,
    },
  };
}

/**
 * Normalize API keys array (migrate legacy format)
 */
export function normalizeApiKeys(apiKeys: ApiKeyFormat[]): ApiKeyObject[] {
  return apiKeys.map((key) => {
    if (isLegacyApiKey(key)) {
      return migrateLegacyApiKey(key);
    }
    return key;
  });
}

/**
 * Check if API key is expired
 */
export function isApiKeyExpired(keyObject: ApiKeyObject): boolean {
  if (!keyObject.expires_at) {
    return false; // Never expires
  }
  return new Date(keyObject.expires_at) < new Date();
}

/**
 * Check if API key is expiring soon (within 7 days)
 */
export function isApiKeyExpiringSoon(keyObject: ApiKeyObject, days: number = 7): boolean {
  if (!keyObject.expires_at) {
    return false; // Never expires
  }
  const expirationDate = new Date(keyObject.expires_at);
  const warningDate = new Date();
  warningDate.setDate(warningDate.getDate() + days);
  return expirationDate <= warningDate && expirationDate > new Date();
}

/**
 * Update last used timestamp for API key
 */
export function updateApiKeyLastUsed(
  apiKeys: ApiKeyObject[],
  hash: string
): ApiKeyObject[] {
  return apiKeys.map((key) => {
    if (key.hash === hash) {
      return {
        ...key,
        last_used_at: new Date().toISOString(),
      };
    }
    return key;
  });
}

/**
 * Rotate API key (create new, keep old for 24 hours)
 */
export function rotateApiKey(
  apiKeys: ApiKeyObject[],
  oldHash: string,
  newKeyName?: string
): {
  newApiKey: string;
  newKeyObject: ApiKeyObject;
  updatedKeys: ApiKeyObject[];
} {
  const { apiKey, keyObject } = createApiKeyObject(newKeyName, 90);
  
  // Mark old key as expiring in 24 hours
  const updatedKeys = apiKeys.map((key) => {
    if (key.hash === oldHash) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      return {
        ...key,
        expires_at: expiresAt.toISOString(),
        name: key.name ? `${key.name} (rotated)` : 'Rotated key',
      };
    }
    return key;
  });

  // Add new key
  updatedKeys.push(keyObject);

  return {
    newApiKey: apiKey,
    newKeyObject: keyObject,
    updatedKeys,
  };
}

/**
 * Remove expired API keys
 */
export function removeExpiredKeys(apiKeys: ApiKeyObject[]): ApiKeyObject[] {
  return apiKeys.filter((key) => !isApiKeyExpired(key));
}

/**
 * Get API key by hash
 */
export function getApiKeyByHash(apiKeys: ApiKeyObject[], hash: string): ApiKeyObject | undefined {
  return apiKeys.find((key) => key.hash === hash);
}
