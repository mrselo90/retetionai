import { describe, expect, it } from 'vitest';
import { buildBuiltInWelcome } from './welcomeMessage';

describe('buildBuiltInWelcome', () => {
  const serum = { product_name: 'Serum A', usage_instructions: 'Two drops at night.', recipe_summary: 'Night use' };

  it("lists the products' usage notes in the chosen language", () => {
    expect(buildBuiltInWelcome('en', [serum])).toBe(
      'Hello! Thank you for your order. Here are the usage instructions for your products:\n\n' +
        '**Serum A**\nTwo drops at night.\nSummary: Night use' +
        '\n\nDo you have any questions about usage?'
    );
    expect(buildBuiltInWelcome('de', [serum])).toContain('Zusammenfassung: Night use');
  });

  it('names an unnamed product in the same language', () => {
    expect(buildBuiltInWelcome('hu', [{ usage_instructions: 'x' }])).toContain('**Termék**');
  });

  it('thanks the customer when no product has notes', () => {
    expect(buildBuiltInWelcome('tr', [])).toBe(
      'Merhaba! Siparişiniz için teşekkür ederiz. Size nasıl yardımcı olabilirim?'
    );
  });
});
