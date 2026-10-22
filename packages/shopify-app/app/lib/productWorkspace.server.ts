import {
  fetchMerchantMultiLangSettings,
  fetchMerchantProductFacts,
  fetchMerchantProductInstructions,
  fetchMerchantProducts,
  settle,
  type MerchantProduct,
  type MerchantProductInstruction,
  type ProductFactsSnapshot,
  type ShopifyCatalogProduct,
} from '../platform.server';
import { authenticateEmbeddedAdmin } from './embeddedAuth.server';
import { CATALOG_MAX_PRODUCTS, fetchFullShopifyCatalog } from './productCatalog.server';

/** Everything the Products screens join into workspace rows. */
export async function loadProductWorkspace(request: Request) {
  await authenticateEmbeddedAdmin(request);
  const [catalogResult, merchantProductsResult, instructionResult, multiLangResult] =
    await Promise.all([
      settle(fetchFullShopifyCatalog(request), {
        shopDomain: '',
        products: [] as ShopifyCatalogProduct[],
        truncated: false,
      }),
      settle(fetchMerchantProducts(request), { products: [] as MerchantProduct[] }),
      settle(fetchMerchantProductInstructions(request), {
        instructions: [] as MerchantProductInstruction[],
      }),
      settle(fetchMerchantMultiLangSettings(request), {
        settings: {
          shop_id: '',
          default_source_lang: 'en',
          enabled_langs: ['en'],
          multi_lang_rag_enabled: true,
        },
      }),
    ]);

  const productIds = (merchantProductsResult.value.products || []).map((product) => product.id);
  const factsResult = await settle(fetchMerchantProductFacts(request, productIds), {
    facts: [] as ProductFactsSnapshot[],
  });

  // Every fetch above defaults to an empty shape on failure, which looks
  // identical to a merchant with a genuinely empty catalog. Without this flag
  // a platform outage rendered as "you have no products yet" instead of
  // telling the merchant their real catalog just failed to load.
  const dataUnavailable = [
    catalogResult,
    merchantProductsResult,
    instructionResult,
    multiLangResult,
    factsResult,
  ].some((result) => !result.ok);

  return {
    shopDomain: catalogResult.value.shopDomain,
    catalogProducts: catalogResult.value.products,
    catalogTruncated: catalogResult.value.truncated,
    catalogLimit: CATALOG_MAX_PRODUCTS,
    merchantProducts: merchantProductsResult.value.products || [],
    instructions: instructionResult.value.instructions || [],
    productFacts: factsResult.value.facts || [],
    serviceLanguages: multiLangResult.value.settings.enabled_langs || ['en'],
    multiLangEnabled: multiLangResult.value.settings.multi_lang_rag_enabled !== false,
    dataUnavailable,
  };
}
