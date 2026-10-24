
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processNormalizedEvent } from './orderProcessor.js';
import { getSupabaseServiceClient } from '@recete/shared';
import { cancelOrderMessages, scheduleOrderMessages } from './messageScheduler.js';
import { queueDeliveryFallback } from './deliveryTiming.js';
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
  cancelOrderMessages: vi.fn(async () => ({ cancelled: 2 })),
}));

vi.mock('./deliveryTiming.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./deliveryTiming.js')>()),
  queueDeliveryFallback: vi.fn(async () => ({ queued: true })),
}));

vi.mock('../queues.js', () => ({
  scheduleMessage: vi.fn(),
}));

vi.mock('./encryption.js', () => ({
  encryptPhone: (phone: string) => `encrypted_${phone}`,
}));

vi.mock('./deliveryTemplateService.js', () => ({
  sendDeliveryTemplate: vi.fn(),
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
    expect(scheduleMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'welcome',
        to: baseEvent.customer.phone,
      }),
      expect.stringContaining('welcome-')
    );
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

describe('processNormalizedEvent - delivery timing', () => {
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
    // Answers a test didn't use would leak into the next one.
    mockSupabase.single.mockReset();
    (getSupabaseServiceClient as any).mockReturnValue(mockSupabase);
  });

  const event = (eventType: string, order: Record<string, unknown>) => ({
    merchant_id: 'merchant_123',
    source: 'shopify',
    event_type: eventType,
    occurred_at: new Date().toISOString(),
    external_order_id: 'order_456',
    customer: { phone: '+905551234567', name: 'Test Customer' },
    order,
    items: [{ external_product_id: 'prod_789', name: 'Test Product' }],
  });
  const existingOrder = (status: string) => {
    mockSupabase.single
      .mockResolvedValueOnce({ data: { id: 'user_123' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'order_123', status }, error: null })
      .mockResolvedValueOnce({ data: { consent_status: 'opt_in' }, error: null });
  };

  it('shipping queues the delivery fallback and sends nothing yet', async () => {
    existingOrder('created');
    await processNormalizedEvent(event('order_shipped', { status: 'fulfilled', shipped_at: new Date().toISOString() }) as any);

    expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'shipped' }));
    expect(queueDeliveryFallback).toHaveBeenCalledTimes(1);
    expect(scheduleOrderMessages).not.toHaveBeenCalled();
    expect(scheduleMessage).not.toHaveBeenCalled();
  });

  it('a second delivered event (the fallback after the carrier) starts nothing again', async () => {
    existingOrder('delivered');
    await processNormalizedEvent(
      event('order_delivered', { status: 'delivered', delivered_at: new Date().toISOString(), delivery_source: 'estimated' }) as any
    );

    expect(scheduleOrderMessages).not.toHaveBeenCalled();
    expect(scheduleMessage).not.toHaveBeenCalled();
  });

  it('never delivers a cancelled order', async () => {
    existingOrder('cancelled');
    await processNormalizedEvent(
      event('order_delivered', { status: 'delivered', delivered_at: new Date().toISOString(), delivery_source: 'estimated' }) as any
    );

    expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled' }));
    expect(scheduleOrderMessages).not.toHaveBeenCalled();
  });

  it('a late shipped event keeps a delivered order delivered', async () => {
    existingOrder('delivered');
    await processNormalizedEvent(event('order_shipped', { status: 'fulfilled' }) as any);

    expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'delivered' }));
    expect(queueDeliveryFallback).not.toHaveBeenCalled();
  });

  it('cancelling drops the scheduled messages', async () => {
    existingOrder('shipped');
    await processNormalizedEvent(event('order_cancelled', { status: 'paid' }) as any);

    expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled' }));
    expect(cancelOrderMessages).toHaveBeenCalledWith('order_123', 'merchant_123');
  });

  it('the carrier delivery of a shipped order starts the post-delivery flow', async () => {
    existingOrder('shipped');
    await processNormalizedEvent(
      event('order_delivered', { status: 'delivered', delivered_at: new Date().toISOString(), delivery_source: 'carrier' }) as any
    );

    expect(scheduleOrderMessages).toHaveBeenCalledTimes(1);
    expect(scheduleMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'welcome' }), 'welcome-order_123');
  });
});

