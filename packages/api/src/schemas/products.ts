import { z } from 'zod';

/**
 * URL validation
 */
const urlSchema = z
  .string()
  .url('Invalid URL format')
  .max(2048, 'URL must be less than 2048 characters');

/**
 * Product name validation
 */
const productNameSchema = z
  .string()
  .min(1, 'Product name is required')
  .max(255, 'Product name must be less than 255 characters')
  .trim();

/**
 * External ID validation
 */
const externalIdSchema = z
  .string()
  .min(1, 'External ID is required')
  .max(255, 'External ID must be less than 255 characters')
  .trim()
  .optional();

/**
 * Create product request schema
 */
export const createProductSchema = z.object({
  name: productNameSchema,
  url: urlSchema,
  external_id: externalIdSchema,
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

/**
 * Update product request schema
 */
export const updateProductSchema = z.object({
  name: productNameSchema.optional(),
  url: urlSchema.optional(),
  external_id: externalIdSchema,
});

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

/**
 * Product ID parameter schema
 */
export const productIdSchema = z.object({
  id: z.string().uuid('Invalid product ID format'),
});

export type ProductIdParams = z.infer<typeof productIdSchema>;
