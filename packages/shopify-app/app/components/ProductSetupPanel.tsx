import { useEffect, useRef, useState, type ComponentProps, type ComponentRef, type ReactNode } from 'react';
import { useFetcher, useSubmit } from 'react-router';
import type { ProductStepOutcome } from '../platform.server';
import {
  buildKnowledgeSummary,
  formatOutcomeDelta,
  getLifecyclePresentation,
  type ActionResult,
  type MappingDraft,
  type StepOutcomeState,
  type WorkspaceRow,
} from '../lib/productWorkspace';

/*
 * One product's Recete setup, laid out like a Shopify admin detail page: the
 * form in the main column (saved through the admin save bar), status and the
 * AI knowledge it produces in the aside.
 */

type StepOutcomes = Partial<Record<ProductStepOutcome['step'], StepOutcomeState>>;

/**
 * The save-bar Save. On the server, save-setup stores the guidance and then
 * rebuilds the product's AI knowledge (with the extra source URL, if any), so
 * one save covers what used to be "Save Draft" and "Save & Update AI".
 */
export function buildSaveSetupForm(row: WorkspaceRow, draft: MappingDraft, workflowUrl: string) {
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
  return formData;
}

function setupProgress(row: WorkspaceRow, draft: MappingDraft, dirty: boolean) {
  const hasGuidance =
    Boolean(row.instruction?.usage_instructions?.trim()) ||
    (!dirty && Boolean(draft.usage_instructions.trim()));
  const hasAiKnowledge = row.hasKnowledge;
  const languagesDone =
    !row.languageWorkflowEnabled || row.languageCoverage >= 100 || row.readyLanguageCount > 0;
  return { hasGuidance, hasAiKnowledge, languagesDone };
}

