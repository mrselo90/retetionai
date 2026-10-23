import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from 'react-router';
import { useActionData, useLoaderData, useNavigation, useSubmit } from 'react-router';
import { useMemo, useState } from 'react';
import { SaveBar } from '@shopify/app-bridge-react';
import { boundary } from '@shopify/shopify-app-react-router/server';
import type { ProductStepOutcome } from '../platform.server';
import { AppPage } from '../components/shell-ui';
import {
  ProductSetupAside,
  ProductSetupMain,
  buildSaveSetupForm,
} from '../components/ProductSetupPanel';
import { useActionToast, useEditProductInShopify } from '../lib/appBridge';
import { handleProductAction } from '../lib/productActions.server';
import { loadProductWorkspace } from '../lib/productWorkspace.server';
import {
  buildWorkspaceRows,
  draftFromInstruction,
  emptyDraft,
  type MappingDraft,
  type StepOutcomeState,
} from '../lib/productWorkspace';

/**
 * One product's Recete setup: customer instructions, AI knowledge, answer
 * preview. Split out of the Products list, which used to render it in place
 * behind `?product=` (old links redirect here).
 */

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const productId = params.productId || '';
  const workspace = await loadProductWorkspace(request);
  return { ...workspace, productId };
};

export const action = async ({ request }: ActionFunctionArgs) => handleProductAction(request);

export default function ProductDetailPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const editInShopify = useEditProductInShopify();
  useActionToast(actionData?.ok && actionData.message ? actionData.message : null, actionData);

  const row = useMemo(
    () =>
      buildWorkspaceRows(
        data.catalogProducts,
        data.merchantProducts,
        data.instructions,
        data.productFacts,
        data.serviceLanguages,
        data.multiLangEnabled
      ).find((candidate) => candidate.shopify.id === data.productId) || null,
    [data]
  );

  const [draft, setDraft] = useState<MappingDraft>(() => draftFromInstruction(row?.instruction));
  const [savedDraft, setSavedDraft] = useState<MappingDraft | null>(null);
  const [workflowUrl, setWorkflowUrl] = useState('');
  const [previewQuestion, setPreviewQuestion] = useState('How do I use this product?');
  const [previewAnswer, setPreviewAnswer] = useState('');
  const [stepOutcomes, setStepOutcomes] = useState<
    Partial<Record<ProductStepOutcome['step'], StepOutcomeState>>
  >({});

  // Both adjusted during render, in this order: a different product resets the
  // local state, then an action result (new, or for the product just switched
  // to) is applied to it. No result counts as handled at first, so one present
  // on mount is applied too.
  const [handled, setHandled] = useState<{
    productId: string;
    actionData: typeof actionData;
  }>({ productId: data.productId, actionData: undefined });
  if (handled.productId !== data.productId || handled.actionData !== actionData) {
    setHandled({ productId: data.productId, actionData });

    // Navigating between products reuses this component: start each one fresh.
    // Only on a different product; row.instruction changes after every save.
    if (handled.productId !== data.productId) {
      setDraft(draftFromInstruction(row?.instruction));
      setSavedDraft(null);
      setWorkflowUrl('');
      setPreviewQuestion('How do I use this product?');
      setPreviewAnswer('');
      setStepOutcomes({});
    }

    if (actionData && actionData.selectedProductId === data.productId) {
      if (actionData.stepOutcomes?.length) {
        setStepOutcomes((current) => {
          const next = { ...current };
          for (const outcome of actionData.stepOutcomes || []) next[outcome.step] = outcome;
          return next;
        });
      }
      if (actionData.ok && actionData.intent === 'save-setup' && actionData.savedDraft) {
        setSavedDraft(actionData.savedDraft);
        setDraft(actionData.savedDraft);
        // The extra source was read during the save; it isn't stored.
        setWorkflowUrl('');
      }
      if (actionData.ok && actionData.intent === 'delete') {
        setDraft(emptyDraft());
        setSavedDraft(null);
      }
      if (actionData.ok && actionData.intent === 'preview-answer') {
        setPreviewQuestion((current) => actionData.previewQuestion || current);
        setPreviewAnswer(actionData.previewAnswer || '');
      }
    }
  }

  if (!row) {
    return (
      <AppPage
        heading="Product not found"
        backAction={{ content: 'Products', url: '/app/products' }}
      >
        <s-banner tone="warning" heading="This product isn't in your catalog">
          <s-paragraph>
            It may have been deleted in Shopify. Go back to Products to pick another one.
          </s-paragraph>
        </s-banner>
      </AppPage>
    );
  }

  const initialDraft = savedDraft || draftFromInstruction(row.instruction);
  const draftDirty = JSON.stringify(draft) !== JSON.stringify(initialDraft);
  // An extra source URL counts as a change: it's only read when saving.
  const dirty = draftDirty || Boolean(workflowUrl.trim());
  const submitting = navigation.state === 'submitting';
  const currentIntent = String(navigation.formData?.get('intent') || '');
  const isSavingSetup = submitting && currentIntent === 'save-setup';
  const isRunningAiAction = submitting && currentIntent === 'embeddings';
  const isDeletingLocalSetup = submitting && currentIntent === 'delete';
  const processRunning = isSavingSetup || isRunningAiAction || isDeletingLocalSetup;
  const isManualSource = !data.catalogProducts.some((product) => product.id === row.shopify.id);
  const actionError =
    actionData && !actionData.ok && actionData.selectedProductId === row.shopify.id
      ? actionData.error || null
      : null;

  function save() {
    if (!row || processRunning) return;
    submit(buildSaveSetupForm(row, draft, workflowUrl), { method: 'post' });
  }

  function discard() {
    setDraft(initialDraft);
    setWorkflowUrl('');
  }

  return (
    <AppPage
      heading={row.shopify.title}
      backAction={{ content: 'Products', url: '/app/products' }}
      secondaryActions={
        isManualSource
          ? undefined
          : [{ content: 'Edit in Shopify', onAction: () => editInShopify(row.shopify.id) }]
      }
      showShellBanner={false}
      aside={
        <ProductSetupAside
          row={row}
          draft={draft}
          dirty={dirty}
          actionError={actionError}
          stepOutcomes={stepOutcomes}
          processRunning={processRunning}
          isRunningAiAction={isRunningAiAction}
        />
      }
    >
      {/* Shopify's save bar, as on Settings: saving also rebuilds the AI answers. */}
      <SaveBar id="product-setup-save-bar" open={dirty}>
        <button variant="primary" onClick={save} loading={isSavingSetup ? '' : undefined}>
          Save
        </button>
        <button onClick={discard} disabled={processRunning}>
          Discard
        </button>
      </SaveBar>
      {data.dataUnavailable ? (
        <s-banner tone="warning" heading="Couldn't reach Recete">
          <s-paragraph>Some product data may be stale. Refresh in a moment.</s-paragraph>
        </s-banner>
      ) : null}
      <ProductSetupMain
        row={row}
        draft={draft}
        workflowUrl={workflowUrl}
        actionError={actionError}
        previewQuestion={previewQuestion}
        previewAnswer={previewAnswer}
        onPreviewQuestionChange={setPreviewQuestion}
        processRunning={processRunning}
        isDeletingLocalSetup={isDeletingLocalSetup}
        isPreviewingAnswer={submitting && currentIntent === 'preview-answer'}
        onChangeDraft={(field, value) => setDraft((current) => ({ ...current, [field]: value }))}
        onWorkflowUrlChange={setWorkflowUrl}
      />
    </AppPage>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
