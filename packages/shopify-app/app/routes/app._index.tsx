import type { ActionFunctionArgs, HeadersFunction } from "react-router";
import { useFetcher, useLocation } from "react-router";
import { useState } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { CartIcon, CatalogIcon, CodeIcon, ConnectIcon, SettingsIcon, ViewIcon } from "@shopify/polaris-icons";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  InlineGrid,
  InlineStack,
  ProgressBar,
  Text,
  TextField,
} from "@shopify/polaris";
import { ShellPage } from "../components/shell-ui";
import { getSetupProgress, type SetupStepKey } from "../lib/setupProgress";
import type { ShopifyMerchantOverview } from "../platform.server";
import { triggerTestOrderFlow } from "../platform.server";
import { useAppBootstrapData } from "./app";
import { authenticateEmbeddedAdmin } from "../lib/embeddedAuth.server";
import { markThemeEmbedEnabled } from "../services/billingUsage.server";

type SetupStepStatus = "done" | "in_progress" | "not_started";

type SetupStep = {
  id: SetupStepKey;
  title: string;
  description: string;
  to: string;
  icon: typeof CartIcon;
  status: SetupStepStatus;
  estimateMinutes: number;
  markAsDoneAction?: boolean;
  openInNewTab?: boolean;
};

// Per-step time estimates (minutes). Used for "X minutes left" hint.
const STEP_ESTIMATES: Record<SetupStepKey, number> = {
  billing: 2,
  products: 5,
  messaging: 3,
  orders: 5,
  themeEmbed: 3,
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticateEmbeddedAdmin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "markThemeEmbedDone") {
    await markThemeEmbedEnabled(session.shop);
    return Response.json({ ok: true, intent: "markThemeEmbedDone" });
  }

  if (intent === "runTestOrder") {
    const phone = String(formData.get("phone") || "").trim();
    const productId = String(formData.get("product_id") || "").trim();
    const productName = String(formData.get("product_name") || "Test Product").trim();

    if (!phone) {
      return Response.json(
        { ok: false, error: "Enter your WhatsApp number to receive the test message.", intent: "runTestOrder" },
        { status: 400 },
      );
    }

    try {
      const result = await triggerTestOrderFlow(request, phone, [
        { name: productName, external_id: productId || null },
      ]);
      return Response.json({ ok: true, intent: "runTestOrder", externalOrderId: result.externalOrderId });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create test order";
      return Response.json({ ok: false, error: message, intent: "runTestOrder" }, { status: 500 });
    }
  }

  return Response.json({ ok: false, error: "Unknown intent" }, { status: 400 });
};

export default function Index() {
  const { bootstrapData, bootstrapError, shellLoading } = useAppBootstrapData();
  const location = useLocation();
  const data = bootstrapData?.overview;

  if (!data) {
    return (
      <ShellPage
        title="Welcome to Recete"
        subtitle="Complete setup to start using Recete."
      >
        <Card padding="500">
          <Text as="p" variant="bodyMd" tone="subdued">
            {bootstrapError
              ? "We couldn't load your store data. Please refresh the page to try again."
              : shellLoading
                ? "Preparing your setup workspace…"
                : "Setup data is not ready yet. Refresh if this persists."}
          </Text>
        </Card>
      </ShellPage>
    );
  }

  const justCompletedSetup = new URLSearchParams(location.search).has("setup");

  return (
    <SetupOverview
      data={data}
      billingApproved={bootstrapData?.billingApproved}
      themeEmbedEnabled={bootstrapData?.themeEmbedEnabled}
      shop={bootstrapData?.shop || ""}
      merchantName={bootstrapData?.merchantName || ""}
      justCompletedSetup={justCompletedSetup}
    />
  );
}

function getThemeEditorUrl(shop: string): string {
  const storeHandle = shop.replace(/\.myshopify\.com$/i, "");
  return `https://admin.shopify.com/store/${storeHandle}/themes/current/editor?context=apps`;
}

function statusFor(done: boolean, isNext: boolean): SetupStepStatus {
  if (done) return "done";
  if (isNext) return "in_progress";
  return "not_started";
}

