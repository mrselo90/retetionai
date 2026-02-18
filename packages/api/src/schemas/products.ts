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
 * Raw text / description (e.g. from Shopify) for RAG / AI bot context
 */
const rawTextSchema = z.string().max(500_000).trim().optional();

/**
 * Create product request schema
 */
export const createProductSchema = z.object({
  name: productNameSchema,
  url: urlSchema,
  external_id: externalIdSchema,
  /** Product description / body (e.g. from Shopify) – stored for RAG and AI responses */
  raw_text: rawTextSchema,
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

/**
 * Update product request schema
 */
export const updateProductSchema = z.object({
  name: productNameSchema.optional(),
  url: urlSchema.optional(),
  external_id: externalIdSchema,
  /** Product description / body – stored for RAG and AI responses */
  raw_text: rawTextSchema,
});

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

/**
 * Product ID parameter schema
 */
export const productIdSchema = z.object({
  id: z.string().uuid('Invalid product ID format'),
});

export type ProductIdParams = z.infer<typeof productIdSchema>;

/**
 * Product instruction (recipe & usage) request schema
 */
export const productInstructionSchema = z.object({
  usage_instructions: z.string().min(1, 'Usage instructions are required').max(50000, 'Max 50k characters').trim(),
  recipe_summary: z.string().max(2000).trim().optional(),
  video_url: z.string().url('Invalid URL').max(2048).trim().optional().or(z.literal('')),
  prevention_tips: z.string().max(5000).trim().optional(),
});

export type ProductInstructionInput = z.infer<typeof productInstructionSchema>;
