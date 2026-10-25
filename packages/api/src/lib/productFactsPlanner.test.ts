import { describe, expect, it } from 'vitest';
import { planStructuredFactAnswer, detectFactQueryType } from './productFactsPlanner';

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

