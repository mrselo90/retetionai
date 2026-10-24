import { describe, expect, it } from 'vitest';
import { detectLanguage, detectLanguageDetailed } from './i18n';

/*
 * Short customer messages: the old detector fell back to English for most
 * Turkish and Hungarian messages without special letters, and the reply then
 * came with the unsupported-language notice.
 */
describe('detectLanguageDetailed', () => {
  it.each([
    ['Serumu nasıl kullanmalıyım?', 'tr'],
    ['sabah mi aksam mi', 'tr'],
    ['Kaç damla?', 'tr'],
    ['hamileyim kullanabilir miyim', 'tr'],
    ['Teşekkürler', 'tr'],
    ['Hogyan használjam?', 'hu'],
    ['reggel vagy este?', 'hu'],
    ['Köszönöm!', 'hu'],
    ['mennyi ideig tart', 'hu'],
    ['How often should I use it?', 'en'],
    ['Is it safe during pregnancy?', 'en'],
    ['Wie oft soll ich das benutzen?', 'de'],
  ])('%s → %s', (text, expected) => {
    expect(detectLanguage(text)).toBe(expected);
    expect(detectLanguageDetailed(text).confident).toBe(true);
  });

  it('keeps English "I" as English', () => {
    expect(detectLanguage('I have dry skin, can I use it at night?')).toBe('en');
  });

  it('is not confident about a message with no language signal', () => {
    expect(detectLanguageDetailed('ok').confident).toBe(false);
    expect(detectLanguageDetailed('SPF 50').confident).toBe(false);
  });
});
