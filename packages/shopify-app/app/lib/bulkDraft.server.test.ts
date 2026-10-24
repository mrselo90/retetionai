import { describe, expect, it, vi } from 'vitest';

vi.mock('../db.server', () => ({ default: {} }));
vi.mock('../platform.server', () => ({
  draftMerchantProductInstructions: vi.fn(),
  prepareMerchantProductKnowledge: vi.fn(),
}));
vi.mock('../services/planService.server', () => ({ getPlanSnapshotByDomain: vi.fn() }));
vi.mock('./productCatalog.server', () => ({ fetchFullShopifyCatalog: vi.fn() }));
vi.mock('./productSetup.server', () => ({
  persistProductSetup: vi.fn(),
  getActionErrorMessage: async (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback,
}));

import { createSerialQueue, processBulkDraftItem, runPool, type BulkDraftSteps } from './bulkDraft.server';

const item = {
  shopifyProductId: 'gid://shopify/Product/1',
  title: 'Test Serum',
  handle: 'test-serum',
  descriptionHtml: '<p>Example</p>',
  productType: null,
  vendor: null,
};
const draft = { usage_instructions: 'Apply 2-3 drops.', recipe_summary: '', prevention_tips: '' };

function steps(patch: Partial<BulkDraftSteps> = {}): BulkDraftSteps {
  return {
    draft: vi.fn(async () => draft),
    save: vi.fn(async () => ({ ok: true, productId: 'p1' })),
    prepare: vi.fn(async () => ({})),
    ...patch,
  };
}

describe('processBulkDraftItem', () => {
  it('drafts, saves and prepares the product', async () => {
    const s = steps();
    expect(await processBulkDraftItem(item, s)).toEqual({ status: 'SAVED' });
    expect(s.save).toHaveBeenCalledWith(item, draft);
    expect(s.prepare).toHaveBeenCalledWith('p1');
  });

  it('fails the product when drafting fails or returns nothing', async () => {
    expect(await processBulkDraftItem(item, steps({ draft: async () => { throw new Error('AI unavailable'); } }))).toEqual({
      status: 'FAILED',
      error: 'AI unavailable',
    });
    const empty = await processBulkDraftItem(item, steps({ draft: async () => ({ usage_instructions: ' ' }) }));
    expect(empty.status).toBe('FAILED');
  });

  it('marks the plan limit as skipped, not failed', async () => {
    const outcome = await processBulkDraftItem(
      item,
      steps({ save: async () => ({ ok: false, error: 'Product limit reached for the current plan.' }) })
    );
    expect(outcome).toMatchObject({ status: 'SKIPPED', limitReached: true });
  });

  it('keeps the saved instructions when preparing AI answers fails', async () => {
    const outcome = await processBulkDraftItem(item, steps({ prepare: async () => { throw new Error('502'); } }));
    expect(outcome).toEqual({ status: 'SAVED' });
  });
});

describe('runPool', () => {
  it('runs every task, never more than the concurrency at once', async () => {
    const tasks = Array.from({ length: 10 }, (_, i) => i);
    let running = 0;
    let peak = 0;
    const done: number[] = [];
    await runPool(
      4,
      async () => tasks.shift() ?? null,
      async (task) => {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setTimeout(resolve, 5));
        done.push(task);
        running -= 1;
      }
    );
    expect(done.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(peak).toBe(4);
  });
});

describe('createSerialQueue', () => {
  it('runs calls one at a time, and a failure does not block the next', async () => {
    const serial = createSerialQueue();
    let running = 0;
    let peak = 0;
    const call = (fail = false) =>
      serial(async () => {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setTimeout(resolve, 5));
        running -= 1;
        if (fail) throw new Error('save failed');
        return 'ok';
      });
    const results = await Promise.allSettled([call(), call(true), call()]);
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
    expect(peak).toBe(1);
  });
});
