import { describe, expect, it } from 'vitest';
import { toWhatsAppText } from './whatsappFormat';

describe('toWhatsAppText', () => {
  it('turns Markdown links into bare, clickable URLs', () => {
    expect(toWhatsAppText('Kargonuzu [bu linkten](https://kargo.example.test/takip/T1) takip edebilirsiniz.')).toBe(
      'Kargonuzu bu linkten: https://kargo.example.test/takip/T1 takip edebilirsiniz.',
    );
    expect(toWhatsAppText('[https://track.example.test/T2](https://track.example.test/T2)')).toBe('https://track.example.test/T2');
  });

  it('converts bold and headings to WhatsApp bold', () => {
    expect(toWhatsAppText('### Sabah\n- **Serum:** 2-3 damla\n__Not__')).toBe('*Sabah*\n- *Serum:* 2-3 damla\n*Not*');
  });

  it('leaves plain text, WhatsApp formatting and lone symbols alone', () => {
    const text = '*Akşam:* 2 * 3 = 6, %10 niasinamid, snake_case_name, C# 1001';
    expect(toWhatsAppText(text)).toBe(text);
  });
});
