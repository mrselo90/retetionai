import { describe, it, expect, vi } from 'vitest';

vi.mock('@recete/shared', () => ({
  getSupabaseServiceClient: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { isOptOutKeyword, recordCustomerOptOut } from './customerOptOut.js';

describe('isOptOutKeyword', () => {
  it.each([
    'STOP',
    'stop',
    ' Stop. ',
    'Unsubscribe',
    'UNSUBSCRIBE',
    'ABONELİKTEN ÇIK',
    'DUR',
    'Durdur!',
    'Abonelikten çık',
    'abmelden',
    'Leiratkozás',
    'ΔΙΑΚΟΠΗ',
  ])('treats "%s" as an opt-out', (text) => {
    expect(isOptOutKeyword(text)).toBe(true);
  });

  it.each([
    'stop the order please',
    'iptal etmek istiyorum',
    'can I stop using it at night?',
    '',
    null,
    undefined,
  ])('does not treat "%s" as an opt-out', (text) => {
    expect(isOptOutKeyword(text as string)).toBe(false);
  });
});

function makeClient(results: { users?: { error: unknown }; tasks?: { error: unknown } }) {
  const calls: Array<{ table: string; update: unknown; eqs: Array<[string, unknown]> }> = [];
  const client = {
    from: vi.fn((table: string) => {
      const call = { table, update: undefined as unknown, eqs: [] as Array<[string, unknown]> };
      calls.push(call);
      const result =
        table === 'users' ? (results.users ?? { error: null }) : (results.tasks ?? { error: null });
      const builder: any = {
        update: vi.fn((value: unknown) => {
          call.update = value;
          return builder;
        }),
        eq: vi.fn((column: string, value: unknown) => {
          call.eqs.push([column, value]);
          return builder;
        }),
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
      };
      return builder;
    }),
  };
  return { client: client as any, calls };
}

describe('recordCustomerOptOut', () => {
  it('sets consent to opt_out for that merchant and cancels pending tasks', async () => {
    const { client, calls } = makeClient({});

    const result = await recordCustomerOptOut(client, {
      merchantId: 'm1',
      userId: 'u1',
      source: 'keyword',
    });

    expect(result.ok).toBe(true);
    expect(calls[0]).toMatchObject({
      table: 'users',
      update: { consent_status: 'opt_out' },
      eqs: [
        ['id', 'u1'],
        ['merchant_id', 'm1'],
      ],
    });
    expect(calls[1]).toMatchObject({
      table: 'scheduled_tasks',
      update: { status: 'cancelled' },
      eqs: [
        ['user_id', 'u1'],
        ['status', 'pending'],
      ],
    });
  });

  it('reports failure and leaves tasks alone when consent cannot be written', async () => {
    const { client, calls } = makeClient({ users: { error: { message: 'boom' } } });

    const result = await recordCustomerOptOut(client, {
      merchantId: 'm1',
      userId: 'u1',
      source: 'ai_intent',
    });

    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it('still succeeds when only task cancellation fails', async () => {
    const { client } = makeClient({ tasks: { error: { message: 'boom' } } });

    const result = await recordCustomerOptOut(client, {
      merchantId: 'm1',
      userId: 'u1',
      source: 'keyword',
    });

    expect(result.ok).toBe(true);
  });
});
