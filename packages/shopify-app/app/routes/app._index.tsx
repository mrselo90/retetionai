import type { ActionFunctionArgs, HeadersFunction } from 'react-router';
import { useFetcher, useLocation, useNavigate } from 'react-router';
import { useState } from 'react';
import { boundary } from '@shopify/shopify-app-react-router/server';
import { SectionCard, ShellPage } from '../components/shell-ui';
import { getSetupProgress, REQUIRED_STEP_INFO, type SetupStepKey } from '../lib/setupProgress';
import type { ShopifyMerchantOverview } from '../platform.server';
import { extractPlatformErrorMessage, triggerTestOrderFlow } from '../platform.server';
import { useAppBootstrapData } from './app';
import { useActionToast, useReviewRequest } from '../lib/appBridge';
import { authenticateEmbeddedAdmin } from '../lib/embeddedAuth.server';

type SetupStepStatus = 'done' | 'in_progress' | 'not_started';

type StepIcon = 'cart' | 'chat' | 'catalog-product' | 'settings' | 'connect';

type SetupStep = {
  id: SetupStepKey;
  title: string;
  description: string;
  to: string;
  icon: StepIcon;
  status: SetupStepStatus;
  estimateMinutes: number;
};

// Per-step time estimates (minutes). Used for "X minutes left" hint.
const STEP_ESTIMATES: Record<SetupStepKey, number> = {
  billing: 2,
  whatsapp: 3,
  products: 5,
  messaging: 3,
  orders: 5,
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticateEmbeddedAdmin(request);
  const formData = await request.formData();
  const intent = String(formData.get('intent') || '');

  if (intent === 'runTestOrder') {
    const phone = String(formData.get('phone') || '').trim();
    const productId = String(formData.get('product_id') || '').trim();
    const productName = String(formData.get('product_name') || 'Test Product').trim();

    if (!phone) {
      return Response.json(
        {
          ok: false,
          error: 'Enter your WhatsApp number to receive the test message.',
          intent: 'runTestOrder',
        },
        { status: 400 }
      );
    }

    try {
      const result = await triggerTestOrderFlow(request, phone, [
        { name: productName, external_id: productId || null },
      ]);
      return Response.json({
        ok: true,
        intent: 'runTestOrder',
        externalOrderId: result.externalOrderId,
      });
    } catch (err) {
      const message = await extractPlatformErrorMessage(err, 'Failed to create test order');
      return Response.json({ ok: false, error: message, intent: 'runTestOrder' }, { status: 500 });
    }
  }

  return Response.json({ ok: false, error: 'Unknown intent' }, { status: 400 });
};

export default function Index() {
  const { bootstrapData, bootstrapError, shellLoading } = useAppBootstrapData();
  const location = useLocation();
  const data = bootstrapData?.overview;

  if (!data) {
    return (
      <ShellPage title="Welcome to Recete" subtitle="Complete setup to start using Recete.">
        <s-section>
          <s-paragraph color="subdued">
            {bootstrapError
              ? "We couldn't load your store data. Please refresh the page to try again."
              : shellLoading
                ? 'Preparing your setup workspace…'
                : 'Setup data is not ready yet. Refresh if this persists.'}
          </s-paragraph>
        </s-section>
      </ShellPage>
    );
  }

  const justSavedMessaging =
    new URLSearchParams(location.search).get('setup') === 'messaging_saved';

  return (
    <SetupOverview
      data={data}
      storePending={Boolean(bootstrapData?.pending)}
      billingApproved={bootstrapData?.billingApproved}
      whatsapp={bootstrapData?.whatsapp}
      merchantName={bootstrapData?.merchantName || ''}
      justSavedMessaging={justSavedMessaging}
    />
  );
}

function statusFor(done: boolean, isNext: boolean): SetupStepStatus {
  if (done) return 'done';
  if (isNext) return 'in_progress';
  return 'not_started';
}

