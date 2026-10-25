import { describe, expect, it, vi } from 'vitest';

vi.mock('@recete/shared', () => ({ getSupabaseServiceClient: vi.fn() }));

import { countReorders, normalizeImpactDays } from './merchantImpact.js';

const at = (iso: string) => Date.parse(iso);

describe('countReorders', () => {
  const allOrders = [
    { user_id: 'a', created_at: '2026-08-01T10:00:00+00:00' },
    { user_id: 'a', created_at: '2026-10-20T10:00:00.5+00:00' },
    { user_id: 'b', created_at: '2026-09-01T10:00:00+00:00' },
    { user_id: 'b', created_at: '2026-10-21T10:00:00+00:00' },
    { user_id: 'c', created_at: '2026-10-22T10:00:00+00:00' },
  ];
  const windowOrders = allOrders.filter((o) => o.created_at >= '2026-10');

  it('counts repeat buyers and those who heard from Recete before reordering', () => {
    const talked = new Map([
      ['a', at('2026-08-05T10:00:00+00:00')], // before the reorder
      ['b', at('2026-10-23T10:00:00+00:00')], // only after it
      ['c', at('2026-10-01T10:00:00+00:00')], // first order, not a repeat
    ]);
    expect(countReorders(windowOrders, allOrders, talked)).toEqual({ repeatBuyers: 2, afterMessage: 1 });
  });

  it('counts a customer once however many orders they placed', () => {
    const extra = [...windowOrders, { user_id: 'a', created_at: '2026-10-24T10:00:00+00:00' }];
    expect(countReorders(extra, [...allOrders, extra[3]], new Map()).repeatBuyers).toBe(2);
  });

  it('compares timestamps by time, not as strings', () => {
    // As strings "…:00+00:00" sorts before "…:00.5+00:00"; in time they are the same second.
    const orders = [
      { user_id: 'd', created_at: '2026-10-20T10:00:00.5+00:00' },
      { user_id: 'd', created_at: '2026-10-20T10:00:01+00:00' },
    ];
    expect(countReorders([orders[1]], orders, new Map()).repeatBuyers).toBe(1);
    expect(countReorders([orders[0]], orders, new Map()).repeatBuyers).toBe(0);
  });
});

describe('normalizeImpactDays', () => {
  it('accepts the offered windows and defaults to 30', () => {
    expect(normalizeImpactDays('7')).toBe(7);
    expect(normalizeImpactDays('90')).toBe(90);
    expect(normalizeImpactDays('365')).toBe(30);
    expect(normalizeImpactDays(undefined)).toBe(30);
  });
});
