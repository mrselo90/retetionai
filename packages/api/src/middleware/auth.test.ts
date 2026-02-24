import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authMiddleware, optionalAuthMiddleware } from './auth.js';
import { getSupabaseServiceClient } from '@recete/shared';

vi.mock('@recete/shared', () => ({
  getSupabaseServiceClient: vi.fn(),
}));

describe('Auth Middleware', () => {
  let mockContext: any;
  let mockNext: any;
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.INTERNAL_SERVICE_SECRET;

    mockNext = vi.fn();
    mockContext = {
      req: {
        header: vi.fn(),
        path: '/api/products',
      },
      json: vi.fn(),
      set: vi.fn(),
    };

    mockSupabase = {
      auth: { getUser: vi.fn() },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };

    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockSupabase);
  });

  it('returns 401 if no auth header', async () => {
    mockContext.req.header.mockReturnValue(undefined);

    await authMiddleware(mockContext, mockNext);

    expect(mockContext.json).toHaveBeenCalledWith(
      { error: 'Unauthorized: Missing authentication' },
      401
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('authenticates valid JWT', async () => {
    mockContext.req.header.mockImplementation((name: string) =>
      name === 'Authorization' ? 'Bearer valid-jwt-token' : undefined
    );
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'merchant-1', email: 'x@test.com' } },
      error: null,
    });
    mockSupabase.maybeSingle.mockResolvedValue({ data: { id: 'merchant-1' }, error: null });

    await authMiddleware(mockContext, mockNext);

    expect(mockContext.set).toHaveBeenCalledWith('merchantId', 'merchant-1');
    expect(mockContext.set).toHaveBeenCalledWith('authMethod', 'jwt');
    expect(mockNext).toHaveBeenCalled();
  });

  it('creates merchant record for first-time OAuth user', async () => {
    mockContext.req.header.mockImplementation((name: string) =>
      name === 'Authorization' ? 'Bearer valid-jwt-token' : undefined
    );
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'merchant-2', email: 'new@test.com', user_metadata: { full_name: 'New Merchant' } } },
      error: null,
    });
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'merchant-2' }, error: null });

    await authMiddleware(mockContext, mockNext);

    expect(mockSupabase.insert).toHaveBeenCalledWith({
      id: 'merchant-2',
      name: 'New Merchant',
    });
    expect(mockNext).toHaveBeenCalled();
  });

  it('supports internal-secret auth on eval route', async () => {
    process.env.INTERNAL_SERVICE_SECRET = 'secret-123';
    mockContext.req.path = '/api/test/rag/answer';
    mockContext.req.header.mockImplementation((name: string) => {
      if (name === 'X-Internal-Secret') return 'secret-123';
      if (name === 'X-Internal-Merchant-Id') return 'merchant-eval';
      return undefined;
    });

    await authMiddleware(mockContext, mockNext);

    expect(mockContext.set).toHaveBeenCalledWith('merchantId', 'merchant-eval');
    expect(mockContext.set).toHaveBeenCalledWith('authMethod', 'internal');
    expect(mockNext).toHaveBeenCalled();
  });

  it('optionalAuth proceeds without auth', async () => {
    mockContext.req.header.mockReturnValue(undefined);

    await optionalAuthMiddleware(mockContext, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });
});
