/**
 * "Draft all with AI" and "Update AI" as background jobs.
 *
 * It used to run inside the form request: draft, save and prepare AI knowledge
 * for each product, one after another. Past 60 seconds nginx answered 504 while
 * the work carried on unseen, and a deploy restart cut it off halfway. Now the
 * action stores a job with one item per product and returns at once; this
 * process works through the items, BULK_DRAFT_CONCURRENCY at a time, and the
 * Products page polls /app/products/bulk-draft-status.
 *
 * A restart loses the runner, not the job: the next status read finds the job
 * RUNNING with no runner in this process, puts interrupted items back to
 * PENDING and resumes. Retrying an item is safe: persistProductSetup links the
 * existing Recete product for a Shopify product before it creates one.
 *
 * "Update AI" (kind PREPARE) runs the same way: each item rebuilds one product's
 * AI knowledge. Products without a saved setup are recorded as skipped up front.
 *
 * The runner calls the platform API as the job's shop. That shop came from the
 * verified Shopify session that created the job, never from client input.
 */
import prisma from '../db.server';
import {
  draftMerchantProductInstructions,
  fetchMerchantMappingData,
  prepareMerchantProductKnowledge,
} from '../platform.server';
import { getPlanSnapshotByDomain } from '../services/planService.server';
import { fetchFullShopifyCatalog } from './productCatalog.server';
import { getActionErrorMessage, persistProductSetup } from './productSetup.server';
import { BULK_DRAFT_LIMIT } from './productWorkspace';
import { normalizeShopDomain, setVerifiedShopDomain } from './verifiedShop.server';

export const BULK_DRAFT_CONCURRENCY = 4;
const LIMIT_REACHED_PREFIX = 'Product limit reached';
const LIMIT_REACHED_NOTE = 'Your plan’s product limit was reached.';
const NOT_SET_UP_NOTE = 'No saved setup yet.';

export interface BulkDraftItemInput {
  shopifyProductId: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  productType: string | null;
  vendor: string | null;
}

interface Draft {
  usage_instructions: string;
  recipe_summary?: string | null;
  prevention_tips?: string | null;
}

export interface BulkDraftSteps {
  draft(item: BulkDraftItemInput): Promise<Draft | null>;
  save(item: BulkDraftItemInput, draft: Draft): Promise<{ ok: boolean; productId?: string; error?: string }>;
  prepare(productId: string): Promise<unknown>;
}

export interface BulkDraftItemOutcome {
  status: 'SAVED' | 'FAILED' | 'SKIPPED';
  error?: string;
  limitReached?: boolean;
}

/** Draft, save and prepare one product. Never throws. */
export async function processBulkDraftItem(
  item: BulkDraftItemInput,
  steps: BulkDraftSteps
): Promise<BulkDraftItemOutcome> {
  let draft: Draft | null;
  try {
    draft = await steps.draft(item);
  } catch (error) {
    return { status: 'FAILED', error: await getActionErrorMessage(error, 'Could not draft instructions.') };
  }
  if (!draft?.usage_instructions?.trim()) {
    return { status: 'FAILED', error: 'Recete could not draft instructions for this product.' };
  }

  const saved = await steps.save(item, draft).catch(async (error: unknown) => ({
    ok: false,
    productId: undefined,
    error: await getActionErrorMessage(error, 'Saving failed.'),
  }));
  if (!saved.ok) {
    const error = saved.error || 'Saving failed.';
    return error.startsWith(LIMIT_REACHED_PREFIX)
      ? { status: 'SKIPPED', error: LIMIT_REACHED_NOTE, limitReached: true }
      : { status: 'FAILED', error };
  }

  // The instructions are saved either way; AI answers can be updated from the
  // product page if this step fails.
  if (saved.productId) {
    await steps.prepare(saved.productId).catch((error: unknown) => {
      console.warn('[bulk-draft] prepare knowledge failed', error instanceof Error ? error.message : error);
    });
  }
  return { status: 'SAVED' };
}

/** "Update AI": rebuild one product's AI knowledge. Never throws. */
export async function processBulkPrepareItem(
  recipeProductId: string | null,
  prepare: BulkDraftSteps['prepare']
): Promise<BulkDraftItemOutcome> {
  if (!recipeProductId) return { status: 'SKIPPED', error: NOT_SET_UP_NOTE };
  try {
    await prepare(recipeProductId);
    return { status: 'SAVED' };
  } catch (error) {
    return { status: 'FAILED', error: await getActionErrorMessage(error, 'Could not update AI answers.') };
  }
}

/** Runs `work` on up to `concurrency` tasks at a time until `next` returns null. */
export async function runPool<T>(
  concurrency: number,
  next: () => Promise<T | null>,
  work: (task: T) => Promise<void>
) {
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      for (let task = await next(); task !== null; task = await next()) {
        await work(task);
      }
    })
  );
}