function SetupOverview({
  data,
  billingApproved,
  whatsapp,
  merchantName,
  justSavedMessaging,
  storePending,
}: {
  data: ShopifyMerchantOverview;
  storePending?: boolean;
  billingApproved?: boolean;
  whatsapp?: { enabled: boolean; connected: boolean } | null;
  merchantName: string;
  justSavedMessaging?: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const progress = getSetupProgress(data, billingApproved, whatsapp);
  const fetcher = useFetcher<{
    ok?: boolean;
    error?: string;
    intent?: string;
    externalOrderId?: string;
  }>();
  const firstProduct = data.products?.[0] ?? null;

  const productCountLabel = progress.productCount > 0 ? progress.productCount : 'your';

  const requiredSteps: SetupStep[] = [
    {
      id: 'billing',
      title: REQUIRED_STEP_INFO.billing.title,
      description: 'Choose a plan and approve billing in Shopify.',
      to: REQUIRED_STEP_INFO.billing.path,
      icon: 'cart' as const,
      status: statusFor(progress.hasBilling, progress.nextStep === 'billing'),
      estimateMinutes: STEP_ESTIMATES.billing,
    },
    // Only while connecting a number is available; see getSetupProgress.
    ...(progress.whatsappRequired
      ? [
          {
            id: 'whatsapp' as const,
            title: REQUIRED_STEP_INFO.whatsapp.title,
            description:
              "Link your store's own WhatsApp number by scanning a QR code, like WhatsApp Web. Customer messages are sent from it.",
            to: REQUIRED_STEP_INFO.whatsapp.path,
            icon: 'chat' as const,
            status: statusFor(progress.hasWhatsApp, progress.nextStep === 'whatsapp'),
            estimateMinutes: STEP_ESTIMATES.whatsapp,
          },
        ]
      : []),
    {
      id: 'products',
      title: REQUIRED_STEP_INFO.products.title,
      description: `Add usage instructions for ${productCountLabel} products so Recete can answer customer questions.`,
      to: REQUIRED_STEP_INFO.products.path,
      icon: 'catalog-product' as const,
      status: statusFor(progress.hasProducts, progress.nextStep === 'products'),
      estimateMinutes: STEP_ESTIMATES.products,
    },
    {
      id: 'messaging',
      title: REQUIRED_STEP_INFO.messaging.title,
      description: 'Pick a bot name, language, and the message customers receive after delivery.',
      to: REQUIRED_STEP_INFO.messaging.path,
      icon: 'settings' as const,
      status: statusFor(progress.hasMessagingConfigured, progress.nextStep === 'messaging'),
      estimateMinutes: STEP_ESTIMATES.messaging,
    },
  ];

  const optionalSteps: SetupStep[] = [
    {
      id: 'orders',
      title: 'Run a test order',
      description: 'Create and fulfill a Shopify test order to verify the live flow.',
      to: '/app/integrations#orders-flow',
      icon: 'connect' as const,
      status: statusFor(
        progress.hasOrders,
        progress.nextOptionalStep === 'orders' && progress.setupComplete
      ),
      estimateMinutes: STEP_ESTIMATES.orders,
    },
  ];

  const setupComplete = progress.setupComplete;
  const completedRequired = progress.completedCount;
  const totalRequired = progress.totalSteps;

  // Time-left estimate: only counts incomplete REQUIRED steps.
  const minutesLeft = requiredSteps
    .filter((step) => step.status !== 'done')
    .reduce((total, step) => total + step.estimateMinutes, 0);

  const nextRequiredStep = requiredSteps.find((step) => step.status !== 'done') ?? null;

  // Back from the welcome-message step: a toast for a saved step, the banner
  // below for setup completion, and that moment is when we ask for a review.
  useActionToast(
    justSavedMessaging && !setupComplete
      ? nextRequiredStep
        ? `Welcome message saved. Next: ${nextRequiredStep.title.toLowerCase()}.`
        : 'Welcome message saved.'
      : null,
    justSavedMessaging ? location.key : null
  );
  useReviewRequest(Boolean(justSavedMessaging && setupComplete));

  const personalizedHeading = merchantName.trim()
    ? `Let's get Recete ready, ${merchantName.trim().split(/\s+/)[0]}`
    : "Let's get Recete ready";

  return (
    <ShellPage
      title={setupComplete ? 'Recete is ready' : 'Welcome to Recete'}
      subtitle={
        setupComplete
          ? 'Setup is complete. You can now run daily operations.'
          : `${totalRequired === 4 ? 'Four' : 'Three'} quick steps to start helping customers after delivery.`
      }
      // During setup the progress card's "Continue: <step>" is the one call to
      // action; a header button to the same place only doubled it.
      primaryAction={
        setupComplete ? { content: 'Open dashboard', url: '/app/dashboard' } : undefined
      }
    >
      {/* A fresh install can open before the platform has finished creating the
          store's records. The page below is all zeros until then, so say why. */}
      {storePending ? (
        <s-banner tone="info" heading="Preparing your store">
          <s-paragraph>
            Recete is still setting up your store. This usually takes a few seconds, and this page
            updates by itself.
          </s-paragraph>
        </s-banner>
      ) : null}

      {/* ── Save feedback, after returning from the welcome-message step ── */}
      {justSavedMessaging && setupComplete ? (
        <s-banner tone="success">
          <s-paragraph>
            <s-text type="strong">
              🎉 Setup complete — Recete is live! Your customers will now receive a WhatsApp message
              after delivery.
            </s-text>
          </s-paragraph>
        </s-banner>
      ) : null}

      {/* Until the required steps are done this is Shopify's Setup guide pattern
          (App Home composition); afterwards the live summary card. */}
      {setupComplete ? (
        <SectionCard
          title="🎉 Recete is live"
          subtitle="Ready to send your first customer message."
          badge={<s-badge tone="success">Ready to go live</s-badge>}
        >
          <s-stack direction="inline" gap="small-200">
            <s-button variant="primary" icon="view" onClick={() => navigate('/app/dashboard')}>
              Open dashboard
            </s-button>
            <s-button onClick={() => navigate('/app/setup/messaging')}>
              Preview welcome message
            </s-button>
          </s-stack>
        </SectionCard>
      ) : (
        <SetupGuide
          heading={personalizedHeading}
          steps={requiredSteps}
          completed={completedRequired}
          minutesLeft={minutesLeft}
        />
      )}

      {/* Once WhatsApp is linked a store can try the real message at any point
          of setup; the optional "Run a test order" step covers it otherwise. */}
      {whatsapp?.connected && !(setupComplete && !progress.hasOrders) ? (
        <TestWhatsAppCard fetcher={fetcher} firstProduct={firstProduct} />
      ) : null}

      {/* ── Optional steps: only once the required ones are done. Shown earlier,
          their green "All done" read as if setup were finished. ── */}
      {setupComplete ? (
        <SectionCard
          title="Polish your setup"
          subtitle="Optional. You can run Recete fully without these, but they make the experience better."
          badge={
            <s-badge tone={progress.postLaunchComplete ? 'success' : 'info'}>
              {progress.postLaunchComplete ? 'All done' : 'Optional'}
            </s-badge>
          }
        >
          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(280px, 1fr))" gap="base">
            {optionalSteps.map((step) => (
              <OptionalStepCard
                key={step.id}
                step={step}
                fetcher={fetcher}
                firstProduct={step.id === 'orders' ? firstProduct : undefined}
              />
            ))}
            <WhatsAppOptInCard />
          </s-grid>
        </SectionCard>
      ) : null}
    </ShellPage>
  );
}

