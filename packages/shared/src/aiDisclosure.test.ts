import { describe, expect, it } from 'vitest';
import {
  AI_DISCLOSURE,
  aiDisclosureFor,
  appendAiDisclosure,
  hasAssistantMessagedCustomer,
  withFirstContactAiDisclosure,
} from './aiDisclosure.js';

function clientWith(rows: Array<{ history: unknown }> | null, error: unknown = null) {
  return {
    from: () => ({ select: () => ({ eq: async () => ({ data: rows, error }) }) }),
  } as any;
}

describe('AI disclosure', () => {
  it('has a note for every supported language, each saying it is an AI', () => {
    expect(Object.keys(AI_DISCLOSURE).sort()).toEqual(['de', 'el', 'en', 'hu', 'tr']);
    expect(AI_DISCLOSURE.tr).toContain('yapay zekâ');
    expect(AI_DISCLOSURE.en).toContain('AI assistant');
    expect(AI_DISCLOSURE.hu).toContain('mesterséges intelligencián');
    expect(AI_DISCLOSURE.de).toContain('KI-Assistenten');
    expect(AI_DISCLOSURE.el).toContain('τεχνητής νοημοσύνης');
  });

  it('picks the note by language code, English otherwise', () => {
    expect(aiDisclosureFor('tr-TR')).toBe(AI_DISCLOSURE.tr);
    expect(aiDisclosureFor('HU')).toBe(AI_DISCLOSURE.hu);
    expect(aiDisclosureFor('fr')).toBe(AI_DISCLOSURE.en);
    expect(aiDisclosureFor(null)).toBe(AI_DISCLOSURE.en);
  });

  it('puts the note after the message', () => {
    expect(appendAiDisclosure('Merhaba!\n', 'tr')).toBe(`Merhaba!\n\n${AI_DISCLOSURE.tr}`);
  });
});

describe('first contact', () => {
  it('knows the assistant has messaged a customer from any conversation', async () => {
    const client = clientWith([
      { history: [{ role: 'user', content: 'hi' }] },
      { history: [{ role: 'user', content: 'x' }, { role: 'assistant', content: 'y' }] },
    ]);
    expect(await hasAssistantMessagedCustomer(client, 'u1')).toBe(true);
  });

  it('adds the note to the first message only', async () => {
    const fresh = clientWith([{ history: [{ role: 'user', content: 'Merhaba' }] }]);
    expect(await withFirstContactAiDisclosure(fresh, { userId: 'u1', message: 'Size nasıl yardımcı olabilirim?', language: 'tr' })).toBe(
      `Size nasıl yardımcı olabilirim?\n\n${AI_DISCLOSURE.tr}`,
    );
    const known = clientWith([{ history: [{ role: 'assistant', content: 'Merhaba' }] }]);
    expect(await withFirstContactAiDisclosure(known, { userId: 'u1', message: 'Tabii.', language: 'tr' })).toBe('Tabii.');
  });

  it('adds the note when it cannot tell (better twice than never)', async () => {
    expect(await withFirstContactAiDisclosure(clientWith(null, { message: 'db down' }), { userId: 'u1', message: 'Hi', language: 'en' })).toBe(
      `Hi\n\n${AI_DISCLOSURE.en}`,
    );
  });
});
