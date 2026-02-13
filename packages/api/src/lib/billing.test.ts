import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    getMerchantSubscription,
    getPlanLimits,
    updateMerchantSubscription,
    isMerchantOnTrial,
    isSubscriptionActive,
    getAvailablePlans,
    type SubscriptionInfo,
    type PlanLimits,
} from './billing.js';
import { getSupabaseServiceClient } from '@glowguide/shared';
import * as cache from './cache.js';

// Mock dependencies
vi.mock('@glowguide/shared', () => ({
    getSupabaseServiceClient: vi.fn(),
    logger: {
        error: vi.fn(),
    },
}));

vi.mock('./cache.js', () => ({
    getCachedPlanLimits: vi.fn(),
    setCachedPlanLimits: vi.fn(),
    invalidatePlanLimitsCache: vi.fn(),
}));

describe('Billing Module', () => {
    const mockMerchantId = 'merchant-123';
    let mockSupabase: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockSupabase = {
            from: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn(),
            update: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
        };

        vi.mocked(getSupabaseServiceClient).mockReturnValue(mockSupabase);
    });

    describe('getMerchantSubscription', () => {
        it('should return subscription info for valid merchant', async () => {
            const mockMerchant = {
                subscription_plan: 'pro',
                subscription_status: 'active',
                subscription_id: 'sub-123',
                billing_provider: 'shopify',
                trial_ends_at: '2026-03-01T00:00:00Z',
                subscription_starts_at: '2026-02-01T00:00:00Z',
                subscription_ends_at: '2026-03-01T00:00:00Z',
                cancelled_at: null,
                billing_email: 'billing@example.com',
            };

            mockSupabase.single.mockResolvedValue({ data: mockMerchant, error: null });

            const result = await getMerchantSubscription(mockMerchantId);

            expect(result).toEqual({
                plan: 'pro',
                status: 'active',
                subscriptionId: 'sub-123',
                billingProvider: 'shopify',
                trialEndsAt: new Date('2026-03-01T00:00:00Z'),
                subscriptionStartsAt: new Date('2026-02-01T00:00:00Z'),
                subscriptionEndsAt: new Date('2026-03-01T00:00:00Z'),
                cancelledAt: undefined,
                billingEmail: 'billing@example.com',
            });
        });

        it('should return null for non-existent merchant', async () => {
            mockSupabase.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

            const result = await getMerchantSubscription(mockMerchantId);

            expect(result).toBeNull();
        });

        it('should handle missing optional fields', async () => {
            const mockMerchant = {
                subscription_plan: 'free',
                subscription_status: 'active',
                subscription_id: null,
                billing_provider: null,
                trial_ends_at: null,
                subscription_starts_at: null,
                subscription_ends_at: null,
                cancelled_at: null,
                billing_email: null,
            };

            mockSupabase.single.mockResolvedValue({ data: mockMerchant, error: null });

            const result = await getMerchantSubscription(mockMerchantId);

            expect(result).toEqual({
                plan: 'free',
                status: 'active',
                subscriptionId: undefined,
                billingProvider: 'shopify', // default
                trialEndsAt: undefined,
                subscriptionStartsAt: undefined,
                subscriptionEndsAt: undefined,
                cancelledAt: undefined,
                billingEmail: undefined,
            });
        });
    });

    describe('getPlanLimits', () => {
        const mockLimits: PlanLimits = {
            messages_per_month: 10000,
            api_calls_per_hour: 100,
            products_limit: 50,
            storage_gb: 5,
            support_level: 'email',
        };

        it('should return cached plan limits if available', async () => {
            vi.mocked(cache.getCachedPlanLimits).mockResolvedValue(mockLimits);

            const result = await getPlanLimits(mockMerchantId);

            expect(result).toEqual(mockLimits);
            expect(mockSupabase.from).not.toHaveBeenCalled();
        });

        it('should fetch and cache plan limits if not cached', async () => {
            vi.mocked(cache.getCachedPlanLimits).mockResolvedValue(null);

            mockSupabase.single
                .mockResolvedValueOnce({ data: { subscription_plan: 'pro' }, error: null })
                .mockResolvedValueOnce({ data: { features: mockLimits }, error: null });

            const result = await getPlanLimits(mockMerchantId);

            expect(result).toEqual(mockLimits);
            expect(cache.setCachedPlanLimits).toHaveBeenCalledWith(mockMerchantId, mockLimits, 1800);
        });

        it('should return null if merchant not found', async () => {
            vi.mocked(cache.getCachedPlanLimits).mockResolvedValue(null);
            mockSupabase.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

            const result = await getPlanLimits(mockMerchantId);

            expect(result).toBeNull();
        });

        it('should return null if plan not found', async () => {
            vi.mocked(cache.getCachedPlanLimits).mockResolvedValue(null);

            mockSupabase.single
                .mockResolvedValueOnce({ data: { subscription_plan: 'pro' }, error: null })
                .mockResolvedValueOnce({ data: null, error: { message: 'Plan not found' } });

            const result = await getPlanLimits(mockMerchantId);

            expect(result).toBeNull();
        });
    });

    describe('updateMerchantSubscription', () => {
        it('should update subscription successfully', async () => {
            mockSupabase.update.mockReturnThis();
            mockSupabase.eq.mockResolvedValue({ error: null });

            const updates: Partial<SubscriptionInfo> = {
                plan: 'pro',
                status: 'active',
                subscriptionId: 'sub-new',
            };

            const result = await updateMerchantSubscription(mockMerchantId, updates);

            expect(result).toBe(true);
            expect(mockSupabase.update).toHaveBeenCalledWith({
                subscription_plan: 'pro',
                subscription_status: 'active',
                subscription_id: 'sub-new',
            });
        });

        it('should invalidate cache when plan changes', async () => {
            mockSupabase.eq.mockResolvedValue({ error: null });

            await updateMerchantSubscription(mockMerchantId, { plan: 'enterprise' });

            expect(cache.invalidatePlanLimitsCache).toHaveBeenCalledWith(mockMerchantId);
        });

        it('should not invalidate cache when plan does not change', async () => {
            mockSupabase.eq.mockResolvedValue({ error: null });

            await updateMerchantSubscription(mockMerchantId, { status: 'active' });

            expect(cache.invalidatePlanLimitsCache).not.toHaveBeenCalled();
        });

        it('should handle update errors', async () => {
            mockSupabase.eq.mockResolvedValue({ error: { message: 'Update failed' } });

            const result = await updateMerchantSubscription(mockMerchantId, { plan: 'pro' });

            expect(result).toBe(false);
        });

        it('should convert dates to ISO strings', async () => {
            mockSupabase.eq.mockResolvedValue({ error: null });

            const trialEndsAt = new Date('2026-03-01');
            await updateMerchantSubscription(mockMerchantId, { trialEndsAt });

            expect(mockSupabase.update).toHaveBeenCalledWith({
                trial_ends_at: trialEndsAt.toISOString(),
            });
        });
    });

    describe('isMerchantOnTrial', () => {
        it('should return true for active trial', async () => {
            const futureDate = new Date(Date.now() + 86400000); // tomorrow
            mockSupabase.single.mockResolvedValue({
                data: {
                    subscription_plan: 'pro',
                    subscription_status: 'trial',
                    trial_ends_at: futureDate.toISOString(),
                    subscription_id: null,
                    billing_provider: 'shopify',
                    subscription_starts_at: null,
                    subscription_ends_at: null,
                    cancelled_at: null,
                    billing_email: null,
                },
                error: null,
            });

            const result = await isMerchantOnTrial(mockMerchantId);

            expect(result).toBe(true);
        });

        it('should return false for expired trial', async () => {
            const pastDate = new Date(Date.now() - 86400000); // yesterday
            mockSupabase.single.mockResolvedValue({
                data: {
                    subscription_plan: 'pro',
                    subscription_status: 'trial',
                    trial_ends_at: pastDate.toISOString(),
                    subscription_id: null,
                    billing_provider: 'shopify',
                    subscription_starts_at: null,
                    subscription_ends_at: null,
                    cancelled_at: null,
                    billing_email: null,
                },
                error: null,
            });

            const result = await isMerchantOnTrial(mockMerchantId);

            expect(result).toBe(false);
        });

        it('should return false for non-trial status', async () => {
            mockSupabase.single.mockResolvedValue({
                data: {
                    subscription_plan: 'pro',
                    subscription_status: 'active',
                    trial_ends_at: null,
                    subscription_id: 'sub-123',
                    billing_provider: 'shopify',
                    subscription_starts_at: null,
                    subscription_ends_at: null,
                    cancelled_at: null,
                    billing_email: null,
                },
                error: null,
            });

            const result = await isMerchantOnTrial(mockMerchantId);

            expect(result).toBe(false);
        });

        it('should return false if subscription not found', async () => {
            mockSupabase.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

            const result = await isMerchantOnTrial(mockMerchantId);

            expect(result).toBe(false);
        });
    });

    describe('isSubscriptionActive', () => {
        it('should return true for active subscription', async () => {
            mockSupabase.single.mockResolvedValue({
                data: {
                    subscription_plan: 'pro',
                    subscription_status: 'active',
                    subscription_id: 'sub-123',
                    billing_provider: 'shopify',
                    trial_ends_at: null,
                    subscription_starts_at: null,
                    subscription_ends_at: null,
                    cancelled_at: null,
                    billing_email: null,
                },
                error: null,
            });

            const result = await isSubscriptionActive(mockMerchantId);

            expect(result).toBe(true);
        });

        it('should return true for trial subscription', async () => {
            mockSupabase.single.mockResolvedValue({
                data: {
                    subscription_plan: 'pro',
                    subscription_status: 'trial',
                    subscription_id: null,
                    billing_provider: 'shopify',
                    trial_ends_at: new Date(Date.now() + 86400000).toISOString(),
                    subscription_starts_at: null,
                    subscription_ends_at: null,
                    cancelled_at: null,
                    billing_email: null,
                },
                error: null,
            });

            const result = await isSubscriptionActive(mockMerchantId);

            expect(result).toBe(true);
        });

        it('should return false for cancelled subscription', async () => {
            mockSupabase.single.mockResolvedValue({
                data: {
                    subscription_plan: 'pro',
                    subscription_status: 'cancelled',
                    subscription_id: 'sub-123',
                    billing_provider: 'shopify',
                    trial_ends_at: null,
                    subscription_starts_at: null,
                    subscription_ends_at: null,
                    cancelled_at: new Date().toISOString(),
                    billing_email: null,
                },
                error: null,
            });

            const result = await isSubscriptionActive(mockMerchantId);

            expect(result).toBe(false);
        });

        it('should return false if subscription not found', async () => {
            mockSupabase.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

            const result = await isSubscriptionActive(mockMerchantId);

            expect(result).toBe(false);
        });
    });

    describe('getAvailablePlans', () => {
        it('should return list of active plans', async () => {
            const mockPlans = [
                {
                    id: 'free',
                    name: 'Free',
                    description: 'Free plan',
                    price_monthly: '0',
                    price_yearly: '0',
                    currency: 'USD',
                    features: {
                        messages_per_month: 100,
                        api_calls_per_hour: 10,
                        products_limit: 5,
                        storage_gb: 1,
                        support_level: 'community',
                    },
                },
                {
                    id: 'pro',
                    name: 'Pro',
                    description: 'Pro plan',
                    price_monthly: '99',
                    price_yearly: '999',
                    currency: 'USD',
                    features: {
                        messages_per_month: 10000,
                        api_calls_per_hour: 100,
                        products_limit: 50,
                        storage_gb: 5,
                        support_level: 'email',
                    },
                },
            ];

            mockSupabase.order.mockResolvedValue({ data: mockPlans, error: null });

            const result = await getAvailablePlans();

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                id: 'free',
                name: 'Free',
                description: 'Free plan',
                priceMonthly: 0,
                priceYearly: 0,
                currency: 'USD',
                features: mockPlans[0].features,
            });
            expect(result[1].priceMonthly).toBe(99);
        });

        it('should return empty array on error', async () => {
            mockSupabase.order.mockResolvedValue({ data: null, error: { message: 'DB error' } });

            const result = await getAvailablePlans();

            expect(result).toEqual([]);
        });

        it('should handle missing description and yearly price', async () => {
            const mockPlans = [
                {
                    id: 'basic',
                    name: 'Basic',
                    description: null,
                    price_monthly: '49',
                    price_yearly: null,
                    currency: null,
                    features: {
                        messages_per_month: 1000,
                        api_calls_per_hour: 50,
                        products_limit: 10,
                        storage_gb: 2,
                        support_level: 'email',
                    },
                },
            ];

            mockSupabase.order.mockResolvedValue({ data: mockPlans, error: null });

            const result = await getAvailablePlans();

            expect(result[0]).toEqual({
                id: 'basic',
                name: 'Basic',
                description: '',
                priceMonthly: 49,
                priceYearly: 0,
                currency: 'USD',
                features: mockPlans[0].features,
            });
        });
    });
});
