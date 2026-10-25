import { describe, expect, it } from 'vitest';
import { stripStockClosing } from './stockClosing';

describe('stripStockClosing', () => {
  it.each([
    ['Göz çevresine uygulamayın. Başka bir sorunuz olursa yardımcı olmaktan memnuniyet duyarım.', 'Göz çevresine uygulamayın.'],
    ['Buzdolabında saklayın. Başka bir konuda yardımcı olabilir miyim?', 'Buzdolabında saklayın.'],
    ['Alkol içermez. Eğer başka bir konuda yardımcı olmamı isterseniz, lütfen bana bildirin.', 'Alkol içermez.'],
    ['Sabah kullanın. Herhangi bir şeyde yardımcı olabilirim.', 'Sabah kullanın.'],
    ['Illatanyagmentes. Ha bármilyen további kérdése van, kérem, jelezze! 😊', 'Illatanyagmentes.'],
    ['Apply at night. Let me know if you have any other questions.', 'Apply at night.'],
    ['Täglich anwenden. Wenn Sie weitere Fragen haben, helfe ich gerne.', 'Täglich anwenden.'],
  ])('drops the stock offer: %s', (input, expected) => {
    expect(stripStockClosing(input)).toBe(expected);
  });

  it.each([
    "Your order was cancelled. If you have any questions or need further assistance, please feel free to reach out to the store's team.",
    'Ne használja terhesség alatt. Ha további kérdése van, forduljon orvosához vagy gyógyszerészéhez.',
    'Kullanmayı bırakın. Başka bir sorunuz olursa mağaza ekibimiz yardımcı olabilir.',
    'If you have any concerns, consult your doctor.',
    'Tek cümlelik cevap, başka sorunuz olursa yazın.',
    'Sabah ve akşam kullanın.',
  ])('keeps it: %s', (input) => {
    expect(stripStockClosing(input)).toBe(input);
  });
});
