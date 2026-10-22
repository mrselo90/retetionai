import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from 'react-router';
import {
  Form,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigation,
  useSearchParams,
  useSubmit,
} from 'react-router';
import { useEffect, useMemo, useState } from 'react';
import { boundary } from '@shopify/shopify-app-react-router/server';
import { DeleteIcon, ImageIcon } from '@shopify/polaris-icons';
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Checkbox,
  Collapsible,
  EmptyState,
  InlineGrid,
  InlineStack,
  Layout,
  Modal,
  Page,
  ProgressBar,
  SkeletonBodyText,
  SkeletonDisplayText,
  SkeletonPage,
  Spinner,
  Text,
  TextField,
  Thumbnail,
} from '@shopify/polaris';
import { authenticateEmbeddedAdmin } from '../lib/embeddedAuth.server';
import { CATALOG_MAX_PRODUCTS, fetchFullShopifyCatalog } from '../lib/productCatalog.server';
import { shellSetupProgress, useAppBootstrapData } from './app';
import { useActionToast, useEditProductInShopify } from '../lib/appBridge';
import {
  createMerchantProduct,
  deleteMerchantProduct,
  draftMerchantProductInstructions,
  enrichMerchantProductFromUrl,
  fetchMerchantMappingData,
  fetchMerchantMultiLangSettings,
  fetchMerchantProductInstructions,
  fetchMerchantProducts,
  fetchMerchantProductFacts,
  generateMerchantProductEmbeddings,
  previewMerchantProductAnswer,
  prepareMerchantProductKnowledge,
  resetMerchantProductKnowledge,
  scrapeMerchantProduct,
  settle,
  type MerchantProduct,
  type MerchantProductInstruction,
  type ProductStepOutcome,
  type ProductFactsSnapshot,
  type ShopifyCatalogProduct,
  updateMerchantProductInstruction,
} from '../platform.server';
import {
  canCreateRecipe,
  getPlanSnapshotByDomain,
  registerRecipeProduct,
} from '../services/planService.server';
import {
  BULK_DRAFT_LIMIT,
  buildKnowledgeSummary,
  buildWorkspaceRows,
  draftFromInstruction,
  emptyDraft,
  formatOutcomeDelta,
  getJourneyMeta,
  getLifecyclePresentation,
  type ActionResult,
  type MappingDraft,
  type StepOutcomeState,
  type WorkspaceRow,
} from '../lib/productWorkspace';


function stripHtmlForRag(html?: string) {
  if (!html) return undefined;
  return (
    html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || undefined
  );
}


function normalizeOptionalUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return `https://${trimmed}`;
}

