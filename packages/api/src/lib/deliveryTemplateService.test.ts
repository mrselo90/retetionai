import { describe, expect, it } from 'vitest';
import {
  resolveTemplateLanguage,
  isPositiveReply,
  isNegativeReply,
  buildProductListMessage,
} from './deliveryTemplateService.js';

describe('resolveTemplateLanguage', () => {
  it('returns "hu" for Hungarian locales', () => {
    expect(resolveTemplateLanguage('hu')).toBe('hu');
    expect(resolveTemplateLanguage('hu-HU')).toBe('hu');
    expect(resolveTemplateLanguage('hu_HU')).toBe('hu');
    expect(resolveTemplateLanguage('HU')).toBe('hu');
    expect(resolveTemplateLanguage('HU-hu')).toBe('hu');
  });

  it('returns "en" for English and other locales', () => {
    expect(resolveTemplateLanguage('en')).toBe('en');
    expect(resolveTemplateLanguage('en-US')).toBe('en');
    expect(resolveTemplateLanguage('de')).toBe('en');
    expect(resolveTemplateLanguage('fr-FR')).toBe('en');
    expect(resolveTemplateLanguage('tr')).toBe('en');
  });

  it('returns "en" for undefined/null/empty', () => {
    expect(resolveTemplateLanguage(undefined)).toBe('en');
    expect(resolveTemplateLanguage(null)).toBe('en');
    expect(resolveTemplateLanguage('')).toBe('en');
    expect(resolveTemplateLanguage('  ')).toBe('en');
  });
});

describe('isPositiveReply', () => {
  it('matches English positive replies', () => {
    expect(isPositiveReply('Yes, help me')).toBe(true);
    expect(isPositiveReply('yes help me')).toBe(true);
    expect(isPositiveReply('Yes')).toBe(true);
    expect(isPositiveReply('yes please')).toBe(true);
    expect(isPositiveReply('Help me')).toBe(true);
  });

  it('matches Hungarian positive replies', () => {
    expect(isPositiveReply('Igen, kérem')).toBe(true);
    expect(isPositiveReply('igen kérem')).toBe(true);
    expect(isPositiveReply('Igen')).toBe(true);
    expect(isPositiveReply('kérem')).toBe(true);
  });

  it('handles trailing punctuation', () => {
    expect(isPositiveReply('Yes!')).toBe(true);
    expect(isPositiveReply('Igen.')).toBe(true);
    expect(isPositiveReply('yes, help me!')).toBe(true);
  });

  it('handles whitespace', () => {
    expect(isPositiveReply('  Yes  ')).toBe(true);
    expect(isPositiveReply('  igen, kérem  ')).toBe(true);
  });

  it('rejects non-positive text', () => {
    expect(isPositiveReply('No thanks')).toBe(false);
    expect(isPositiveReply('What is this?')).toBe(false);
    expect(isPositiveReply('Tell me more about product X')).toBe(false);
  });
});

describe('isNegativeReply', () => {
  it('matches English negative replies', () => {
    expect(isNegativeReply('No thanks')).toBe(true);
    expect(isNegativeReply('no, thanks')).toBe(true);
    expect(isNegativeReply('No thank you')).toBe(true);
    expect(isNegativeReply('No')).toBe(true);
  });

  it('matches Hungarian negative replies', () => {
    expect(isNegativeReply('Nem, köszönöm')).toBe(true);
    expect(isNegativeReply('nem köszönöm')).toBe(true);
    expect(isNegativeReply('Nem')).toBe(true);
    expect(isNegativeReply('köszönöm, nem')).toBe(true);
  });

  it('handles trailing punctuation', () => {
    expect(isNegativeReply('No thanks.')).toBe(true);
    expect(isNegativeReply('Nem!')).toBe(true);
  });

  it('handles whitespace', () => {
    expect(isNegativeReply('  No thanks  ')).toBe(true);
    expect(isNegativeReply('  nem, köszönöm  ')).toBe(true);
  });

  it('rejects non-negative text', () => {
    expect(isNegativeReply('Yes, help me')).toBe(false);
    expect(isNegativeReply('I need help')).toBe(false);
  });
});

describe('buildProductListMessage', () => {
  it('builds English product list with multiple products', () => {
    const result = buildProductListMessage(['Product A', 'Product B', 'Product C'], 'en');
    expect(result).toContain('Thanks.');
    expect(result).toContain('1. Product A');
    expect(result).toContain('2. Product B');
    expect(result).toContain('3. Product C');
    expect(result).toContain('Which product would you like help with first?');
  });

  it('builds Hungarian product list with multiple products', () => {
    const result = buildProductListMessage(['Termék A', 'Termék B'], 'hu');
    expect(result).toContain('Köszönöm.');
    expect(result).toContain('1. Termék A');
    expect(result).toContain('2. Termék B');
    expect(result).toContain('Melyik termékkel kapcsolatban szeretnél először segítséget?');
  });

  it('builds message with a single product', () => {
    const result = buildProductListMessage(['Only Product'], 'en');
    expect(result).toContain('1. Only Product');
    expect(result).toContain('Which product would you like help with first?');
  });

  it('handles zero products with English fallback', () => {
    const result = buildProductListMessage([], 'en');
    expect(result).toContain('(no product info available)');
  });

  it('handles zero products with Hungarian fallback', () => {
    const result = buildProductListMessage([], 'hu');
    expect(result).toContain('(nincs termékinfo)');
  });
});