export function ProductSetupMain({
  row,
  draft,
  workflowUrl,
  actionError,
  previewQuestion,
  previewAnswer,
  onPreviewQuestionChange,
  processRunning,
  isDeletingLocalSetup,
  isPreviewingAnswer,
  onChangeDraft,
  onWorkflowUrlChange,
}: {
  row: WorkspaceRow;
  draft: MappingDraft;
  workflowUrl: string;
  actionError: string | null;
  previewQuestion: string;
  previewAnswer: string;
  onPreviewQuestionChange: (value: string) => void;
  processRunning: boolean;
  isDeletingLocalSetup: boolean;
  isPreviewingAnswer: boolean;
  onChangeDraft: (field: keyof MappingDraft, value: string) => void;
  onWorkflowUrlChange: (value: string) => void;
}) {
  const submit = useSubmit();
  // Separate from the page's main form so a draft never replaces the page's
  // action result (save messages, errors) and never saves anything by itself.
  const draftFetcher = useFetcher<ActionResult>();
  const [aiDrafted, setAiDrafted] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Adjusted during render rather than in an effect: a different product
  // starts with everything collapsed, and a new AI draft for this product
  // shows the "drafted" banner (also when coming back to the drafted product).
  const [seenDraft, setSeenDraft] = useState({
    productId: row.shopify.id,
    data: draftFetcher.data,
  });
  if (seenDraft.productId !== row.shopify.id || seenDraft.data !== draftFetcher.data) {
    setSeenDraft({ productId: row.shopify.id, data: draftFetcher.data });
    if (seenDraft.productId !== row.shopify.id) {
      setPreviewOpen(false);
      setConfirmDelete(false);
      setAiDrafted(false);
    }
    const result = draftFetcher.data;
    if (result?.ok && result.draft && result.selectedProductId === row.shopify.id) {
      setAiDrafted(true);
    }
  }

  // Fill the form with the AI draft; the merchant reviews it and saves. This
  // stays an effect: it updates the parent's state.
  useEffect(() => {
    const result = draftFetcher.data;
    if (!result?.ok || !result.draft || result.selectedProductId !== row.shopify.id) return;
    onChangeDraft('usage_instructions', result.draft.usage_instructions);
    if (result.draft.prevention_tips)
      onChangeDraft('prevention_tips', result.draft.prevention_tips);
    if (result.draft.recipe_summary) onChangeDraft('recipe_summary', result.draft.recipe_summary);
    // onChangeDraft is recreated by the parent on every render.
  }, [draftFetcher.data, row.shopify.id]);

  const isDrafting = draftFetcher.state !== 'idle';
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

  const previewId = `preview-${row.shopify.id}`;

  return (
    <>
      {processRunning ? (
        <s-banner tone="info" heading="Updating">
          <s-paragraph>We’re applying updates. This usually takes a few seconds.</s-paragraph>
        </s-banner>
      ) : null}

      {actionError && !processRunning ? (
        <s-banner tone="critical" heading="Action failed">
          <s-paragraph>{actionError}</s-paragraph>
        </s-banner>
      ) : null}

      <s-section>
        <s-stack gap="base">
          <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
            <s-stack gap="small-300">
              <s-heading>Customer instructions</s-heading>
              <s-paragraph color="subdued">
                What customers should do after delivery: first use or setup, care, what to avoid.
              </s-paragraph>
            </s-stack>
            <s-button onClick={requestAiDraft} loading={isDrafting} disabled={processRunning}>
              {draft.usage_instructions.trim() ? 'Rewrite with AI' : 'Write it for me'}
            </s-button>
          </s-grid>
          {aiDrafted ? (
            <s-banner tone="info">
              <s-paragraph>
                Drafted from this product&apos;s description. Check it says what you would tell a
                customer, then save.
              </s-paragraph>
            </s-banner>
          ) : null}
          {draftError ? (
            <s-banner tone="warning">
              <s-paragraph>{draftError}</s-paragraph>
            </s-banner>
          ) : null}

          {/* The section heading already names this field; the label stays for screen readers. */}
          <s-text-area
            label="Customer instructions"
            labelAccessibilityVisibility="exclusive"
            name="usage_instructions"
            value={draft.usage_instructions}
            onInput={(event) => onChangeDraft('usage_instructions', event.currentTarget.value)}
            rows={6}
            autocomplete="off"
            details="Recete sends this guidance to customers after delivery."
          />

          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(240px, 1fr))" gap="base">
            <s-text-area
              label="Warnings and important notes"
              name="prevention_tips"
              value={draft.prevention_tips}
              onInput={(event) => onChangeDraft('prevention_tips', event.currentTarget.value)}
              rows={3}
              autocomplete="off"
            />
            <s-text-area
              label="Key product summary"
              name="recipe_summary"
              value={draft.recipe_summary}
              onInput={(event) => onChangeDraft('recipe_summary', event.currentTarget.value)}
              rows={3}
              autocomplete="off"
            />
          </s-grid>
        </s-stack>
      </s-section>

      <s-section heading="Extra source">
        <s-url-field
          label="Page with FAQs or usage details"
          autocomplete="off"
          value={workflowUrl}
          onInput={(event) => onWorkflowUrlChange(event.currentTarget.value)}
          placeholder="https://example.com/product-faq"
          details="Optional. Read when you save, to improve Recete's answers about this product."
        />
      </s-section>

      <s-section>
        <s-stack gap="small">
          <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
            <s-heading>Preview answer</s-heading>
            <DisclosureButton
              open={previewOpen}
              controls={previewId}
              onToggle={() => setPreviewOpen((current) => !current)}
            >
              {previewOpen ? 'Hide' : 'Open'}
            </DisclosureButton>
          </s-grid>
          <s-paragraph color="subdued">
            Ask a sample question and see how Recete responds.
          </s-paragraph>
          <div id={previewId} hidden={!previewOpen}>
            <s-stack gap="small">
              <s-text-field
                label="Sample question"
                autocomplete="off"
                value={previewQuestion}
                onInput={(event) => onPreviewQuestionChange(event.currentTarget.value)}
              />
              <s-stack direction="inline">
                <s-button
                  variant="secondary"
                  loading={isPreviewingAnswer}
                  disabled={!row.localProduct || processRunning}
                  onClick={submitPreviewAnswer}
                >
                  {previewAnswer ? 'Regenerate answer' : 'Generate answer'}
                </s-button>
              </s-stack>
              <s-box padding="small" background="subdued" borderRadius="base">
                <s-paragraph color="subdued">
                  {previewAnswer ||
                    (row.localProduct
                      ? 'Generate a preview to inspect the response.'
                      : 'Save this product first, then preview an answer.')}
                </s-paragraph>
              </s-box>
            </s-stack>
          </div>
        </s-stack>
      </s-section>

      {row.localProduct ? (
        <s-section heading="Reset product setup">
          <s-stack gap="small">
            <s-paragraph color="subdued">
              Clears this product&apos;s Recete setup: instructions, AI knowledge and language data.
              Your Shopify product stays untouched, and you can set it up again.
            </s-paragraph>
            <s-checkbox
              label="I understand this removes the saved setup for this product."
              checked={confirmDelete}
              onChange={(event) => setConfirmDelete(event.currentTarget.checked)}
            />
            <s-stack direction="inline">
              <InlineActionForm
                productId={row.localProduct.id}
                shopifyProductId={row.shopify.id}
                intent="delete"
                label="Reset product setup"
                icon="delete"
                destructive
                disabled={!confirmDelete || processRunning}
                loading={isDeletingLocalSetup}
                variant="secondary"
              />
            </s-stack>
          </s-stack>
        </s-section>
      ) : null}
    </>
  );
}

