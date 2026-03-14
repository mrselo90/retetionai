import { Prisma, type BillingInterval, type PlanType } from "@prisma/client";
import prisma from "../db.server";
import {
  comparePlans,
  getPlanDefinition,
} from "./planDefinitions";

type ShopWithUsage = Prisma.ShopGetPayload<{
  include: {
    usageTracker: true;
    products: {
      select: {
        id: true;
      };
    };
  };
}>;

export type PlanSnapshot = {
  shopId: string;
  shopDomain: string;
  planType: PlanType;
  billingInterval: BillingInterval;
  isTrial: boolean;
  subscriptionId: string | null;
  subscriptionLineItemId: string | null;
  recipeCount: number;
  chatsSentThisMonth: number;
  photosAnalyzedCount: number;
  recipesCreatedCount: number;
  includedChats: number;
  recipeLimit: number | null;
  overageRate: number;
};

function getMonthlyUsageWindow(anchor = new Date()) {
  const periodStart = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1, 0, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1, 0, 0, 0, 0));

  return { periodStart, periodEnd };
}

async function ensureUsageTracker(shopId: string, recipeCount = 0) {
  const { periodStart, periodEnd } = getMonthlyUsageWindow();

  return prisma.usageTracker.upsert({
    where: { shopId },
    update: {},
    create: {
      shopId,
      recipesCreatedCount: recipeCount,
      periodStart,
      periodEnd,
    },
  });
}

export async function ensureShop(shopDomain: string) {
  let shop = await prisma.shop.findUnique({
    where: { shopDomain },
  });

  if (!shop) {
    try {
      shop = await prisma.shop.create({
        data: {
          shopDomain,
        },
      });
    } catch (error) {
      // Concurrent embedded requests can race on first install/auth.
      // If another request created the row first, re-read it and continue.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        shop = await prisma.shop.findUnique({
          where: { shopDomain },
        });
      } else {
        throw error;
      }
    }
  }

  if (!shop) {
    throw new Error(`Unable to ensure shop record for ${shopDomain}`);
  }

  await ensureUsageTracker(shop.id);
  return shop;
}

async function resetUsageTrackerIfNeeded(shop: ShopWithUsage) {
  const tracker = shop.usageTracker ?? (await ensureUsageTracker(shop.id, shop.products.length));
  const now = new Date();

  if (tracker.periodEnd > now) {
    if (tracker.recipesCreatedCount !== shop.products.length) {
      return prisma.usageTracker.update({
        where: { shopId: shop.id },
        data: { recipesCreatedCount: shop.products.length },
      });
    }
    return tracker;
  }

  const { periodStart, periodEnd } = getMonthlyUsageWindow(now);
  return prisma.usageTracker.update({
    where: { shopId: shop.id },
    data: {
      chatsSentThisMonth: 0,
      photosAnalyzedCount: 0,
      recipesCreatedCount: shop.products.length,
      periodStart,
      periodEnd,
    },
  });
}

async function loadShopBy(
  where: Prisma.ShopWhereUniqueInput,
): Promise<ShopWithUsage> {
  const shop = await prisma.shop.findUnique({
    where,
    include: {
      usageTracker: true,
      products: {
        select: { id: true },
      },
    },
  });

  if (!shop) {
    throw new Error("Shop not found");
  }

  await resetUsageTrackerIfNeeded(shop);

  const freshShop = await prisma.shop.findUnique({
    where: { id: shop.id },
    include: {
      usageTracker: true,
      products: {
        select: { id: true },
      },
    },
  });

  if (!freshShop) {
    throw new Error("Shop disappeared during plan sync");
  }

  return freshShop;
}

export async function getPlanSnapshotByShopId(shopId: string): Promise<PlanSnapshot> {
  const shop = await loadShopBy({ id: shopId });
  return buildPlanSnapshot(shop);
}

export async function getPlanSnapshotByDomain(shopDomain: string): Promise<PlanSnapshot> {
  const shop = await ensureShop(shopDomain);
  const hydrated = await loadShopBy({ id: shop.id });
  return buildPlanSnapshot(hydrated);
}

