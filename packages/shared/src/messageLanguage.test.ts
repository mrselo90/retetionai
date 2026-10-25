import { describe, expect, it } from 'vitest';
import { pickMessageLanguage } from './messageLanguage';

describe('pickMessageLanguage', () => {
  it('uses the saved language first', () => {
    expect(pickMessageLanguage('hu', ['en'])).toBe('hu');
    expect(pickMessageLanguage('el', null)).toBe('el');
  });

  it("falls back to the store's first reply language", () => {
    expect(pickMessageLanguage(undefined, ['de', 'en'])).toBe('de');
    expect(pickMessageLanguage('xx', ['en', 'hu'])).toBe('en');
  });

  it('falls back to Turkish when nothing usable is saved', () => {
    expect(pickMessageLanguage(undefined, [])).toBe('tr');
    expect(pickMessageLanguage(null, ['fr'])).toBe('tr');
    expect(pickMessageLanguage(null, 'en')).toBe('tr');
  });
});
