import { describe, expect, it } from 'vitest';
import { planStructuredFactAnswer, detectFactQueryType, huTheName, shortProductName } from './productFactsPlanner';

describe('planStructuredFactAnswer', () => {
  const snapshot = {
    id: 'fact-1',
    productId: 'prod-1',
    productName: 'Vitamin Serum',
    detectedLanguage: 'en',
    facts: {
      ingredients: ['Water', 'Fragrance'],
      active_ingredients: ['Niacinamide'],
      usage_steps: ['Apply to clean skin'],
      frequency: 'Twice daily',
      warnings: ['Avoid contact with eyes'],
      product_identity: { title: 'Vitamin Serum' },
    },
    evidence: [
      { quote: 'Ingredients: Water, Fragrance, Niacinamide', factKey: 'ingredients' },
    ],
  };

  it('answers ingredient presence queries deterministically when the ingredient is listed', () => {
    const planned = planStructuredFactAnswer('Does this contain fragrance?', 'en', [snapshot]);

    expect(planned?.queryType).toBe('ingredient_presence');
    expect(planned?.answer).toContain('Fragrance');
    expect(planned?.answer).toContain('listed');
  });

  it('answers ingredient presence queries deterministically when the ingredient is not listed', () => {
    const planned = planStructuredFactAnswer('Does this contain retinol?', 'en', [snapshot]);

    expect(planned?.queryType).toBe('ingredient_presence');
    expect(planned?.answer).toContain('do not see retinol');
  });
});

describe('detectFactQueryType with non-English words', () => {
  // \\b only knows ASCII letters: "terhesség alatt" used to match "g " as grams,
  // and words starting with é, ö or a Greek letter never matched (textMatch.ts).
  it.each([
    ['Használhatom terhesség alatt?', null],
    ['Bu ürünü hamileyken kullanabilir miyim?', null],
    ['Hány ml?', 'volume'],
    ['50 g mı?', 'volume'],
    ['Milyen összetevők vannak benne?', 'ingredients'],
    ['Ποια είναι τα συστατικά;', 'ingredients'],
    ['Érzékeny bőrre is jó?', 'skin_type'],
    ['Van benne figyelmeztetés?', 'warnings'],
    ['Nasıl kullanılır?', 'usage'],
    ['Is it suitable for oily skin?', 'skin_type'],
  ])('%s → %s', (query, expected) => {
    expect(detectFactQueryType(query)?.queryType ?? null).toBe(expected);
  });
});

describe('frequency questions without a frequency fact', () => {
  it('go to the model instead of a fixed "no clear frequency" answer', () => {
    const snapshot = {
      id: 'f1',
      productId: 'p1',
      productName: 'Test Serum',
      detectedLanguage: 'tr',
      facts: { product_identity: { title: 'Test Serum' }, usage_steps: ['İlk iki hafta günde bir kez kullanın.'] },
      evidence: [],
    };
    expect(planStructuredFactAnswer('Günde kaç kez kullanmalıyım?', 'tr', [snapshot as any])).toBeNull();
  });
});

describe('names in fixed fact answers', () => {
  it('drops the descriptive tail and the size from the name', () => {
    expect(shortProductName('Maruderm %10 Azelaik Asit Solüsyon Serum – Leke ve Kızarıklık Karşıtı Cilt Bakım Serumu 30 ML')).toBe(
      'Maruderm %10 Azelaik Asit Solüsyon Serum',
    );
    expect(shortProductName('Lumea %10 Niasinamid + %1 Çinko Serum 30 ml')).toBe('Lumea %10 Niasinamid + %1 Çinko Serum');
    expect(shortProductName('Gift Card')).toBe('Gift Card');
  });

  it('uses the right Hungarian article', () => {
    expect(huTheName('Lumea Serum')).toBe('A Lumea Serum');
    expect(huTheName('Aqua Vita Krém')).toBe('Az Aqua Vita Krém');
    expect(huTheName('Ölmez Krém')).toBe('Az Ölmez Krém');
  });

  it('answers a volume question in one natural sentence', () => {
    const snapshot = {
      id: 'f1',
      productId: 'p1',
      productName: 'Lumea %10 Niasinamid + %1 Çinko Serum 30 ml',
      detectedLanguage: 'tr',
      facts: { product_identity: { title: 'Lumea %10 Niasinamid + %1 Çinko Serum 30 ml', volume_value: 30, volume_unit: 'ML' } },
      evidence: [],
    };
    expect(planStructuredFactAnswer('Hány ml van benne?', 'hu', [snapshot as any])?.answer).toBe(
      'A Lumea %10 Niasinamid + %1 Çinko Serum kiszerelése 30 ml.',
    );
  });
});