function buildPlanSnapshot(shop: ShopWithUsage): PlanSnapshot {
  const tracker = shop.usageTracker;
  if (!tracker) {
    throw new Error(`Usage tracker missing for shop ${shop.shopDomain}`);
  }

  const definition = getPlanDefinition(shop.planType, shop.billingInterval);
  const recipeCount = shop.products.length;

  return {
    shopId: shop.id,
    shopDomain: shop.shopDomain,
    planType: shop.planType,
    billingInterval: shop.billingInterval,
    isTrial: shop.isTrial,
    subscriptionId: shop.subscriptionId ?? null,
    subscriptionLineItemId: shop.subscriptionLineItemId ?? null,
    recipeCount,
    chatsSentThisMonth: tracker.chatsSentThisMonth,
    photosAnalyzedCount: tracker.photosAnalyzedCount,
    recipesCreatedCount: tracker.recipesCreatedCount,
    includedChats: definition.includedChats,
    recipeLimit: definition.recipeLimit,
    overageRate: definition.overageRate,
  };
}

export async function canCreateRecipe(shopId: string) {
  const snapshot = await getPlanSnapshotByShopId(shopId);
  const allowed =
    snapshot.recipeLimit === null || snapshot.recipeCount < snapshot.recipeLimit;

  return {
    allowed,
    currentCount: snapshot.recipeCount,
    limit: snapshot.recipeLimit,
  };
}

export async function canUseAiVision(shopId: string) {
  const snapshot = await getPlanSnapshotByShopId(shopId);
  return getPlanDefinition(snapshot.planType, snapshot.billingInterval).aiVision;
}

export async function getWhatsAppConfig(shopId: string) {
  const snapshot = await getPlanSnapshotByShopId(shopId);
  return getPlanDefinition(snapshot.planType, snapshot.billingInterval).whatsAppConfig;
}

export async function getAnalyticsLevel(shopId: string) {
  const snapshot = await getPlanSnapshotByShopId(shopId);
  return getPlanDefinition(snapshot.planType, snapshot.billingInterval).analyticsLevel;
}

export async function getUpsellStrategy(shopId: string) {
  const snapshot = await getPlanSnapshotByShopId(shopId);
  return getPlanDefinition(snapshot.planType, snapshot.billingInterval).upsellStrategy;
}

export async function registerRecipeProduct(
  shopId: string,
  externalProductId: string,
  title: string,
) {
  await prisma.product.upsert({
    where: {
      shopId_externalProductId: {
        shopId,
        externalProductId,
      },
    },
    update: {
      title,
    },
    create: {
      shopId,
      externalProductId,
      title,
    },
  });

  const recipeCount = await prisma.product.count({ where: { shopId } });
  await prisma.usageTracker.update({
    where: { shopId },
    data: {
      recipesCreatedCount: recipeCount,
    },
  });
}

export async function syncShopBillingState(params: {
  shopDomain: string;
  planType: PlanType;
  billingInterval: BillingInterval;
  subscriptionId?: string | null;
  subscriptionName?: string | null;
  subscriptionLineItemId?: string | null;
  isTrial?: boolean;
  currentPeriodEnd?: Date | null;
}) {
  const shop = await ensureShop(params.shopDomain);

  return prisma.shop.update({
    where: { id: shop.id },
    data: {
      planType: params.planType,
      billingInterval: params.billingInterval,
      subscriptionId: params.subscriptionId ?? null,
      subscriptionName: params.subscriptionName ?? null,
      subscriptionLineItemId: params.subscriptionLineItemId ?? null,
      isTrial: params.isTrial ?? false,
      currentPeriodEnd: params.currentPeriodEnd ?? null,
    },
  });
}

export async function compareShopPlan(shopId: string, requiredPlan: PlanType) {
  const snapshot = await getPlanSnapshotByShopId(shopId);
  return comparePlans(snapshot.planType, requiredPlan);
}
