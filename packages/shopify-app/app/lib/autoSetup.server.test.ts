import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../platform.server', () => ({
  fetchMerchantMultiLangSettings: vi.fn(),
  updateMerchantSettings: vi.fn(),
}));
vi.mock('./bulkDraft.server', () => ({ startBulkDraft: vi.fn() }));
vi.mock('./productCatalog.server', () => ({ fetchFullShopifyCatalog: vi.fn() }));
vi.mock('./persistMessagingSetup', () => ({ persistMessagingSetup: vi.fn() }));

import { fetchMerchantMultiLangSettings, updateMerchantSettings } from '../platform.server';
import type { ShopifyMerchantOverview } from '../platform.server';
import { startBulkDraft } from './bulkDraft.server';
import { fetchFullShopifyCatalog } from './productCatalog.server';
import { persistMessagingSetup } from './persistMessagingSetup';
import { languageForCountry, planAutoSetup, runAutoSetupIfDue } from './autoSetup.server';

function overview(
  persona: Record<string, string> = {},
  totalProducts = 0
): ShopifyMerchantOverview {
  return {
    merchant: { id: 'm1', name: 'Black Eagle' },
    shop: 'shop.myshopify.com',
    metrics: { totalOrders: 0, activeUsers: 0, totalProducts, responseRate: 0 },
    settings: { personaSettings: persona },
    products: [],
  } as unknown as ShopifyMerchantOverview;
}

describe('planAutoSetup', () => {
  it('waits for the plan approval', () => {
    expect(planAutoSetup(overview(), false)).toBeNull();
  });

  it('runs once', () => {
    expect(planAutoSetup(overview({ auto_setup_at: '2026-10-25T10:00:00Z' }), true)).toBeNull();
  });

  it('does only the steps the merchant has not done', () => {
    expect(planAutoSetup(overview(), true)).toEqual({ messaging: true, products: true });
    expect(planAutoSetup(overview({ bot_name: 'Ada' }, 3), true)).toEqual({ messaging: false, products: false });
    expect(planAutoSetup(overview({ onboarding_settings_configured_at: 'x' }), true)).toEqual({
      messaging: false,
      products: true,
    });
  });
});

describe('languageForCountry', () => {
  it('maps the supported countries and defaults to English', () => {
    expect(languageForCountry('TR')).toBe('tr');
    expect(languageForCountry('hu')).toBe('hu');
    expect(languageForCountry('AT')).toBe('de');
    expect(languageForCountry('CY')).toBe('el');
    expect(languageForCountry('FR')).toBe('en');
    expect(languageForCountry(null)).toBe('en');
  });
});

describe('runAutoSetupIfDue', () => {
  const graphql = vi.fn(async () =>
    Response.json({ data: { shop: { name: 'Black Eagle Store', billingAddress: { countryCodeV2: 'HU' } } } })
  );
  const request = new Request('https://app.test/app/bootstrap');

  beforeEach(() => {
    vi.mocked(updateMerchantSettings).mockReset().mockResolvedValue({});
    vi.mocked(fetchMerchantMultiLangSettings)
      .mockReset()
      .mockResolvedValue({ settings: { enabled_langs: ['en'] } } as never);
    vi.mocked(persistMessagingSetup).mockReset().mockResolvedValue({ ok: true, message: '' });
    vi.mocked(fetchFullShopifyCatalog)
      .mockReset()
      .mockResolvedValue({ products: [{ id: 'p1' }, { id: 'p2' }] } as never);
    vi.mocked(startBulkDraft).mockReset().mockResolvedValue({ ok: true } as never);
  });

  it('records the run, fills the welcome step from the store and drafts the products', async () => {
    const started = await runAutoSetupIfDue({
      request,
      shop: 'shop.myshopify.com',
      overview: overview(),
      billingApproved: true,
      graphql,
    });

    expect(started).toBe(true);
    expect(updateMerchantSettings).toHaveBeenCalledWith(request, {
      persona_settings: { auto_setup_at: expect.any(String) },
    });
    expect(persistMessagingSetup).toHaveBeenCalledWith(request, 'shop.myshopify.com', {
      botName: 'Black Eagle Store',
      defaultLanguage: 'hu',
      enabledLangs: ['hu', 'en'],
    });
    expect(startBulkDraft).toHaveBeenCalledWith({
      request,
      shopDomain: 'shop.myshopify.com',
      shopifyProductIds: ['p1', 'p2'],
    });
  });

  it('leaves a store that set itself up alone', async () => {
    const started = await runAutoSetupIfDue({
      request,
      shop: 'shop.myshopify.com',
      overview: overview({ bot_name: 'Ada' }, 4),
      billingApproved: true,
      graphql,
    });

    expect(started).toBe(true);
    expect(persistMessagingSetup).not.toHaveBeenCalled();
    expect(startBulkDraft).not.toHaveBeenCalled();
  });

  it('does nothing before the plan is approved', async () => {
    const started = await runAutoSetupIfDue({
      request,
      shop: 'shop.myshopify.com',
      overview: overview(),
      billingApproved: false,
      graphql,
    });

    expect(started).toBe(false);
    expect(updateMerchantSettings).not.toHaveBeenCalled();
  });
});