export function ProductSetupAside({
  row,
  draft,
  dirty,
  actionError,
  stepOutcomes,
  processRunning,
  isRunningAiAction,
}: {
  row: WorkspaceRow;
  draft: MappingDraft;
  dirty: boolean;
  actionError: string | null;
  stepOutcomes?: StepOutcomes;
  processRunning: boolean;
  isRunningAiAction: boolean;
}) {
  const submit = useSubmit();
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [seenProductId, setSeenProductId] = useState(row.shopify.id);
  if (seenProductId !== row.shopify.id) {
    setSeenProductId(row.shopify.id);
    setKnowledgeOpen(false);
  }

  const { hasGuidance, hasAiKnowledge, languagesDone } = setupProgress(row, draft, dirty);
  const knowledge = buildKnowledgeSummary(row);
  const lifecycle = getLifecyclePresentation(row, { actionError, processRunning });
  const statusLabel =
    lifecycle.key === 'ready' ? 'Ready' : lifecycle.key === 'processing' ? 'In progress' : 'Needs attention';
  const statusTone: 'success' | 'info' | 'warning' =
    lifecycle.key === 'ready' ? 'success' : lifecycle.key === 'processing' ? 'info' : 'warning';
  const setupScore = Math.max(0, Math.min(100, knowledge.qualityScore));
  const knowledgeId = `knowledge-${row.shopify.id}`;

  // Rebuilds the AI knowledge from what is saved. Unsaved edits go through the
  // save bar instead, which rebuilds it as part of the save.
  function updateAiAnswers() {
    if (!row.localProduct || processRunning || dirty) return;
    const formData = new FormData();
    formData.set('intent', 'embeddings');
    formData.set('productId', row.localProduct.id);
    formData.set('shopifyProductId', row.shopify.id);
    formData.set('productName', row.shopify.title);
    formData.set('hasContent', row.localProduct.raw_text ? 'true' : 'false');
    formData.set('enrichmentUrl', '');
    submit(formData, { method: 'post' });
  }

  return (
    <>
      <s-section heading="Status">
        <s-stack gap="base">
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-thumbnail
              src={row.shopify.featuredImageUrl || undefined}
              alt={row.shopify.title}
              size="small"
            />
            <s-badge tone={statusTone}>{statusLabel}</s-badge>
          </s-stack>
          <s-paragraph color="subdued">{lifecycle.message}</s-paragraph>
          <s-stack gap="small-300">
            <s-text>Setup completeness: {setupScore}%</s-text>
            <s-progress
              value={setupScore}
              max={100}
              tone={knowledge.missingInfo.length ? 'info' : 'success'}
              accessibilityLabel={`Setup completeness: ${setupScore}%`}
            />
          </s-stack>
          <s-stack gap="small-300">
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
          </s-stack>
        </s-stack>
      </s-section>

      <s-section>
        <s-stack gap="small">
          <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
            <s-heading>AI knowledge</s-heading>
            <DisclosureButton
              open={knowledgeOpen}
              controls={knowledgeId}
              onToggle={() => setKnowledgeOpen((current) => !current)}
            >
              {knowledgeOpen ? 'Hide' : 'Review'}
            </DisclosureButton>
          </s-grid>
          <s-paragraph color="subdued">
            What Recete uses to answer customer questions about this product.
          </s-paragraph>
          <div id={knowledgeId} hidden={!knowledgeOpen}>
            <s-stack gap="small">
              <InfoMiniCard title="How Recete should answer" body={knowledge.howToUse} />
              <InfoListCard title="Key product details" items={knowledge.keyDetails} empty="No key details yet." />
              <InfoListCard title="Warnings" items={knowledge.warnings} empty="No warnings saved yet." />
              <InfoListCard
                title="Common customer questions"
                items={knowledge.commonQuestions}
                empty="No common question patterns yet."
              />
            </s-stack>
          </div>
          <StepOutcomeLine
            title="Latest update"
            outcome={
              stepOutcomes?.collect_sources ||
              stepOutcomes?.generate_ai_knowledge ||
              stepOutcomes?.map_product
            }
          />
          {row.localProduct ? (
            <s-stack gap="small-300">
              <s-stack direction="inline">
                <s-button
                  variant="secondary"
                  loading={isRunningAiAction}
                  disabled={processRunning || dirty}
                  onClick={updateAiAnswers}
                >
                  Update AI answers
                </s-button>
              </s-stack>
              <s-text color="subdued">
                {dirty
                  ? 'Saving your changes updates the AI answers too.'
                  : 'Rebuilds the answers from the saved setup and the product page.'}
              </s-text>
            </s-stack>
          ) : null}
        </s-stack>
      </s-section>
    </>
  );
}

