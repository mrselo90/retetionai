import { describe, expect, it } from 'vitest';
import { planStructuredFactAnswer } from './productFactsPlanner';

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
