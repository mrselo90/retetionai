import { describe, expect, it } from 'vitest';
import { buildAiFallbackMessage, buildUnknownUserMessage } from './whatsappInboundProcessor';

describe('fixed WhatsApp replies follow the customer language', () => {
  it.each([
    ['Merhaba, siparişim nerede?', 'sipariş numaranızı'],
    ['Köszönöm, hol a csomagom?', 'rendelésszámát'], // ö/ü used to read as Turkish
    ['Hallo, wo ist meine Bestellung?', 'Bestellnummer'],
    ['Γεια σας, πού είναι η παραγγελία μου;', 'αριθμό της παραγγελίας'],
    ['Hi, where is my order?', 'order number'],
  ])('unknown sender: %s', (message, expected) => {
    expect(buildUnknownUserMessage(message)).toContain(expected);
  });

  it('the AI-unavailable reply too', () => {
    expect(buildAiFallbackMessage('Hogyan kell használni a krémet?')).toContain('Jelenleg nem tudok segíteni');
    expect(buildAiFallbackMessage('Wie oft soll ich das benutzen?')).toContain('Ich kann Ihnen gerade nicht');
  });
});
