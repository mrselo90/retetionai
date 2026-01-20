-- Migration: API Key Rotation Support
-- Adds expiration, rotation, and usage tracking to API keys

-- Note: This migration updates the api_keys JSONB structure
-- Old format: ['hash1', 'hash2', ...]
-- New format: [{'hash': 'hash1', 'created_at': '...', 'expires_at': '...', 'last_used_at': '...', 'name': '...'}, ...]

-- We'll handle the migration in application code to preserve existing keys
-- This migration just documents the new structure

COMMENT ON COLUMN merchants.api_keys IS 'JSONB array of API key objects: [{"hash": "...", "created_at": "...", "expires_at": "...", "last_used_at": "...", "name": "..."}]';
