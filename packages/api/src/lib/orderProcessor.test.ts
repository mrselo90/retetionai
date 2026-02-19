
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processNormalizedEvent } from './orderProcessor.js';
import { getSupabaseServiceClient } from '@recete/shared';
import { scheduleOrderMessages } from './messageScheduler.js';
import { scheduleMessage } from '../queues.js';

// Mock dependencies
vi.mock('@recete/shared', () => ({
  getSupabaseServiceClient: vi.fn(),
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('./messageScheduler.js', () => ({
  scheduleOrderMessages: vi.fn(),
}));

vi.mock('../queues.js', () => ({
  scheduleMessage: vi.fn(),
}));

vi.mock('./encryption.js', () => ({
  encryptPhone: (phone: string) => `encrypted_${phone}`,
}));

describe('processNormalizedEvent - Consent Gate', () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getSupabaseServiceClient as any).mockReturnValue(mockSupabase);
  });

  const baseEvent = {
    merchant_id: 'merchant_123',
    source: 'shopify',
    event_type: 'order_delivered',
    occurred_at: new Date().toISOString(),
    external_order_id: 'order_456',
    customer: {
      phone: '+905551234567',
      name: 'Test Customer',
    },
    order: {
      status: 'delivered',
      delivered_at: new Date().toISOString(),
    },
    items: [
      { external_product_id: 'prod_789', name: 'Test Product' }
    ],
    consent_status: 'pending', // Default
  };

  it('should SCHEDULE messages if user consent is opt_in', async () => {
    // Mock user lookup (found with opt_in)
    mockSupabase.single
      .mockResolvedValueOnce({ data: { id: 'user_123' }, error: null }) // Look up user (found)
      .mockResolvedValueOnce({ data: { id: 'order_123' }, error: null }) // Look up order (found)
      .mockResolvedValueOnce({ data: { consent_status: 'opt_in' }, error: null }); // Look up user consent for scheduling

    await processNormalizedEvent({ ...baseEvent, consent_status: 'opt_in' } as any);

    expect(scheduleOrderMessages).toHaveBeenCalled();
    expect(scheduleMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'welcome',
      to: baseEvent.customer.phone,
    }));
  });

  it('should NOT schedule messages if user consent is opt_out', async () => {
    // Mock user lookup (found with opt_out)
    mockSupabase.single
      .mockResolvedValueOnce({ data: { id: 'user_123' }, error: null }) // Look up user
      .mockResolvedValueOnce({ data: { id: 'order_123' }, error: null }) // Look up order
      .mockResolvedValueOnce({ data: { consent_status: 'opt_out' }, error: null }); // Look up user consent

    await processNormalizedEvent({ ...baseEvent, consent_status: 'opt_out' } as any);

    expect(scheduleOrderMessages).not.toHaveBeenCalled();
    expect(scheduleMessage).not.toHaveBeenCalled();
  });

  it('should NOT schedule messages if user consent is pending', async () => {
    // Mock user lookup (found with pending)
    mockSupabase.single
      .mockResolvedValueOnce({ data: { id: 'user_123' }, error: null }) // Look up user
      .mockResolvedValueOnce({ data: { id: 'order_123' }, error: null }) // Look up order
      .mockResolvedValueOnce({ data: { consent_status: 'pending' }, error: null }); // Look up user consent

    await processNormalizedEvent({ ...baseEvent, consent_status: 'pending' } as any);

    expect(scheduleOrderMessages).not.toHaveBeenCalled();
    expect(scheduleMessage).not.toHaveBeenCalled();
  });
});