/**
 * Shopify's Setup guide composition (App Home patterns): progress, then one
 * collapsible row per required step. Status comes from the store's data, not a
 * checkbox the merchant ticks, so each row shows a status icon instead.
 */
function SetupGuide({
  heading,
  steps,
  completed,
  minutesLeft,
}: {
  heading: string;
  steps: SetupStep[];
  completed: number;
  minutesLeft: number;
}) {
  const navigate = useNavigate();
  const nextId = steps.find((step) => step.status !== 'done')?.id ?? null;
  const [guideOpen, setGuideOpen] = useState(true);
  const [openStep, setOpenStep] = useState<SetupStepKey | null>(nextId);

  return (
    <s-section>
      <s-grid gap="base">
        <s-grid gap="small-200">
          <s-grid gridTemplateColumns="1fr auto" gap="small-300" alignItems="center">
            <s-heading>{heading}</s-heading>
            <s-button
              accessibilityLabel={guideOpen ? 'Collapse setup guide' : 'Expand setup guide'}
              variant="tertiary"
              tone="neutral"
              icon={guideOpen ? 'chevron-up' : 'chevron-down'}
              onClick={() => setGuideOpen((value) => !value)}
            />
          </s-grid>
          <s-paragraph>Complete these steps to start helping customers after delivery.</s-paragraph>
          <s-paragraph color="subdued">
            {`${completed} out of ${steps.length} steps completed · ~${minutesLeft} min left`}
          </s-paragraph>
          <s-progress value={completed} max={steps.length} accessibilityLabel="Setup progress" />
        </s-grid>

        <s-box
          borderRadius="base"
          border="base"
          background="base"
          display={guideOpen ? 'auto' : 'none'}
        >
          {steps.map((step, index) => {
            const done = step.status === 'done';
            const expanded = openStep === step.id;
            const toggle = () => setOpenStep(expanded ? null : step.id);
            return (
              <s-box key={step.id}>
                {index > 0 ? <s-divider /> : null}
                <s-grid
                  gridTemplateColumns="auto 1fr auto"
                  gap="base"
                  padding="small"
                  alignItems="center"
                >
                  <s-icon
                    type={done ? 'check-circle-filled' : 'circle-dashed'}
                    tone={done ? 'success' : 'auto'}
                  />
                  <s-clickable onClick={toggle} accessibilityLabel={`${step.title} details`}>
                    <s-text type={step.id === nextId ? 'strong' : 'generic'}>{step.title}</s-text>
                  </s-clickable>
                  <s-button
                    accessibilityLabel={`Toggle ${step.title} details`}
                    variant="tertiary"
                    icon={expanded ? 'chevron-up' : 'chevron-down'}
                    onClick={toggle}
                  />
                </s-grid>
                <s-box
                  padding="small"
                  paddingBlockStart="none"
                  display={expanded ? 'auto' : 'none'}
                >
                  <s-box padding="base" background="subdued" borderRadius="base">
                    <s-grid gap="small-300">
                      <s-paragraph>{step.description}</s-paragraph>
                      <s-paragraph color="subdued">
                        {done ? 'Done' : `About ${step.estimateMinutes} min`}
                      </s-paragraph>
                      {done ? null : (
                        <s-stack direction="inline">
                          <s-button
                            variant={step.id === nextId ? 'primary' : 'secondary'}
                            onClick={() => navigate(step.to)}
                          >
                            {step.id === nextId ? 'Start' : 'Open'}
                          </s-button>
                        </s-stack>
                      )}
                    </s-grid>
                  </s-box>
                </s-box>
              </s-box>
            );
          })}
        </s-box>
      </s-grid>
    </s-section>
  );
}

