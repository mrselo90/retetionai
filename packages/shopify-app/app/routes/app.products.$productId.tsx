import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from 'react-router';
import { useActionData, useLoaderData, useNavigate, useNavigation } from 'react-router';
import { useEffect, useMemo, useState } from 'react';
import { boundary } from '@shopify/shopify-app-react-router/server';
import type { ProductStepOutcome } from '../platform.server';
import { AppPage } from '../components/shell-ui';
import { ProductSetupPanel } from '../components/ProductSetupPanel';
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
  const navigate = useNavigate();
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

  // Navigating between products reuses this component: start each one fresh.
  useEffect(() => {
    setDraft(draftFromInstruction(row?.instruction));
    setSavedDraft(null);
    setWorkflowUrl('');
    setPreviewQuestion('How do I use this product?');
    setPreviewAnswer('');
    setStepOutcomes({});
    // Only on a different product; row.instruction changes after every save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.productId]);

  useEffect(() => {
    if (!actionData || actionData.selectedProductId !== data.productId) return;

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
    }
    if (actionData.ok && actionData.intent === 'delete') {
      setDraft(emptyDraft());
      setSavedDraft(null);
    }
    if (actionData.ok && actionData.intent === 'preview-answer') {
      setPreviewQuestion((current) => actionData.previewQuestion || current);
      setPreviewAnswer(actionData.previewAnswer || '');
    }
  }, [actionData, data.productId]);

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
  const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft);
  const submitting = navigation.state === 'submitting';
  const currentIntent = String(navigation.formData?.get('intent') || '');
  const isManualSource = !data.catalogProducts.some((product) => product.id === row.shopify.id);

  return (
    <AppPage
      heading={row.shopify.title}
      backAction={{ content: 'Products', url: '/app/products' }}
      secondaryActions={
        isManualSource
          ? undefined
          : [{ content: 'Edit in Shopify', onAction: () => editInShopify(row.shopify.id) }]
      }
    >
      <s-stack gap="base">
        {data.dataUnavailable ? (
          <s-banner tone="warning" heading="Couldn't reach Recete">
            <s-paragraph>Some product data may be stale. Refresh in a moment.</s-paragraph>
          </s-banner>
        ) : null}
        <ProductSetupPanel
          row={row}
          draft={draft}
          dirty={dirty}
          workflowUrl={workflowUrl}
          actionError={
            actionData && !actionData.ok && actionData.selectedProductId === row.shopify.id
              ? actionData.error || null
              : null
          }
          previewQuestion={previewQuestion}
          previewAnswer={previewAnswer}
          onPreviewQuestionChange={setPreviewQuestion}
          stepOutcomes={stepOutcomes}
          isSavingSetup={submitting && currentIntent === 'save-setup'}
          isRunningAiAction={submitting && currentIntent === 'embeddings'}
          isDeletingLocalSetup={submitting && currentIntent === 'delete'}
          isPreviewingAnswer={submitting && currentIntent === 'preview-answer'}
          onChangeDraft={(field, value) => setDraft((current) => ({ ...current, [field]: value }))}
          onWorkflowUrlChange={setWorkflowUrl}
          onBackToProducts={() => navigate('/app/products')}
        />
      </s-stack>
    </AppPage>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
