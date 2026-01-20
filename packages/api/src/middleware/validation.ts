import { Context, Next } from 'hono';
import { z, ZodError, ZodSchema } from 'zod';

/**
 * Validation error response
 */
interface ValidationErrorResponse {
  error: 'Validation failed';
  message: string;
  details: Array<{
    field: string;
    message: string;
    code: string;
  }>;
}

/**
 * Format Zod errors for API response
 */
function formatZodError(error: ZodError): ValidationErrorResponse {
  return {
    error: 'Validation failed',
    message: 'Request validation failed. Please check the details.',
    details: error.issues.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
    })),
  };
}

/**
 * Validate request body with Zod schema
 */
export function validateBody<T extends ZodSchema>(schema: T) {
  return async (c: Context, next: Next) => {
    try {
      const body = await c.req.json();
      const validated = schema.parse(body);
      
      // Store validated body in context
      c.set('validatedBody', validated);
      
      await next();
    } catch (error) {
      if (error instanceof ZodError) {
        return c.json(formatZodError(error), 400);
      }
      
      // Handle JSON parse errors
      if (error instanceof SyntaxError) {
        return c.json(
          {
            error: 'Invalid JSON',
            message: 'Request body must be valid JSON',
          },
          400
        );
      }
      
      // Re-throw unexpected errors
      throw error;
    }
  };
}

/**
 * Validate query parameters with Zod schema
 */
export function validateQuery<T extends ZodSchema>(schema: T) {
  return async (c: Context, next: Next) => {
    try {
      const query = c.req.query();
      const validated = schema.parse(query);
      
      // Store validated query in context
      c.set('validatedQuery', validated);
      
      await next();
    } catch (error) {
      if (error instanceof ZodError) {
        return c.json(formatZodError(error), 400);
      }
      
      throw error;
    }
  };
}

/**
 * Validate path parameters with Zod schema
 */
export function validateParams<T extends ZodSchema>(schema: T) {
  return async (c: Context, next: Next) => {
    try {
      const params = c.req.param();
      const validated = schema.parse(params);
      
      // Store validated params in context
      c.set('validatedParams', validated);
      
      await next();
    } catch (error) {
      if (error instanceof ZodError) {
        return c.json(formatZodError(error), 400);
      }
      
      throw error;
    }
  };
}
