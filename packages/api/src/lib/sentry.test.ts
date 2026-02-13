import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Sentry from '@sentry/node';
import {
    initSentry,
    captureException,
    captureMessage,
    setUserContext,
    setMerchantContext,
    addBreadcrumb
} from './sentry';

// Mock Sentry
vi.mock('@sentry/node', () => ({
    init: vi.fn(),
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    setUser: vi.fn(),
    setContext: vi.fn(),
    addBreadcrumb: vi.fn(),
    withScope: vi.fn((callback) => {
        const scope = {
            setContext: vi.fn(),
            setLevel: vi.fn(),
        };
        callback(scope);
    }),
}));

vi.mock('@sentry/profiling-node', () => ({
    nodeProfilingIntegration: vi.fn(),
}));

describe('Sentry Module', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('initSentry', () => {
        it('should initialize Sentry when DSN is present', () => {
            process.env.SENTRY_DSN = 'https://example@sentry.io/123';
            initSentry();
            expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({
                dsn: 'https://example@sentry.io/123',
                environment: 'test',
            }));
        });

        it('should not initialize Sentry when DSN is missing', () => {
            delete process.env.SENTRY_DSN;
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
            initSentry();
            expect(Sentry.init).not.toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Sentry DSN not configured'));
            consoleSpy.mockRestore();
        });

        it('should configure production sample rates', () => {
            process.env.SENTRY_DSN = 'https://example@sentry.io/123';
            process.env.NODE_ENV = 'production';
            initSentry();
            expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({
                tracesSampleRate: 0.1,
                profilesSampleRate: 0.1,
            }));
        });
    });

    describe('captureException', () => {
        it('should capture exception without context', () => {
            const error = new Error('Test error');
            captureException(error);
            expect(Sentry.captureException).toHaveBeenCalledWith(error);
        });

        it('should capture exception with context', () => {
            const error = new Error('Test error');
            const context = { userId: '123' };
            captureException(error, context);
            expect(Sentry.withScope).toHaveBeenCalled();
            expect(Sentry.captureException).toHaveBeenCalledWith(error);
        });
    });

    describe('captureMessage', () => {
        it('should capture message', () => {
            captureMessage('Test message');
            expect(Sentry.withScope).toHaveBeenCalled();
            // Since withScope calls callback synchronously in our mock, captureMessage calls inside
            expect(Sentry.captureMessage).toHaveBeenCalledWith('Test message');
        });

        it('should capture message with context', () => {
            captureMessage('Test message', 'warning', { key: 'value' });
            expect(Sentry.withScope).toHaveBeenCalled();
            expect(Sentry.captureMessage).toHaveBeenCalledWith('Test message');
        });
    });

    describe('Context Helpers', () => {
        it('should set user context', () => {
            setUserContext('user-1', 'test@example.com', 'merchant-1');
            expect(Sentry.setUser).toHaveBeenCalledWith({
                id: 'user-1',
                email: 'test@example.com',
                merchantId: 'merchant-1',
            });
        });

        it('should set merchant context', () => {
            setMerchantContext('merchant-1', 'Merchant Name');
            expect(Sentry.setContext).toHaveBeenCalledWith('merchant', {
                id: 'merchant-1',
                name: 'Merchant Name',
            });
        });

        it('should add breadcrumb', () => {
            addBreadcrumb('Navigated', 'navigation', 'info', { from: 'a', to: 'b' });
            expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
                message: 'Navigated',
                category: 'navigation',
                level: 'info',
                data: { from: 'a', to: 'b' },
            });
        });
    });
});
