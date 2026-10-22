import {
  createMerchantProduct,
  deleteMerchantProduct,
  draftMerchantProductInstructions,
  enrichMerchantProductFromUrl,
  fetchMerchantMappingData,
  generateMerchantProductEmbeddings,
  previewMerchantProductAnswer,
  prepareMerchantProductKnowledge,
  resetMerchantProductKnowledge,
  scrapeMerchantProduct,
  updateMerchantProductInstruction,
} from '../platform.server';
import {
  canCreateRecipe,
  getPlanSnapshotByDomain,
  registerRecipeProduct,
} from '../services/planService.server';
import { authenticateEmbeddedAdmin } from './embeddedAuth.server';
import { fetchFullShopifyCatalog } from './productCatalog.server';
import { BULK_DRAFT_LIMIT, type ActionResult, type StepOutcomeState } from './productWorkspace';

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


/**
 * Every Products form intent (list: bulk-draft, bulk-prepare, create; product
 * detail: save-setup, embeddings, draft-instructions, delete, reset-knowledge,
 * preview-answer). Both Products routes use it as their action.
 */
export async function handleProductAction(request: Request): Promise<ActionResult> {
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
}