/**
 * Disclosure toggle (the documented replacement for Polaris React's
 * Collapsible): s-button has no aria-expanded/aria-controls props, so they are
 * set on the host element.
 */
function DisclosureButton({
  open,
  controls,
  onToggle,
  children,
}: {
  open: boolean;
  controls: string;
  onToggle: () => void;
  children: ReactNode;
}) {
  const button = useRef<ComponentRef<'s-button'>>(null);
  useEffect(() => {
    button.current?.setAttribute('aria-expanded', String(open));
    button.current?.setAttribute('aria-controls', controls);
  }, [open, controls]);
  return (
    <s-button ref={button} variant="tertiary" onClick={onToggle}>
      {children}
    </s-button>
  );
}

function ChecklistRow({ done, label }: { done: boolean; label: string }) {
  return (
    <s-stack direction="inline" gap="small-200" alignItems="center">
      <s-icon
        type={done ? 'check-circle' : 'circle'}
        tone={done ? 'success' : undefined}
        color={done ? undefined : 'subdued'}
      />
      <s-text color={done ? 'subdued' : 'base'}>{label}</s-text>
    </s-stack>
  );
}

function InfoMiniCard({ title, body }: { title: string; body: string }) {
  return (
    <s-box padding="small" background="subdued" borderRadius="base">
      <s-stack gap="small-300">
        <s-text type="strong">{title}</s-text>
        <s-paragraph color="subdued">{body}</s-paragraph>
      </s-stack>
    </s-box>
  );
}

function InfoListCard({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <s-box padding="small" background="subdued" borderRadius="base">
      <s-stack gap="small-300">
        <s-text type="strong">{title}</s-text>
        {items.length > 0 ? (
          <s-stack gap="small-400">
            {items.map((item, index) => (
              <s-paragraph key={`${title}-${index}-${item}`} color="subdued">
                {item}
              </s-paragraph>
            ))}
          </s-stack>
        ) : (
          <s-paragraph color="subdued">{empty}</s-paragraph>
        )}
      </s-stack>
    </s-box>
  );
}

function StepOutcomeLine({ title, outcome }: { title: string; outcome?: StepOutcomeState }) {
  if (!outcome) return null;

  const text = [
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
    .join(' ');

  return outcome.status === 'error' ? (
    <s-paragraph tone="critical">{text}</s-paragraph>
  ) : (
    <s-paragraph color="subdued">{text}</s-paragraph>
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
  icon?: ComponentProps<'s-button'>['icon'];
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
    <s-button
      icon={icon}
      variant={variant}
      tone={destructive ? 'critical' : undefined}
      disabled={disabled || loading}
      loading={loading}
      onClick={submitAction}
    >
      {label}
    </s-button>
  );
}
