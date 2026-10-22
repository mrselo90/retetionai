import { describe, expect, it } from 'vitest';
import type {
  MerchantProduct,
  MerchantProductInstruction,
  ShopifyCatalogProduct,
} from '../platform.server';
import {
  buildWorkspaceRows,
  countWorkspaceRows,
  filterWorkspaceRows,
  paginateRows,
  parseProductTab,
} from './productWorkspace';

function catalog(count: number): ShopifyCatalogProduct[] {
  return Array.from({ length: count }, (_, index) => ({
    id: String(1000 + index),
    title: index === 0 ? 'Hydrating Serum' : `Product ${index}`,
    handle: `product-${index}`,
    status: 'ACTIVE',
    vendor: index === 1 ? 'Acme Labs' : 'Recete',
  }));
}

function local(externalId: string, chunkCount: number): MerchantProduct {
  return { id: `local-${externalId}`, external_id: externalId, chunkCount } as MerchantProduct;
}

function instruction(externalId: string): MerchantProductInstruction {
  return {
    product_id: `local-${externalId}`,
    external_id: externalId,
    usage_instructions: 'Apply twice a day.',
  } as MerchantProductInstruction;
}

describe('buildWorkspaceRows', () => {
  it('derives each product state from Recete records', () => {
    const rows = buildWorkspaceRows(
      catalog(3),
      [local('1001', 0), local('1002', 4)],
      [instruction('1001'), instruction('1002')],
      [],
      ['en'],
      true
    );

    expect(rows.map((row) => [row.shopify.id, row.state])).toEqual([
      ['1000', 'needs_setup'],
      ['1001', 'needs_ai_answers'],
      ['1002', 'ready'],
    ]);
  });

  it('keeps every catalog product, beyond the old 100 cap', () => {
    const rows = buildWorkspaceRows(catalog(640), [], [], [], ['en'], true);
    expect(rows).toHaveLength(640);
  });
});

describe('filters and paging', () => {
  const rows = buildWorkspaceRows(
    catalog(60),
    [local('1001', 0), local('1002', 4), local('1003', 2)],
    [instruction('1001'), instruction('1002'), instruction('1003')],
    [],
    ['en'],
    true
  );

  it('counts every tab', () => {
    expect(countWorkspaceRows(rows)).toEqual({
      all: 60,
      needs_setup: 57,
      needs_ai_answers: 1,
      ready: 2,
    });
  });

  it('filters by tab and searches title, handle and vendor', () => {
    expect(filterWorkspaceRows(rows, { tab: 'ready', query: '' })).toHaveLength(2);
    expect(
      filterWorkspaceRows(rows, { tab: 'all', query: 'serum' }).map((row) => row.shopify.id)
    ).toEqual(['1000']);
    expect(
      filterWorkspaceRows(rows, { tab: 'all', query: 'ACME' }).map((row) => row.shopify.id)
    ).toEqual(['1001']);
    expect(
      filterWorkspaceRows(rows, { tab: 'all', query: 'product-59' }).map((row) => row.shopify.id)
    ).toEqual(['1059']);
    expect(filterWorkspaceRows(rows, { tab: 'ready', query: 'serum' })).toHaveLength(0);
  });

  it('pages and clamps out-of-range pages', () => {
    expect(paginateRows(rows, 1, 25)).toMatchObject({
      page: 1,
      pageCount: 3,
      hasPrevious: false,
      hasNext: true,
    });
    const last = paginateRows(rows, 3, 25);
    expect(last.items).toHaveLength(10);
    expect(last.hasNext).toBe(false);
    expect(paginateRows(rows, 99, 25).page).toBe(3);
    expect(paginateRows(rows, 0, 25).page).toBe(1);
    expect(paginateRows([], 1, 25)).toMatchObject({ items: [], page: 1, pageCount: 1 });
  });

  it('falls back to the All tab for unknown values', () => {
    expect(parseProductTab('ready')).toBe('ready');
    expect(parseProductTab('archived')).toBe('all');
    expect(parseProductTab(null)).toBe('all');
  });
});
