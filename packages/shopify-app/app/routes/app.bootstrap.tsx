import type { LoaderFunctionArgs } from 'react-router';

import { authenticateEmbeddedAdmin } from '../lib/embeddedAuth.server';
import { isBillingReady } from '../lib/billingStatus';
import {
  fetchMerchantOverviewFromRequest,
  fetchWhatsAppConnection,
  syncShopInstall,
} from '../platform.server';
import prisma from '../db.server';
/**
 * For the setup checklist: whether connecting a WhatsApp number is available
 * yet, and whether this store has connected one. null when it can't be read,
 * which leaves the step out rather than blocking setup on a failed call.
 */
async function loadSetupWhatsApp(request: Request) {
  try {
    const status = await fetchWhatsAppConnection(request);
    return { enabled: status.available, connected: status.status === 'connected' };
  } catch {
    return null;
  }
}

function buildPendingOverview(shop: string) {
  const merchantName = shop.replace('.myshopify.com', '');
  return {
    merchant: {
      id: `pending:${shop}`,
      name: merchantName,
      subscription_status: 'pending',
      subscription_plan: null,
      trial_ends_at: null,
    },
    shop,
    integration: {
      id: `pending:${shop}`,
      provider: 'shopify',
      status: 'pending',
    },
    subscription: {
      plan: null,
      status: 'pending',
      billingProvider: null,
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
  };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const requestUrl = new URL(request.url);
  const { billing, session } = await authenticateEmbeddedAdmin(request);
  // Any active subscription counts. Plans are sold through Shopify Managed
  // Pricing, whose subscription names ("Growth", ...) never matched the
  // "growth-monthly" keys this filtered on, and development stores only get
  // test charges, which isTest:false dropped. Both made a paid plan read as
  // "No plan" right after approval. Real stores cannot hold test charges.
  const billingState = await billing.check({ isTest: true });

  try {
    const overview = await fetchMerchantOverviewFromRequest(request);
    const shop = requestUrl.searchParams.get('shop') || overview.shop;
    const billingApproved =
      billingState.hasActivePayment || isBillingReady(overview.merchant.subscription_status);
    const shopRecord = await prisma.shop.findUnique({
      where: { shopDomain: session.shop },
      select: { themeEmbedEnabled: true },
    });

    const activeSubscription = billingState.appSubscriptions.find(
      (s) => String(s.status).toUpperCase() === 'ACTIVE'
    );
    const activePlanName = activeSubscription?.name || overview.merchant.subscription_plan || null;

    return Response.json({
      merchantName: overview.merchant.name || shop.replace('.myshopify.com', ''),
      overview,
      shop,
      subscriptionStatus: billingApproved
        ? 'active'
        : overview.merchant.subscription_status || 'inactive',
      billingApproved,
      themeEmbedEnabled: shopRecord?.themeEmbedEnabled ?? false,
      activePlanName,
      whatsapp: await loadSetupWhatsApp(request),
    });
  } catch (error) {
    // Attempt install-sync repair when the platform doesn't know about this shop yet.
    // 404 = merchant/integration not found; 403 = shop domain not in integrations table.
    if (
      error instanceof Response &&
      (error.status === 404 || error.status === 403) &&
      session.shop &&
      session.accessToken
    ) {
      try {
        await syncShopInstall({
          shop: session.shop,
          accessToken: session.accessToken,
          scope: session.scope ?? null,
        });

        const overview = await fetchMerchantOverviewFromRequest(request);
        const shop = requestUrl.searchParams.get('shop') || overview.shop;
        const billingApproved =
          billingState.hasActivePayment || isBillingReady(overview.merchant.subscription_status);
        const shopRecord2 = await prisma.shop.findUnique({
          where: { shopDomain: session.shop },
          select: { themeEmbedEnabled: true },
        });
        const activeSubscription2 = billingState.appSubscriptions.find(
          (s) => String(s.status).toUpperCase() === 'ACTIVE'
        );
        const activePlanName2 =
          activeSubscription2?.name || overview.merchant.subscription_plan || null;

        return Response.json({
          merchantName: overview.merchant.name || shop.replace('.myshopify.com', ''),
          overview,
          shop,
          subscriptionStatus: billingApproved
            ? 'active'
            : overview.merchant.subscription_status || 'inactive',
          billingApproved,
          themeEmbedEnabled: shopRecord2?.themeEmbedEnabled ?? false,
          activePlanName: activePlanName2,
          whatsapp: await loadSetupWhatsApp(request),
        });
      } catch (repairError) {
        console.error('[app-bootstrap] install sync repair failed', repairError);
      }
    }

    // Fresh installs can hit a short timing window where embedded auth is valid
    // but merchant records are not fully bootstrapped in the platform API yet.
    if (error instanceof Response && (error.status === 403 || error.status === 404)) {
      const shop =
        requestUrl.searchParams.get('shop')?.trim() || session.shop || 'unknown.myshopify.com';
      const overview = buildPendingOverview(shop);
      const billingApproved = billingState.hasActivePayment;
      if (billingApproved) {
        overview.merchant.subscription_status = 'active';
        overview.subscription.status = 'active';
      }
      return Response.json(
        {
          pending: true,
          reason: 'merchant_bootstrap_pending',
          merchantName: overview.merchant.name,
          overview,
          shop,
          subscriptionStatus: billingApproved ? 'active' : 'pending',
          billingApproved,
        },
        { status: 202 }
      );
    }
    throw error;
  }
};

export default function AppBootstrapRoute() {
  return null;
}
