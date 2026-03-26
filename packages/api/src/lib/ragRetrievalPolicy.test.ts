import { describe, expect, it } from 'vitest';
import { getCosmeticRagPolicy } from './ragRetrievalPolicy.js';

describe('getCosmeticRagPolicy', () => {
  it('classifies usage questions with usage-first sections', () => {
    const policy = getCosmeticRagPolicy('Bu ürün nasıl kullanılır?');

    expect(policy.profile).toBe('usage');
    expect(policy.preferredSectionTypes).toEqual(['usage', 'faq', 'warnings', 'general']);
    expect(policy.similarityThreshold).toBe(0.58);
  });

  it('classifies ingredient questions with ingredient-first sections', () => {
    const policy = getCosmeticRagPolicy('What ingredients does this contain?');

    expect(policy.profile).toBe('ingredients');
    expect(policy.preferredSectionTypes).toEqual(['ingredients', 'active_ingredients', 'claims', 'general']);
  });
});
