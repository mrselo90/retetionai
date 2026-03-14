import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import type { BillingInterval, PlanType } from "@prisma/client";
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

const SHOPIFY_ADMIN_API_VERSION = "2026-01";
const INTERNAL_EVENT_TYPE_CHAT = "BILLABLE_CHAT";
const INTERNAL_EVENT_TYPE_PHOTO = "PHOTO_ANALYSIS";

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
  shopDomain: string;
  accessToken: string;
  subscriptionLineItemId: string;
  amount: number;
  description: string;
  idempotencyKey: string;
}) {
  const response = await fetch(
    `https://${params.shopDomain}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": params.accessToken,
      },
      body: JSON.stringify({
        query: `#graphql
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
        variables: {
          subscriptionLineItemId: params.subscriptionLineItemId,
          price: {
            amount: params.amount,
            currencyCode: "USD",
          },
          description: params.description,
          idempotencyKey: params.idempotencyKey,
        },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Usage record request failed for ${params.shopDomain} with ${response.status}: ${body}`,
    );
  }

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

async function getOfflineAccessToken(shopDomain: string) {
  const offlineSession = await prisma.session.findFirst({
    where: {
      shop: shopDomain,
      isOnline: false,
    },
    orderBy: {
      expires: "desc",
    },
  });

  if (!offlineSession?.accessToken) {
    throw new Error(`Offline session missing for ${shopDomain}`);
  }

  return offlineSession.accessToken;
}

async function applyUsageEvent(params: {
  shopDomain: string;
  eventType: typeof INTERNAL_EVENT_TYPE_CHAT | typeof INTERNAL_EVENT_TYPE_PHOTO;
  externalEventId: string;
  description?: string;
  quantity?: number;
}) {
  const quantity = Math.max(1, Math.floor(params.quantity ?? 1));
  const shop = await ensureShop(params.shopDomain);
  const snapshotBefore = await getPlanSnapshotByDomain(params.shopDomain);
  const definition = getPlanDefinition(snapshotBefore.planType, snapshotBefore.billingInterval);
  const accessToken =
    params.eventType === INTERNAL_EVENT_TYPE_CHAT ? await getOfflineAccessToken(params.shopDomain) : null;

  const receipt = await prisma.usageEventReceipt.upsert({
    where: {
      shopId_eventType_externalEventId: {
        shopId: shop.id,
        eventType: params.eventType,
        externalEventId: params.externalEventId,
      },
    },
    update: {},
    create: {
      shopId: shop.id,
      eventType: params.eventType,
      externalEventId: params.externalEventId,
      description: params.description ?? null,
      quantity,
    },
  });

  if (receipt.processedAt) {
    return {
      chargedUnits: receipt.chargedUnits,
      usageRecordId: receipt.usageRecordId,
      alreadyProcessed: true,
    };
  }

  if (!receipt.usageApplied) {
    if (params.eventType === INTERNAL_EVENT_TYPE_CHAT) {
      await prisma.usageTracker.update({
        where: { shopId: shop.id },
        data: {
          chatsSentThisMonth: {
            increment: quantity,
          },
        },
      });
    } else {
      await prisma.usageTracker.update({
        where: { shopId: shop.id },
        data: {
          photosAnalyzedCount: {
            increment: quantity,
          },
        },
      });
    }

    await prisma.usageEventReceipt.update({
      where: { id: receipt.id },
      data: {
        usageApplied: true,
      },
    });
  }

  let chargedUnits = 0;
  let usageRecordId: string | null = null;

  if (params.eventType === INTERNAL_EVENT_TYPE_CHAT) {
    const snapshotAfter = await getPlanSnapshotByDomain(params.shopDomain);
    const billableBefore = Math.max(0, snapshotBefore.chatsSentThisMonth - definition.includedChats);
    const billableAfter = Math.max(0, snapshotAfter.chatsSentThisMonth - definition.includedChats);
    chargedUnits = Math.max(0, billableAfter - billableBefore);

    if (chargedUnits > 0) {
      if (!snapshotAfter.subscriptionLineItemId) {
        throw new Error(`Usage billing line item missing for shop ${params.shopDomain}`);
      }

      usageRecordId = await createUsageRecord({
        shopDomain: params.shopDomain,
        accessToken: accessToken!,
        subscriptionLineItemId: snapshotAfter.subscriptionLineItemId,
        amount: Number((definition.overageRate * chargedUnits).toFixed(2)),
        description:
          params.description ??
          `Chat overage (${chargedUnits}) after ${definition.includedChats} included chats`,
        idempotencyKey: `${params.eventType}:${params.externalEventId}`,
      });
    }
  }

  await prisma.usageEventReceipt.update({
    where: { id: receipt.id },
    data: {
      chargedUnits,
      usageRecordId,
      processedAt: new Date(),
    },
  });

  return {
    chargedUnits,
    usageRecordId,
    alreadyProcessed: false,
  };
}

export async function recordBillableChatUsage(params: {
  shopDomain: string;
  externalEventId: string;
  description?: string;
  quantity?: number;
}) {
  return applyUsageEvent({
    shopDomain: params.shopDomain,
    eventType: INTERNAL_EVENT_TYPE_CHAT,
    externalEventId: params.externalEventId,
    description: params.description,
    quantity: params.quantity,
  });
}

export async function recordPhotoAnalysisUsage(params: {
  shopDomain: string;
  externalEventId: string;
  description?: string;
  quantity?: number;
}) {
  return applyUsageEvent({
    shopDomain: params.shopDomain,
    eventType: INTERNAL_EVENT_TYPE_PHOTO,
    externalEventId: params.externalEventId,
    description: params.description,
    quantity: params.quantity,
  });
}

export function getUsageTermsForPlan(planKey: string) {
  if (!isPlanKey(planKey)) {
    throw new Error(`Unknown plan key ${planKey}`);
  }
  return getUsageTerms(planKey);
}
