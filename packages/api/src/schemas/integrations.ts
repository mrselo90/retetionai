import { z } from 'zod';

/**
 * Integration provider enum
 */
export const integrationProviderSchema = z.enum([
  'shopify',
  'woocommerce',
  'ticimax',
  'manual',
  'csv',
]);

/**
 * Integration status enum
 */
export const integrationStatusSchema = z.enum(['active', 'inactive', 'error']);

/**
 * Integration auth type enum
 */
export const integrationAuthTypeSchema = z.enum(['oauth', 'api_key', 'webhook', 'none']);

/**
 * Create integration request schema
 */
export const createIntegrationSchema = z.object({
  provider: integrationProviderSchema,
  status: integrationStatusSchema.default('active'),
  auth_type: integrationAuthTypeSchema,
  auth_data: z.record(z.string(), z.unknown()).optional(), // JSONB field - flexible
});

export type CreateIntegrationInput = z.infer<typeof createIntegrationSchema>;

/**
 * Update integration request schema
 */
export const updateIntegrationSchema = z.object({
  status: integrationStatusSchema.optional(),
  auth_data: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateIntegrationInput = z.infer<typeof updateIntegrationSchema>;

/**
 * Integration ID parameter schema
 */
export const integrationIdSchema = z.object({
  id: z.string().uuid('Invalid integration ID format'),
});

export type IntegrationIdParams = z.infer<typeof integrationIdSchema>;
