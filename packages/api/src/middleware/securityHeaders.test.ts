/**
 * Security Headers Middleware Tests
 * Tests for security headers middleware
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { securityHeadersMiddleware } from './securityHeaders';
import { createMockContext } from '../test/helpers';

describe('securityHeadersMiddleware', () => {
  it('should set all security headers', async () => {
    const oldEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const context = createMockContext({
      req: {
        header: vi.fn((name: string) => {
          if (name === 'X-Forwarded-Proto') return 'https';
          return undefined;
        }),
        url: 'https://example.com',
      } as any,
    });

    const next = vi.fn();
    await securityHeadersMiddleware(context as any, next);

    expect(next).toHaveBeenCalled();
    expect(context.header).toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.stringContaining("default-src 'self'")
    );
    expect(context.header).toHaveBeenCalledWith(
      'Strict-Transport-Security',
      expect.stringContaining('max-age=63072000')
    );
    expect(context.header).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    expect(context.header).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(context.header).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
    expect(context.header).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');

    process.env.NODE_ENV = oldEnv;
  });

  it('should include CSP directives', async () => {
    const context = createMockContext();

    const next = vi.fn();
    await securityHeadersMiddleware(context as any, next);

    const cspCall = (context.header as any).mock.calls.find(
      (call: any[]) => call[0] === 'Content-Security-Policy'
    );

    expect(cspCall).toBeDefined();
    const cspValue = cspCall[1];
    expect(cspValue).toContain("default-src 'self'");
    expect(cspValue).toContain("script-src 'self'");
    expect(cspValue).toContain("style-src 'self'");
  });

  it('should set HSTS header with correct values', async () => {
    const oldEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const context = createMockContext({
      req: {
        header: vi.fn((name: string) => {
          if (name === 'X-Forwarded-Proto') return 'https';
          return undefined;
        }),
        url: 'https://example.com',
      } as any,
    });

    const next = vi.fn();
    await securityHeadersMiddleware(context as any, next);

    const hstsCall = (context.header as any).mock.calls.find(
      (call: any[]) => call[0] === 'Strict-Transport-Security'
    );

    expect(hstsCall).toBeDefined();
    const hstsValue = hstsCall[1];
    expect(hstsValue).toContain('max-age=63072000');
    expect(hstsValue).toContain('includeSubDomains');

    process.env.NODE_ENV = oldEnv;
  });
});
