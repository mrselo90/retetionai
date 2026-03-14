import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import type { BillingInterval, PlanType, WebhookProcessingStatus } from "@prisma/client";
import prisma from "../db.server";
import {
  getPlanDefinition,
  getPlanDefinitionByKey,
  getUsageTerms,
  isPlanKey,
  type PlanKey,
} from "./planDefinitions";
import {
  ensureShop,
  getPlanSnapshotByDomain,
  syncShopBillingState,
} from "./planService.server";

type ActiveSubscriptionPricingDetails =
  | {
      interval: "EVERY_30_DAYS" | "ANNUAL";
      price: { amount: number; currencyCode: string };
    }
  | {
      cappedAmount: { amount: number; currencyCode: string };
      terms: string;
    };

type ActiveSubscription = {
  id: string;
  name: string;
  status: "ACTIVE" | "CANCELLED" | "PENDING" | "DECLINED" | "EXPIRED" | "FROZEN" | "ACCEPTED";
  trialDays: number;
  currentPeriodEnd: string;
  lineItems: Array<{
    id: string;
    plan: {
      pricingDetails: ActiveSubscriptionPricingDetails;
    };
  }>;
};

type CurrentInstallationResponse = {
  data?: {
    currentAppInstallation?: {
      activeSubscriptions: ActiveSubscription[];
    };
  };
};

function isUsagePricingDetails(
  details: ActiveSubscriptionPricingDetails,
): details is { cappedAmount: { amount: number; currencyCode: string }; terms: string } {
  return "cappedAmount" in details;
}

function mapPricingIntervalToBillingInterval(
  interval: "EVERY_30_DAYS" | "ANNUAL",
): BillingInterval {
  return interval === "ANNUAL" ? "ANNUAL" : "MONTHLY";
}

function mapPlanNameToPlanType(planName: string): PlanType {
  const lower = planName.toLowerCase();
  if (lower.includes("starter")) return "STARTER";
  if (lower.includes("growth")) return "GROWTH";
  return "PRO";
}

export async function syncShopAfterAuth(shopDomain: string) {
  await ensureShop(shopDomain);
}

export async function syncRequestedPlanSelection(shopDomain: string, planKey: PlanKey) {
  const definition = getPlanDefinitionByKey(planKey);
  return syncShopBillingState({
    shopDomain,
    planType: definition.planType,
    billingInterval: definition.billingInterval,
    subscriptionName: definition.label,
    isTrial: true,
  });
}

export async function syncShopSubscriptionFromAdmin(
  shopDomain: string,
  admin: AdminApiContext,
) {
  const response = await admin.graphql(
    `#graphql
      query CurrentInstallationSubscriptions {
        currentAppInstallation {
          activeSubscriptions {
            id
            name
            status
            trialDays
            currentPeriodEnd
            lineItems {
              id
              plan {
                pricingDetails {
                  ... on AppRecurringPricing {
                    interval
                    price {
                      amount
                      currencyCode
                    }
                  }
                  ... on AppUsagePricing {
                    cappedAmount {
                      amount
                      currencyCode
                    }
                    terms
                  }
                }
              }
            }
          }
        }
      }`,
  );
  const payload = (await response.json()) as CurrentInstallationResponse;
  const activeSubscriptions =
    payload.data?.currentAppInstallation?.activeSubscriptions ?? [];
  const activeSubscription = activeSubscriptions.find((subscription) =>
    subscription.status === "ACTIVE" || subscription.status === "ACCEPTED",
  );

  if (!activeSubscription) {
    return syncShopBillingState({
      shopDomain,
      planType: "STARTER",
      billingInterval: "MONTHLY",
      subscriptionId: null,
      subscriptionName: null,
      subscriptionLineItemId: null,
      isTrial: true,
      currentPeriodEnd: null,
    });
  }

  const recurringLineItem = activeSubscription.lineItems.find(
    (lineItem) => !isUsagePricingDetails(lineItem.plan.pricingDetails),
  );
  const usageLineItem = activeSubscription.lineItems.find((lineItem) =>
    isUsagePricingDetails(lineItem.plan.pricingDetails),
  );

  const recurringPricing = recurringLineItem?.plan.pricingDetails;
  if (!recurringPricing || isUsagePricingDetails(recurringPricing)) {
    throw new Error(`Missing recurring line item for shop ${shopDomain}`);
  }

  return syncShopBillingState({
    shopDomain,
    planType: mapPlanNameToPlanType(activeSubscription.name),
    billingInterval: mapPricingIntervalToBillingInterval(recurringPricing.interval),
    subscriptionId: activeSubscription.id,
    subscriptionName: activeSubscription.name,
    subscriptionLineItemId: usageLineItem?.id ?? null,
    isTrial: activeSubscription.trialDays > 0,
    currentPeriodEnd: activeSubscription.currentPeriodEnd
      ? new Date(activeSubscription.currentPeriodEnd)
      : null,
  });
}