type TestOrderFetcher = ReturnType<
  typeof useFetcher<{ ok?: boolean; error?: string; intent?: string; externalOrderId?: string }>
>;

/**
 * Simulates a delivered order for a phone number, so the store sees the exact
 * welcome message a customer gets, from its own linked number, and can reply to
 * try the assistant.
 */
function TestWhatsAppForm({
  fetcher,
  firstProduct,
}: {
  fetcher: TestOrderFetcher;
  firstProduct?: { id: string; name: string; external_id?: string | null } | null;
}) {
  // Empty on purpose: the store's own linked number would land in WhatsApp's
  // "message yourself" chat, where a reply is not a customer message.
  const [phone, setPhone] = useState('');
  const testOrderResult = fetcher.data?.intent === 'runTestOrder' ? fetcher.data : null;
  const testOrderBusy = fetcher.state !== 'idle';
  useActionToast(
    testOrderResult?.ok
      ? 'Test order sent. The message should arrive on that phone within a minute or two.'
      : null,
    fetcher.data,
    { duration: 6000 }
  );

  return (
    <s-stack gap="small-200">
      <s-paragraph color="subdued">
        Enter a phone number other than your linked WhatsApp. It gets the message a customer
        receives after delivery, sent from your number. Reply to it to see Recete answer.
      </s-paragraph>
      {testOrderResult?.error ? (
        <s-banner tone="critical">
          <s-paragraph>{testOrderResult.error}</s-paragraph>
        </s-banner>
      ) : null}
      <fetcher.Form method="post">
        <s-stack gap="small-200">
          <input type="hidden" name="intent" value="runTestOrder" />
          <input
            type="hidden"
            name="product_id"
            value={firstProduct?.external_id || firstProduct?.id || ''}
          />
          <input type="hidden" name="product_name" value={firstProduct?.name || 'Test Product'} />
          {/* Polaris 1.1 has no phone field, and s-text-field's types don't
              allow autocomplete="tel"; the format hint carries the guidance. */}
          <s-text-field
            label="Test phone number"
            name="phone"
            value={phone}
            onInput={(event) => setPhone(event.currentTarget.value)}
            placeholder="+90 555 000 0000"
            details="Use international format with country code, e.g. +1 555 000 1234 or +44 7911 123456."
          />
          <s-stack direction="inline">
            <s-button
              type="submit"
              variant="primary"
              icon="connect"
              loading={testOrderBusy}
              disabled={!phone.trim()}
            >
              Send test WhatsApp
            </s-button>
          </s-stack>
        </s-stack>
      </fetcher.Form>
    </s-stack>
  );
}

