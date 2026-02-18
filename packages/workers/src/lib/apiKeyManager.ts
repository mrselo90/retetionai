/**
 * API Key Management utilities (used by workers)
 * Copied from API package to avoid cross-package source imports.
 */

import { hashApiKey, generateApiKey } from '@recete/shared';

export interface ApiKeyObject {
  hash: string;
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  name?: string;
}

type LegacyApiKey = string;
type CurrentApiKey = ApiKeyObject;
type ApiKeyFormat = LegacyApiKey | CurrentApiKey;

export function isLegacyApiKey(key: ApiKeyFormat): key is LegacyApiKey {
  return typeof key === 'string';
}

export function migrateLegacyApiKey(hash: string): ApiKeyObject {
  return {
    hash,
    created_at: new Date().toISOString(),
    expires_at: null,
    last_used_at: null,
  };
}

export function createApiKeyObject(
  name?: string,
  expiresInDays: number = 90
): { apiKey: string; keyObject: ApiKeyObject } {
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

export function normalizeApiKeys(apiKeys: ApiKeyFormat[]): ApiKeyObject[] {
  return apiKeys.map((key) => (isLegacyApiKey(key) ? migrateLegacyApiKey(key) : key));
}

export function isApiKeyExpired(keyObject: ApiKeyObject): boolean {
  if (!keyObject.expires_at) return false;
  return new Date(keyObject.expires_at) < new Date();
}

export function removeExpiredKeys(apiKeys: ApiKeyObject[]): ApiKeyObject[] {
  return apiKeys.filter((key) => !isApiKeyExpired(key));
}

