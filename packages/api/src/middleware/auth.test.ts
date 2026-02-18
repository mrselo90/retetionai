import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authMiddleware, optionalAuthMiddleware } from './auth.js';
import { getSupabaseServiceClient } from '@recete/shared';
import { hashApiKey } from '@recete/shared';

// Mock dependencies
vi.mock('@recete/shared', () => ({
    getSupabaseServiceClient: vi.fn(),
    isValidApiKeyFormat: vi.fn(),
    hashApiKey: vi.fn(),
}));

vi.mock('../lib/apiKeyManager.js', () => ({
    normalizeApiKeys: vi.fn((keys) => keys),
    getApiKeyByHash: vi.fn(),
    isApiKeyExpired: vi.fn(),
    updateApiKeyLastUsed: vi.fn((keys) => keys),
}));

describe('Auth Middleware', () => {
    let mockContext: any;
    let mockNext: any;
    let mockSupabase: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockNext = vi.fn();
        mockContext = {
            req: {
                header: vi.fn(),
            },
            json: vi.fn(),
            set: vi.fn(),
        };

        mockSupabase = {
            auth: {
                getUser: vi.fn(),
            },
            from: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn(),
            insert: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            contains: vi.fn().mockReturnThis(),
            limit: vi.fn(),
        };

        vi.mocked(getSupabaseServiceClient).mockReturnValue(mockSupabase);
    });

    describe('authMiddleware', () => {
        it('should return 401 if no authorization header', async () => {
            mockContext.req.header.mockReturnValue(undefined);

            await authMiddleware(mockContext, mockNext);

            expect(mockContext.json).toHaveBeenCalledWith(
                { error: 'Unauthorized: Missing authentication' },
                401
            );
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should authenticate with valid JWT', async () => {
            const mockUser = { id: 'user-123', email: 'test@example.com' };
            const mockMerchant = { id: 'user-123' };

            mockContext.req.header.mockReturnValue('Bearer valid-jwt-token');
            mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
            mockSupabase.single.mockResolvedValue({ data: mockMerchant, error: null });

            await authMiddleware(mockContext, mockNext);

            expect(mockContext.set).toHaveBeenCalledWith('merchantId', 'user-123');
            expect(mockContext.set).toHaveBeenCalledWith('authMethod', 'jwt');
            expect(mockNext).toHaveBeenCalled();
        });

        it('should create merchant for first-time OAuth user', async () => {
            const mockUser = {
                id: 'new-user-123',
                email: 'newuser@example.com',
                user_metadata: { full_name: 'New User' },
            };

            mockContext.req.header.mockReturnValue('Bearer valid-jwt-token');
            mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
            mockSupabase.single
                .mockResolvedValueOnce({ data: null, error: null }) // merchant doesn't exist
                .mockResolvedValueOnce({ data: { id: 'new-user-123' }, error: null }); // inserted merchant

            await authMiddleware(mockContext, mockNext);

            expect(mockSupabase.insert).toHaveBeenCalledWith({
                id: 'new-user-123',
                name: 'New User',
                api_keys: [],
            });
            expect(mockContext.set).toHaveBeenCalledWith('merchantId', 'new-user-123');
            expect(mockNext).toHaveBeenCalled();
        });

        it('should handle user metadata variations for OAuth', async () => {
            const mockUser = {
                id: 'user-456',
                email: 'user@example.com',
                user_metadata: { name: 'User Name' }, // 'name' instead of 'full_name'
            };

            mockContext.req.header.mockReturnValue('Bearer valid-jwt-token');
            mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
            mockSupabase.single
                .mockResolvedValueOnce({ data: null, error: null })
                .mockResolvedValueOnce({ data: { id: 'user-456' }, error: null });

            await authMiddleware(mockContext, mockNext);

            expect(mockSupabase.insert).toHaveBeenCalledWith({
                id: 'user-456',
                name: 'User Name',
                api_keys: [],
            });
        });

        it('should use email as fallback name for OAuth user', async () => {
            const mockUser = {
                id: 'user-789',
                email: 'fallback@example.com',
                user_metadata: {},
            };

            mockContext.req.header.mockReturnValue('Bearer valid-jwt-token');
            mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
            mockSupabase.single
                .mockResolvedValueOnce({ data: null, error: null })
                .mockResolvedValueOnce({ data: { id: 'user-789' }, error: null });

            await authMiddleware(mockContext, mockNext);

            expect(mockSupabase.insert).toHaveBeenCalledWith({
                id: 'user-789',
                name: 'fallback@example.com',
                api_keys: [],
            });
        });

        it('should authenticate with valid API key', async () => {
            const { isValidApiKeyFormat } = await import('@recete/shared');
            const { getApiKeyByHash, isApiKeyExpired } = await import('../lib/apiKeyManager.js');

            mockContext.req.header.mockReturnValue('glow_test_1234567890abcdef');
            mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid JWT' } });

            vi.mocked(isValidApiKeyFormat).mockReturnValue(true);
            vi.mocked(hashApiKey).mockReturnValue('hashed-key');
            mockSupabase.limit.mockResolvedValue({
                data: [{ id: 'merchant-123', api_keys: ['hashed-key'] }],
                error: null,
            });
            vi.mocked(getApiKeyByHash).mockReturnValue({
                hash: 'hashed-key',
                created_at: new Date().toISOString(),
                expires_at: null,
                last_used_at: null
            });
            vi.mocked(isApiKeyExpired).mockReturnValue(false);

            await authMiddleware(mockContext, mockNext);

            expect(mockContext.set).toHaveBeenCalledWith('merchantId', 'merchant-123');
            expect(mockContext.set).toHaveBeenCalledWith('authMethod', 'api_key');
            expect(mockNext).toHaveBeenCalled();
        });

        it('should return 401 for invalid API key format', async () => {
            const { isValidApiKeyFormat } = await import('@recete/shared');

            mockContext.req.header.mockReturnValue('invalid-key');
            mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid JWT' } });
            vi.mocked(isValidApiKeyFormat).mockReturnValue(false);

            await authMiddleware(mockContext, mockNext);

            expect(mockContext.json).toHaveBeenCalledWith(
                { error: 'Unauthorized: Invalid token or API key' },
                401
            );
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should return 401 for expired API key', async () => {
            const { isValidApiKeyFormat } = await import('@recete/shared');
            const { getApiKeyByHash, isApiKeyExpired } = await import('../lib/apiKeyManager.js');

            mockContext.req.header.mockReturnValue('glow_test_1234567890abcdef');
            mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid JWT' } });

            vi.mocked(isValidApiKeyFormat).mockReturnValue(true);
            vi.mocked(hashApiKey).mockReturnValue('hashed-key');
            mockSupabase.limit.mockResolvedValue({
                data: [{ id: 'merchant-123', api_keys: ['hashed-key'] }],
                error: null,
            });
            vi.mocked(getApiKeyByHash).mockReturnValue({
                hash: 'hashed-key',
                created_at: new Date().toISOString(),
                expires_at: null,
                last_used_at: null
            });
            vi.mocked(isApiKeyExpired).mockReturnValue(true); // expired

            await authMiddleware(mockContext, mockNext);

            expect(mockContext.json).toHaveBeenCalledWith(
                { error: 'Unauthorized: Invalid token or API key' },
                401
            );
        });

        it('should extract Bearer token correctly', async () => {
            const mockUser = { id: 'user-123', email: 'test@example.com' };
            const mockMerchant = { id: 'user-123' };

            mockContext.req.header.mockReturnValue('Bearer jwt-token-here');
            mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
            mockSupabase.single.mockResolvedValue({ data: mockMerchant, error: null });

            await authMiddleware(mockContext, mockNext);

            expect(mockSupabase.auth.getUser).toHaveBeenCalledWith('jwt-token-here');
            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('optionalAuthMiddleware', () => {
        it('should proceed without auth if no header provided', async () => {
            mockContext.req.header.mockReturnValue(undefined);

            await optionalAuthMiddleware(mockContext, mockNext);

            expect(mockContext.set).not.toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalled();
        });

        it('should set merchant context if valid JWT provided', async () => {
            const mockUser = { id: 'user-123', email: 'test@example.com' };
            const mockMerchant = { id: 'user-123' };

            mockContext.req.header.mockReturnValue('Bearer valid-jwt-token');
            mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
            mockSupabase.single.mockResolvedValue({ data: mockMerchant, error: null });

            await optionalAuthMiddleware(mockContext, mockNext);

            expect(mockContext.set).toHaveBeenCalledWith('merchantId', 'user-123');
            expect(mockContext.set).toHaveBeenCalledWith('authMethod', 'jwt');
            expect(mockNext).toHaveBeenCalled();
        });

        it('should proceed without auth if invalid token provided', async () => {
            mockContext.req.header.mockReturnValue('Bearer invalid-token');
            mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid' } });

            await optionalAuthMiddleware(mockContext, mockNext);

            expect(mockContext.set).not.toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalled();
        });

        it('should set merchant context if valid API key provided', async () => {
            const { isValidApiKeyFormat } = await import('@recete/shared');
            const { getApiKeyByHash, isApiKeyExpired } = await import('../lib/apiKeyManager.js');

            mockContext.req.header.mockReturnValue('glow_test_1234567890abcdef');
            mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid JWT' } });

            vi.mocked(isValidApiKeyFormat).mockReturnValue(true);
            vi.mocked(hashApiKey).mockReturnValue('hashed-key');
            mockSupabase.limit.mockResolvedValue({
                data: [{ id: 'merchant-456', api_keys: ['hashed-key'] }],
                error: null,
            });
            vi.mocked(getApiKeyByHash).mockReturnValue({
                hash: 'hashed-key',
                created_at: new Date().toISOString(),
                expires_at: null,
                last_used_at: null
            });
            vi.mocked(isApiKeyExpired).mockReturnValue(false);

            await optionalAuthMiddleware(mockContext, mockNext);

            expect(mockContext.set).toHaveBeenCalledWith('merchantId', 'merchant-456');
            expect(mockContext.set).toHaveBeenCalledWith('authMethod', 'api_key');
            expect(mockNext).toHaveBeenCalled();
        });
    });
});