/** Stand-alone card on Overview once WhatsApp is linked. */
function TestWhatsAppCard({
  fetcher,
  firstProduct,
}: {
  fetcher: TestOrderFetcher;
  firstProduct?: { id: string; name: string; external_id?: string | null } | null;
}) {
  return (
    <SectionCard title="Send a test message">
      <TestWhatsAppForm fetcher={fetcher} firstProduct={firstProduct} />
    </SectionCard>
  );
}

function OptionalStepCard({
  step,
  fetcher,
  firstProduct,
}: {
  step: SetupStep;
  fetcher: ReturnType<
    typeof useFetcher<{ ok?: boolean; error?: string; intent?: string; externalOrderId?: string }>
  >;
  firstProduct?: { id: string; name: string; external_id?: string | null } | null;
}) {
  const navigate = useNavigate();
  const done = step.status === 'done';

  // A bordered tile inside the parent section (a nested s-section draws no card).
  if (step.id === 'orders' && !done) {
    return (
      <s-box padding="base" border="base" borderRadius="base">
        <s-stack gap="small-200">
          <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
            <s-heading>{step.title}</s-heading>
            <s-badge tone="info">Optional</s-badge>
          </s-grid>
          <TestWhatsAppForm fetcher={fetcher} firstProduct={firstProduct} />
        </s-stack>
      </s-box>
    );
  }

  return (
    <s-box padding="base" border="base" borderRadius="base" background={done ? 'subdued' : 'base'}>
      <s-stack gap="small-200">
        <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
          <s-heading>{step.title}</s-heading>
          <s-badge tone={done ? 'success' : 'info'}>{done ? 'Done' : 'Optional'}</s-badge>
        </s-grid>
        <s-paragraph color="subdued">{step.description}</s-paragraph>
        <s-stack direction="inline">
          <s-button
            variant="tertiary"
            icon={step.icon}
            disabled={done}
            onClick={() => navigate(step.to)}
          >
            Open step
          </s-button>
        </s-stack>
      </s-stack>
    </s-box>
  );
}

/**
 * Recete only messages customers who opted in to WhatsApp. The Thank you page
 * block (extensions/whatsapp-optin) is where most of them can say yes; its
 * placement lives in the checkout editor, which this opens. Not tracked as a
 * step: the app can't see where the merchant placed the block.
 */
function WhatsAppOptInCard() {
  return (
    <s-box padding="base" border="base" borderRadius="base">
      <s-stack gap="small-200">
        <s-heading>Collect WhatsApp opt-ins</s-heading>
        <s-paragraph color="subdued">
          Recete only messages customers who agreed to WhatsApp messages. Add the WhatsApp opt-in block to your
          Thank you page so customers can say yes right after they order.
        </s-paragraph>
        <s-stack direction="inline">
          <s-button
            variant="tertiary"
            icon="external"
            href="shopify://admin/settings/checkout/editor?page=thank-you&context=apps"
            target="_top"
          >
            Open checkout editor
          </s-button>
        </s-stack>
      </s-stack>
    </s-box>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