/**
 * Runs calls one at a time. Saving checks the plan's product limit and then
 * creates the product; in parallel, several saves could pass the check together.
 */
export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(fn: () => Promise<T>): Promise<T> => {
    const run = tail.then(fn, fn);
    tail = run.catch(() => undefined);
    return run;
  };
}

function platformStepsForShop(shopDomain: string): BulkDraftSteps {
  // platform.server builds API headers from the verified shop of a Request.
  const request = new Request('https://recete.internal/app/products/bulk-draft');
  setVerifiedShopDomain(request, shopDomain);
  const serial = createSerialQueue();

  return {
    async draft(item) {
      const { drafts } = await draftMerchantProductInstructions(request, [
        {
          key: item.shopifyProductId,
          title: item.title,
          description: item.descriptionHtml,
          productType: item.productType || undefined,
          vendor: item.vendor || undefined,
        },
      ]);
      return drafts.find((draft) => draft.key === item.shopifyProductId) || null;
    },
    save(item, draft) {
      return serial(() =>
        persistProductSetup({
          request,
          shopDomain,
          selectedProductId: item.shopifyProductId,
          title: item.title,
          handle: item.handle,
          externalId: item.shopifyProductId,
          descriptionHtml: item.descriptionHtml,
          usageInstructions: draft.usage_instructions,
          recipeSummary: draft.recipe_summary || '',
          preventionTips: draft.prevention_tips || '',
          videoUrl: '',
          existingProductId: '',
        })
      );
    },
    prepare: (productId) => prepareMerchantProductKnowledge(request, productId),
  };
}

const activeRunners = new Set<string>();

async function claimNextItem(jobId: string) {
  for (;;) {
    const item = await prisma.bulkDraftItem.findFirst({
      where: { jobId, status: 'PENDING' },
      orderBy: { position: 'asc' },
    });
    if (!item) return null;
    const claimed = await prisma.bulkDraftItem.updateMany({
      where: { id: item.id, status: 'PENDING' },
      data: { status: 'RUNNING' },
    });
    if (claimed.count === 1) return item;
  }
}

async function runJob(jobId: string) {
  if (activeRunners.has(jobId)) return;
  activeRunners.add(jobId);
  try {
    const job = await prisma.bulkDraftJob.findUnique({ where: { id: jobId } });
    if (!job || job.status !== 'RUNNING') return;
    // Items an earlier runner was working on when the process stopped.
    await prisma.bulkDraftItem.updateMany({ where: { jobId, status: 'RUNNING' }, data: { status: 'PENDING' } });

    const jobSteps = platformStepsForShop(job.shopDomain);
    let limitReached = false;
    await runPool(
      BULK_DRAFT_CONCURRENCY,
      async () => (limitReached ? null : claimNextItem(jobId)),
      async (item) => {
        const outcome =
          job.kind === 'PREPARE'
            ? await processBulkPrepareItem(item.recipeProductId, jobSteps.prepare)
            : await processBulkDraftItem(item, jobSteps);
        if (outcome.limitReached) limitReached = true;
        await prisma.bulkDraftItem.update({
          where: { id: item.id },
          data: { status: outcome.status, error: outcome.error?.slice(0, 500) ?? null },
        });
      }
    );

    if (limitReached) {
      await prisma.bulkDraftItem.updateMany({
        where: { jobId, status: 'PENDING' },
        data: { status: 'SKIPPED', error: LIMIT_REACHED_NOTE },
      });
    }
    await prisma.bulkDraftJob.update({
      where: { id: jobId },
      data: { status: 'DONE', finishedAt: new Date(), limitReached },
    });
  } catch (error) {
    // Left RUNNING: the next status read resumes it.
    console.error('[bulk-draft] job stopped', jobId, error instanceof Error ? error.message : error);
  } finally {
    activeRunners.delete(jobId);
  }
}

export type StartBulkJobResult =
  | { ok: true; jobId: string; queued: number; remaining: number; alreadyRunning: boolean }
  | { ok: false; error: string };

type CatalogProduct = Awaited<ReturnType<typeof fetchFullShopifyCatalog>>['products'][number];

/**
 * One job per shop at a time: a second click (or the other bulk action) while
 * one runs returns the running job.
 */
