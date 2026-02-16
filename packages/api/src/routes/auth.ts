/**
 * Authentication routes
 * Merchant signup, login, API key management
 */

import { Hono } from 'hono';
import { getSupabaseServiceClient } from '@glowguide/shared';
import { getAuthClient, generateApiKey, hashApiKey } from '@glowguide/shared';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { signupSchema, loginSchema, createApiKeySchema, revokeApiKeySchema, SignupInput, LoginInput } from '../schemas/auth.js';
import { captureException, setUserContext } from '../lib/sentry.js';
import { logger } from '@glowguide/shared';
import {
  createApiKeyObject,
  normalizeApiKeys,
  rotateApiKey,
  removeExpiredKeys,
  getApiKeyByHash,
  isApiKeyExpired,
  isApiKeyExpiringSoon,
} from '../lib/apiKeyManager.js';
import { z } from 'zod';

const auth = new Hono();

/**
 * Merchant Signup
 * POST /api/auth/signup
 */
auth.post('/signup', validateBody(signupSchema), async (c) => {
  try {
    const validatedBody = c.get('validatedBody') as SignupInput;
    const { email, password, name } = validatedBody;

    const serviceClient = getSupabaseServiceClient();
    const supabase = getAuthClient();

    // Check if user already exists in Supabase Auth using admin API
    const { data: { users }, error: listError } = await serviceClient.auth.admin.listUsers();
    
    if (listError) {
      logger.error(listError, 'Failed to list users during signup');
      throw new Error('Failed to verify existing accounts');
    }

    const existingAuthUser = users.find(u => u.email === email);

    let userId: string;
    let isNewUser = false;
    let authData: any = null; // Store authData for email confirmation check

    if (existingAuthUser) {
      // User already exists, check if merchant exists
      userId = existingAuthUser.id;
      const { data: existingMerchant } = await serviceClient
        .from('merchants')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (existingMerchant) {
        return c.json({
          error: 'Account already exists. Please login instead.',
          message: 'Account already exists. Please login instead.',
        }, 409);
      }

      // User exists but merchant doesn't - we'll create the merchant record below
      logger.info({ userId, email }, 'User exists in Auth but missing from merchants table');
    } else {
      // Create new user in Supabase Auth
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const signupResult = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${frontendUrl}/auth/callback?type=signup`,
        },
      });

      authData = signupResult.data;
      const authError = signupResult.error;

      if (authError) {
        logger.error(authError, 'Supabase Auth signup error');
        return c.json({
          error: authError.message || 'Signup failed',
          message: authError.message || 'Signup failed',
        }, 400);
      }

      if (!authData?.user) {
        return c.json({
          error: 'User creation failed - no user returned',
          message: 'User creation failed - no user returned',
        }, 400);
      }

      userId = authData.user.id;
      isNewUser = true;
    }

    // Check if merchant already exists again (double check)
    const { data: merchantRecord } = await serviceClient
      .from('merchants')
      .select('id, name')
      .eq('id', userId)
      .maybeSingle();

    if (merchantRecord) {
      const requiresEmailConfirmation = isNewUser && !authData?.session;
      return c.json({
        message: requiresEmailConfirmation
          ? 'Account already exists but requires email confirmation. Please check your email.'
          : 'Merchant already exists. Please login.',
        merchant: {
          id: merchantRecord.id,
          name: merchantRecord.name,
        },
        apiKey: '********',
        requiresEmailConfirmation,
      }, 200);
    }

    // Generate API key for new merchant
    const apiKey = generateApiKey();
    const { keyObject } = createApiKeyObject(undefined, 90);
    keyObject.hash = hashApiKey(apiKey);

    const { data: merchant, error: merchantError } = await serviceClient
      .from('merchants')
      .insert({
        id: userId,
        name,
        api_keys: [keyObject],
      })
      .select()
      .single();

    if (merchantError) {
      logger.error({ error: merchantError, userId }, 'Merchant creation error');

      if (isNewUser) {
        try {
          await serviceClient.auth.admin.deleteUser(userId);
        } catch (deleteError) {
          logger.error(deleteError, 'Failed to rollback auth user');
        }
      }

      return c.json({
        error: 'Failed to create merchant account',
        message: merchantError.message,
      }, 500);
    }

    const requiresEmailConfirmation = isNewUser && !authData?.session;

    return c.json({
      message: requiresEmailConfirmation
        ? 'Account created successfully. Please check your email to confirm.'
        : 'Account created successfully',
      merchant: {
        id: merchant.id,
        name: merchant.name,
      },
      apiKey,
      requiresEmailConfirmation,
    }, 201);
  } catch (error) {
    logger.error(error instanceof Error ? error : new Error(String(error)), 'Signup error');
    captureException(error instanceof Error ? error : new Error(String(error)), {
      endpoint: '/api/auth/signup',
    });
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Merchant Login
 * POST /api/auth/login
 */
auth.post('/login', validateBody(loginSchema), async (c) => {
  try {
    const validatedBody = c.get('validatedBody') as LoginInput;
    const { email, password } = validatedBody;

    const supabase = getAuthClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      logger.error(error, 'Login error');
      return c.json({
        error: error.message || 'Invalid login credentials',
        details: error.message,
      }, 401);
    }

    if (!data.session || !data.user) {
      return c.json({ error: 'Login failed - no session created' }, 401);
    }

    // Get merchant info
    const serviceClient = getSupabaseServiceClient();
    const { data: merchant, error: merchantError } = await serviceClient
      .from('merchants')
      .select('id, name')
      .eq('id', data.user.id)
      .maybeSingle();

    let finalMerchant = merchant;

    if (merchantError) {
      logger.error({ userId: data.user.id, error: merchantError }, 'Error fetching merchant during login');
    }

    // Self-healing: Create merchant record if missing for an authenticated user
    if (!merchant && !merchantError) {
      logger.info({ userId: data.user.id, email: data.user.email }, 'Merchant record missing during login, creating...');
      
      const name = 
        (data.user.user_metadata?.full_name as string) || 
        (data.user.user_metadata?.name as string) || 
        (data.user.email?.split('@')[0]) || 
        'Merchant';

      // Generate API key for new merchant
      const { apiKey, keyObject } = createApiKeyObject(undefined, 90);

      const { data: newMerchant, error: createError } = await serviceClient
        .from('merchants')
        .insert({
          id: data.user.id,
          name: typeof name === 'string' ? name.slice(0, 255) : 'Merchant',
          api_keys: [keyObject],
        })
        .select('id, name')
        .single();

      if (createError) {
        logger.error({ userId: data.user.id, error: createError }, 'Failed to create missing merchant record during login');
        return c.json({
          error: 'Merchant account not found and could not be created.',
          details: createError.message,
        }, 500);
      }
      
      finalMerchant = newMerchant;
      logger.info({ userId: data.user.id }, 'Self-healed merchant record successfully');
    }

    if (!finalMerchant) {
      return c.json({
        error: 'Merchant account not found. Please contact support.',
        details: 'User exists but merchant record is missing and self-healing failed',
      }, 404);
    }

    // Set user context for Sentry
    setUserContext(data.user.id, data.user.email || undefined, finalMerchant.id);

    return c.json({
      message: 'Login successful',
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
      merchant: {
        id: finalMerchant.id,
        name: finalMerchant.name,
      },
    });
  } catch (error) {
    logger.error(error instanceof Error ? error : new Error(String(error)), 'Login error');
    captureException(error instanceof Error ? error : new Error(String(error)), {
      endpoint: '/api/auth/login',
    });
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Get Current User (Protected)
 * GET /api/auth/me
 */
auth.get('/me', authMiddleware, async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;

    const serviceClient = getSupabaseServiceClient();
    const { data: merchant, error } = await serviceClient
      .from('merchants')
      .select('id, name, created_at')
      .eq('id', merchantId)
      .single();

    if (error || !merchant) {
      return c.json({ error: 'Merchant not found' }, 404);
    }

    return c.json({ merchant });
  } catch (error) {
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Generate New API Key (Protected)
 * POST /api/auth/api-keys
 */
auth.post('/api-keys', authMiddleware, validateBody(createApiKeySchema), async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;

    const serviceClient = getSupabaseServiceClient();

    // Get current merchant
    const { data: merchant, error: fetchError } = await serviceClient
      .from('merchants')
      .select('api_keys')
      .eq('id', merchantId)
      .single();

    if (fetchError || !merchant) {
      return c.json({ error: 'Merchant not found' }, 404);
    }

    // Normalize existing keys (migrate legacy format)
    const normalizedKeys = normalizeApiKeys((merchant.api_keys as any) || []);

    // Remove expired keys
    const activeKeys = removeExpiredKeys(normalizedKeys);

    // Check limit (max 5 keys per merchant)
    if (activeKeys.length >= 5) {
      return c.json({ error: 'Maximum 5 API keys allowed' }, 400);
    }

    // Get optional name from request body
    const validatedBody = c.get('validatedBody') as { name?: string };
    const { apiKey, keyObject } = createApiKeyObject(validatedBody?.name, 90); // 90 days expiration

    const updatedKeys = [...activeKeys, keyObject];

    // Update merchant
    const { error: updateError } = await serviceClient
      .from('merchants')
      .update({ api_keys: updatedKeys })
      .eq('id', merchantId);

    if (updateError) {
      return c.json({ error: 'Failed to create API key' }, 500);
    }

    return c.json({
      message: 'API key created successfully',
      apiKey, // Return only once!
      keyInfo: {
        name: keyObject.name,
        expires_at: keyObject.expires_at,
        created_at: keyObject.created_at,
      },
      // Note: In production, send via secure channel
    }, 201);
  } catch (error) {
    captureException(error instanceof Error ? error : new Error(String(error)), {
      endpoint: '/api/auth/api-keys',
    });
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * List API Keys (Protected)
 * GET /api/auth/api-keys
 */
auth.get('/api-keys', authMiddleware, async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;

    const serviceClient = getSupabaseServiceClient();
    const { data: merchant, error } = await serviceClient
      .from('merchants')
      .select('api_keys')
      .eq('id', merchantId)
      .single();

    if (error || !merchant) {
      return c.json({ error: 'Merchant not found' }, 404);
    }

    // Normalize keys (migrate legacy format)
    const normalizedKeys = normalizeApiKeys((merchant.api_keys as any) || []);

    // Remove expired keys
    const activeKeys = removeExpiredKeys(normalizedKeys);

    // Return key list with metadata
    const keyList = activeKeys.map((key, index) => ({
      id: index,
      hash: key.hash.substring(0, 8) + '...', // Show only first 8 chars for display
      hash_full: key.hash, // Full hash for operations (rotate/revoke)
      name: key.name || 'Unnamed',
      created_at: key.created_at,
      expires_at: key.expires_at,
      last_used_at: key.last_used_at,
      is_expired: isApiKeyExpired(key),
      is_expiring_soon: isApiKeyExpiringSoon(key),
      days_until_expiration: key.expires_at
        ? Math.ceil((new Date(key.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null,
    }));

    return c.json({
      apiKeys: keyList,
      count: activeKeys.length,
      maxKeys: 5,
    });
  } catch (error) {
    captureException(error instanceof Error ? error : new Error(String(error)), {
      endpoint: '/api/auth/api-keys',
    });
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Rotate API Key (Protected)
 * POST /api/auth/api-keys/:keyHash/rotate
 */
const keyHashSchema = z.object({
  keyHash: z.string().min(1),
});

auth.post('/api-keys/:keyHash/rotate', authMiddleware, validateParams(keyHashSchema), validateBody(createApiKeySchema), async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const { keyHash } = c.get('validatedParams') as { keyHash: string };
    const validatedBody = c.get('validatedBody') as { name?: string };

    const serviceClient = getSupabaseServiceClient();

    // Get current merchant
    const { data: merchant, error: fetchError } = await serviceClient
      .from('merchants')
      .select('api_keys')
      .eq('id', merchantId)
      .single();

    if (fetchError || !merchant) {
      return c.json({ error: 'Merchant not found' }, 404);
    }

    // Normalize keys
    const normalizedKeys = normalizeApiKeys((merchant.api_keys as any) || []);
    const keyObject = getApiKeyByHash(normalizedKeys, keyHash);

    if (!keyObject) {
      return c.json({ error: 'API key not found' }, 404);
    }

    // Rotate key
    const { newApiKey, newKeyObject, updatedKeys } = rotateApiKey(
      normalizedKeys,
      keyHash,
      validatedBody?.name
    );

    // Update merchant
    const { error: updateError } = await serviceClient
      .from('merchants')
      .update({ api_keys: updatedKeys })
      .eq('id', merchantId);

    if (updateError) {
      return c.json({ error: 'Failed to rotate API key' }, 500);
    }

    return c.json({
      message: 'API key rotated successfully',
      apiKey: newApiKey, // Return only once!
      keyInfo: {
        name: newKeyObject.name,
        expires_at: newKeyObject.expires_at,
        created_at: newKeyObject.created_at,
      },
      note: 'Old key will expire in 24 hours. Update your integrations with the new key.',
    }, 201);
  } catch (error) {
    captureException(error instanceof Error ? error : new Error(String(error)), {
      endpoint: '/api/auth/api-keys/:keyHash/rotate',
    });
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Revoke API Key (Protected)
 * DELETE /api/auth/api-keys/:keyHash
 */
auth.delete('/api-keys/:keyHash', authMiddleware, validateParams(keyHashSchema), async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const { keyHash } = c.get('validatedParams') as { keyHash: string };

    const serviceClient = getSupabaseServiceClient();

    // Get current merchant
    const { data: merchant, error: fetchError } = await serviceClient
      .from('merchants')
      .select('api_keys')
      .eq('id', merchantId)
      .single();

    if (fetchError || !merchant) {
      return c.json({ error: 'Merchant not found' }, 404);
    }

    // Normalize and find key
    const normalizedKeys = normalizeApiKeys((merchant.api_keys as any) || []);
    const keyObject = getApiKeyByHash(normalizedKeys, keyHash);

    if (!keyObject) {
      return c.json({ error: 'API key not found' }, 404);
    }

    const updatedKeys = normalizedKeys.filter((key) => key.hash !== keyHash);

    // Update merchant
    const { error: updateError } = await serviceClient
      .from('merchants')
      .update({ api_keys: updatedKeys })
      .eq('id', merchantId);

    if (updateError) {
      return c.json({ error: 'Failed to revoke API key' }, 500);
    }

    return c.json({ message: 'API key revoked successfully' });
  } catch (error) {
    captureException(error instanceof Error ? error : new Error(String(error)), {
      endpoint: '/api/auth/api-keys/:keyHash',
    });
    return c.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default auth;
