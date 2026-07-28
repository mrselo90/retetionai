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
  it("returns 1/3 when billing is approved but products are not ready yet", () => {
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
    // Setup gates on three required steps (billing, products, messaging);
    // orders and themeEmbed are optional and tracked separately.
    expect(progress.totalSteps).toBe(3);
    expect(progress.hasBilling).toBe(true);
    expect(progress.hasProducts).toBe(false);
    expect(progress.nextStep).toBe("products");
  });

  it("returns 2/3 when billing is approved and at least one product exists", () => {
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

  it("completes setup at 3/3 once messaging is explicitly saved, even if bot name is empty", () => {
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
    expect(progress.setupComplete).toBe(true);
    // All required steps are done, so there is no next required step. Orders is
    // now surfaced as the next optional step instead.
    expect(progress.nextStep).toBeNull();
    expect(progress.nextOptionalStep).toBe("orders");
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

  it("stays complete once the first order is visible, and clears the optional orders step", () => {
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

    // Orders is optional, so completing it does not raise the required count
    // past 3 — it clears the optional queue down to the theme embed step.
    expect(progress.completedCount).toBe(3);
    expect(progress.setupComplete).toBe(true);
    expect(progress.nextStep).toBeNull();
    expect(progress.hasOrders).toBe(true);
    expect(progress.nextOptionalStep).toBe("themeEmbed");
  });
});
