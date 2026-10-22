import { useEffect, useState } from 'react';
import { useFetcher, useSubmit } from 'react-router';
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
  InlineGrid,
  InlineStack,
  ProgressBar,
  Text,
  TextField,
  Thumbnail,
} from '@shopify/polaris';
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

export function ProductSetupPanel({
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
        {/* Title, back link and "Edit in Shopify" live in the admin title bar
            (the route's s-page); this keeps the image and the status. */}
        <InlineStack align="space-between" blockAlign="center" wrap>
          <InlineStack gap="200" blockAlign="center" wrap>
            <Thumbnail
              source={row.shopify.featuredImageUrl || ImageIcon}
              alt={row.shopify.title}
              size="small"
            />
            <Text as="p" variant="bodySm" tone="subdued">
              {lifecycle.message}
            </Text>
          </InlineStack>
          <Badge tone={statusTone}>{statusLabel}</Badge>
        </InlineStack>
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

  return content;
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

