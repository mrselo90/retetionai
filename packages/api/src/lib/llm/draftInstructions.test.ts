import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../runtimeModelSettings.js', () => ({
  getDefaultLlmModel: vi.fn(async () => 'test-model'),
}));
vi.mock('../aiUsageEvents.js', () => ({ trackAiUsageEvent: vi.fn(async () => undefined) }));

import { __setOpenAIClientForTests } from '../openaiClient.js';
import { draftProductInstructions, MAX_DRAFTS_PER_REQUEST } from './draftInstructions.js';

let lastRequest: any = null;
function fakeOpenAI(content: string) {
  __setOpenAIClientForTests({
    chat: {
      completions: {
        create: vi.fn(async (req: any) => {
          lastRequest = req;
          return { choices: [{ message: { content } }], usage: { total_tokens: 10 } };
        }),
      },
    },
  } as any);
}

describe('draftProductInstructions', () => {
  beforeEach(() => {
    lastRequest = null;
  });

  it('returns one draft per product, matched by key, with HTML stripped from the input', async () => {
    fakeOpenAI(
      JSON.stringify({
        drafts: [
          {
            key: 'b',
            usage_instructions: 'Redeem at checkout.',
            prevention_tips: '',
            recipe_summary: 'A gift card.',
          },
          {
            key: 'a',
            usage_instructions: 'Wax before first ride.',
            prevention_tips: 'Store dry.',
            recipe_summary: 'A snowboard.',
          },
        ],
      })
    );
    const drafts = await draftProductInstructions('m-1', [
      { key: 'a', title: 'Snowboard', description: '<p>All-mountain <b>board</b></p>' },
      { key: 'b', title: 'Gift Card' },
    ]);
    expect(drafts.map((d) => d.key).sort()).toEqual(['a', 'b']);
    expect(drafts.find((d) => d.key === 'a')?.prevention_tips).toBe('Store dry.');
    const sent = JSON.parse(lastRequest.messages[1].content);
    expect(sent.products[0].description).toBe('All-mountain board');
    expect(lastRequest.response_format).toEqual({ type: 'json_object' });
  });

  it('drops unknown keys, duplicates and empty instructions instead of saving junk', async () => {
    fakeOpenAI(
      JSON.stringify({
        drafts: [
          { key: 'x', usage_instructions: 'not asked for' },
          { key: 'a', usage_instructions: '' },
          { key: 'b', usage_instructions: 'first' },
          { key: 'b', usage_instructions: 'second' },
        ],
      })
    );
    const drafts = await draftProductInstructions('m-1', [
      { key: 'a', title: 'A' },
      { key: 'b', title: 'B' },
    ]);
    expect(drafts).toEqual([
      { key: 'b', usage_instructions: 'first', prevention_tips: '', recipe_summary: '' },
    ]);
  });

  it('returns nothing on invalid JSON', async () => {
    fakeOpenAI('not json');
    expect(await draftProductInstructions('m-1', [{ key: 'a', title: 'A' }])).toEqual([]);
  });

  it(`sends at most ${MAX_DRAFTS_PER_REQUEST} products per call`, async () => {
    fakeOpenAI(JSON.stringify({ drafts: [] }));
    await draftProductInstructions(
      'm-1',
      Array.from({ length: 15 }, (_, i) => ({ key: String(i), title: `P${i}` }))
    );
    expect(JSON.parse(lastRequest.messages[1].content).products).toHaveLength(
      MAX_DRAFTS_PER_REQUEST
    );
  });
});
