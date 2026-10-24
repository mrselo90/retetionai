export type CosmeticRagProfile = 'ingredients' | 'usage' | 'warnings' | 'specs' | 'default';

/**
 * Minimum cosine similarity for a dense (vector) match, applied in SQL.
 *
 * Calibrated on text-embedding-3-small with packages/api/evals/retrieval: a
 * customer question and the chunk that answers it typically score 0.30-0.56,
 * so the previous per-profile thresholds (0.55-0.65) dropped almost every real
 * match (15% of questions found their evidence; 96% at 0.30). Below 0.30,
 * off-catalogue questions (shipping, returns, discounts) start pulling in
 * unrelated product text as evidence. Rerun the eval before changing this.
 */
export const DENSE_SIMILARITY_FLOOR = 0.3;

export interface RetrievalPolicy {
  profile: CosmeticRagProfile;
  topK: number;
  similarityThreshold: number;
  preferredSectionTypes?: string[];
}

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

export function getPreferredSectionsForProfile(profile: CosmeticRagProfile): string[] | undefined {
  switch (profile) {
    case 'ingredients':
      return ['ingredients', 'active_ingredients', 'claims', 'general'];
    case 'usage':
      return ['usage', 'faq', 'warnings', 'general'];
    case 'warnings':
      return ['warnings', 'usage', 'faq', 'general'];
    case 'specs':
      return ['specs', 'identity', 'claims', 'general'];
    default:
      return undefined;
  }
}

export function getCosmeticRagPolicy(query: string): RetrievalPolicy {
  const q = query.toLocaleLowerCase('tr-TR');

  if (hasAny(q, ['içerik', 'i̇çerik', 'ingredients', 'inci', 'összetev', 'hatóanyag', 'fragrance', 'parfüm', 'illatanyag'])) {
    return {
      profile: 'ingredients',
      topK: 4,
      similarityThreshold: DENSE_SIMILARITY_FLOOR,
      preferredSectionTypes: getPreferredSectionsForProfile('ingredients'),
    };
  }

  if (hasAny(q, ['nasıl kullan', 'nasil kullan', 'kullanım', 'kullanim', 'how to use', 'directions', 'használat', 'alkalmaz'])) {
    return {
      profile: 'usage',
      topK: 5,
      similarityThreshold: DENSE_SIMILARITY_FLOOR,
      preferredSectionTypes: getPreferredSectionsForProfile('usage'),
    };
  }

  if (hasAny(q, ['uyarı', 'uyari', 'warning', 'caution', 'figyelmezt', 'allergy', 'alerji', 'allergia', 'eye', 'göz', 'goz', 'szem'])) {
    return {
      profile: 'warnings',
      topK: 5,
      similarityThreshold: DENSE_SIMILARITY_FLOOR,
      preferredSectionTypes: getPreferredSectionsForProfile('warnings'),
    };
  }

  if (hasAny(q, ['ml', 'gram', 'g ', 'oz', 'spf', 'ph', '%'])) {
    return {
      profile: 'specs',
      topK: 3,
      similarityThreshold: DENSE_SIMILARITY_FLOOR,
      preferredSectionTypes: getPreferredSectionsForProfile('specs'),
    };
  }

  return {
    profile: 'default',
    topK: 5,
    similarityThreshold: DENSE_SIMILARITY_FLOOR,
    preferredSectionTypes: undefined,
  };
}