async function getActionErrorMessage(error: unknown, fallback: string) {
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


async function persistProductSetup({
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

export const loader = async ({ request }: LoaderFunctionArgs) => {
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
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticateEmbeddedAdmin(request);
  const formData = await request.formData();
  const intent = String(formData.get('intent') || '').trim();

  try {
    switch (intent) {
      case 'create': {
        const name = String(formData.get('name') || '').trim();
        const url = String(formData.get('url') || '').trim();
        const enrichmentUrl = normalizeOptionalUrl(String(formData.get('enrichmentUrl') || ''));

        if (!name || !url) {
          return { ok: false, intent, error: 'Name and URL are required.' } satisfies ActionResult;
        }

        const created = (await createMerchantProduct(request, { name, url })) as {
          product?: { id?: string };
        };
        const createdId = created?.product?.id;

        if (!createdId) {
          return {
            ok: true,
            intent,
            message: 'Manual source created.',
          } satisfies ActionResult;
        }

        const stepOutcomes: StepOutcomeState[] = [];
        let message = 'Manual source created.';

        if (enrichmentUrl) {
          const enrich = await enrichMerchantProductFromUrl(request, createdId, enrichmentUrl);
          if (enrich.stepOutcome) {
            stepOutcomes.push({
              ...enrich.stepOutcome,
              message: enrich.message,
              intent,
            });
          }
          message = 'Manual source created and extra source added.';
        }

        return {
          ok: true,
          intent,
          productId: createdId,
          message,
          stepOutcomes,
        } satisfies ActionResult;
      }
      case 'save-setup': {
        const workflowUrl = normalizeOptionalUrl(String(formData.get('workflow_url') || ''));
        const result = await persistProductSetup({
          request,
          shopDomain: session.shop,
          selectedProductId: String(formData.get('selected_product_id') || '').trim(),
          title: String(formData.get('title') || '').trim(),
          handle: String(formData.get('handle') || '').trim(),
          externalId: String(formData.get('external_id') || '').trim(),
          descriptionHtml: String(formData.get('description_html') || ''),
          usageInstructions: String(formData.get('usage_instructions') || '').trim(),
          recipeSummary: String(formData.get('recipe_summary') || '').trim(),
          preventionTips: String(formData.get('prevention_tips') || '').trim(),
          videoUrl: String(formData.get('video_url') || '').trim(),
          existingProductId: String(formData.get('existing_product_id') || '').trim(),
        });

        if (!result.ok) {
          return { ...result, intent } satisfies ActionResult;
        }

        // Auto-trigger enrichment pipeline after save
        const stepOutcomes: StepOutcomeState[] = [];
        if (result.productId) {
          try {
            const prepared = await prepareMerchantProductKnowledge(
              request,
              result.productId,
              workflowUrl || undefined
            );
            for (const outcome of prepared.stepOutcomes || []) {
              stepOutcomes.push({
                ...outcome,
                message: prepared.message,
                intent,
              });
            }
          } catch (error) {
            console.warn('[auto-prepare-knowledge-failed]', error);
            const errorMessage = await getActionErrorMessage(
              error,
              'Your guidance was saved, but Recete could not prepare product answers automatically.'
            );
            stepOutcomes.push({
              step: 'collect_sources',
              status: 'error',
              updatedAt: new Date().toISOString(),
              error: errorMessage,
              intent,
            });
          }
        }

        return {
          ...result,
          ok: true,
          intent,
          stepOutcomes,
          message: 'Customer guidance saved and AI updated.',
        } satisfies ActionResult;
      }
      case 'embeddings': {
        const productId = String(formData.get('productId') || '').trim();
        const productName = String(formData.get('productName') || '').trim();
        const selectedProductId = String(formData.get('shopifyProductId') || '').trim();
        const hasContent = String(formData.get('hasContent') || '').trim() === 'true';
        const enrichmentUrl = normalizeOptionalUrl(String(formData.get('enrichmentUrl') || ''));

        console.info('[products-action:embeddings] start', {
          shop: session.shop,
          intent,
          productId,
          productName,
          selectedProductId,
          hasContent,
          hasEnrichmentUrl: Boolean(enrichmentUrl),
        });

        if (!productId) {
          console.warn('[products-action:embeddings] missing-product-id', {
            shop: session.shop,
            intent,
            selectedProductId,
            productName,
          });
          return {
            ok: false,
            intent,
            selectedProductId,
            error: 'Missing product id.',
          } satisfies ActionResult;
        }

        const stepOutcomes: StepOutcomeState[] = [];
        let pipelineMessage = `${productName || 'Product'} answers improved with product context.`;

        if (enrichmentUrl) {
          try {
            const enrich = await enrichMerchantProductFromUrl(request, productId, enrichmentUrl);
            if (enrich.stepOutcome) {
              stepOutcomes.push({
                ...enrich.stepOutcome,
                message: enrich.message,
                intent,
              });
            }
            pipelineMessage =
              enrich.message ||
              `${productName || 'Product'} answers improved with extra source context.`;
          } catch (error) {
            const errorMessage = await getActionErrorMessage(
              error,
              'Extra source URL could not be processed.'
            );
            return {
              ok: false,
              intent,
              productId,
              productName,
              selectedProductId,
              error: errorMessage,
              stepOutcomes: [
                {
                  step: 'collect_sources',
                  status: 'error',
                  updatedAt: new Date().toISOString(),
                  error: errorMessage,
                  intent,
                },
              ],
            } satisfies ActionResult;
          }
        } else if (!hasContent) {
          const scrape = await scrapeMerchantProduct(request, productId);
          if (scrape.stepOutcome) {
            stepOutcomes.push({
              ...scrape.stepOutcome,
              message: scrape.message,
              intent,
            });
          }
          pipelineMessage =
            scrape.message ||
            `${productName || 'Product'} content was collected and prepared for answers.`;
        } else {
          console.info('[products-action:embeddings] generate-request', {
            shop: session.shop,
            productId,
            selectedProductId,
            stepOutcomesBeforeGenerate: stepOutcomes.length,
          });
          const generated = await generateMerchantProductEmbeddings(request, productId);
          console.info('[products-action:embeddings] generate-response', {
            shop: session.shop,
            productId,
            selectedProductId,
            status: generated?.status,
            message: generated?.message,
            hasStepOutcome: Boolean(generated?.stepOutcome),
          });
          if (generated.stepOutcome) {
            stepOutcomes.push({
              ...generated.stepOutcome,
              message: generated.message,
              intent,
            });
          }
          pipelineMessage = generated.message || pipelineMessage;
        }

        return {
          ok: true,
          intent,
          productId,
          productName,
          selectedProductId,
          message: pipelineMessage,
          stepOutcomes,
        } satisfies ActionResult;
      }
      case 'draft-instructions': {
        // "Write it for me": a draft for the merchant to review. Saves nothing.
        const selectedProductId = String(formData.get('selected_product_id') || '').trim();
        try {
          const { drafts } = await draftMerchantProductInstructions(request, [
            {
              key: selectedProductId,
              title: String(formData.get('title') || '').trim(),
              description: String(formData.get('description_html') || ''),
              productType: String(formData.get('product_type') || '') || undefined,
              vendor: String(formData.get('vendor') || '') || undefined,
            },
          ]);
          const draft = drafts[0];
          if (!draft) {
            return {
              ok: false,
              intent,
              selectedProductId,
              error:
                'Recete could not draft instructions for this product. Write them in a few words instead.',
            } satisfies ActionResult;
          }
          return {
            ok: true,
            intent,
            selectedProductId,
            draft: {
              usage_instructions: draft.usage_instructions,
              prevention_tips: draft.prevention_tips,
              recipe_summary: draft.recipe_summary,
            },
          } satisfies ActionResult;
        } catch (error) {
          return {
            ok: false,
            intent,
            selectedProductId,
            error: await getActionErrorMessage(error, 'Could not draft instructions right now.'),
          } satisfies ActionResult;
        }
      }
      case 'bulk-draft': {
        // "Draft all with AI": draft guidance for every product that has none,
        // save it, and start the AI knowledge step, so setup is a review
        // instead of writing a dozen texts by hand.
        const requestedIds = new Set(
          String(formData.get('shopifyProductIds') || '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)
        );
        if (!requestedIds.size) {
          return {
            ok: false,
            intent,
            error: 'No products need instructions.',
          } satisfies ActionResult;
        }

        const catalog = await fetchFullShopifyCatalog(request);
        const targets = catalog.products
          .filter((product) => requestedIds.has(product.id))
          .slice(0, BULK_DRAFT_LIMIT);

        let saved = 0;
        let failed = 0;
        let limitReached = false;
        for (let i = 0; i < targets.length && !limitReached; i += 10) {
          const chunk = targets.slice(i, i + 10);
          let drafts: Awaited<ReturnType<typeof draftMerchantProductInstructions>>['drafts'] = [];
          try {
            ({ drafts } = await draftMerchantProductInstructions(
              request,
              chunk.map((product) => ({
                key: product.id,
                title: product.title,
                description: product.descriptionHtml || '',
                productType: product.productType || undefined,
                vendor: product.vendor || undefined,
              }))
            ));
          } catch (error) {
            console.warn('[bulk-draft] draft request failed', error);
            failed += chunk.length;
            continue;
          }
          const byKey = new Map(drafts.map((draft) => [draft.key, draft]));
          for (const product of chunk) {
            const draft = byKey.get(product.id);
            if (!draft) {
              failed += 1;
              continue;
            }
            const result = await persistProductSetup({
              request,
              shopDomain: session.shop,
              selectedProductId: product.id,
              title: product.title,
              handle: product.handle,
              externalId: product.id,
              descriptionHtml: product.descriptionHtml || '',
              usageInstructions: draft.usage_instructions,
              recipeSummary: draft.recipe_summary,
              preventionTips: draft.prevention_tips,
              videoUrl: '',
              existingProductId: '',
            }).catch(async (error) => ({
              ok: false as const,
              error: await getActionErrorMessage(error, 'save failed'),
            }));
            if (!result.ok) {
              if (String(result.error || '').startsWith('Product limit reached')) {
                limitReached = true;
                break;
              }
              failed += 1;
              continue;
            }
            saved += 1;
            if (result.productId) {
              await prepareMerchantProductKnowledge(request, result.productId).catch((error) => {
                console.warn('[bulk-draft] prepare knowledge failed', error);
              });
            }
          }
        }

        const remaining = requestedIds.size - targets.length;
        const notes = [
          failed ? `${failed} could not be drafted; open them to write a few words.` : '',
          limitReached ? 'Your plan’s product limit was reached; upgrade to set up more.' : '',
          remaining > 0 ? `${remaining} more left — run it again to continue.` : '',
        ].filter(Boolean);
        if (!saved) {
          return {
            ok: false,
            intent,
            error: notes.join(' ') || 'No instructions could be drafted. Try again in a moment.',
          } satisfies ActionResult;
        }
        return {
          ok: true,
          intent,
          message: [
            `Recete drafted and saved instructions for ${saved} product${saved === 1 ? '' : 's'}. Open any product to review or edit what it says.`,
            ...notes,
          ].join(' '),
        } satisfies ActionResult;
      }
      case 'bulk-prepare': {
        const shopifyProductIds = String(formData.get('shopifyProductIds') || '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean);

        if (!shopifyProductIds.length) {
          return {
            ok: false,
            intent,
            error: 'Select at least one product.',
          } satisfies ActionResult;
        }

        const mappingData = await fetchMerchantMappingData(request);
        const localByExternalId = new Map(
          (mappingData.localProducts || [])
            .filter((product) => product.external_id)
            .map((product) => [String(product.external_id), product])
        );

        let processed = 0;
        let skipped = 0;

        for (const externalId of shopifyProductIds) {
          const localProduct = localByExternalId.get(externalId);
          if (!localProduct?.id) {
            skipped += 1;
            continue;
          }
          try {
            await prepareMerchantProductKnowledge(request, localProduct.id);
            processed += 1;
          } catch {
            skipped += 1;
          }
        }

        if (!processed) {
          return {
            ok: false,
            intent,
            error:
              'No selected products had a saved setup yet. Open each product once and click Save draft, then retry bulk update.',
          } satisfies ActionResult;
        }

        const message =
          skipped > 0
            ? `AI update started for ${processed} products. ${skipped} products were skipped.`
            : `AI update started for ${processed} products.`;

        return {
          ok: true,
          intent,
          message,
        } satisfies ActionResult;
      }
      case 'delete': {
        const productId = String(formData.get('productId') || '').trim();
        const productName = String(formData.get('productName') || '').trim();
        const selectedProductId = String(formData.get('shopifyProductId') || '').trim();

        if (!productId) {
          return {
            ok: false,
            intent,
            selectedProductId,
            error: 'Missing product id.',
          } satisfies ActionResult;
        }

        await deleteMerchantProduct(request, productId);
        return {
          ok: true,
          intent,
          productId,
          productName,
          selectedProductId,
          message: `${productName || 'Product'} local setup removed.`,
        } satisfies ActionResult;
      }
      case 'reset-knowledge': {
        const productId = String(formData.get('productId') || '').trim();
        const productName = String(formData.get('productName') || '').trim();
        const selectedProductId = String(formData.get('shopifyProductId') || '').trim();

        if (!productId) {
          return {
            ok: false,
            intent,
            selectedProductId,
            error: 'Missing product id.',
          } satisfies ActionResult;
        }

        await resetMerchantProductKnowledge(request, productId);
        return {
          ok: true,
          intent,
          productId,
          productName,
          selectedProductId,
          message: `AI knowledge for ${productName || 'this product'} has been cleared.`,
        } satisfies ActionResult;
      }
      case 'preview-answer': {
        const productId = String(formData.get('productId') || '').trim();
        const selectedProductId = String(formData.get('shopifyProductId') || '').trim();
        const question = String(formData.get('question') || '').trim();

        if (!productId) {
          return {
            ok: false,
            intent,
            selectedProductId,
            error: 'Missing product id.',
          } satisfies ActionResult;
        }
        if (!question) {
          return {
            ok: false,
            intent,
            selectedProductId,
            error: 'Question is required.',
          } satisfies ActionResult;
        }

        const result = await previewMerchantProductAnswer(request, productId, question);
        if (result.error) {
          return {
            ok: false,
            intent,
            selectedProductId,
            error: result.error,
          } satisfies ActionResult;
        }

        return {
          ok: true,
          intent,
          selectedProductId,
          previewAnswer: result.answer || '',
          previewQuestion: question,
        } satisfies ActionResult;
      }
      default:
        return { ok: false, intent, error: 'Unknown action.' } satisfies ActionResult;
    }
  } catch (error) {
    console.error('[products-action] failed', {
      shop: session.shop,
      intent,
      error: error instanceof Error ? error.message : String(error),
    });
    if (error instanceof Response) {
      throw error;
    }

    return {
      ok: false,
      intent,
      error: error instanceof Error ? error.message : 'Product action failed.',
    } satisfies ActionResult;
  }
};

export default function ProductsPage() {
  const { bootstrapData: shellBootstrap } = useAppBootstrapData();
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  // Every successful action (bulk draft/prepare, manual source, product setup
  // steps) confirms with one admin toast instead of a Banner in the page.
  useActionToast(actionData?.ok && actionData.message ? actionData.message : null, actionData);
  const navigation = useNavigation();
  const submit = useSubmit();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [showReadyProducts, setShowReadyProducts] = useState(true);
  const [showManualEntryModal, setShowManualEntryModal] = useState(false);
  const [manualSourceDraft, setManualSourceDraft] = useState({
    name: '',
    url: '',
    enrichmentUrl: '',
  });
  const [drafts, setDrafts] = useState<Record<string, MappingDraft>>({});
  const [savedDrafts, setSavedDrafts] = useState<Record<string, MappingDraft>>({});
  const [workflowUrlByProduct, setWorkflowUrlByProduct] = useState<Record<string, string>>({});
  const [previewQuestionByProduct, setPreviewQuestionByProduct] = useState<Record<string, string>>(
    {}
  );
  const [previewAnswerByProduct, setPreviewAnswerByProduct] = useState<Record<string, string>>({});
  const [bulkSelectedProductIds, setBulkSelectedProductIds] = useState<string[]>([]);
  const [outcomesByProduct, setOutcomesByProduct] = useState<
    Record<string, Partial<Record<ProductStepOutcome['step'], StepOutcomeState>>>
  >({});
  const busy = navigation.state === 'submitting';

  const rows = useMemo(
    () =>
      buildWorkspaceRows(
        data.catalogProducts,
        data.merchantProducts,
        data.instructions,
        data.productFacts,
        data.serviceLanguages,
        data.multiLangEnabled
      ),
    [
      data.catalogProducts,
      data.instructions,
      data.merchantProducts,
      data.multiLangEnabled,
      data.productFacts,
      data.serviceLanguages,
    ]
  );
  const summary = useMemo(
    () => ({
      total: rows.length,
      needsSetup: rows.filter((row) => row.state === 'needs_setup').length,
      needsAiAnswers: rows.filter((row) => row.state === 'needs_ai_answers').length,
      ready: rows.filter((row) => row.state === 'ready').length,
      languageUpdates: rows.filter(
        (row) =>
          row.languageWorkflowEnabled && row.linked && row.hasGuidance && row.languageCoverage < 100
      ).length,
    }),
    [rows]
  );
  const searchedRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return rows;

    return rows.filter((row) => {
      const title = row.shopify.title.toLowerCase();
      const handle = row.shopify.handle.toLowerCase();
      const vendor = row.shopify.vendor?.toLowerCase() || '';
      return title.includes(query) || handle.includes(query) || vendor.includes(query);
    });
  }, [rows, searchQuery]);
  const needsActionRows = useMemo(
    () => searchedRows.filter((row) => row.state !== 'ready'),
    [searchedRows]
  );
  const readyRows = useMemo(
    () => searchedRows.filter((row) => row.state === 'ready'),
    [searchedRows]
  );
  const nextIncompleteProduct = useMemo(
    () => rows.find((row) => getJourneyMeta(row).activeStep !== 'ready') || null,
    [rows]
  );

  const requestedProductId = searchParams.get('product') || '';
  const [selectedProductId, setSelectedProductId] = useState<string>(requestedProductId || '');
  const [hasInitializedSelection, setHasInitializedSelection] = useState(
    Boolean(requestedProductId)
  );

  useEffect(() => {
    if (hasInitializedSelection || selectedProductId || rows.length === 0) return;

    if (requestedProductId && rows.some((row) => row.shopify.id === requestedProductId)) {
      setSelectedProductId(requestedProductId);
      replaceProductSearchParam(requestedProductId);
    }
    setHasInitializedSelection(true);
  }, [hasInitializedSelection, nextIncompleteProduct, requestedProductId, rows, selectedProductId]);

  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current };
      for (const row of rows) {
        if (!next[row.shopify.id]) {
          next[row.shopify.id] = draftFromInstruction(row.instruction);
        }
      }
      return next;
    });
  }, [rows]);

  useEffect(() => {
    if (!selectedProductId) return;
    if (searchedRows.length === 0) {
      setSelectedProductId('');
      replaceProductSearchParam(null);
      return;
    }
    if (!searchedRows.some((row) => row.shopify.id === selectedProductId)) {
      const nextId = searchedRows[0]?.shopify.id;
      if (!nextId) return;
      setSelectedProductId(nextId);
      replaceProductSearchParam(nextId);
    }
  }, [searchedRows, selectedProductId]);

  useEffect(() => {
    if (actionData?.selectedProductId) {
      setSelectedProductId(actionData.selectedProductId);
      replaceProductSearchParam(actionData.selectedProductId);
      setHasInitializedSelection(true);
    }
  }, [actionData?.selectedProductId]);

  useEffect(() => {
    if (!(actionData?.selectedProductId && actionData?.stepOutcomes?.length)) return;

    setOutcomesByProduct((current) => {
      const next = { ...(current[actionData.selectedProductId as string] || {}) };
      for (const outcome of actionData.stepOutcomes || []) {
        next[outcome.step] = outcome;
      }
      return {
        ...current,
        [actionData.selectedProductId as string]: next,
      };
    });
  }, [actionData]);

  useEffect(() => {
    if (
      actionData?.ok &&
      actionData.intent === 'save-setup' &&
      actionData.selectedProductId &&
      actionData.savedDraft &&
      actionData.message
    ) {
      setSavedDrafts((current) => ({
        ...current,
        [actionData.selectedProductId as string]: actionData.savedDraft as MappingDraft,
      }));
      setDrafts((current) => ({
        ...current,
        [actionData.selectedProductId as string]: actionData.savedDraft as MappingDraft,
      }));
    }
  }, [actionData]);

  useEffect(() => {
    if (!(actionData?.ok && actionData.intent === 'delete' && actionData.selectedProductId)) return;

    setDrafts((current) => ({
      ...current,
      [actionData.selectedProductId as string]: emptyDraft(),
    }));
    setSavedDrafts((current) => {
      const next = { ...current };
      delete next[actionData.selectedProductId as string];
      return next;
    });
  }, [actionData]);

  useEffect(() => {
    if (actionData?.ok && actionData.intent === 'create') {
      setShowManualEntryModal(false);
      setManualSourceDraft({ name: '', url: '', enrichmentUrl: '' });
    }
  }, [actionData]);

  useEffect(() => {
    if (actionData?.ok && actionData.intent === 'preview-answer' && actionData.selectedProductId) {
      setPreviewQuestionByProduct((current) => ({
        ...current,
        [actionData.selectedProductId as string]:
          actionData.previewQuestion || current[actionData.selectedProductId as string] || '',
      }));
      setPreviewAnswerByProduct((current) => ({
        ...current,
        [actionData.selectedProductId as string]: actionData.previewAnswer || '',
      }));
    }
  }, [actionData]);

  const selectedRow = searchedRows.find((row) => row.shopify.id === selectedProductId) || null;
  const currentDraft = selectedRow ? drafts[selectedRow.shopify.id] || emptyDraft() : emptyDraft();
  const initialDraft = selectedRow
    ? savedDrafts[selectedRow.shopify.id] || draftFromInstruction(selectedRow.instruction)
    : emptyDraft();
  const dirty = JSON.stringify(currentDraft) !== JSON.stringify(initialDraft);
  const workflowUrl = selectedRow ? workflowUrlByProduct[selectedRow.shopify.id] || '' : '';
  const previewQuestion = selectedRow
    ? previewQuestionByProduct[selectedRow.shopify.id] || 'How do I use this product?'
    : 'How do I use this product?';
  const previewAnswer = selectedRow ? previewAnswerByProduct[selectedRow.shopify.id] || '' : '';
  const handlePreviewQuestionChange = (productId: string, value: string) => {
    setPreviewQuestionByProduct((current) => ({
      ...current,
      [productId]: value,
    }));
  };
  const currentIntent = String(navigation.formData?.get('intent') || '');
  const currentSelectedProductId = String(
    navigation.formData?.get('selected_product_id') ||
      navigation.formData?.get('shopifyProductId') ||
      ''
  );
  const isSavingSetup =
    navigation.state === 'submitting' &&
    currentSelectedProductId === selectedRow?.shopify.id &&
    currentIntent === 'save-setup';
  const isRunningAiAction =
    navigation.state === 'submitting' &&
    currentSelectedProductId === selectedRow?.shopify.id &&
    currentIntent === 'embeddings';
  const isDeletingLocalSetup =
    navigation.state === 'submitting' &&
    currentSelectedProductId === selectedRow?.shopify.id &&
    currentIntent === 'delete';
  const isPreviewingAnswer =
    navigation.state === 'submitting' &&
    currentSelectedProductId === selectedRow?.shopify.id &&
    currentIntent === 'preview-answer';
  const isBulkPreparing = navigation.state === 'submitting' && currentIntent === 'bulk-prepare';
  const isBulkDrafting = navigation.state === 'submitting' && currentIntent === 'bulk-draft';
  // Products with no customer guidance yet: what "Draft all with AI" works on.
  const rowsWithoutGuidance = rows.filter((row) => !row.instruction?.usage_instructions?.trim());
  const selectedBulkCount = bulkSelectedProductIds.length;

  function replaceProductSearchParam(productId: string | null) {
    if (typeof window === 'undefined') return;

    const next = new URLSearchParams(window.location.search);
    if (productId) {
      next.set('product', productId);
    } else {
      next.delete('product');
    }

    const query = next.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
  }

  function handleSelectProduct(productId: string, forceOpen = false) {
    const nextProductId = forceOpen ? productId : selectedProductId === productId ? '' : productId;
    setSelectedProductId(nextProductId);
    setHasInitializedSelection(true);
    replaceProductSearchParam(nextProductId || null);

    if (nextProductId && typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  function closeSelectedProduct() {
    setSelectedProductId('');
    setHasInitializedSelection(true);
    replaceProductSearchParam(null);
  }

  function openProductBrowser() {
    closeSelectedProduct();
    if (typeof window === 'undefined') return;

    window.requestAnimationFrame(() => {
      document
        .getElementById('all-products-panel')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function toggleBulkSelection(productId: string, checked: boolean) {
    setBulkSelectedProductIds((current) => {
      if (checked) {
        if (current.includes(productId)) return current;
        return [...current, productId];
      }
      return current.filter((id) => id !== productId);
    });
  }

  function setBulkSelectionFromRows(nextRows: WorkspaceRow[]) {
    setBulkSelectedProductIds(nextRows.map((row) => row.shopify.id));
  }

  function submitBulkDraft() {
    if (!rowsWithoutGuidance.length) return;
    const formData = new FormData();
    formData.set('intent', 'bulk-draft');
    formData.set('shopifyProductIds', rowsWithoutGuidance.map((row) => row.shopify.id).join(','));
    submit(formData, { method: 'post' });
  }

  function submitBulkPrepare() {
    if (!bulkSelectedProductIds.length) return;
    const formData = new FormData();
    formData.set('intent', 'bulk-prepare');
    formData.set('shopifyProductIds', bulkSelectedProductIds.join(','));
    submit(formData, { method: 'post' });
  }

  if (navigation.state === 'loading' && rows.length === 0) {
    return (
      <SkeletonPage title="Products" primaryAction>
        <Layout>
          <Layout.Section>
            <Box padding="400" borderWidth="025" borderColor="border" borderRadius="200">
              <SkeletonDisplayText size="small" />
              <SkeletonBodyText lines={4} />
            </Box>
          </Layout.Section>
        </Layout>
      </SkeletonPage>
    );
  }

  const needsActionCount = summary.needsSetup + summary.needsAiAnswers;
  const pageTitle = selectedRow ? undefined : 'Products';
  const pageSubtitle = selectedRow
    ? undefined
    : needsActionCount > 0
      ? `${needsActionCount} product${needsActionCount === 1 ? '' : 's'} need action · ${summary.ready} of ${summary.total} ready`
      : `All ${summary.total} products are ready.`;

  return (
    <Page
      fullWidth
      title={pageTitle}
      subtitle={pageSubtitle}
      secondaryActions={
        selectedRow
          ? []
          : [
              {
                content: 'Add manual source',
                onAction: () => setShowManualEntryModal(true),
              },
            ]
      }
    >
      <Layout>
        {busy ? (
          <Layout.Section>
            <Spinner accessibilityLabel="Updating products" size="small" />
          </Layout.Section>
        ) : null}

        {data.catalogTruncated ? (
          <Layout.Section>
            <Banner tone="warning" title="Showing your first products only">
              <p>
                {`Recete loads up to ${data.catalogLimit.toLocaleString('en')} products from Shopify. Products beyond that are not listed here yet.`}
              </p>
            </Banner>
          </Layout.Section>
        ) : null}

        {data.dataUnavailable ? (
          <Layout.Section>
            <Banner tone="warning" title="Couldn't reach Recete">
              <p>
                Some product data below may be stale or missing — we couldn't load current data.
                Refresh in a moment.
              </p>
            </Banner>
          </Layout.Section>
        ) : null}

        {!selectedRow && rowsWithoutGuidance.length > 0 ? (
          <Layout.Section>
            <Card padding="400">
              <InlineStack align="space-between" blockAlign="center" gap="300" wrap>
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">
                    {`Let Recete write the instructions for ${rowsWithoutGuidance.length} product${rowsWithoutGuidance.length === 1 ? '' : 's'}`}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    {isBulkDrafting
                      ? 'Drafting from your product descriptions. This can take a minute — keep this page open.'
                      : 'Drafted from your product descriptions and saved. You can open any product later to edit what it says.'}
                  </Text>
                </BlockStack>
                <Button
                  variant="primary"
                  onClick={submitBulkDraft}
                  loading={isBulkDrafting}
                  disabled={isBulkDrafting || isBulkPreparing}
                >
                  Draft all with AI
                </Button>
              </InlineStack>
            </Card>
          </Layout.Section>
        ) : null}

        {actionData?.error && !actionData.selectedProductId ? (
          <Layout.Section>
            <Banner tone="critical" title="Product action failed">
              <Text as="p" variant="bodyMd">
                {actionData.error}
              </Text>
            </Banner>
          </Layout.Section>
        ) : null}

        {summary.total > 0 && summary.ready === summary.total ? (
          <Layout.Section>
            <Box padding="300" background="bg-fill-success-secondary" borderRadius="200">
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  You&apos;re all set
                </Text>
                <Text as="p" variant="bodyMd">
                  All products are ready. Recete can now answer customer questions after delivery.
                </Text>
                {/* Dashboard and Conversations stay locked until setup is done;
                    the setup banner points at the next step until then. */}
                {shellBootstrap?.overview &&
                shellSetupProgress(shellBootstrap.overview, shellBootstrap).setupComplete ? (
                  <InlineStack gap="200" wrap>
                    <Button url="/app/dashboard" variant="primary">
                      Go to dashboard
                    </Button>
                    <Button url="/app/conversations" variant="secondary">
                      View conversations
                    </Button>
                  </InlineStack>
                ) : null}
              </BlockStack>
            </Box>
          </Layout.Section>
        ) : null}

        {selectedRow ? (
          <Layout.Section>
            <SetupPanel
              row={selectedRow}
              draft={currentDraft}
              dirty={dirty}
              workflowUrl={workflowUrl}
              actionError={
                actionData?.error && actionData.selectedProductId === selectedRow.shopify.id
                  ? actionData.error
                  : null
              }
              previewQuestion={previewQuestion}
              previewAnswer={previewAnswer}
              onPreviewQuestionChange={(value) =>
                handlePreviewQuestionChange(selectedRow.shopify.id, value)
              }
              stepOutcomes={outcomesByProduct[selectedRow.shopify.id]}
              isSavingSetup={isSavingSetup}
              isRunningAiAction={isRunningAiAction}
              isDeletingLocalSetup={isDeletingLocalSetup}
              isPreviewingAnswer={isPreviewingAnswer}
              onChangeDraft={(field, value) =>
                setDrafts((current) => ({
                  ...current,
                  [selectedRow.shopify.id]: {
                    ...(current[selectedRow.shopify.id] || emptyDraft()),
                    [field]: value,
                  },
                }))
              }
              onWorkflowUrlChange={(value) =>
                setWorkflowUrlByProduct((current) => ({
                  ...current,
                  [selectedRow.shopify.id]: value,
                }))
              }
              onBackToProducts={openProductBrowser}
            />
          </Layout.Section>
        ) : null}

        {!selectedRow ? (
          <Layout.Section>
            <Box
              id="all-products-panel"
              padding="300"
              borderWidth="025"
              borderColor="border"
              borderRadius="300"
            >
              <BlockStack gap="300">
                <BlockStack gap="050">
                  <Text as="h2" variant="headingMd">
                    All products
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Start with products that need action.
                  </Text>
                </BlockStack>

                <InlineGrid columns={{ xs: 1, md: '2fr auto' }} gap="200">
                  <TextField
                    label="Search products"
                    labelHidden
                    autoComplete="off"
                    placeholder="Search by product title, handle, or vendor"
                    value={searchQuery}
                    onChange={setSearchQuery}
                  />
                  <Text as="p" variant="bodySm" tone="subdued">
                    {searchedRows.length} {searchedRows.length === 1 ? 'product' : 'products'} shown
                  </Text>
                </InlineGrid>

                <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                  <InlineStack align="space-between" blockAlign="center" wrap gap="200">
                    <Text as="p" variant="bodySm" tone="subdued">
                      {selectedBulkCount > 0
                        ? `${selectedBulkCount} product${selectedBulkCount > 1 ? 's' : ''} selected`
                        : 'Select products to run bulk actions.'}
                    </Text>
                    <InlineStack gap="200" wrap>
                      <Button
                        variant="tertiary"
                        onClick={() => setBulkSelectionFromRows(searchedRows)}
                        disabled={searchedRows.length === 0}
                      >
                        Select all shown
                      </Button>
                      <Button
                        variant="tertiary"
                        onClick={() => setBulkSelectedProductIds([])}
                        disabled={selectedBulkCount === 0}
                      >
                        Clear
                      </Button>
                      <Button
                        variant="primary"
                        onClick={submitBulkPrepare}
                        loading={isBulkPreparing}
                        disabled={selectedBulkCount === 0 || isBulkPreparing}
                      >
                        Update AI for selected
                      </Button>
                    </InlineStack>
                  </InlineStack>
                </Box>

                {needsActionRows.length > 0 ? (
                  <BlockStack gap="200">
                    <Text as="p" variant="bodySm" fontWeight="semibold">
                      Needs action ({needsActionRows.length})
                    </Text>
                    {needsActionRows.map((row) => (
                      <ProductBrowserItem
                        key={row.shopify.id}
                        row={row}
                        selected={row.shopify.id === selectedProductId}
                        bulkSelected={bulkSelectedProductIds.includes(row.shopify.id)}
                        onBulkSelectChange={(checked) =>
                          toggleBulkSelection(row.shopify.id, checked)
                        }
                        onSelect={() => {
                          handleSelectProduct(row.shopify.id, true);
                        }}
                      />
                    ))}
                  </BlockStack>
                ) : (
                  <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                    <Text as="p" variant="bodySm" tone="subdued">
                      No products need action right now.
                    </Text>
                  </Box>
                )}

                {readyRows.length > 0 ? (
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="p" variant="bodySm" fontWeight="semibold">
                        Ready products ({readyRows.length})
                      </Text>
                      <Button
                        variant="tertiary"
                        onClick={() => setShowReadyProducts((current) => !current)}
                        ariaExpanded={showReadyProducts}
                        ariaControls="ready-products-list"
                      >
                        {showReadyProducts ? 'Hide ready products' : 'Show ready products'}
                      </Button>
                    </InlineStack>
                    <Collapsible open={showReadyProducts} id="ready-products-list">
                      <BlockStack gap="200">
                        {readyRows.map((row) => (
                          <ProductBrowserItem
                            key={row.shopify.id}
                            row={row}
                            selected={row.shopify.id === selectedProductId}
                            bulkSelected={bulkSelectedProductIds.includes(row.shopify.id)}
                            onBulkSelectChange={(checked) =>
                              toggleBulkSelection(row.shopify.id, checked)
                            }
                            onSelect={() => {
                              handleSelectProduct(row.shopify.id, true);
                            }}
                          />
                        ))}
                      </BlockStack>
                    </Collapsible>
                  </BlockStack>
                ) : null}

                {searchedRows.length === 0 ? (
                  <Box padding="400" borderWidth="025" borderColor="border" borderRadius="200">
                    <EmptyState
                      heading="No products match this view"
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      Try a different filter or search term.
                    </EmptyState>
                  </Box>
                ) : null}
              </BlockStack>
            </Box>
          </Layout.Section>
        ) : null}
      </Layout>

      <Modal
        open={showManualEntryModal}
        onClose={() => setShowManualEntryModal(false)}
        title="Add manual source"
        primaryAction={{
          content: 'Create manual source',
          onAction: () => {
            const form = document.getElementById('manual-source-form') as HTMLFormElement | null;
            if (form) form.requestSubmit();
          },
          loading: busy,
          disabled: busy,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setShowManualEntryModal(false),
            disabled: busy,
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Banner tone="info">
              <Text as="p" variant="bodySm">
                Use this only when a product does not exist in Shopify and still needs response
                content.
              </Text>
            </Banner>
            <Form method="post" id="manual-source-form">
              <input type="hidden" name="intent" value="create" />
              <BlockStack gap="300">
                <TextField
                  label="Product name"
                  name="name"
                  value={manualSourceDraft.name}
                  onChange={(value) =>
                    setManualSourceDraft((current) => ({
                      ...current,
                      name: value,
                    }))
                  }
                  autoComplete="off"
                  placeholder="Hydrating cleanser"
                />
                <TextField
                  label="Product URL"
                  name="url"
                  value={manualSourceDraft.url}
                  onChange={(value) =>
                    setManualSourceDraft((current) => ({
                      ...current,
                      url: value,
                    }))
                  }
                  autoComplete="off"
                  placeholder="https://example.com/products/hydrating-cleanser"
                />
                <TextField
                  label="Extra source URL"
                  name="enrichmentUrl"
                  value={manualSourceDraft.enrichmentUrl}
                  onChange={(value) =>
                    setManualSourceDraft((current) => ({
                      ...current,
                      enrichmentUrl: value,
                    }))
                  }
                  autoComplete="off"
                  helpText="Optional second source to add more context right after creation."
                  placeholder="https://example.com/blog/how-to-use-product"
                />
              </BlockStack>
            </Form>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}

function SetupPanel({
  row,
  draft,
  dirty,
  workflowUrl,
  actionError,
  previewQuestion,
  previewAnswer,
  onPreviewQuestionChange,
  stepOutcomes,
  isSavingSetup,
  isRunningAiAction,
  isDeletingLocalSetup,
  isPreviewingAnswer,
  embedded = false,
  onChangeDraft,
  onWorkflowUrlChange,
  onBackToProducts,
}: {
  row: WorkspaceRow;
  draft: MappingDraft;
  dirty: boolean;
  workflowUrl: string;
  actionError: string | null;
  previewQuestion: string;
  previewAnswer: string;
  onPreviewQuestionChange: (value: string) => void;
  stepOutcomes?: Partial<Record<ProductStepOutcome['step'], StepOutcomeState>>;
  isSavingSetup: boolean;
  isRunningAiAction: boolean;
  isDeletingLocalSetup: boolean;
  isPreviewingAnswer: boolean;
  embedded?: boolean;
  onChangeDraft: (field: keyof MappingDraft, value: string) => void;
  onWorkflowUrlChange: (value: string) => void;
  onBackToProducts?: () => void;
}) {
  const submit = useSubmit();
  // Separate from the page's main form so a draft never replaces the page's
  // action result (save messages, errors) and never saves anything by itself.
  const draftFetcher = useFetcher<ActionResult>();
  const [aiDrafted, setAiDrafted] = useState(false);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const hasGuidance =
    Boolean(row.instruction?.usage_instructions?.trim()) ||
    (!dirty && Boolean(draft.usage_instructions.trim()));
  const hasAiKnowledge = row.hasKnowledge;
  const languagesDone =
    !row.languageWorkflowEnabled || row.languageCoverage >= 100 || row.readyLanguageCount > 0;
  const enhancementDone = hasAiKnowledge && languagesDone;
  const setupComplete = row.state === 'ready' || (hasGuidance && enhancementDone);
  const knowledge = buildKnowledgeSummary(row);
  const canSubmitSave = !isSavingSetup && !isRunningAiAction && !isDeletingLocalSetup;
  const canRunAiStep = !isRunningAiAction && !isSavingSetup && !isDeletingLocalSetup;
  const processRunning = isSavingSetup || isRunningAiAction || isDeletingLocalSetup;
  const lifecycle = getLifecyclePresentation(row, {
    actionError,
    processRunning,
  });
  const statusLabel =
    lifecycle.key === 'ready'
      ? 'Ready'
      : lifecycle.key === 'processing'
        ? 'In progress'
        : 'Needs attention';
  const statusTone: 'success' | 'info' | 'attention' =
    lifecycle.key === 'ready' ? 'success' : lifecycle.key === 'processing' ? 'info' : 'attention';

  useEffect(() => {
    setKnowledgeOpen(false);
    setPreviewOpen(false);
    setShowDangerZone(false);
    setConfirmDelete(false);
    setAiDrafted(false);
  }, [row.shopify.id]);

  // Fill the form with the AI draft; the merchant reviews it and saves.
  useEffect(() => {
    const result = draftFetcher.data;
    if (!result?.ok || !result.draft || result.selectedProductId !== row.shopify.id) return;
    onChangeDraft('usage_instructions', result.draft.usage_instructions);
    if (result.draft.prevention_tips)
      onChangeDraft('prevention_tips', result.draft.prevention_tips);
    if (result.draft.recipe_summary) onChangeDraft('recipe_summary', result.draft.recipe_summary);
    setAiDrafted(true);
    // onChangeDraft is recreated by the parent on every render.
  }, [draftFetcher.data, row.shopify.id]);

  const isDrafting = draftFetcher.state !== 'idle';
  const editInShopify = useEditProductInShopify();
  const draftError =
    draftFetcher.data &&
    !draftFetcher.data.ok &&
    draftFetcher.data.selectedProductId === row.shopify.id
      ? draftFetcher.data.error
      : null;

  function requestAiDraft() {
    const formData = new FormData();
    formData.set('intent', 'draft-instructions');
    formData.set('selected_product_id', row.shopify.id);
    formData.set('title', row.shopify.title);
    formData.set('description_html', row.shopify.descriptionHtml || '');
    formData.set('product_type', row.shopify.productType || '');
    formData.set('vendor', row.shopify.vendor || '');
    draftFetcher.submit(formData, { method: 'post' });
  }

  function submitSaveDraft() {
    if (!canSubmitSave) return;

    const formData = new FormData();
    formData.set('intent', 'save-setup');
    formData.set('selected_product_id', row.shopify.id);
    formData.set('title', row.shopify.title);
    formData.set('handle', row.shopify.handle);
    formData.set('external_id', row.shopify.id);
    formData.set('description_html', row.shopify.descriptionHtml || '');
    formData.set('existing_product_id', row.localProduct?.id || '');
    formData.set('workflow_url', workflowUrl || '');
    formData.set('usage_instructions', draft.usage_instructions);
    formData.set('recipe_summary', draft.recipe_summary);
    formData.set('prevention_tips', draft.prevention_tips);
    formData.set('video_url', draft.video_url);
    submit(formData, { method: 'post' });
  }

  function submitEmbeddingsFromStep() {
    if (!row.localProduct || !canRunAiStep) return;
    const formData = new FormData();
    formData.set('intent', 'embeddings');
    formData.set('productId', row.localProduct?.id || '');
    formData.set('shopifyProductId', row.shopify.id);
    formData.set('productName', row.shopify.title);
    formData.set('hasContent', row.localProduct?.raw_text ? 'true' : 'false');
    formData.set('enrichmentUrl', workflowUrl || '');
    submit(formData, { method: 'post' });
  }

  function handlePrimarySaveAndUpdate() {
    if (!canSubmitStep) return;
    if (!row.localProduct || dirty) {
      submitSaveDraft();
      return;
    }
    if (enhancementNeedsRun) {
      submitEmbeddingsFromStep();
      return;
    }
    onBackToProducts?.();
  }

  function submitPreviewAnswer() {
    if (!row.localProduct || isPreviewingAnswer || processRunning) return;
    const formData = new FormData();
    formData.set('intent', 'preview-answer');
    formData.set('productId', row.localProduct.id);
    formData.set('shopifyProductId', row.shopify.id);
    formData.set('productName', row.shopify.title);
    formData.set('question', previewQuestion.trim() || 'How do I use this product?');
    submit(formData, { method: 'post' });
  }

  const enhancementNeedsRun = !enhancementDone || Boolean(workflowUrl.trim());
  const canSubmitStep = !processRunning;
  const setupScore = Math.max(0, Math.min(100, knowledge.qualityScore));
  const readySummary = knowledge.missingInfo.length
    ? 'This product can answer questions, but coverage is not complete yet.'
    : 'This product is fully prepared for customer replies.';
  const runningMessage = 'We’re applying updates. This usually takes a few seconds.';

  const content = (
    <BlockStack gap="500">
      <Box
        paddingBlockStart="200"
        paddingBlockEnd="400"
        borderBlockEndWidth="025"
        borderColor="border"
      >
        <BlockStack gap="200">
          <InlineStack align="start">
            <Button variant="plain" onClick={onBackToProducts}>
              ← All products
            </Button>
          </InlineStack>

          <InlineStack align="space-between" blockAlign="center" wrap>
            <InlineStack gap="200" blockAlign="center" wrap>
              <Thumbnail
                source={row.shopify.featuredImageUrl || ImageIcon}
                alt={row.shopify.title}
                size="small"
              />
              <BlockStack gap="050">
                <Text as="h1" variant="headingLg">
                  {row.shopify.title}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {lifecycle.message}
                </Text>
              </BlockStack>
            </InlineStack>
            <InlineStack gap="200" blockAlign="center">
              <Badge tone={statusTone}>{statusLabel}</Badge>
              <Button onClick={() => editInShopify(row.shopify.id)}>Edit in Shopify</Button>
            </InlineStack>
          </InlineStack>
        </BlockStack>
      </Box>

      {processRunning ? (
        <Banner tone="info" title="Updating">
          <Text as="p" variant="bodyMd">
            {runningMessage}
          </Text>
        </Banner>
      ) : null}

      {actionError && !processRunning ? (
        <Banner tone="critical" title="Action failed">
          <Text as="p" variant="bodyMd">
            {actionError}
          </Text>
        </Banner>
      ) : null}

      <Card padding="500">
        <BlockStack gap="400">
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center" gap="200" wrap>
              <BlockStack gap="050">
                <Text as="h2" variant="headingMd">
                  Customer instructions
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  What customers should do after delivery: first use or setup, care, what to avoid.
                </Text>
              </BlockStack>
              <Button onClick={requestAiDraft} loading={isDrafting} disabled={processRunning}>
                {draft.usage_instructions.trim() ? 'Rewrite with AI' : 'Write it for me'}
              </Button>
            </InlineStack>
            {aiDrafted ? (
              <Banner tone="info">
                <p>
                  Drafted from this product&apos;s description. Check it says what you would tell a
                  customer, then save.
                </p>
              </Banner>
            ) : null}
            {draftError ? (
              <Banner tone="warning">
                <p>{draftError}</p>
              </Banner>
            ) : null}

            <TextField
              label="Customer instructions"
              name="usage_instructions"
              value={draft.usage_instructions}
              onChange={(value) => onChangeDraft('usage_instructions', value)}
              multiline={6}
              autoComplete="off"
              helpText="Optional but recommended. Write the guidance Recete should send to customers after delivery."
            />

            <InlineGrid columns={{ xs: 1, md: 2 }} gap="300">
              <TextField
                label="Warnings and important notes"
                name="prevention_tips"
                value={draft.prevention_tips}
                onChange={(value) => onChangeDraft('prevention_tips', value)}
                multiline={3}
                autoComplete="off"
              />
              <TextField
                label="Key product summary"
                name="recipe_summary"
                value={draft.recipe_summary}
                onChange={(value) => onChangeDraft('recipe_summary', value)}
                multiline={3}
                autoComplete="off"
              />
            </InlineGrid>
          </BlockStack>

          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">
              Enhancement
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Refine AI answers with extra sources and keep language coverage healthy.
            </Text>

            <TextField
              label="Extra source URL"
              autoComplete="off"
              value={workflowUrl}
              onChange={onWorkflowUrlChange}
              placeholder="https://example.com/product-faq"
              helpText="Optional. Add a page with FAQs or usage details to improve answer quality."
            />

            <BlockStack gap="100">
              <InlineStack gap="200" wrap>
                {canSubmitStep ? (
                  <>
                    <Button
                      variant="primary"
                      loading={isSavingSetup || isRunningAiAction}
                      disabled={!canSubmitStep}
                      onClick={handlePrimarySaveAndUpdate}
                    >
                      Save & Update AI
                    </Button>
                    <Button variant="secondary" disabled={!canSubmitSave} onClick={submitSaveDraft}>
                      Save Draft
                    </Button>
                  </>
                ) : null}
              </InlineStack>
              {canSubmitStep ? (
                <Text as="p" variant="bodyXs" tone="subdued">
                  <strong>Save &amp; Update AI</strong> saves changes and regenerates AI knowledge.{' '}
                  <strong>Save Draft</strong> saves your work without regenerating AI.
                </Text>
              ) : null}
            </BlockStack>
          </BlockStack>
        </BlockStack>
      </Card>

      <BlockStack gap="400">
        <Card padding="500">
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center" wrap>
              <BlockStack gap="050">
                <Text as="h2" variant="headingMd">
                  Setup completeness: {setupScore}%
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {readySummary}
                </Text>
              </BlockStack>
            </InlineStack>
            <ProgressBar
              progress={setupScore}
              tone={knowledge.missingInfo.length ? 'highlight' : 'success'}
            />

            {/* Mini checklist showing what's done vs missing */}
            <BlockStack gap="100">
              <ChecklistRow done={hasGuidance} label="Customer instructions added" />
              <ChecklistRow done={hasAiKnowledge} label="AI knowledge generated" />
              {row.languageWorkflowEnabled ? (
                <ChecklistRow
                  done={languagesDone}
                  label={
                    row.languageCoverage >= 100
                      ? 'All reply languages ready'
                      : `Language coverage (${row.readyLanguageCount}/${row.requiredLanguageCount} ready)`
                  }
                />
              ) : null}
            </BlockStack>
          </BlockStack>
        </Card>

        <Card padding="400">
          <BlockStack gap="200">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h3" variant="headingSm">
                AI knowledge
              </Text>
              <Button
                variant="tertiary"
                onClick={() => setKnowledgeOpen((current) => !current)}
                ariaExpanded={knowledgeOpen}
              >
                {knowledgeOpen ? 'Hide' : 'Review'}
              </Button>
            </InlineStack>
            <Text as="p" variant="bodySm" tone="subdued">
              This is the information Recete uses to answer customer questions.
            </Text>
            <Collapsible open={knowledgeOpen} id={`knowledge-${row.shopify.id}`}>
              <BlockStack gap="200">
                <InfoMiniCard title="How Recete should answer" body={knowledge.howToUse} />
                <InfoListCard
                  title="Key product details"
                  items={knowledge.keyDetails}
                  empty="No key details yet."
                />
                <InfoListCard
                  title="Warnings"
                  items={knowledge.warnings}
                  empty="No warnings saved yet."
                />
                <InfoListCard
                  title="Common customer questions"
                  items={knowledge.commonQuestions}
                  empty="No common question patterns yet."
                />
                <StepOutcomeLine
                  title="Latest update"
                  outcome={
                    stepOutcomes?.collect_sources ||
                    stepOutcomes?.generate_ai_knowledge ||
                    stepOutcomes?.map_product
                  }
                />
              </BlockStack>
            </Collapsible>
          </BlockStack>
        </Card>

        <Card padding="400">
          <BlockStack gap="200">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h3" variant="headingSm">
                Preview answer
              </Text>
              <Button
                variant="tertiary"
                onClick={() => setPreviewOpen((current) => !current)}
                ariaExpanded={previewOpen}
              >
                {previewOpen ? 'Hide' : 'Open'}
              </Button>
            </InlineStack>
            <Text as="p" variant="bodySm" tone="subdued">
              Ask a sample question and see how Recete responds.
            </Text>
            <Collapsible open={previewOpen} id={`preview-${row.shopify.id}`}>
              <BlockStack gap="200">
                <TextField
                  label="Sample question"
                  autoComplete="off"
                  value={previewQuestion}
                  onChange={onPreviewQuestionChange}
                />
                <InlineStack>
                  <Button
                    variant="secondary"
                    loading={isPreviewingAnswer}
                    disabled={!row.localProduct || processRunning}
                    onClick={submitPreviewAnswer}
                  >
                    Regenerate answer
                  </Button>
                </InlineStack>
                <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                  <Text as="p" variant="bodySm" tone="subdued">
                    {previewAnswer || 'Generate a preview to inspect the response.'}
                  </Text>
                </Box>
              </BlockStack>
            </Collapsible>
          </BlockStack>
        </Card>
      </BlockStack>

      {setupComplete && row.localProduct && (
        <BlockStack gap="200">
          <Box padding="200" background="bg-surface-secondary" borderRadius="200">
            <BlockStack gap="150">
              <InlineStack align="space-between" blockAlign="center" wrap gap="200">
                <BlockStack gap="050">
                  <Text as="p" variant="bodySm" fontWeight="semibold" tone="critical">
                    Danger zone
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Remove only if you want to delete this product&apos;s Recete setup and AI
                    knowledge.
                  </Text>
                </BlockStack>
                <Button
                  size="slim"
                  variant="secondary"
                  tone="critical"
                  onClick={() => setShowDangerZone((current) => !current)}
                >
                  {showDangerZone ? 'Hide' : 'Open'}
                </Button>
              </InlineStack>
            </BlockStack>
          </Box>

          {showDangerZone && (
            <Box padding="200" background="bg-surface-secondary" borderRadius="200">
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">
                  Danger zone
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Clears all Recete setup for this product — instructions, AI knowledge, and
                  language data. Your Shopify product stays untouched. You can set it up again from
                  scratch.
                </Text>
                <Checkbox
                  label="I understand this removes the saved setup for this product."
                  checked={confirmDelete}
                  onChange={setConfirmDelete}
                />
                <InlineStack>
                  <InlineActionForm
                    productId={row.localProduct.id}
                    shopifyProductId={row.shopify.id}
                    intent="delete"
                    label="Reset product setup"
                    icon={DeleteIcon}
                    destructive
                    disabled={!confirmDelete || isSavingSetup || isRunningAiAction}
                    loading={isDeletingLocalSetup}
                    variant="secondary"
                  />
                </InlineStack>
              </BlockStack>
            </Box>
          )}
        </BlockStack>
      )}
    </BlockStack>
  );

  if (embedded) return content;

  return content;
}

function ProductBrowserItem({
  row,
  selected,
  bulkSelected,
  onBulkSelectChange,
  onSelect,
}: {
  row: WorkspaceRow;
  selected: boolean;
  bulkSelected: boolean;
  onBulkSelectChange: (checked: boolean) => void;
  onSelect: () => void;
}) {
  const journey = getJourneyMeta(row);
  const lifecycle = getLifecyclePresentation(row);

  return (
    <Box
      padding="200"
      borderWidth="025"
      borderColor="border"
      borderRadius="200"
      background={selected ? 'bg-surface-secondary' : undefined}
    >
      <InlineGrid
        columns={{ xs: 'auto 1fr auto', md: 'auto 1fr auto' }}
        gap="200"
        alignItems="center"
      >
        <Thumbnail
          source={row.shopify.featuredImageUrl || ImageIcon}
          alt={row.shopify.title}
          size="small"
        />
        <BlockStack gap="100">
          <InlineStack gap="150" wrap blockAlign="center">
            <Checkbox label="" labelHidden checked={bulkSelected} onChange={onBulkSelectChange} />
            <Text as="h3" variant="headingSm">
              {row.shopify.title}
            </Text>
            <Badge tone={lifecycle.tone}>{lifecycle.label}</Badge>
            {!row.hasGuidance ? <Badge tone="attention">Missing instructions</Badge> : null}
          </InlineStack>
          <Text as="p" variant="bodySm" tone="subdued">
            {lifecycle.message}
          </Text>
        </BlockStack>
        <InlineStack align="end" blockAlign="center">
          <Button variant={selected ? 'secondary' : 'primary'} onClick={onSelect}>
            {selected ? 'Open' : journey.nextActionLabel}
          </Button>
        </InlineStack>
      </InlineGrid>
    </Box>
  );
}

function ChecklistRow({ done, label }: { done: boolean; label: string }) {
  return (
    <InlineStack gap="200" blockAlign="center">
      <Text as="span" variant="bodySm" tone={done ? 'success' : 'subdued'}>
        {done ? '✓' : '○'}
      </Text>
      <Text as="span" variant="bodySm" tone={done ? 'subdued' : 'base'}>
        {label}
      </Text>
    </InlineStack>
  );
}

function InfoMiniCard({ title, body }: { title: string; body: string }) {
  return (
    <Box padding="200" background="bg-surface-secondary" borderRadius="200">
      <BlockStack gap="100">
        <Text as="p" variant="bodySm" fontWeight="medium">
          {title}
        </Text>
        <Text as="p" variant="bodySm" tone="subdued">
          {body}
        </Text>
      </BlockStack>
    </Box>
  );
}

function InfoListCard({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <Box padding="200" background="bg-surface-secondary" borderRadius="200">
      <BlockStack gap="100">
        <Text as="p" variant="bodySm" fontWeight="medium">
          {title}
        </Text>
        {items.length > 0 ? (
          <BlockStack gap="050">
            {items.map((item, index) => (
              <Text key={`${title}-${index}-${item}`} as="p" variant="bodySm" tone="subdued">
                {item}
              </Text>
            ))}
          </BlockStack>
        ) : (
          <Text as="p" variant="bodySm" tone="subdued">
            {empty}
          </Text>
        )}
      </BlockStack>
    </Box>
  );
}

function StepOutcomeLine({ title, outcome }: { title: string; outcome?: StepOutcomeState }) {
  if (!outcome) return null;

  return (
    <Text as="p" variant="bodySm" tone={outcome.status === 'error' ? 'critical' : 'subdued'}>
      {[
        `${title}:`,
        outcome.status,
        outcome.updatedAt
          ? new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' }).format(
              new Date(outcome.updatedAt)
            )
          : '',
        formatOutcomeDelta(outcome.delta),
        outcome.error || outcome.message || '',
      ]
        .filter(Boolean)
        .join(' ')}
    </Text>
  );
}

function InlineActionForm({
  productId,
  shopifyProductId,
  productName,
  intent,
  label,
  icon,
  hasContent,
  destructive = false,
  enrichmentUrl,
  disabled = false,
  loading = false,
  variant = 'secondary',
  onActionStart,
}: {
  productId: string;
  shopifyProductId: string;
  productName?: string;
  intent: string;
  label: string;
  icon?: unknown;
  hasContent?: boolean;
  destructive?: boolean;
  enrichmentUrl?: string;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'tertiary';
  onActionStart?: () => void;
}) {
  const submit = useSubmit();

  function submitAction() {
    if (disabled || loading) return;
    onActionStart?.();

    const formData = new FormData();
    formData.set('intent', intent);
    formData.set('productId', productId);
    formData.set('shopifyProductId', shopifyProductId);
    formData.set('productName', productName || '');
    formData.set('hasContent', hasContent ? 'true' : 'false');
    formData.set('enrichmentUrl', enrichmentUrl || '');
    submit(formData, { method: 'post' });
  }

  return (
    <Button
      icon={icon as never}
      variant={variant}
      tone={destructive ? 'critical' : undefined}
      disabled={disabled || loading}
      loading={loading}
      onClick={submitAction}
    >
      {label}
    </Button>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
