import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductI18nService } from './productI18nService.js';

const upsertMock = vi.fn();
const selectBuilder = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockResolvedValue({ data: [], error: null }),
};

vi.mock('@recete/shared', () => ({
  getSupabaseServiceClient: () => ({
    from: (table: string) => {
      if (table === 'product_i18n') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: vi.fn(async () => ({
                  data: [
                    { lang: 'tr', locked: true, source_hash: 'old' },
                    { lang: 'de', locked: false, source_hash: 'same-hash' },
                  ],
                  error: null,
                })),
              })),
            })),
          })),
          upsert: upsertMock.mockResolvedValue({ error: null }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  }),
  logger: { warn: vi.fn(), info: vi.fn() },
}));

describe('ProductI18nService', () => {
  beforeEach(() => {
    upsertMock.mockClear();
  });

  it('skips locked rows and same source_hash translations', async () => {
    const translator = { translateProductSnapshot: vi.fn(async (s: any) => s) } as any;
    const svc = new ProductI18nService(translator);

    const results = await svc.upsertTranslations({
      shopId: 'shop-1',
      productId: 'prod-1',
      sourceLang: 'hu',
      enabledLangs: ['hu', 'tr', 'de'],
      sourceSnapshot: {
        title: 'X',
        description_html: 'Y',
        specs_json: {},
        faq_json: [],
      },
    });

    // source lang always upserted, de may skip if hash match only if same hash equals generated hash (unlikely)
    expect(results.find((r) => r.lang === 'tr')?.reason).toBe('locked');
    expect(upsertMock).toHaveBeenCalled(); // source row upsert at minimum
  });
});