function SetupOverview({
  data,
  billingApproved,
  themeEmbedEnabled,
  shop,
  merchantName,
  justCompletedSetup,
}: {
  data: ShopifyMerchantOverview;
  billingApproved?: boolean;
  themeEmbedEnabled?: boolean;
  shop: string;
  merchantName: string;
  justCompletedSetup?: boolean;
}) {
  const progress = getSetupProgress(data, billingApproved, themeEmbedEnabled);
  const fetcher = useFetcher<{ ok?: boolean; error?: string; intent?: string; externalOrderId?: string }>();
  const themeEditorUrl = getThemeEditorUrl(shop);
  const notificationPhone = data.settings?.notificationPhone || "";
  const firstProduct = data.products?.[0] ?? null;

  const productCountLabel = progress.productCount > 0 ? progress.productCount : "your";

  const requiredSteps: SetupStep[] = [
    {
      id: "billing",
      title: "Pick a plan",
      description: "Choose a plan and approve billing in Shopify.",
      to: "/app/billing",
      icon: CartIcon,
      status: statusFor(progress.hasBilling, progress.nextStep === "billing"),
      estimateMinutes: STEP_ESTIMATES.billing,
    },
    {
      id: "products",
      title: "Add product instructions",
      description: `Add usage instructions for ${productCountLabel} products so Recete can answer customer questions.`,
      to: "/app/products",
      icon: CatalogIcon,
      status: statusFor(progress.hasProducts, progress.nextStep === "products"),
      estimateMinutes: STEP_ESTIMATES.products,
    },
    {
      id: "messaging",
      title: "Set up welcome message",
      description: "Pick a bot name, language, and the message customers receive after delivery.",
      to: "/app/setup/messaging",
      icon: SettingsIcon,
      status: statusFor(progress.hasMessagingConfigured, progress.nextStep === "messaging"),
      estimateMinutes: STEP_ESTIMATES.messaging,
    },
  ];

  const optionalSteps: SetupStep[] = [
    {
      id: "orders",
      title: "Run a test order",
      description: "Create and fulfill a Shopify test order to verify the live flow.",
      to: "/app/integrations#orders-flow",
      icon: ConnectIcon,
      status: statusFor(progress.hasOrders, progress.nextOptionalStep === "orders" && progress.setupComplete),
      estimateMinutes: STEP_ESTIMATES.orders,
    },
    {
      id: "themeEmbed",
      title: "Enable on-site widget",
      description: "Activate the Recete embed block in your Shopify theme editor.",
      to: themeEditorUrl,
      icon: CodeIcon,
      status: statusFor(progress.hasThemeEmbed, progress.nextOptionalStep === "themeEmbed" && progress.setupComplete),
      estimateMinutes: STEP_ESTIMATES.themeEmbed,
      markAsDoneAction: true,
      openInNewTab: true,
    },
  ];

  const setupComplete = progress.setupComplete;
  const completedRequired = progress.completedCount;
  const totalRequired = progress.totalSteps;
  const percentComplete = totalRequired === 0 ? 0 : Math.round((completedRequired / totalRequired) * 100);

  // Time-left estimate: only counts incomplete REQUIRED steps.
  const minutesLeft = requiredSteps
    .filter((step) => step.status !== "done")
    .reduce((total, step) => total + step.estimateMinutes, 0);

  const nextRequiredStep = requiredSteps.find((step) => step.status !== "done") ?? null;

  const personalizedHeading = merchantName.trim()
    ? `Let's get Recete ready, ${merchantName.trim().split(/\s+/)[0]}`
    : "Let's get Recete ready";

  return (
    <ShellPage
      title={setupComplete ? "Recete is ready" : "Welcome to Recete"}
      subtitle={
        setupComplete
          ? "Setup is complete. You can now run daily operations."
          : "Three quick steps to start helping customers after delivery."
      }
      primaryAction={
        setupComplete
          ? { content: "Open dashboard", url: "/app/dashboard", icon: ViewIcon }
          : { content: "Continue setup", url: nextRequiredStep?.to || "/app/billing", icon: nextRequiredStep?.icon || CartIcon }
      }
    >
      {/* ── Celebration banner (shown once after completing final setup step) ── */}
      {setupComplete && justCompletedSetup ? (
        <Banner tone="success">
          <Text as="p" variant="bodyMd" fontWeight="semibold">
            🎉 Setup complete — Recete is live! Your customers will now receive a WhatsApp message after delivery.
          </Text>
        </Banner>
      ) : null}

      {/* ── Hero progress card ──────────────────────────────────────────── */}
      <Card padding="500" roundedAbove="sm">
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center" wrap>
            <BlockStack gap="100">
              <Text as="h2" variant="headingLg">
                {setupComplete ? "🎉 Recete is live" : personalizedHeading}
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                {setupComplete
                  ? "Ready to send your first customer message."
                  : `${completedRequired} of ${totalRequired} done · ~${minutesLeft} min left`}
              </Text>
            </BlockStack>
            <Badge tone={setupComplete ? "success" : "attention"}>
              {setupComplete ? "Ready to go live" : "In progress"}
            </Badge>
          </InlineStack>

          <ProgressBar progress={percentComplete} tone="primary" size="medium" />

          {setupComplete ? (
            <InlineStack gap="200">
              <Button url="/app/dashboard" variant="primary" icon={ViewIcon}>
                Open dashboard
              </Button>
              <Button url="/app/setup/messaging">Preview welcome message</Button>
            </InlineStack>
          ) : nextRequiredStep ? (
            <InlineStack gap="200">
              <Button url={nextRequiredStep.to} variant="primary" icon={nextRequiredStep.icon}>
                {`Continue: ${nextRequiredStep.title}`}
              </Button>
            </InlineStack>
          ) : null}
        </BlockStack>
      </Card>

      {/* ── Required steps ──────────────────────────────────────────────── */}
      <Card padding="500" roundedAbove="sm">
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center" wrap>
            <Text as="h2" variant="headingMd">
              Setup
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              {`${completedRequired}/${totalRequired} completed`}
            </Text>
          </InlineStack>

          <BlockStack gap="300">
            {requiredSteps.map((step) => (
              <SetupStepCard key={step.id} step={step} stepNumber={requiredSteps.indexOf(step) + 1} />
            ))}
          </BlockStack>
        </BlockStack>
      </Card>

      {/* ── Optional steps (only render once required are done OR billing exists) ── */}
      {progress.hasBilling ? (
        <Card padding="500" roundedAbove="sm">
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center" wrap>
              <BlockStack gap="050">
                <Text as="h2" variant="headingMd">
                  Polish your setup
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Optional. You can run Recete fully without these, but they make the experience better.
                </Text>
              </BlockStack>
              <Badge tone={progress.postLaunchComplete ? "success" : "info"}>
                {progress.postLaunchComplete ? "All done" : "Optional"}
              </Badge>
            </InlineStack>

            <InlineGrid columns={{ xs: 1, md: 2 }} gap="300">
              {optionalSteps.map((step) => (
                <OptionalStepCard
                  key={step.id}
                  step={step}
                  fetcher={fetcher}
                  notificationPhone={step.id === "orders" ? notificationPhone : undefined}
                  firstProduct={step.id === "orders" ? firstProduct : undefined}
                />
              ))}
            </InlineGrid>
          </BlockStack>
        </Card>
      ) : null}
    </ShellPage>
  );
}