async function startJob(input: {
  request: Request;
  shopDomain: string;
  shopifyProductIds: string[];
  kind: 'DRAFT' | 'PREPARE';
  emptyError: string;
  /** Recete product per Shopify product, for PREPARE. */
  recipeProductIds?: (request: Request) => Promise<Map<string, string>>;
}): Promise<StartBulkJobResult> {
  const requested = new Set(input.shopifyProductIds);
  if (!requested.size) return { ok: false, error: input.emptyError };

  const plan = await getPlanSnapshotByDomain(input.shopDomain);
  const running = await prisma.bulkDraftJob.findFirst({ where: { shopId: plan.shopId, status: 'RUNNING' } });
  if (running) {
    void runJob(running.id);
    return { ok: true, jobId: running.id, queued: 0, remaining: 0, alreadyRunning: true };
  }

  const catalog = await fetchFullShopifyCatalog(input.request);
  const targets: CatalogProduct[] = catalog.products
    .filter((product) => requested.has(product.id))
    .slice(0, BULK_DRAFT_LIMIT);
  if (!targets.length) return { ok: false, error: input.emptyError };
  const recipeIds = input.recipeProductIds ? await input.recipeProductIds(input.request) : null;

  // Only the latest job is kept.
  await prisma.bulkDraftJob.deleteMany({ where: { shopId: plan.shopId } });
  const job = await prisma.bulkDraftJob.create({
    data: {
      kind: input.kind,
      shopId: plan.shopId,
      shopDomain: normalizeShopDomain(input.shopDomain),
      items: {
        create: targets.map((product, position) => {
          const recipeProductId = recipeIds?.get(product.id) ?? null;
          return {
            position,
            shopifyProductId: product.id,
            title: product.title,
            handle: product.handle,
            descriptionHtml: product.descriptionHtml || '',
            productType: product.productType || null,
            vendor: product.vendor || null,
            recipeProductId,
            ...(recipeIds && !recipeProductId ? { status: 'SKIPPED' as const, error: NOT_SET_UP_NOTE } : {}),
          };
        }),
      },
    },
  });
  void runJob(job.id);
  return { ok: true, jobId: job.id, queued: targets.length, remaining: requested.size - targets.length, alreadyRunning: false };
}

export function startBulkDraft(input: { request: Request; shopDomain: string; shopifyProductIds: string[] }) {
  return startJob({ ...input, kind: 'DRAFT', emptyError: 'No products need instructions.' });
}

export function startBulkPrepare(input: { request: Request; shopDomain: string; shopifyProductIds: string[] }) {
  return startJob({
    ...input,
    kind: 'PREPARE',
    emptyError: 'Select at least one product.',
    recipeProductIds: async (request) => {
      const mapping = await fetchMerchantMappingData(request);
      return new Map(
        (mapping.localProducts || [])
          .filter((product) => product.external_id)
          .map((product) => [String(product.external_id), product.id])
      );
    },
  });
}

export interface BulkDraftStatus {
  jobId: string;
  /** draft: "Draft all with AI"; prepare: "Update AI". */
  kind: 'draft' | 'prepare';
  running: boolean;
  total: number;
  finished: number;
  saved: number;
  failed: Array<{ title: string; error: string | null }>;
  skipped: number;
  /** Titles of skipped products (for "Update AI": not set up yet). */
  skippedTitles: string[];
  limitReached: boolean;
  /** Shopify product ids still waiting or being worked on. */
  inProgressIds: string[];
}

/**
 * The shop's current job: running, or finished and not yet dismissed. Resumes a
 * running job that has no runner in this process (after a restart).
 */
export async function getBulkDraftStatus(shopDomain: string): Promise<BulkDraftStatus | null> {
  const job = await prisma.bulkDraftJob.findFirst({
    where: {
      shopDomain: normalizeShopDomain(shopDomain),
      OR: [{ status: 'RUNNING' }, { status: 'DONE', seenAt: null }],
    },
    orderBy: { createdAt: 'desc' },
    include: { items: { select: { shopifyProductId: true, title: true, status: true, error: true }, orderBy: { position: 'asc' } } },
  });
  if (!job) return null;
  if (job.status === 'RUNNING' && !activeRunners.has(job.id)) void runJob(job.id);

  const items = job.items;
  const inProgress = items.filter((item) => item.status === 'PENDING' || item.status === 'RUNNING');
  return {
    jobId: job.id,
    kind: job.kind === 'PREPARE' ? 'prepare' : 'draft',
    running: job.status === 'RUNNING',
    total: items.length,
    finished: items.length - inProgress.length,
    saved: items.filter((item) => item.status === 'SAVED').length,
    failed: items.filter((item) => item.status === 'FAILED').map((item) => ({ title: item.title, error: item.error })),
    skipped: items.filter((item) => item.status === 'SKIPPED').length,
    skippedTitles: items.filter((item) => item.status === 'SKIPPED').map((item) => item.title),
    limitReached: job.limitReached,
    inProgressIds: inProgress.map((item) => item.shopifyProductId),
  };
}

/** The merchant closed the result banner. */
export async function dismissBulkDraft(shopDomain: string, jobId: string) {
  await prisma.bulkDraftJob.updateMany({
    where: { id: jobId, shopDomain: normalizeShopDomain(shopDomain), status: 'DONE' },
    data: { seenAt: new Date() },
  });
}
