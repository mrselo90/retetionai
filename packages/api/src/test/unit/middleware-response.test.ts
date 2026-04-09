import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { z } from 'zod';
import { validateBody } from '../../middleware/validation.js';
import { requireActiveSubscription } from '../../middleware/billingMiddleware.js';
import { getMultiLangRagFlags, __resetMultiLangRagFlagsForTests } from '../../lib/multiLangRag/config.js';

vi.mock('../../lib/billing.js', () => ({
  isSubscriptionActive: vi.fn(),
}));

import { isSubscriptionActive } from '../../lib/billing.js';

describe('middleware response finalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MULTI_LANG_CHUNK_SHADOW_WRITE;
    __resetMultiLangRagFlagsForTests();
  });

  it('validateBody returns the downstream response on success', async () => {
    const app = new Hono();
    app.post(
      '/',
      validateBody(z.object({ name: z.string().min(1) })),
      (c) => c.json({ ok: true, body: c.get('validatedBody') }),
    );

    const response = await app.request('http://localhost/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Recete' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      body: { name: 'Recete' },
    });
  });

  it('requireActiveSubscription returns the downstream response for active merchants', async () => {
    vi.mocked(isSubscriptionActive).mockResolvedValue(true);

    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('merchantId', 'merchant-1');
      return await next();
    });
    app.use('*', requireActiveSubscription);
    app.get('/', (c) => c.json({ ok: true }));

    const response = await app.request('http://localhost/');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});

describe('multi-lang rag flags', () => {
  beforeEach(() => {
    delete process.env.MULTI_LANG_CHUNK_SHADOW_WRITE;
    __resetMultiLangRagFlagsForTests();
  });

  it('enables chunk shadow writes by default', () => {
    const flags = getMultiLangRagFlags();
    expect(flags.chunkShadowWrite).toBe(true);
  });

  it('allows explicit opt-out for chunk shadow writes', () => {
    process.env.MULTI_LANG_CHUNK_SHADOW_WRITE = 'false';
    __resetMultiLangRagFlagsForTests();

    const flags = getMultiLangRagFlags();
    expect(flags.chunkShadowWrite).toBe(false);
  });
});
