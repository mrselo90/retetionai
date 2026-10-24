/**
 * Saving a product's setup: link (or create) the Recete product for a Shopify
 * product, record it against the plan, and save its instructions. Shared by
 * the Products form actions and the background "Draft all with AI" job
 * (bulkDraft.server.ts).
 */
import {
  createMerchantProduct,
  fetchMerchantMappingData,
  updateMerchantProductInstruction,
} from '../platform.server';
import {
  canCreateRecipe,
  getPlanSnapshotByDomain,
  registerRecipeProduct,
} from '../services/planService.server';
import type { ActionResult } from './productWorkspace';

export function stripHtmlForRag(html?: string) {
  if (!html) return undefined;
  return (
    html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || undefined
  );
}


export async function getActionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Response) {
    try {
      const payload = await error.clone().json();
      if (payload && typeof payload === 'object') {
        if ('details' in payload && typeof payload.details === 'string' && payload.details.trim()) {
          return payload.details;
        }
        if ('error' in payload && typeof payload.error === 'string' && payload.error.trim()) {
          return payload.error;
        }
      }
    } catch {
      // Ignore parse failures and fall through to generic handling.
    }
    return fallback;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export async function persistProductSetup({
  request,
  shopDomain,
  selectedProductId,
  title,
  handle,
  externalId,
  descriptionHtml,
  usageInstructions,
  recipeSummary,
  preventionTips,
  videoUrl,
  existingProductId,
}: {
  request: Request;
  shopDomain: string;
  selectedProductId: string;
  title: string;
  handle: string;
  externalId: string;
  descriptionHtml: string;
  usageInstructions: string;
  recipeSummary: string;
  preventionTips: string;
  videoUrl: string;
  existingProductId: string;
}) {
  if (!selectedProductId || !title || !handle || !externalId) {
    return {
      ok: false,
      selectedProductId,
      error: 'Missing Shopify product context.',
    } satisfies ActionResult;
  }

  let productId = existingProductId;
  if (!productId) {
    // Defensive resolution: if UI context misses existingProductId for the same
    // Shopify product, recover it from merchant mappings so we don't consume
    // plan capacity as if this were a brand-new setup.
    //
    // A transient failure here used to be swallowed (.catch(() => null)) and
    // treated identically to "genuinely no mapping exists" - exactly the
    // brand-new-setup case this comment says it exists to prevent. That let a
    // flaky lookup silently create a duplicate product record and burn plan
    // quota for a product that was already linked. Fail the action instead of
    // guessing when we can't tell the two cases apart.
    let mappingData: Awaited<ReturnType<typeof fetchMerchantMappingData>>;
    try {
      mappingData = await fetchMerchantMappingData(request);
    } catch (err) {
      return {
        ok: false,
        selectedProductId,
        error: `Could not verify whether this product is already set up: ${await getActionErrorMessage(err, 'lookup failed')}. Please try again.`,
      } satisfies ActionResult;
    }
    const mappedProduct = mappingData?.localProducts?.find(
      (product) => String(product.external_id || '').trim() === externalId
    );
    if (mappedProduct?.id) {
      productId = mappedProduct.id;
    }
  }

  if (!productId) {
    const plan = await getPlanSnapshotByDomain(shopDomain);
    const recipeCapacity = await canCreateRecipe(plan.shopId);

    if (!recipeCapacity.allowed) {
      return {
        ok: false,
        selectedProductId,
        error:
          'Product limit reached for the current plan. Upgrade before creating more product setups.',
      } satisfies ActionResult;
    }

    const createResponse = (await createMerchantProduct(request, {
      name: title,
      url: `https://${shopDomain}/products/${handle}`,
      external_id: externalId,
      raw_text: stripHtmlForRag(descriptionHtml),
    })) as { product?: { id?: string } };
    productId = createResponse.product?.id || '';
  }

  if (!productId) {
    return {
      ok: false,
      selectedProductId,
      error: 'Failed to create the linked Recete product record.',
    } satisfies ActionResult;
  }

  const plan = await getPlanSnapshotByDomain(shopDomain);
  await registerRecipeProduct(plan.shopId, externalId, title);
  await updateMerchantProductInstruction(request, productId, {
    usage_instructions: usageInstructions,
    recipe_summary: recipeSummary || undefined,
    prevention_tips: preventionTips || undefined,
    video_url: videoUrl || undefined,
  });

  return {
    ok: true,
    productId,
    selectedProductId,
    savedDraft: {
      usage_instructions: usageInstructions,
      recipe_summary: recipeSummary,
      prevention_tips: preventionTips,
      video_url: videoUrl,
    },
  } satisfies ActionResult;
}
