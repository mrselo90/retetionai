import { describe, expect, it } from "vitest";

import { getSetupProgress } from "../../../shopify-app/app/lib/setupProgress";
import type { ShopifyMerchantOverview } from "../../../shopify-app/app/platform.server";

function createOverview(overrides: Partial<ShopifyMerchantOverview> = {}): ShopifyMerchantOverview {
  return {
    merchant: {
      id: "merchant-1",
      name: "Recete Shop",
      subscription_status: "inactive",
      subscription_plan: null,
      trial_ends_at: null,
    },
    shop: "receteshop.myshopify.com",
    integration: {
      id: "integration-1",
      provider: "shopify",
      status: "pending",
      updated_at: null,
    },
    subscription: {
      plan: null,
      status: "inactive",
      billingProvider: "shopify",
      trialEndsAt: null,
    },
    metrics: {
      totalOrders: 0,
      activeUsers: 0,
      totalProducts: 0,
      responseRate: 0,
    },
    analytics: {
      avgSentiment: 0,
      returnRate: 0,
      preventedReturns: 0,
      totalConversations: 0,
      resolvedConversations: 0,
    },
    settings: {
      notificationPhone: null,
      personaSettings: {},
    },
    integrations: [],
    products: [],
    recentOrders: [],
    ...overrides,
  };
}

describe("getSetupProgress", () => {
  it("returns 1/4 when billing is approved but products are not ready yet", () => {
    const progress = getSetupProgress(
      createOverview({
        merchant: {
          id: "merchant-1",
          name: "Recete Shop",
          subscription_status: "active",
        },
        subscription: {
          plan: "starter",
          status: "active",
          billingProvider: "shopify",
          trialEndsAt: null,
        },
      }),
    );

    expect(progress.completedCount).toBe(1);
    expect(progress.totalSteps).toBe(4);
    expect(progress.hasBilling).toBe(true);
    expect(progress.hasProducts).toBe(false);
    expect(progress.nextStep).toBe("products");
  });

  it("returns 2/4 when billing is approved and at least one product exists", () => {
    const progress = getSetupProgress(
      createOverview({
        merchant: {
          id: "merchant-1",
          name: "Recete Shop",
          subscription_status: "active",
        },
        subscription: {
          plan: "starter",
          status: "active",
          billingProvider: "shopify",
          trialEndsAt: null,
        },
        metrics: {
          totalOrders: 0,
          activeUsers: 0,
          totalProducts: 1,
          responseRate: 0,
        },
        products: [
          {
            id: "product-1",
            name: "Serum",
          },
        ],
      }),
    );

    expect(progress.completedCount).toBe(2);
    expect(progress.productCount).toBe(1);
    expect(progress.hasProducts).toBe(true);
    expect(progress.hasMessagingConfigured).toBe(false);
    expect(progress.nextStep).toBe("messaging");
  });

  it("returns 3/4 after settings are explicitly saved even if bot name is empty", () => {
    const progress = getSetupProgress(
      createOverview({
        merchant: {
          id: "merchant-1",
          name: "Recete Shop",
          subscription_status: "active",
        },
        subscription: {
          plan: "starter",
          status: "active",
          billingProvider: "shopify",
          trialEndsAt: null,
        },
        metrics: {
          totalOrders: 0,
          activeUsers: 0,
          totalProducts: 1,
          responseRate: 0,
        },
        products: [
          {
            id: "product-1",
            name: "Serum",
          },
        ],
        settings: {
          notificationPhone: null,
          personaSettings: {
            onboarding_settings_configured_at: "2026-04-15T18:00:00.000Z",
          },
        },
      }),
    );

    expect(progress.completedCount).toBe(3);
    expect(progress.hasMessagingConfigured).toBe(true);
    expect(progress.nextStep).toBe("orders");
  });

  it("keeps legacy settings detection for existing bot configuration", () => {
    const progress = getSetupProgress(
      createOverview({
        merchant: {
          id: "merchant-1",
          name: "Recete Shop",
          subscription_status: "active",
        },
        subscription: {
          plan: "starter",
          status: "active",
          billingProvider: "shopify",
          trialEndsAt: null,
        },
        metrics: {
          totalOrders: 0,
          activeUsers: 0,
          totalProducts: 1,
          responseRate: 0,
        },
        settings: {
          notificationPhone: null,
          personaSettings: {
            bot_name: "Recete Assistant",
          },
        },
      }),
    );

    expect(progress.hasMessagingConfigured).toBe(true);
    expect(progress.completedCount).toBe(3);
  });

  it("returns 4/4 after the first order is visible", () => {
    const progress = getSetupProgress(
      createOverview({
        merchant: {
          id: "merchant-1",
          name: "Recete Shop",
          subscription_status: "active",
        },
        subscription: {
          plan: "starter",
          status: "active",
          billingProvider: "shopify",
          trialEndsAt: null,
        },
        metrics: {
          totalOrders: 1,
          activeUsers: 0,
          totalProducts: 1,
          responseRate: 0,
        },
        settings: {
          notificationPhone: null,
          personaSettings: {
            onboarding_settings_configured_at: "2026-04-15T18:00:00.000Z",
          },
        },
        products: [
          {
            id: "product-1",
            name: "Serum",
          },
        ],
        recentOrders: [
          {
            id: "order-1",
            external_order_id: "1001",
            status: "fulfilled",
            created_at: "2026-04-15T18:00:00.000Z",
          },
        ],
      }),
    );

    expect(progress.completedCount).toBe(4);
    expect(progress.setupComplete).toBe(true);
    expect(progress.nextStep).toBeNull();
  });
});
