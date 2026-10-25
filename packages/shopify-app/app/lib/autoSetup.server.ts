/**
 * The setup steps Recete can do by itself, run once when the plan is approved.
 *
 * Setup used to be four steps; two of them only needed the merchant to press
 * a button and wait: "Draft all with AI" for the products, and a welcome
 * message form whose fields could be filled from the store. Now the merchant
 * picks a plan and links WhatsApp, and while they link it Recete:
 *
 *   - drafts and prepares instructions for the first products (the same
 *     background job as "Draft all with AI"), when no product is set up yet;
 *   - saves the store's name as the bot name and a language from the store's
 *     country, when the welcome message step was never saved. The welcome
 *     template stays empty: the built-in message lists the ordered products'
 *     usage notes, in that language.
 *
 * Both are left alone when the merchant did them already. It starts after the
 * plan approval, not at install, so a store that never pays costs no AI drafts.
 * persona_settings.auto_setup_at records that it ran; it runs once per store.
 */
import {
  fetchMerchantMultiLangSettings,
  updateMerchantSettings,
  type ShopifyMerchantOverview,
} from '../platform.server';
import { startBulkDraft } from './bulkDraft.server';
import { fetchFullShopifyCatalog } from './productCatalog.server';
import { BULK_DRAFT_LIMIT } from './productWorkspace';
import { persistMessagingSetup } from './persistMessagingSetup';

type AdminGraphql = (query: string) => Promise<Response>;

const LANGUAGE_BY_COUNTRY: Record<string, string> = {
  TR: 'tr',
  HU: 'hu',
  DE: 'de',
  AT: 'de',
  CH: 'de',
  LI: 'de',
  GR: 'el',
  CY: 'el',
};

/** The welcome message language for a store's country; English elsewhere. */
export function languageForCountry(countryCode: string | null | undefined): string {
  return LANGUAGE_BY_COUNTRY[String(countryCode || '').toUpperCase()] || 'en';
}

export interface AutoSetupPlan {
  messaging: boolean;
  products: boolean;
}

/** What auto-setup should do for this store, or null when it has nothing to do. */
export function planAutoSetup(
  overview: ShopifyMerchantOverview,
  billingApproved: boolean
): AutoSetupPlan | null {
  const persona = overview.settings?.personaSettings || {};
  if (!billingApproved || persona.auto_setup_at) return null;
  const messagingSaved = Boolean(
    persona.onboarding_settings_configured_at?.trim() ||
      persona.bot_name?.trim() ||
      persona.whatsapp_welcome_template?.trim() ||
      overview.settings?.notificationPhone?.trim()
  );
  const productCount = Math.max(overview.metrics?.totalProducts || 0, overview.products?.length || 0);
  return { messaging: !messagingSaved, products: productCount === 0 };
}

async function readShop(graphql: AdminGraphql) {
  try {
    const response = await graphql(`#graphql
      query AutoSetupShop {
        shop {
          name
          billingAddress {
            countryCodeV2
          }
        }
      }`);
    const body = (await response.json()) as {
      data?: { shop?: { name?: string; billingAddress?: { countryCodeV2?: string | null } | null } };
    };
    return {
      name: body.data?.shop?.name?.trim() || '',
      country: body.data?.shop?.billingAddress?.countryCodeV2 || null,
    };
  } catch {
    return { name: '', country: null };
  }
}

// One run per store per process: the shell loads bootstrap on every navigation
// and focus, and the first run can still be going when the next load comes.
const inFlight = new Set<string>();

/**
 * Runs auto-setup when it is due. Returns true when it started something, so
 * the caller can reload the overview. Never throws.
 */
export async function runAutoSetupIfDue(input: {
  request: Request;
  shop: string;
  overview: ShopifyMerchantOverview;
  billingApproved: boolean;
  graphql: AdminGraphql;
}): Promise<boolean> {
  const plan = planAutoSetup(input.overview, input.billingApproved);
  if (!plan || inFlight.has(input.shop)) return false;
  inFlight.add(input.shop);
  try {
    // Recorded first: a failure below must not retry on every page load.
    await updateMerchantSettings(input.request, {
      persona_settings: { auto_setup_at: new Date().toISOString() },
    });

    if (plan.messaging) {
      const shop = await readShop(input.graphql);
      const language = languageForCountry(shop.country);
      let enabledLangs: string[] | null = null;
      try {
        const current = (await fetchMerchantMultiLangSettings(input.request)).settings?.enabled_langs || [];
        enabledLangs = [language, ...current.filter((lang) => lang !== language)];
      } catch {
        // Leave the reply languages as they are; the welcome language is saved anyway.
      }
      await persistMessagingSetup(input.request, input.shop, {
        botName: shop.name || input.overview.merchant.name || null,
        defaultLanguage: language,
        enabledLangs,
      }).catch((error: unknown) => {
        console.warn('[auto-setup] welcome message defaults failed', error instanceof Error ? error.message : error);
      });
    }

    if (plan.products) {
      const catalog = await fetchFullShopifyCatalog(input.request, { maxProducts: BULK_DRAFT_LIMIT });
      const result = await startBulkDraft({
        request: input.request,
        shopDomain: input.shop,
        shopifyProductIds: catalog.products.map((product) => product.id),
      });
      if (!result.ok) console.warn('[auto-setup] product drafts not started', result.error);
    }
    return true;
  } catch (error) {
    console.warn('[auto-setup] failed', error instanceof Error ? error.message : error);
    return false;
  } finally {
    inFlight.delete(input.shop);
  }
}