function SetupStepCard({ step, stepNumber }: { step: SetupStep; stepNumber: number }) {
  const done = step.status === "done";
  return (
    <Card
      padding="400"
      roundedAbove="sm"
      background={done ? "bg-surface-success" : undefined}
    >
      <InlineGrid columns={{ xs: 1, md: "auto 1fr auto" }} gap="300" alignItems="center">
        <Box minWidth="32px">
          <Text as="p" variant="headingMd" tone={done ? "success" : "subdued"}>
            {done ? "✓" : stepNumber}
          </Text>
        </Box>
        <BlockStack gap="100">
          <InlineStack gap="200" blockAlign="center" wrap>
            <Text as="h3" variant="headingSm">
              {step.title}
            </Text>
            <Badge tone={statusTone(step.status)}>
              {step.status === "done" ? "Done" : step.status === "in_progress" ? "Next" : "Up next"}
            </Badge>
            <Text as="span" variant="bodySm" tone="subdued">
              {`~${step.estimateMinutes} min`}
            </Text>
          </InlineStack>
          <Text as="p" variant="bodySm" tone="subdued">
            {step.description}
          </Text>
        </BlockStack>
        <Box>
          <Button
            url={step.to}
            variant={step.status === "in_progress" ? "primary" : "tertiary"}
            icon={step.icon}
            disabled={done}
          >
            {done ? "Done" : step.status === "in_progress" ? "Start" : "Open"}
          </Button>
        </Box>
      </InlineGrid>
    </Card>
  );
}

