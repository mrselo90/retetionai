import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useFetcher, useLoaderData, useNavigate, useNavigation, useSubmit } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { ArrowLeftIcon, CheckIcon, MagicIcon } from "@shopify/polaris-icons";
import {
  Box,
  Button,
  Card,
  ContextualSaveBar,
  EmptyState,
  InlineGrid,
  InlineStack,
  Layout,
  Page,
  ProgressBar,
  Select,
  SkeletonBodyText,
  SkeletonDisplayText,
  SkeletonPage,
  Text,
  TextField,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import {
  createMerchantProduct,
  fetchShopifyCatalog,
  type MerchantProductInstruction,
  type ShopifyCatalogProduct,
  updateMerchantProductInstruction,
} from "../platform.server";
import { MetricCard, SectionCard, StatusBadge } from "../components/shell-ui";

type ActionResult = {
  ok: boolean;
  message?: string;
  error?: string;
  selectedProductId?: string;
};

type MappingRow = {
  shopify: ShopifyCatalogProduct;
  localProductId?: string;
  instruction?: MerchantProductInstruction;
  mapped: boolean;
};

type MappingDraft = {
  usage_instructions: string;
  recipe_summary: string;
  prevention_tips: string;
  video_url: string;
};

type LocalProductRecord = {
  id: string;
  external_id?: string | null;
};

type MappingDataPayload = {
  instructions: MerchantProductInstruction[];
  localProducts: LocalProductRecord[];
  localProductCount: number;
};

function stripHtmlForRag(html?: string) {
  if (!html) return undefined;
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || undefined;
}

function emptyDraft(): MappingDraft {
  return {
    usage_instructions: "",
    recipe_summary: "",
    prevention_tips: "",
    video_url: "",
  };
}

function draftFromInstruction(instruction?: MerchantProductInstruction): MappingDraft {
  return {
    usage_instructions: instruction?.usage_instructions || "",
    recipe_summary: instruction?.recipe_summary || "",
    prevention_tips: instruction?.prevention_tips || "",
    video_url: instruction?.video_url || "",
  };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const catalog = await fetchShopifyCatalog(request, { first: 24 });

  return {
    shopDomain: catalog.shopDomain,
    catalogProducts: catalog.products,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const selectedProductId = String(formData.get("selected_product_id") || "");
  const title = String(formData.get("title") || "").trim();
  const handle = String(formData.get("handle") || "").trim();
  const externalId = String(formData.get("external_id") || "").trim();
  const descriptionHtml = String(formData.get("description_html") || "");
  const usageInstructions = String(formData.get("usage_instructions") || "").trim();
  const recipeSummary = String(formData.get("recipe_summary") || "").trim();
  const preventionTips = String(formData.get("prevention_tips") || "").trim();
  const videoUrl = String(formData.get("video_url") || "").trim();
  const existingProductId = String(formData.get("existing_product_id") || "").trim();

  if (!selectedProductId || !title || !handle || !externalId) {
    return { ok: false, error: "Missing Shopify product context." } satisfies ActionResult;
  }

  if (!usageInstructions) {
    return {
      ok: false,
      error: "Usage instructions are required before a mapping can be saved.",
      selectedProductId,
    } satisfies ActionResult;
  }

  try {
    let productId = existingProductId;
    if (!productId) {
      const createResponse = (await createMerchantProduct(request, {
        name: title,
        url: `https://${session.shop}/products/${handle}`,
        external_id: externalId,
        raw_text: stripHtmlForRag(descriptionHtml),
      })) as { product?: { id: string } };
      productId = createResponse.product?.id || "";
    }

    if (!productId) {
      return {
        ok: false,
        error: "Failed to create the linked Recete product record.",
        selectedProductId,
      } satisfies ActionResult;
    }

    await updateMerchantProductInstruction(request, productId, {
      usage_instructions: usageInstructions,
      recipe_summary: recipeSummary || undefined,
      prevention_tips: preventionTips || undefined,
      video_url: videoUrl || undefined,
    });

    return {
      ok: true,
      message: "Shopify product mapping saved.",
      selectedProductId,
    } satisfies ActionResult;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to save Shopify mapping.",
      selectedProductId,
    } satisfies ActionResult;
  }
};

export default function ProductMappingPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const mappingDataFetcher = useFetcher<MappingDataPayload>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const mappingDataLoading = mappingDataFetcher.state !== "idle" && !mappingDataFetcher.data;

  useEffect(() => {
    if (mappingDataFetcher.state === "idle" && !mappingDataFetcher.data) {
      mappingDataFetcher.load("/app/products/mapping-data");
    }
  }, [mappingDataFetcher]);

  useEffect(() => {
    if (actionData?.ok) {
      mappingDataFetcher.load("/app/products/mapping-data");
    }
  }, [actionData?.ok, mappingDataFetcher]);

  const baseRows = useMemo<MappingRow[]>(
    () =>
      data.catalogProducts.map((product) => ({
        shopify: product,
        mapped: false,
      })),
    [data.catalogProducts],
  );

  const rows = useMemo<MappingRow[]>(() => {
    if (!mappingDataFetcher.data) return baseRows;

    const localByExternalId = new Map(
      mappingDataFetcher.data.localProducts
        .filter((product) => product.external_id)
        .map((product) => [product.external_id as string, product]),
    );
    const instructionsByExternalId = new Map<string, MerchantProductInstruction>();
    const instructionsByProductId = new Map<string, MerchantProductInstruction>();

    for (const instruction of mappingDataFetcher.data.instructions || []) {
      if (instruction.external_id) instructionsByExternalId.set(instruction.external_id, instruction);
      instructionsByProductId.set(instruction.product_id, instruction);
    }

    return data.catalogProducts.map((product) => {
      const localProduct = localByExternalId.get(product.id);
      const instruction =
        instructionsByExternalId.get(product.id) ||
        (localProduct ? instructionsByProductId.get(localProduct.id) : undefined);

      return {
        shopify: product,
        localProductId: localProduct?.id,
        instruction,
        mapped: Boolean(localProduct && instruction?.usage_instructions),
      };
    });
  }, [baseRows, data.catalogProducts, mappingDataFetcher.data]);

  const mappedCount = useMemo(() => rows.filter((row) => row.localProductId).length, [rows]);
  const instructionCount = useMemo(
    () => rows.filter((row) => Boolean(row.instruction?.usage_instructions)).length,
    [rows],
  );
  const localProductCount = mappingDataFetcher.data?.localProductCount ?? 0;

  const [selectedProductId, setSelectedProductId] = useState<string>(
    actionData?.selectedProductId || data.catalogProducts[0]?.id || "",
  );
  const [drafts, setDrafts] = useState<Record<string, MappingDraft>>(() =>
    Object.fromEntries(data.catalogProducts.map((product) => [product.id, emptyDraft()])),
  );

  useEffect(() => {
    if (actionData?.selectedProductId) setSelectedProductId(actionData.selectedProductId);
  }, [actionData?.selectedProductId]);

  useEffect(() => {
    if (!selectedProductId && rows[0]?.shopify.id) {
      setSelectedProductId(rows[0].shopify.id);
    }
  }, [rows, selectedProductId]);

  useEffect(() => {
    if (!mappingDataFetcher.data) return;

    setDrafts((current) => {
      const next = { ...current };

      for (const row of rows) {
        const rowId = row.shopify.id;
        const existing = current[rowId] || emptyDraft();
        const serverDraft = draftFromInstruction(row.instruction);

        next[rowId] = {
          usage_instructions: existing.usage_instructions || serverDraft.usage_instructions,
          recipe_summary: existing.recipe_summary || serverDraft.recipe_summary,
          prevention_tips: existing.prevention_tips || serverDraft.prevention_tips,
          video_url: existing.video_url || serverDraft.video_url,
        };
      }

      return next;
    });
  }, [mappingDataFetcher.data, rows]);

  const selectedRow = useMemo(
    () => rows.find((row) => row.shopify.id === selectedProductId) || rows[0],
    [rows, selectedProductId],
  );

  const currentDraft = selectedRow ? drafts[selectedRow.shopify.id] : undefined;
  const initialDraft = selectedRow ? draftFromInstruction(selectedRow.instruction) : null;
  const dirty = Boolean(
    selectedRow &&
      currentDraft &&
      JSON.stringify(currentDraft) !== JSON.stringify(initialDraft),
  );

  const selectOptions = rows.map((row) => ({
    label: row.shopify.title,
    value: row.shopify.id,
  }));

  if (navigation.state === "loading" && !selectedRow) {
    return (
      <SkeletonPage title="Shopify mapping" primaryAction>
        <Layout>
          <Layout.Section>
            <Card padding="500">
              <SkeletonDisplayText size="small" />
              <SkeletonBodyText lines={5} />
            </Card>
          </Layout.Section>
        </Layout>
      </SkeletonPage>
    );
  }

  return (
    <Page
      backAction={{ content: "Products", onAction: () => navigate("/app/products") }}
      fullWidth
      title="Shopify mapping"
      subtitle="Connect Shopify catalog items to Recete recipes so the delivery flow can send accurate post-purchase guidance."
      primaryAction={{ content: "Back to products", onAction: () => navigate("/app/products"), icon: ArrowLeftIcon }}
    >
      {dirty && selectedRow ? (
        <ContextualSaveBar
          message={`Unsaved mapping draft for ${selectedRow.shopify.title}`}
          saveAction={{
            onAction: () => {
              const form = document.getElementById("mapping-form") as HTMLFormElement | null;
              if (form) submit(form);
            },
            loading: busy,
            disabled: !dirty,
          }}
          discardAction={{
            onAction: () => {
              if (!selectedRow || !initialDraft) return;
              setDrafts((current) => ({
                ...current,
                [selectedRow.shopify.id]: { ...initialDraft },
              }));
            },
            disabled: busy,
          }}
        />
      ) : null}

      <Layout>
        <Layout.Section>
          {busy || mappingDataLoading ? <ProgressBar progress={70} size="small" /> : null}
        </Layout.Section>

        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
            <MetricCard label="Catalog rows" value={rows.length} hint="Shopify products currently loaded into this mapping workspace." />
            <MetricCard label="Linked" value={mappedCount} hint="Products already linked to a local Recete record." />
            <MetricCard label="Instructions ready" value={instructionCount} hint="Catalog items with usable usage guidance saved." />
            <MetricCard label="Local catalog" value={localProductCount} hint="Recete-side product records available for AI and scraping." />
          </InlineGrid>
        </Layout.Section>

        <Layout.Section>
          <SectionCard
            title="Mapping queue"
            subtitle="Merchants should be able to see what is connected, what is missing, and fix the recipe content without leaving Shopify."
            badge={<StatusBadge status={selectedRow?.mapped ? "active" : "pending"}>{selectedRow?.mapped ? "Mapped" : "Needs setup"}</StatusBadge>}
          >
            {rows.length > 0 ? (
              <BlockArea
                options={selectOptions}
                selectedProductId={selectedProductId}
                onChange={setSelectedProductId}
                rows={rows}
              />
            ) : (
              <EmptyState
                heading="No Shopify catalog items loaded"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                Connect Shopify correctly and ensure products exist in the store before mapping recipes.
              </EmptyState>
            )}
            {mappingDataLoading ? (
              <Box paddingBlockStart="400">
                <Text as="p" variant="bodyMd" tone="subdued">
                  Loading Recete mappings and saved guidance...
                </Text>
              </Box>
            ) : null}
          </SectionCard>
        </Layout.Section>

        {selectedRow && currentDraft ? (
          <Layout.Section>
            {actionData?.message ? <StatusBadge status="active">{actionData.message}</StatusBadge> : null}
            {actionData?.error ? <Text as="p" variant="bodyMd" tone="critical">{actionData.error}</Text> : null}
            <SectionCard
              title={selectedRow.shopify.title}
              subtitle="Define the exact usage guidance, recipe summary, and prevention tips that the AI should use after delivery."
              badge={<StatusBadge status={selectedRow.localProductId ? "active" : "pending"}>{selectedRow.localProductId ? "Local record linked" : "Will create local record"}</StatusBadge>}
            >
              <Form method="post" id="mapping-form">
                <input type="hidden" name="selected_product_id" value={selectedRow.shopify.id} />
                <input type="hidden" name="title" value={selectedRow.shopify.title} />
                <input type="hidden" name="handle" value={selectedRow.shopify.handle} />
                <input type="hidden" name="external_id" value={selectedRow.shopify.id} />
                <input type="hidden" name="description_html" value={selectedRow.shopify.descriptionHtml || ""} />
                <input type="hidden" name="existing_product_id" value={selectedRow.localProductId || ""} />

                <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                  <TextField
                    label="Shopify status"
                    value={selectedRow.shopify.status}
                    autoComplete="off"
                    disabled
                  />
                  <TextField
                    label="Shopify handle"
                    value={selectedRow.shopify.handle}
                    autoComplete="off"
                    disabled
                  />
                </InlineGrid>

                <Box paddingBlockStart="400">
                  <TextField
                    label="Usage instructions"
                    name="usage_instructions"
                    multiline={8}
                    value={currentDraft.usage_instructions}
                    onChange={(value) =>
                      setDrafts((current) => ({
                        ...current,
                        [selectedRow.shopify.id]: {
                          ...current[selectedRow.shopify.id],
                          usage_instructions: value,
                        },
                      }))
                    }
                    helpText="This is the primary recipe/usage block the AI will use in post-delivery messages."
                    autoComplete="off"
                  />
                </Box>

                <Box paddingBlockStart="400">
                  <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                    <TextField
                      label="Recipe summary"
                      name="recipe_summary"
                      multiline={4}
                      value={currentDraft.recipe_summary}
                      onChange={(value) =>
                        setDrafts((current) => ({
                          ...current,
                          [selectedRow.shopify.id]: {
                            ...current[selectedRow.shopify.id],
                            recipe_summary: value,
                          },
                        }))
                      }
                      autoComplete="off"
                    />
                    <TextField
                      label="Prevention tips"
                      name="prevention_tips"
                      multiline={4}
                      value={currentDraft.prevention_tips}
                      onChange={(value) =>
                        setDrafts((current) => ({
                          ...current,
                          [selectedRow.shopify.id]: {
                            ...current[selectedRow.shopify.id],
                            prevention_tips: value,
                          },
                        }))
                      }
                      autoComplete="off"
                    />
                  </InlineGrid>
                </Box>

                <Box paddingBlockStart="400">
                  <TextField
                    label="Video URL"
                    name="video_url"
                    value={currentDraft.video_url}
                    onChange={(value) =>
                      setDrafts((current) => ({
                        ...current,
                        [selectedRow.shopify.id]: {
                          ...current[selectedRow.shopify.id],
                          video_url: value,
                        },
                      }))
                    }
                    autoComplete="off"
                    helpText="Optional product education or tutorial link."
                  />
                </Box>

                <Box paddingBlockStart="400">
                  <InlineStack gap="300" wrap>
                    <Button submit icon={CheckIcon} variant="primary" loading={busy}>
                      Save mapping
                    </Button>
                    <Button onClick={() => navigate("/app/products")} icon={MagicIcon}>
                      Return to product workspace
                    </Button>
                  </InlineStack>
                </Box>
              </Form>
            </SectionCard>
          </Layout.Section>
        ) : null}
      </Layout>
    </Page>
  );
}

function BlockArea({
  options,
  selectedProductId,
  onChange,
  rows,
}: {
  options: Array<{ label: string; value: string }>;
  selectedProductId: string;
  onChange: (value: string) => void;
  rows: MappingRow[];
}) {
  return (
    <>
      <Select label="Shopify product" options={options} value={selectedProductId} onChange={onChange} />
      <Box paddingBlockStart="400">
        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          {rows.map((row) => (
            <Card key={row.shopify.id} padding="500">
              <InlineStack align="space-between" blockAlign="start" gap="300">
                <Box maxWidth="22rem">
                  <Text as="h3" variant="headingMd">
                    {row.shopify.title}
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    {row.shopify.vendor || "No vendor"} · {row.shopify.productType || "General"}
                  </Text>
                </Box>
                <StatusBadge status={row.mapped ? "active" : row.localProductId ? "pending" : "inactive"}>
                  {row.mapped ? "Ready" : row.localProductId ? "Drafted" : "Unmapped"}
                </StatusBadge>
              </InlineStack>
            </Card>
          ))}
        </InlineGrid>
      </Box>
    </>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
