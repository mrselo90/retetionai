export type CosmeticRagProfile = 'ingredients' | 'usage' | 'warnings' | 'specs' | 'default';

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
      similarityThreshold: 0.62,
      preferredSectionTypes: getPreferredSectionsForProfile('ingredients'),
    };
  }

  if (hasAny(q, ['nasıl kullan', 'nasil kullan', 'kullanım', 'kullanim', 'how to use', 'directions', 'használat', 'alkalmaz'])) {
    return {
      profile: 'usage',
      topK: 5,
      similarityThreshold: 0.58,
      preferredSectionTypes: getPreferredSectionsForProfile('usage'),
    };
  }

  if (hasAny(q, ['uyarı', 'uyari', 'warning', 'caution', 'figyelmezt', 'allergy', 'alerji', 'allergia', 'eye', 'göz', 'goz', 'szem'])) {
    return {
      profile: 'warnings',
      topK: 5,
      similarityThreshold: 0.55,
      preferredSectionTypes: getPreferredSectionsForProfile('warnings'),
    };
  }

  if (hasAny(q, ['ml', 'gram', 'g ', 'oz', 'spf', 'ph', '%'])) {
    return {
      profile: 'specs',
      topK: 3,
      similarityThreshold: 0.65,
      preferredSectionTypes: getPreferredSectionsForProfile('specs'),
    };
  }

  return {
    profile: 'default',
    topK: 5,
    similarityThreshold: 0.6,
    preferredSectionTypes: undefined,
  };
}

