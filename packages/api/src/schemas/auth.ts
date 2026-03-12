import { z } from 'zod';

/**
 * Email validation (RFC 5322 compliant)
 */
const emailSchema = z.string().email('Invalid email format').min(3).max(255);

/**
 * Password validation
 * - Minimum 8 characters
 * - Must include upper, lower, and number
 * - Maximum 100 characters
 */
const strongPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password must be less than 100 characters')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[0-9]/, 'Password must include a number');

const loginPasswordSchema = z
  .string()
  .min(1, 'Password is required')
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
  password: strongPasswordSchema,
  name: businessNameSchema,
});

export type SignupInput = z.infer<typeof signupSchema>;

/**
 * Login request schema
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
