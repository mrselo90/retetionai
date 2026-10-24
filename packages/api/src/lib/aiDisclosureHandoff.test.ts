import { describe, expect, it } from 'vitest';
import { AI_DISCLOSURE } from '@recete/shared';
import { checkForHumanHandoffRequest } from './guardrails';

/*
 * The AI note (@recete/shared aiDisclosure.ts) tells customers which words
 * reach a person. Those words must trigger the handoff in every language.
 */
describe('AI note handoff phrases', () => {
  it.each(Object.entries(AI_DISCLOSURE))('%s: the quoted phrase asks for a person', (_lang, note) => {
    const phrase = note.match(/["„«]([^"“”»]+)["“”»]/)?.[1];
    expect(phrase).toBeTruthy();
    expect(checkForHumanHandoffRequest(phrase!)).toBe(true);
    expect(checkForHumanHandoffRequest(`Merhaba, ${phrase}`)).toBe(true);
  });
});
