import { describe, it, expect } from 'vitest';
import { buildSourceSnapshotHash, detectSourceLanguageFromText } from './utils.js';

describe('multiLangRag utils', () => {
  it('produces same source_hash for whitespace/key-order equivalent snapshots', () => {
    const a = buildSourceSnapshotHash({
      title: ' Test Product ',
      description_html: '<p>Hello   world</p>',
      specs_json: { b: '2', a: '1' },
      faq_json: [{ answer: 'A', question: 'Q' }],
    });
    const b = buildSourceSnapshotHash({
      title: 'Test   Product',
      description_html: '<p>Hello world</p>',
      specs_json: { a: '1', b: '2' },
      faq_json: [{ question: 'Q', answer: 'A' }],
    });
    expect(a).toBe(b);
  });
});


describe('detectSourceLanguageFromText', () => {
  it.each([
    // ö/ü without ő/ű used to read as Turkish
    ['Ez a krém érzékeny bőrre is alkalmas. Használat után öblítse le alaposan.', 'hu'],
    ['Temizlenmiş cilde sabah ve akşam 2-3 damla uygulayın. Göz çevresine sürmeyin.', 'tr'],
    ['Εφαρμόστε το προϊόν στο καθαρό δέρμα το πρωί και το βράδυ.', 'el'],
    ['Täglich auf die gereinigte Haut auftragen und sanft einmassieren.', 'de'],
    ['Apply to clean skin in the morning and evening, then use sunscreen.', 'en'],
  ])('%s → %s', (text, expected) => {
    expect(detectSourceLanguageFromText(text, 'en')).toBe(expected);
  });

  it('falls back when the text gives no signal', () => {
    expect(detectSourceLanguageFromText('SPF 50+ 50 ml', 'tr')).toBe('tr');
    expect(detectSourceLanguageFromText('', 'hu')).toBe('hu');
  });
});
