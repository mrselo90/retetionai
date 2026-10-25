import { describe, expect, it } from 'vitest';
import { buildBuiltInWelcome, shortUsageNote } from './welcomeMessage';

describe('buildBuiltInWelcome', () => {
  const serum = {
    product_name: 'Serum A',
    usage_instructions: 'Two drops at night on clean skin. Avoid the eye area.',
    recipe_summary: 'Night use',
  };
  const cream = { product_name: 'Cream B', usage_instructions: 'Apply in the morning.', recipe_summary: null };

  it("gives one product's full usage notes", () => {
    expect(buildBuiltInWelcome('en', [serum])).toBe(
      'Hello! Thank you for your order. Here are the usage instructions for your products:\n\n' +
        '**Serum A**\nTwo drops at night on clean skin. Avoid the eye area.\nSummary: Night use' +
        '\n\nDo you have any questions about usage?'
    );
  });

  it('gives several products one short line each and an invitation to ask', () => {
    expect(buildBuiltInWelcome('en', [serum, cream])).toBe(
      'Hello! Thank you for your order. A short note on each of your products:\n\n' +
        '• **Serum A**: Two drops at night on clean skin.\n' +
        '• **Cream B**: Apply in the morning.' +
        "\n\nYou can ask me anything about using them, and I'll send you the details."
    );
    expect(buildBuiltInWelcome('tr', [serum, cream])).toContain('her şeyi bana sorabilirsiniz');
  });

  it('lists five products and counts the rest', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ product_name: `P${i}`, usage_instructions: 'Use daily.' }));
    const text = buildBuiltInWelcome('hu', many);
    expect(text.match(/^• /gm)).toHaveLength(5);
    expect(text).toContain('…és még 2 termék');
  });

  it('names an unnamed product in the same language', () => {
    expect(buildBuiltInWelcome('de', [{ usage_instructions: 'x' }])).toContain('**Produkt**');
  });

  it('thanks the customer when no product has notes', () => {
    expect(buildBuiltInWelcome('tr', [])).toBe(
      'Merhaba! Siparişiniz için teşekkür ederiz. Size nasıl yardımcı olabilirim?'
    );
  });
});

describe('shortUsageNote', () => {
  it('keeps the first sentence', () => {
    expect(shortUsageNote('Shake well.\nApply twice a day.')).toBe('Shake well.');
  });

  it('cuts a long sentence at a word', () => {
    const long = `Apply ${'a thin layer evenly '.repeat(12)}today`;
    const note = shortUsageNote(long);
    expect(note.length).toBeLessThanOrEqual(141);
    expect(note.endsWith('…')).toBe(true);
    expect(note).not.toMatch(/\s…$/);
  });
});
