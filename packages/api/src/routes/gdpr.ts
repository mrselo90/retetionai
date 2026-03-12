/**
 * GDPR compliance routes
 * Data export, deletion, and consent management
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { getSupabaseServiceClient } from '@recete/shared';
import { exportMerchantData, exportUserData } from '../lib/dataExport.js';
import { processShopifyGdprJob, type ShopifyGdprJobType } from '../lib/shopifyGdprJobs.js';
import {
  softDeleteMerchantData,
  permanentlyDeleteMerchantData,
  softDeleteUserData,
  permanentlyDeleteUserData,
} from '../lib/dataDeletion.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { z } from 'zod';

const gdpr = new Hono();

// All routes require authentication
gdpr.use('/*', authMiddleware);

const gdprJobIdSchema = z.object({
  id: z.string().uuid('Invalid GDPR job ID format'),
});

/**
 * Export merchant data
 * GET /api/gdpr/export
 */
gdpr.get('/export', async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;

    const data = await exportMerchantData(merchantId);

    // Return as JSON (can also be formatted as CSV if needed)
    return c.json({
      message: 'Data export successful',
      data,
      format: 'json',
      exported_at: data.exported_at,
    });
  } catch (error) {
    console.error('Data export error:', error);
    return c.json(
      {
        error: 'Failed to export data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * List GDPR export artifacts prepared for the merchant
 * GET /api/gdpr/exports
 */
gdpr.get('/exports', async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const supabase = getSupabaseServiceClient();

    const { data: exports, error } = await supabase
      .from('gdpr_exports')
      .select('id, user_id, source, shop_domain, status, requested_at, created_at')
      .eq('merchant_id', merchantId)
      .order('requested_at', { ascending: false })
      .limit(50);

    if (error) {
      return c.json({ error: 'Failed to fetch GDPR exports' }, 500);
    }

    return c.json({ exports: exports || [] });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to fetch GDPR exports',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * Get a single GDPR export payload
 * GET /api/gdpr/exports/:id
 */
const gdprExportIdSchema = z.object({
  id: z.string().uuid('Invalid GDPR export ID format'),
});

gdpr.get('/exports/:id', validateParams(gdprExportIdSchema), async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const { id } = c.get('validatedParams') as { id: string };
    const supabase = getSupabaseServiceClient();

    const { data: gdprExport, error } = await supabase
      .from('gdpr_exports')
      .select('id, user_id, source, shop_domain, status, requested_at, created_at, payload')
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .single();

    if (error || !gdprExport) {
      return c.json({ error: 'GDPR export not found' }, 404);
    }

    return c.json({ export: gdprExport });
  } catch (error) {
    return c.json(
      {
        error: 'Failed to fetch GDPR export',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * Process a persisted Shopify GDPR job.
 * POST /api/gdpr/jobs/:id/process
 */
gdpr.post('/jobs/:id/process', validateParams(gdprJobIdSchema), async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const { id } = c.get('validatedParams') as { id: string };
    const supabase = getSupabaseServiceClient();

    const { data: job, error: fetchError } = await supabase
      .from('gdpr_jobs')
      .select('id, merchant_id, job_type, payload, status, attempts')
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .single();

    if (fetchError || !job) {
      return c.json({ error: 'GDPR job not found' }, 404);
    }

    if (job.status === 'completed') {
      return c.json({ ok: true, skipped: true, reason: 'already_completed' });
    }

    const attemptCount = typeof job.attempts === 'number' ? job.attempts + 1 : 1;
    const processingTimestamp = new Date().toISOString();

    const { error: markProcessingError } = await supabase
      .from('gdpr_jobs')
      .update({
        status: 'processing',
        attempts: attemptCount,
        last_error: null,
        updated_at: processingTimestamp,
      })
      .eq('id', id)
      .eq('merchant_id', merchantId);

    if (markProcessingError) {
      return c.json({ error: 'Failed to update GDPR job state' }, 500);
    }

    try {
      await processShopifyGdprJob(
        job.id,
        job.job_type as ShopifyGdprJobType,
        (job.payload || {}) as Record<string, unknown>,
        merchantId,
      );

      const completedAt = new Date().toISOString();
      await supabase
        .from('gdpr_jobs')
        .update({
          status: 'completed',
          processed_at: completedAt,
          updated_at: completedAt,
          last_error: null,
        })
        .eq('id', id)
        .eq('merchant_id', merchantId);

      return c.json({ ok: true, status: 'completed' });
    } catch (error) {
      const lastError = error instanceof Error ? error.message : 'Unknown error';

      await supabase
        .from('gdpr_jobs')
        .update({
          status: 'failed',
          last_error: lastError,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('merchant_id', merchantId);

      return c.json({ error: 'Failed to process GDPR job', message: lastError }, 500);
    }
  } catch (error) {
    return c.json(
      {
        error: 'Failed to process GDPR job',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
});

/**
 * Export user data (for end users)
 * GET /api/gdpr/users/:userId/export
 */
const userIdSchema = z.object({
  userId: z.string().uuid('Invalid user ID format'),
});

gdpr.get('/users/:userId/export', validateParams(userIdSchema), async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const { userId } = c.get('validatedParams') as { userId: string };

    // Verify user belongs to merchant
    const supabase = getSupabaseServiceClient();
    const { data: user } = await supabase
      .from('users')
      .select('merchant_id')
      .eq('id', userId)
      .eq('merchant_id', merchantId)
      .single();

    if (!user) {
      return c.json({ error: 'User not found or access denied' }, 404);
    }

    const data = await exportUserData(userId);

    return c.json({
      message: 'User data export successful',
      data,
      format: 'json',
      exported_at: data.exported_at,
    });
  } catch (error) {
    console.error('User data export error:', error);
    return c.json(
      {
        error: 'Failed to export user data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * Request merchant data deletion (soft delete with 30-day grace period)
 * DELETE /api/gdpr/delete
 */
const deleteRequestSchema = z.object({
  confirm: z.boolean().refine((v) => v === true, {
    message: 'Deletion must be confirmed',
  }),
  permanent: z.boolean().default(false), // If true, delete immediately (no grace period)
});

gdpr.delete('/delete', validateBody(deleteRequestSchema) as any, async (c) => {
  try {
    const merchantId = c.get('merchantId') as string;
    const { permanent } = c.get('validatedBody') as { confirm: true; permanent: boolean };

    if (permanent) {
      // Permanently delete immediately
      await permanentlyDeleteMerchantData(merchantId);
      return c.json({
        message: 'Data permanently deleted',
        warning: 'This action is irreversible',
      });
    } else {
      // Soft delete with grace period
      const result = await softDeleteMerchantData(merchantId);
      return c.json({
        message: 'Data deletion scheduled',
        ...result,
        note: 'Your data will be permanently deleted after 30 days. Contact support to cancel.',
      });
    }
  } catch (error) {
    console.error('Data deletion error:', error);
    return c.json(
      {
        error: 'Failed to delete data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * Request user data deletion
 * DELETE /api/gdpr/users/:userId/delete
 */
const userDeleteRequestSchema = z.object({
  confirm: z.literal(true),
  permanent: z.boolean().default(false),
});

gdpr.delete(
  '/users/:userId/delete',
  validateParams(userIdSchema),
  validateBody(userDeleteRequestSchema) as any,
  async (c) => {
    try {
      const merchantId = c.get('merchantId') as string;
      const { userId } = c.get('validatedParams') as { userId: string };
      const { permanent } = c.get('validatedBody') as { confirm: true; permanent: boolean };

      // Verify user belongs to merchant
      const supabase = getSupabaseServiceClient();
      const { data: user } = await supabase
        .from('users')
        .select('merchant_id')
        .eq('id', userId)
        .eq('merchant_id', merchantId)
        .single();

      if (!user) {
        return c.json({ error: 'User not found or access denied' }, 404);
      }

      if (permanent) {
        await permanentlyDeleteUserData(userId);
        return c.json({
          message: 'User data permanently deleted',
          warning: 'This action is irreversible',
        });
      } else {
        const result = await softDeleteUserData(userId);
        return c.json({
          message: 'User data deletion scheduled',
          ...result,
          note: 'Data will be permanently deleted after 30 days.',
        });
      }
    } catch (error) {
      console.error('User data deletion error:', error);
      return c.json(
        {
          error: 'Failed to delete user data',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  }
);

/**
 * Update user consent
 * PUT /api/gdpr/users/:userId/consent
 */
const consentSchema = z.object({
  consent_status: z.enum(['granted', 'revoked', 'pending']),
  consent_type: z.enum(['marketing', 'data_processing', 'all']).optional(),
});

gdpr.put(
  '/users/:userId/consent',
  validateParams(userIdSchema),
  validateBody(consentSchema),
  async (c) => {
    try {
      const merchantId = c.get('merchantId') as string;
      const { userId } = c.get('validatedParams') as { userId: string };
      const { consent_status, consent_type } = c.get('validatedBody') as {
        consent_status: 'granted' | 'revoked' | 'pending';
        consent_type?: 'marketing' | 'data_processing' | 'all';
      };

      // Verify user belongs to merchant
      const supabase = getSupabaseServiceClient();
      const { data: user } = await supabase
        .from('users')
        .select('merchant_id, consent_status')
        .eq('id', userId)
        .eq('merchant_id', merchantId)
        .single();

      if (!user) {
        return c.json({ error: 'User not found or access denied' }, 404);
      }

      // Update consent
      const { error: updateError } = await supabase
        .from('users')
        .update({
          consent_status: consent_status,
          consent_updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateError) {
        return c.json({ error: 'Failed to update consent' }, 500);
      }

      // FUTURE: Log consent change in audit log table for compliance tracking
      // MVP: Consent changes are tracked via consent_updated_at timestamp

      return c.json({
        message: 'Consent updated successfully',
        consent_status,
        consent_type: consent_type || 'all',
      });
    } catch (error) {
      console.error('Consent update error:', error);
      return c.json(
        {
          error: 'Failed to update consent',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  }
);

export default gdpr;
