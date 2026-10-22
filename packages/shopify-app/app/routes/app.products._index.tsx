import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from 'react-router';
import {
  Form,
  redirect,
  useActionData,
  useLoaderData,
  useNavigate,
  useNavigation,
  useSearchParams,
  useSubmit,
} from 'react-router';
import { useEffect, useState } from 'react';
import { boundary } from '@shopify/shopify-app-react-router/server';
import { Banner, BlockStack, Checkbox, Modal, Text, TextField } from '@shopify/polaris';
import { AppPage } from '../components/shell-ui';
import { shellSetupProgress, useAppBootstrapData } from './app';
import { useActionToast } from '../lib/appBridge';
import { handleProductAction } from '../lib/productActions.server';
import { loadProductWorkspace } from '../lib/productWorkspace.server';
import {
  BULK_DRAFT_LIMIT,
  PRODUCT_TABS,
  PRODUCT_TAB_LABELS,
  buildWorkspaceRows,
  countWorkspaceRows,
  getJourneyMeta,
  getLifecyclePresentation,
  paginateRows,
  parseProductTab,
  searchWorkspaceRows,
  type ProductTab,
} from '../lib/productWorkspace';

/**
 * Products list on Shopify's Index table pattern: filter tabs with counts,
 * search, bulk selection and paging, all computed on the server from the full
 * catalog (lib/productCatalog.server.ts) so counts cover every product, not
 * one page. A product opens on its own route, /app/products/:productId.
 *
 * React 18 note: Polaris web components need React 19 for controlled fields and
 * custom events, so selection checkboxes and the search field stay Polaris
 * React, and paging uses buttons instead of s-table's page events.
 */

const PAGE_SIZE = 25;