function OptionalStepCard({
  step,
  fetcher,
  notificationPhone,
  firstProduct,
}: {
  step: SetupStep;
  fetcher: ReturnType<typeof useFetcher<{ ok?: boolean; error?: string; intent?: string; externalOrderId?: string }>>;
  notificationPhone?: string;
  firstProduct?: { id: string; name: string; external_id?: string | null } | null;
}) {
  const done = step.status === "done";
  const [phone, setPhone] = useState(notificationPhone || "");

  // Test order result (only relevant for orders step)
  const testOrderResult =
    fetcher.data?.intent === "runTestOrder" ? fetcher.data : null;
  const testOrderBusy = fetcher.state !== "idle" && !testOrderResult;

  if (step.id === "orders" && !done) {
    return (
      <Card padding="300" roundedAbove="sm">
        <BlockStack gap="200">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h3" variant="headingSm">{step.title}</Text>
            <Badge tone="info">Optional</Badge>
          </InlineStack>
          <Text as="p" variant="bodySm" tone="subdued">
            Enter your WhatsApp number and we&apos;ll simulate a real delivery — you&apos;ll receive the actual message Recete sends to customers.
          </Text>
          {testOrderResult?.ok ? (
            <Banner tone="success">
              <Text as="p" variant="bodySm">
                Test order sent! Check your WhatsApp — the message should arrive within a minute.
              </Text>
            </Banner>
          ) : testOrderResult?.error ? (
            <Banner tone="critical">
              <Text as="p" variant="bodySm">{testOrderResult.error}</Text>
            </Banner>
          ) : null}
          <fetcher.Form method="post">
            <BlockStack gap="200">
              <input type="hidden" name="intent" value="runTestOrder" />
              <input type="hidden" name="product_id" value={firstProduct?.external_id || firstProduct?.id || ""} />
              <input type="hidden" name="product_name" value={firstProduct?.name || "Test Product"} />
              <TextField
                label="Your WhatsApp number"
                name="phone"
                value={phone}
                onChange={setPhone}
                placeholder="+90 555 000 0000"
                helpText="Use international format with country code, e.g. +1 555 000 1234 or +44 7911 123456."
                autoComplete="tel"
                type="tel"
              />
              <Button submit variant="primary" icon={ConnectIcon} loading={testOrderBusy} disabled={done}>
                Send test WhatsApp
              </Button>
            </BlockStack>
          </fetcher.Form>
        </BlockStack>
      </Card>
    );
  }

  return (
    <Card padding="300" roundedAbove="sm" background={done ? "bg-surface-success" : undefined}>
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h3" variant="headingSm">
            {step.title}
          </Text>
          <Badge tone={done ? "success" : "info"}>{done ? "Done" : "Optional"}</Badge>
        </InlineStack>
        <Text as="p" variant="bodySm" tone="subdued">
          {step.description}
        </Text>
        <InlineStack gap="200">
          <Button
            url={step.to}
            variant="tertiary"
            icon={step.icon}
            target={step.openInNewTab ? "_blank" : undefined}
            disabled={done}
          >
            {step.id === "themeEmbed" ? "Open theme editor" : "Open step"}
          </Button>
          {step.markAsDoneAction && !done ? (
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="markThemeEmbedDone" />
              <Button submit variant="plain" loading={fetcher.state !== "idle"}>
                Mark as done
              </Button>
            </fetcher.Form>
          ) : null}
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

function statusTone(status: SetupStepStatus): "success" | "attention" | "info" {
  if (status === "done") return "success";
  if (status === "in_progress") return "attention";
  return "info";
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