export async function syncShopUninstalled(shopDomain: string) {
  const shop = await ensureShop(shopDomain);
  await prisma.shop.update({
    where: { id: shop.id },
    data: {
      subscriptionId: null,
      subscriptionName: null,
      subscriptionLineItemId: null,
      isTrial: false,
    },
  });
}

async function createUsageRecord(params: {
  admin: AdminApiContext;
  subscriptionLineItemId: string;
  amount: number;
  description: string;
  idempotencyKey: string;
}) {
  const response = await params.admin.graphql(
    `#graphql
      mutation CreateUsageRecord(
        $subscriptionLineItemId: ID!
        $price: MoneyInput!
        $description: String!
        $idempotencyKey: String!
      ) {
        appUsageRecordCreate(
          subscriptionLineItemId: $subscriptionLineItemId
          price: $price
          description: $description
          idempotencyKey: $idempotencyKey
        ) {
          appUsageRecord {
            id
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        subscriptionLineItemId: params.subscriptionLineItemId,
        price: {
          amount: params.amount,
          currencyCode: "USD",
        },
        description: params.description,
        idempotencyKey: params.idempotencyKey,
      },
    },
  );

  const payload = (await response.json()) as {
    data?: {
      appUsageRecordCreate?: {
        appUsageRecord?: {
          id: string;
        };
        userErrors?: Array<{ field?: string[]; message: string }>;
      };
    };
  };

  const userErrors = payload.data?.appUsageRecordCreate?.userErrors ?? [];
  if (userErrors.length > 0) {
    throw new Error(userErrors.map((error) => error.message).join(", "));
  }

  return payload.data?.appUsageRecordCreate?.appUsageRecord?.id ?? null;
}

export async function processOrderFulfillmentUsage(params: {
  shopDomain: string;
  webhookId: string;
  topic: string;
  externalOrderId: string;
  admin: AdminApiContext;
}) {
  const shop = await ensureShop(params.shopDomain);
  const snapshot = await getPlanSnapshotByDomain(params.shopDomain);

  const receipt = await prisma.webhookReceipt.upsert({
    where: { webhookId: params.webhookId },
    update: {},
    create: {
      webhookId: params.webhookId,
      shopId: shop.id,
      topic: params.topic,
      externalReference: params.externalOrderId,
      status: "PENDING" satisfies WebhookProcessingStatus,
    },
  });

  if (receipt.status === "COMPLETED") {
    return;
  }

  if (!receipt.chatIncrementApplied) {
    await prisma.usageTracker.update({
      where: { shopId: shop.id },
      data: {
        chatsSentThisMonth: {
          increment: 1,
        },
      },
    });

    await prisma.webhookReceipt.update({
      where: { id: receipt.id },
      data: {
        chatIncrementApplied: true,
      },
    });
  }

  const refreshedSnapshot = await getPlanSnapshotByDomain(params.shopDomain);
  const definition = getPlanDefinition(
    refreshedSnapshot.planType,
    refreshedSnapshot.billingInterval,
  );

  if (
    refreshedSnapshot.chatsSentThisMonth > definition.includedChats &&
    !receipt.usageChargeApplied
  ) {
    if (!refreshedSnapshot.subscriptionLineItemId) {
      throw new Error(`Usage billing line item missing for shop ${params.shopDomain}`);
    }

    await createUsageRecord({
      admin: params.admin,
      subscriptionLineItemId: refreshedSnapshot.subscriptionLineItemId,
      amount: definition.overageRate,
      description: `Overage chat for order ${params.externalOrderId}`,
      idempotencyKey: `${params.webhookId}:${params.externalOrderId}`,
    });

    await prisma.webhookReceipt.update({
      where: { id: receipt.id },
      data: {
        usageChargeApplied: true,
      },
    });
  }

  await prisma.webhookReceipt.update({
    where: { id: receipt.id },
    data: {
      status: "COMPLETED",
      processedAt: new Date(),
    },
  });
}

export function getUsageTermsForPlan(planKey: string) {
  if (!isPlanKey(planKey)) {
    throw new Error(`Unknown plan key ${planKey}`);
  }
  return getUsageTerms(planKey);
}