const BADGE_TONE = { attention: 'warning', info: 'info', success: 'success', critical: 'critical' } as const;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  // The product used to open in place behind ?product=; it has its own route now.
  const legacyProductId = url.searchParams.get('product');
  if (legacyProductId) {
    url.searchParams.delete('product');
    throw redirect(`/app/products/${encodeURIComponent(legacyProductId)}${url.search}`);
  }

  const workspace = await loadProductWorkspace(request);
  const rows = buildWorkspaceRows(
    workspace.catalogProducts,
    workspace.merchantProducts,
    workspace.instructions,
    workspace.productFacts,
    workspace.serviceLanguages,
    workspace.multiLangEnabled
  );

  const tab = parseProductTab(url.searchParams.get('tab'));
  const query = (url.searchParams.get('q') || '').slice(0, 200);
  const searched = searchWorkspaceRows(rows, query);
  const filtered = tab === 'all' ? searched : searched.filter((row) => row.state === tab);
  const page = paginateRows(filtered, Number(url.searchParams.get('page') || 1), PAGE_SIZE);

  return {
    tab,
    query,
    tabCounts: countWorkspaceRows(searched),
    totals: countWorkspaceRows(rows),
    // "Draft all with AI" and bulk drafting only touch products with no guidance:
    // drafting over existing instructions would replace what the merchant wrote.
    needsGuidanceIds: rows
      .filter((row) => !row.instruction?.usage_instructions?.trim())
      .map((row) => row.shopify.id),
    page: page.page,
    pageCount: page.pageCount,
    hasPrevious: page.hasPrevious,
    hasNext: page.hasNext,
    filteredCount: filtered.length,
    items: page.items.map((row) => {
      const lifecycle = getLifecyclePresentation(row);
      return {
        id: row.shopify.id,
        title: row.shopify.title,
        imageUrl: row.shopify.featuredImageUrl || null,
        vendor: row.shopify.vendor || null,
        hasGuidance: row.hasGuidance,
        statusLabel: lifecycle.label,
        statusTone: BADGE_TONE[lifecycle.tone],
        message: lifecycle.message,
        nextActionLabel: getJourneyMeta(row).nextActionLabel,
      };
    }),
    catalogTruncated: workspace.catalogTruncated,
    catalogLimit: workspace.catalogLimit,
    dataUnavailable: workspace.dataUnavailable,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => handleProductAction(request);

export default function ProductsPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const submit = useSubmit();
  const [searchParams, setSearchParams] = useSearchParams();
  const { bootstrapData: shellBootstrap } = useAppBootstrapData();
  useActionToast(actionData?.ok && actionData.message ? actionData.message : null, actionData);

  const [searchInput, setSearchInput] = useState(data.query);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showManualEntryModal, setShowManualEntryModal] = useState(false);
  const [manualSourceDraft, setManualSourceDraft] = useState({ name: '', url: '', enrichmentUrl: '' });

  const busy = navigation.state === 'submitting';
  const currentIntent = String(navigation.formData?.get('intent') || '');
  const isBulkDrafting = busy && currentIntent === 'bulk-draft';
  const isBulkPreparing = busy && currentIntent === 'bulk-prepare';

  function updateView(next: { tab?: ProductTab; q?: string; page?: number }) {
    const params = new URLSearchParams(searchParams);
    if (next.tab !== undefined) params.set('tab', next.tab);
    if (next.q !== undefined) params.set('q', next.q);
    // A new tab or search starts on page 1; paging keeps both.
    params.set('page', String(next.page ?? 1));
    if (params.get('tab') === 'all') params.delete('tab');
    if (!params.get('q')) params.delete('q');
    if (params.get('page') === '1') params.delete('page');
    setSearchParams(params, { replace: true, preventScrollReset: true });
  }

  // Search as the merchant types, once they pause.
  useEffect(() => {
    if (searchInput === data.query) return;
    const timer = window.setTimeout(() => updateView({ q: searchInput.trim() }), 300);
    return () => window.clearTimeout(timer);
    // updateView reads the current URL; the input and loaded query are what change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, data.query]);

  useEffect(() => {
    if (!actionData?.ok) return;
    if (actionData.intent === 'bulk-draft' || actionData.intent === 'bulk-prepare') setSelectedIds([]);
    if (actionData.intent === 'create') {
      setShowManualEntryModal(false);
      setManualSourceDraft({ name: '', url: '', enrichmentUrl: '' });
    }
  }, [actionData]);

  const pageIds = data.items.map((item) => item.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const someOnPageSelected = pageIds.some((id) => selectedIds.includes(id));
  const selectedNeedingGuidance = selectedIds.filter((id) => data.needsGuidanceIds.includes(id));

  function toggleRow(id: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? (current.includes(id) ? current : [...current, id]) : current.filter((value) => value !== id)
    );
  }

  function togglePage(checked: boolean) {
    setSelectedIds((current) =>
      checked
        ? [...current, ...pageIds.filter((id) => !current.includes(id))]
        : current.filter((id) => !pageIds.includes(id))
    );
  }

  function submitBulk(intent: 'bulk-draft' | 'bulk-prepare', ids: string[]) {
    if (!ids.length) return;
    const formData = new FormData();
    formData.set('intent', intent);
    formData.set('shopifyProductIds', ids.join(','));
    submit(formData, { method: 'post' });
  }

  const needsAction = data.totals.needs_setup + data.totals.needs_ai_answers;
  const allReady = data.totals.all > 0 && data.totals.ready === data.totals.all;
  const setupComplete = Boolean(
    shellBootstrap?.overview && shellSetupProgress(shellBootstrap.overview, shellBootstrap).setupComplete
  );

  return (
    <AppPage
      heading="Products"
      subtitle={
        needsAction > 0
          ? `${needsAction} product${needsAction === 1 ? '' : 's'} need action · ${data.totals.ready} of ${data.totals.all} ready`
          : `All ${data.totals.all} products are ready.`
      }
      primaryAction={
        data.needsGuidanceIds.length > 0
          ? {
              content: `Draft all with AI (${Math.min(data.needsGuidanceIds.length, BULK_DRAFT_LIMIT)})`,
              onAction: () => submitBulk('bulk-draft', data.needsGuidanceIds),
              loading: isBulkDrafting || undefined,
              disabled: busy || undefined,
            }
          : undefined
      }
      secondaryActions={[{ content: 'Add manual source', onAction: () => setShowManualEntryModal(true) }]}
    >
      {data.catalogTruncated ? (
        <Banner tone="warning" title="Showing your first products only">
          <p>
            {`Recete loads up to ${data.catalogLimit.toLocaleString('en')} products from Shopify. Products beyond that are not listed here yet.`}
          </p>
        </Banner>
      ) : null}

      {data.dataUnavailable ? (
        <Banner tone="warning" title="Couldn't reach Recete">
          <p>
            Some product data below may be stale or missing — we couldn&apos;t load current data.
            Refresh in a moment.
          </p>
        </Banner>
      ) : null}

      {isBulkDrafting ? (
        <Banner tone="info" title="Drafting instructions">
          <p>Drafting from your product descriptions. This can take a minute — keep this page open.</p>
        </Banner>
      ) : null}

      {actionData && !actionData.ok && actionData.error ? (
        <Banner tone="critical" title="Product action failed">
          <p>{actionData.error}</p>
        </Banner>
      ) : null}

      {allReady ? (
        <Banner tone="success" title="You're all set">
          <p>All products are ready. Recete can now answer customer questions after delivery.</p>
          {setupComplete ? (
            <s-stack direction="inline" gap="small-200">
              <s-button variant="primary" onClick={() => navigate('/app/dashboard')}>
                Go to dashboard
              </s-button>
              <s-button onClick={() => navigate('/app/conversations')}>View conversations</s-button>
            </s-stack>
          ) : null}
        </Banner>
      ) : null}

      <s-section padding="none" accessibilityLabel="Products">
        <s-grid gap="small-300" padding="base">
          {/* Filter tabs: counts follow the current search. */}
          <s-stack direction="inline" gap="small-200">
            {PRODUCT_TABS.map((tab) => (
              <s-button
                key={tab}
                variant={data.tab === tab ? 'secondary' : 'tertiary'}
                accessibilityLabel={`${PRODUCT_TAB_LABELS[tab]}: ${data.tabCounts[tab]} products`}
                onClick={() => updateView({ tab })}
              >
                {`${PRODUCT_TAB_LABELS[tab]} (${data.tabCounts[tab]})`}
              </s-button>
            ))}
          </s-stack>
          <TextField
            label="Search products"
            labelHidden
            autoComplete="off"
            placeholder="Search by product title, handle, or vendor"
            value={searchInput}
            onChange={setSearchInput}
            clearButton
            onClearButtonClick={() => setSearchInput('')}
          />
          {selectedIds.length > 0 ? (
            <s-box padding="small" background="subdued" borderRadius="base">
              <s-grid gridTemplateColumns="1fr auto" gap="small-300" alignItems="center">
                <s-text>{`${selectedIds.length} selected`}</s-text>
                <s-stack direction="inline" gap="small-200">
                  <s-button
                    disabled={!selectedNeedingGuidance.length || busy || undefined}
                    loading={isBulkDrafting || undefined}
                    accessibilityLabel="Draft instructions with AI for selected products without instructions"
                    onClick={() => submitBulk('bulk-draft', selectedNeedingGuidance)}
                  >
                    {`Draft with AI (${selectedNeedingGuidance.length})`}
                  </s-button>
                  <s-button
                    disabled={busy || undefined}
                    loading={isBulkPreparing || undefined}
                    onClick={() => submitBulk('bulk-prepare', selectedIds)}
                  >
                    Update AI
                  </s-button>
                  <s-button variant="tertiary" onClick={() => setSelectedIds([])}>
                    Clear
                  </s-button>
                </s-stack>
              </s-grid>
            </s-box>
          ) : null}
        </s-grid>

        {data.items.length === 0 ? (
          <s-grid gap="small-200" padding="large" justifyItems="center">
            <s-heading>No products match this view</s-heading>
            <s-paragraph color="subdued">Try a different tab or search term.</s-paragraph>
          </s-grid>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">
                <s-stack direction="inline" gap="small-200" alignItems="center">
                  <Checkbox
                    label="Select all products on this page"
                    labelHidden
                    checked={allOnPageSelected ? true : someOnPageSelected ? 'indeterminate' : false}
                    onChange={togglePage}
                  />
                  <s-text>Product</s-text>
                </s-stack>
              </s-table-header>
              <s-table-header listSlot="secondary">Status</s-table-header>
              <s-table-header listSlot="labeled">Instructions</s-table-header>
              <s-table-header listSlot="inline">Action</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {data.items.map((item) => (
                <s-table-row key={item.id}>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small-300" alignItems="center">
                      <Checkbox
                        label={`Select ${item.title}`}
                        labelHidden
                        checked={selectedIds.includes(item.id)}
                        onChange={(checked) => toggleRow(item.id, checked)}
                      />
                      <s-thumbnail src={item.imageUrl || undefined} alt={item.title} size="small" />
                      <s-stack gap="none">
                        <s-link
                          href={`/app/products/${item.id}`}
                          onClick={(event) => {
                            event.preventDefault();
                            navigate(`/app/products/${item.id}`);
                          }}
                        >
                          {item.title}
                        </s-link>
                        <s-text color="subdued">{item.message}</s-text>
                      </s-stack>
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge tone={item.statusTone}>{item.statusLabel}</s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    {item.hasGuidance ? (
                      <s-badge tone="success">Added</s-badge>
                    ) : (
                      <s-badge tone="warning">Missing</s-badge>
                    )}
                  </s-table-cell>
                  <s-table-cell>
                    <s-button onClick={() => navigate(`/app/products/${item.id}`)}>
                      {item.nextActionLabel}
                    </s-button>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}

        {data.pageCount > 1 ? (
          <s-grid gridTemplateColumns="1fr auto" gap="small-300" padding="base" alignItems="center">
            <s-text color="subdued">
              {`Page ${data.page} of ${data.pageCount} · ${data.filteredCount} products`}
            </s-text>
            <s-stack direction="inline" gap="small-200">
              <s-button
                icon="chevron-left"
                accessibilityLabel="Previous page"
                disabled={!data.hasPrevious || undefined}
                onClick={() => updateView({ page: data.page - 1 })}
              />
              <s-button
                icon="chevron-right"
                accessibilityLabel="Next page"
                disabled={!data.hasNext || undefined}
                onClick={() => updateView({ page: data.page + 1 })}
              />
            </s-stack>
          </s-grid>
        ) : null}
      </s-section>

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
    </AppPage>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
