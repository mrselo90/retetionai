import { z } from 'zod';

/**
 * Email validation (RFC 5322 compliant)
 */
const emailSchema = z.string().email('Invalid email format').min(3).max(255);

/**
 * Password validation
 * - Minimum 6 characters
 * - Maximum 100 characters
 */
const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters')
  .max(100, 'Password must be less than 100 characters');

/**
 * Business name validation
 */
const businessNameSchema = z
  .string()
  .min(2, 'Business name must be at least 2 characters')
  .max(100, 'Business name must be less than 100 characters')
  .trim();

/**
 * Signup request schema
 */
export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: businessNameSchema,
});

export type SignupInput = z.infer<typeof signupSchema>;

/**
 * Login request schema
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
