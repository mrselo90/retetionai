import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData, useNavigate, useNavigation, useSubmit } from "react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { CircleUpIcon, DeleteIcon, MagicIcon, RefreshIcon, ConnectIcon } from "@shopify/polaris-icons";
import {
  Button,
  Card,
  ContextualSaveBar,
  EmptyState,
  InlineGrid,
  Layout,
  Page,
  Spinner,
  SkeletonBodyText,
  SkeletonDisplayText,
  SkeletonPage,
  Text,
  TextField,
} from "@shopify/polaris";
import { requireSessionTokenAuthorization } from "../lib/sessionToken.server";
import {
  createMerchantProduct,
  deleteMerchantProduct,
  fetchMerchantProducts,
  generateMerchantProductEmbeddings,
  scrapeMerchantProduct,
} from "../platform.server";
import { MetricCard, SectionCard, StatusBadge } from "../components/shell-ui";
import { FloatingActionFeedback } from "../components/FloatingActionFeedback";

type ActionResult = {
  ok: boolean;
  intent?: string;
  message?: string;
  error?: string;
  productId?: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Embedded data route: require the bearer token locally and rely on the
  // platform API as the single verifier.
  requireSessionTokenAuthorization(request);
  return fetchMerchantProducts(request);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  // Embedded data route: avoid duplicate local Shopify verification.
  requireSessionTokenAuthorization(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  try {
    switch (intent) {
      case "create": {
        const name = String(formData.get("name") || "").trim();
        const url = String(formData.get("url") || "").trim();
        if (!name || !url) {
          return { ok: false, intent, error: "Name and URL are required." } satisfies ActionResult;
        }
        await createMerchantProduct(request, { name, url });
        return { ok: true, intent, message: "Product created successfully." } satisfies ActionResult;
      }
      case "scrape": {
        const productId = String(formData.get("productId") || "").trim();
        if (!productId) return { ok: false, intent, error: "Missing product id." } satisfies ActionResult;
        await scrapeMerchantProduct(request, productId);
        return { ok: true, intent, productId, message: "Scrape completed and content was refreshed." } satisfies ActionResult;
      }
      case "embeddings": {
        const productId = String(formData.get("productId") || "").trim();
        if (!productId) return { ok: false, intent, error: "Missing product id." } satisfies ActionResult;
        await generateMerchantProductEmbeddings(request, productId);
        return { ok: true, intent, productId, message: "Embeddings generated successfully." } satisfies ActionResult;
      }
      case "delete": {
        const productId = String(formData.get("productId") || "").trim();
        if (!productId) return { ok: false, intent, error: "Missing product id." } satisfies ActionResult;
        await deleteMerchantProduct(request, productId);
        return { ok: true, intent, productId, message: "Product deleted successfully." } satisfies ActionResult;
      }
      default:
        return { ok: false, intent, error: "Unknown action." } satisfies ActionResult;
    }
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    return {
      ok: false,
      intent,
      error: error instanceof Error ? error.message : "Product action failed.",
    } satisfies ActionResult;
  }
};

export default function ProductsPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const submit = useSubmit();
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const busy = navigation.state !== "idle";
  const dirty = name.trim().length > 0 || url.trim().length > 0;
  const [feedbackOpen, setFeedbackOpen] = useState(true);

  const stats = useMemo(() => {
    const scraped = data.products.filter((product) => Boolean(product.raw_text)).length;
    const embedded = data.products.filter((product) => (product.chunkCount || 0) > 0).length;
    return {
      scraped,
      embedded,
      coverage: data.products.length > 0 ? Math.round((embedded / data.products.length) * 100) : 0,
    };
  }, [data.products]);

  const handleSave = () => {
    if (formRef.current) submit(formRef.current);
  };

  const handleDiscard = () => {
    setName("");
    setUrl("");
  };

  useEffect(() => {
    if (actionData?.message || actionData?.error) {
      setFeedbackOpen(true);
    }
  }, [actionData?.message, actionData?.error]);

  if (navigation.state === "loading") {
    return (
      <SkeletonPage title="Products" primaryAction>
        <Layout>
          <Layout.Section>
            <Card padding="500">
              <SkeletonDisplayText size="small" />
              <SkeletonBodyText lines={3} />
            </Card>
          </Layout.Section>
        </Layout>
      </SkeletonPage>
    );
  }

  return (
    <Page
      fullWidth
      title="Products"
      subtitle="Catalog workspace for scraping, enrichment, and merchant-ready AI product coverage."
      primaryAction={{ content: "Add product", icon: CircleUpIcon, onAction: handleSave, disabled: !dirty }}
      secondaryActions={[
        { content: "Shopify mapping", onAction: () => navigate("/app/products/mapping"), icon: ConnectIcon as never },
      ]}
    >
      {dirty ? (
        <ContextualSaveBar
          message="Unsaved product draft"
          saveAction={{ onAction: handleSave, loading: busy, disabled: !dirty }}
          discardAction={{ onAction: handleDiscard, disabled: busy }}
        />
      ) : null}

      {feedbackOpen && actionData?.message ? (
        <FloatingActionFeedback
          tone="success"
          title="Catalog action completed"
          message={actionData.message}
          actionLabel={actionData.intent === "create" ? "Review products" : "Open product list"}
          onAction={() => {
            document.getElementById("catalog-operations")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          onDismiss={() => setFeedbackOpen(false)}
        />
      ) : null}

      {feedbackOpen && actionData?.error ? (
        <FloatingActionFeedback
          tone="critical"
          title="Catalog action failed"
          message={actionData.error}
          actionLabel="Review form"
          onAction={() => {
            document.getElementById(actionData.intent === "create" ? "add-catalog-entry" : "catalog-operations")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          onDismiss={() => setFeedbackOpen(false)}
        />
      ) : null}

      <Layout>
        <Layout.Section>
          {busy ? <Spinner accessibilityLabel="Saving product" size="small" /> : null}
        </Layout.Section>

        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
            <MetricCard label="Catalog rows" value={data.products.length} hint="Products visible inside Recete." />
            <MetricCard label="Scraped" value={stats.scraped} hint="Products with refreshed page content." />
            <MetricCard label="Embedded" value={stats.embedded} hint="Products prepared for RAG and downstream AI logic." />
            <MetricCard label="Coverage" value={`${stats.coverage}%`} hint="Share of catalog ready for AI flows." />
          </InlineGrid>
        </Layout.Section>

        <Layout.Section>
          <SectionCard
            id="add-catalog-entry"
            title="Add catalog entry"
            subtitle="Use this form when a merchant needs to seed or repair a product record inside the embedded app."
            badge={actionData?.message ? <StatusBadge status="active">{actionData.message}</StatusBadge> : undefined}
          >
            {actionData?.error ? <Text as="p" variant="bodyMd" tone="critical">{actionData.error}</Text> : null}
            <Form method="post" ref={formRef}>
              <input type="hidden" name="intent" value="create" />
              <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                <TextField
                  label="Product name"
                  name="name"
                  value={name}
                  onChange={setName}
                  autoComplete="off"
                  placeholder="Hydrating cleanser"
                />
                <TextField
                  label="Product URL"
                  name="url"
                  value={url}
                  onChange={setUrl}
                  autoComplete="off"
                  placeholder="https://example.com/products/hydrating-cleanser"
                />
              </InlineGrid>
            </Form>
          </SectionCard>
        </Layout.Section>

        <Layout.Section>
          <SectionCard
            id="catalog-operations"
            title="Catalog operations"
            subtitle="Merchants should see product status, enrichment depth, and the next maintenance action in one screen."
            badge={<Button onClick={() => navigate("/app/products/mapping")} icon={ConnectIcon} variant="primary">Open Shopify mapping</Button>}
          >
            {data.products.length > 0 ? (
              <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                {data.products.map((product) => (
                  <Card key={product.id} padding="500">
                    <Layout>
                      <Layout.Section>
                        <Text as="h3" variant="headingLg">{product.name}</Text>
                        <Text as="p" variant="bodyMd" tone="subdued">{product.url}</Text>
                      </Layout.Section>
                      <Layout.Section>
                        <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                          <StatusBadge status={product.raw_text ? "active" : "pending"}>
                            {product.raw_text ? "Scraped" : "Needs scrape"}
                          </StatusBadge>
                          <StatusBadge status={(product.chunkCount || 0) > 0 ? "active" : "pending"}>
                            {`${product.chunkCount || 0} chunks`}
                          </StatusBadge>
                        </InlineGrid>
                      </Layout.Section>
                      <Layout.Section>
                        <InlineGrid columns={{ xs: 1, sm: 2 }} gap="200">
                          <Button
                            fullWidth
                            icon={ConnectIcon}
                            variant="primary"
                            onClick={() =>
                              navigate(
                                product.external_id
                                  ? `/app/products/mapping?product=${encodeURIComponent(product.external_id)}`
                                  : "/app/products/mapping",
                              )
                            }
                          >
                            Edit mapping
                          </Button>
                        </InlineGrid>
                      </Layout.Section>
                      <Layout.Section>
                        <InlineGrid columns={{ xs: 1, sm: 3 }} gap="200">
                          <InlineActionForm productId={product.id} intent="scrape" label="Scrape" icon={RefreshIcon} />
                          <InlineActionForm productId={product.id} intent="embeddings" label="Generate embeddings" icon={MagicIcon} />
                          <InlineActionForm productId={product.id} intent="delete" label="Delete" icon={DeleteIcon} destructive />
                        </InlineGrid>
                      </Layout.Section>
                    </Layout>
                  </Card>
                ))}
              </InlineGrid>
            ) : (
              <EmptyState
                heading="No products visible yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                Add the first product above, then scrape it so the AI pipeline has usable product context.
              </EmptyState>
            )}
          </SectionCard>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function InlineActionForm({
  productId,
  intent,
  label,
  icon,
  destructive = false,
}: {
  productId: string;
  intent: string;
  label: string;
  icon: unknown;
  destructive?: boolean;
}) {
  return (
    <Form method="post">
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="productId" value={productId} />
      <Button submit fullWidth icon={icon as never} tone={destructive ? "critical" : undefined}>
        {label}
      </Button>
    </Form>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
