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
} from '../platform.server';
import { authenticateEmbeddedAdmin } from './embeddedAuth.server';
import { dismissBulkDraft, startBulkDraft } from './bulkDraft.server';
import { getActionErrorMessage, persistProductSetup } from './productSetup.server';
import { type ActionResult, type StepOutcomeState } from './productWorkspace';

function normalizeOptionalUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return `https://${trimmed}`;
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
        // instead of writing a dozen texts by hand. Runs as a background job
        // the page follows (bulkDraft.server.ts).
        const started = await startBulkDraft({
          request,
          shopDomain: session.shop,
          shopifyProductIds: String(formData.get('shopifyProductIds') || '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
        });
        if (!started.ok) {
          return { ok: false, intent, error: started.error } satisfies ActionResult;
        }
        return {
          ok: true,
          intent,
          message: started.alreadyRunning
            ? 'Recete is already drafting instructions for your products.'
            : `Drafting instructions for ${started.queued} product${started.queued === 1 ? '' : 's'}. You can leave this page; Recete keeps going.${
                started.remaining > 0 ? ` ${started.remaining} more left — run it again when this finishes.` : ''
              }`,
        } satisfies ActionResult;
      }
      case 'bulk-draft-dismiss': {
        await dismissBulkDraft(session.shop, String(formData.get('jobId') || ''));
        return { ok: true, intent } satisfies ActionResult;
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
