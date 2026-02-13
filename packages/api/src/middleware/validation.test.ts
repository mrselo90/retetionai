/**
 * Validation Middleware Tests
 * Tests for request validation using Zod schemas
 */

import { describe, it, expect, vi } from 'vitest';
import { validateBody, validateParams, validateQuery } from './validation';
import { z } from 'zod';
import { createMockContext } from '../test/helpers';

describe('validateBody', () => {
  const testSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    age: z.number().optional(),
  });

  it('should validate correct body', async () => {
    const context = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({
          name: 'Test User',
          email: 'test@example.com',
          age: 25,
        }),
      } as any,
    });

    const middleware = validateBody(testSchema);
    const next = vi.fn();

    await middleware(context as any, next);

    expect(next).toHaveBeenCalled();
    expect(context.set).toHaveBeenCalledWith(
      'validatedBody',
      expect.objectContaining({ name: 'Test User', email: 'test@example.com', age: 25 })
    );
  });

  it('should reject invalid body', async () => {
    const context = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({
          name: '', // Invalid: min length 1
          email: 'invalid-email', // Invalid: not an email
        }),
      } as any,
    });

    const middleware = validateBody(testSchema);
    const next = vi.fn();

    const result = await middleware(context as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(result.status).toBe(400);
  });

  it('should handle missing required fields', async () => {
    const context = createMockContext({
      req: {
        json: vi.fn().mockResolvedValue({
          // Missing name and email
          age: 25,
        }),
      } as any,
    });

    const middleware = validateBody(testSchema);
    const next = vi.fn();

    const result = await middleware(context as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(result.status).toBe(400);
  });
});

describe('validateParams', () => {
  const testSchema = z.object({
    id: z.string().uuid(),
  });

  it('should validate correct params', async () => {
    const context = createMockContext({
      req: {
        param: vi.fn().mockReturnValue({
          id: '123e4567-e89b-12d3-a456-426614174000',
        }),
      } as any,
    });

    const middleware = validateParams(testSchema);
    const next = vi.fn();

    await middleware(context as any, next);

    expect(next).toHaveBeenCalled();
    expect(context.set).toHaveBeenCalledWith(
      'validatedParams',
      expect.objectContaining({ id: '123e4567-e89b-12d3-a456-426614174000' })
    );
  });

  it('should reject invalid params', async () => {
    const context = createMockContext({
      req: {
        param: vi.fn().mockReturnValue({
          id: 'invalid-uuid',
        }),
      } as any,
    });

    const middleware = validateParams(testSchema);
    const next = vi.fn();

    const result = await middleware(context as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(result.status).toBe(400);
  });
});

describe('validateQuery', () => {
  const testSchema = z.object({
    page: z.string().transform(Number).pipe(z.number().min(1)),
    limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
  });

  it('should validate correct query parameters', async () => {
    const context = createMockContext({
      req: {
        query: vi.fn().mockReturnValue({
          page: '1',
          limit: '10',
        }),
      } as any,
    });

    const middleware = validateQuery(testSchema);
    const next = vi.fn();

    await middleware(context as any, next);

    expect(next).toHaveBeenCalled();
    expect(context.set).toHaveBeenCalledWith(
      'validatedQuery',
      expect.objectContaining({ page: 1, limit: 10 })
    );
  });

  it('should reject invalid query parameters', async () => {
    const context = createMockContext({
      req: {
        query: vi.fn().mockReturnValue({
          page: '0',
        }),
      } as any,
    });

    const middleware = validateQuery(testSchema);
    const next = vi.fn();

    const result = await middleware(context as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(result.status).toBe(400);
  });

  it('should handle optional query parameters', async () => {
    const context = createMockContext({
      req: {
        query: vi.fn().mockReturnValue({
          page: '1',
        }),
      } as any,
    });

    const middleware = validateQuery(testSchema);
    const next = vi.fn();

    await middleware(context as any, next);

    expect(next).toHaveBeenCalled();
  });
});
