/**
 * Authentication routes
 * Merchant signup and login
 */

import { Hono } from 'hono';
import { getSupabaseServiceClient } from '@recete/shared';
import { getAuthClient } from '@recete/shared';
import { authMiddleware } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { signupSchema, loginSchema, SignupInput, LoginInput } from '../schemas/auth.js';
import { captureException, setUserContext } from '../lib/sentry.js';
import { logger } from '@recete/shared';

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
        requiresEmailConfirmation,
      }, 200);
    }

    const { data: merchant, error: merchantError } = await serviceClient
      .from('merchants')
      .insert({
        id: userId,
        name,
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

      const { data: newMerchant, error: createError } = await serviceClient
        .from('merchants')
        .insert({
          id: data.user.id,
          name: typeof name === 'string' ? name.slice(0, 255) : 'Merchant',
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

export default auth;
