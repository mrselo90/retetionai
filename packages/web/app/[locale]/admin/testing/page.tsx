'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import {
    Badge,
    Banner,
    BlockStack,
    Box,
    Button,
    Card,
    Checkbox,
    Divider,
    InlineGrid,
    InlineStack,
    Layout,
    Page,
    Scrollable,
    Select,
    SkeletonBodyText,
    SkeletonDisplayText,
    SkeletonPage,
    Text,
    TextField,
} from '@shopify/polaris';
import { FlaskConical, ListChecks, MessageSquareReply, PackageCheck, Store } from 'lucide-react';

interface MerchantOption {
    id: string;
    name: string;
    integrations?: Array<{ provider: string; status: string }>;
}

interface MerchantProduct {
    id: string;
    name: string;
    externalId: string | null;
    url: string | null;
    updatedAt: string | null;
}

interface MerchantTestKitData {
    merchant: {
        id: string;
        name: string;
        subscription_plan?: string | null;
        subscription_status?: string | null;
    };
    integrations: Array<{ provider: string; status: string }>;
    products: MerchantProduct[];
    whatsapp: {
        configured: boolean;
        provider?: string;
        senderMode?: string;
        from?: string | null;
    };
}

interface TestOrderResult {
    success: boolean;
    merchant: { id: string; name: string };
    order: {
        id: string;
        externalOrderId: string;
        status: string;
        deliveryDate: string | null;
        createdAt: string;
    };
    user: {
        id: string;
        phone: string;
        name: string | null;
        email: string | null;
    };
    products: Array<{ id: string; name: string; externalId: string | null }>;
    queuedFollowUps: boolean;
}

interface ReplyResult {
    success: boolean;
    conversationId: string;
    orderId: string | null;
    inboundMessage: string;
    aiReply: string;
    intent?: string;
    guardrailBlocked?: boolean;
    upsellTriggered?: boolean;
    liveSend?: {
        attempted: boolean;
        success: boolean;
        error?: string | null;
        messageId?: string | null;
    } | null;
}

interface ShopifyScenarioDefinition {
    id: string;
    title: string;
    feature: string;
    description: string;
}

interface ScenarioAssertionResult {
    id: string;
    passed: boolean;
    message: string;
}

interface ShopifyScenarioResult {
    id: string;
    title: string;
    feature: string;
    passed: boolean;
    inboundMessage: string;
    aiReply: string;
    intent: string;
    guardrailBlocked: boolean;
    upsellTriggered: boolean;
    assertions: ScenarioAssertionResult[];
}

interface ShopifyScenarioRunResponse {
    success: boolean;
    merchant: { id: string; name: string };
    order: {
        id: string;
        externalOrderId: string;
        status: string;
        deliveryDate: string | null;
        createdAt: string;
    };
    user: {
        id: string;
        phone: string;
        name: string | null;
        email: string | null;
    };
    products: Array<{ id: string; name: string; externalId: string | null }>;
    summary: {
        total: number;
        passed: number;
        failed: number;
    };
    results: ShopifyScenarioResult[];
}

export default function AdminTestingPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [merchants, setMerchants] = useState<MerchantOption[]>([]);
    const [selectedMerchantId, setSelectedMerchantId] = useState('');
    const [merchantData, setMerchantData] = useState<MerchantTestKitData | null>(null);
    const [merchantLoading, setMerchantLoading] = useState(false);
    const [productQuery, setProductQuery] = useState('');
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
    const [customerName, setCustomerName] = useState('Test Customer');
    const [customerEmail, setCustomerEmail] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerLocale, setCustomerLocale] = useState('tr');
    const [markDelivered, setMarkDelivered] = useState(true);
    const [creatingOrder, setCreatingOrder] = useState(false);
    const [orderResult, setOrderResult] = useState<TestOrderResult | null>(null);
    const [replyMessage, setReplyMessage] = useState('Urunu nasil kullanmaliyim?');
    const [sendReplyLive, setSendReplyLive] = useState(false);
    const [simulatingReply, setSimulatingReply] = useState(false);
    const [replyResult, setReplyResult] = useState<ReplyResult | null>(null);
    const [scenarioCatalog, setScenarioCatalog] = useState<ShopifyScenarioDefinition[]>([]);
    const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>([]);
    const [scenariosLoading, setScenariosLoading] = useState(false);
    const [runningScenarios, setRunningScenarios] = useState(false);
    const [scenarioRunResult, setScenarioRunResult] = useState<ShopifyScenarioRunResponse | null>(null);

    const fetchMerchants = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const response = await authenticatedRequest<{ merchants: MerchantOption[] }>(
                '/api/admin/merchants',
                session.access_token,
            );
            setMerchants(response.merchants || []);
            if (!selectedMerchantId && response.merchants?.length) {
                setSelectedMerchantId(response.merchants[0].id);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load merchants');
        } finally {
            setLoading(false);
        }
    };

    const fetchScenarioCatalog = async () => {
        setScenariosLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const response = await authenticatedRequest<{ scenarios: ShopifyScenarioDefinition[] }>(
                '/api/admin/test-kit/shopify-scenarios',
                session.access_token,
            );
            const scenarios = response.scenarios || [];
            setScenarioCatalog(scenarios);
            setSelectedScenarioIds(scenarios.map((scenario) => scenario.id));
        } catch (err: any) {
            setError(err.message || 'Failed to load Shopify scenarios');
        } finally {
            setScenariosLoading(false);
        }
    };

    const fetchMerchantData = async (merchantId: string) => {
        if (!merchantId) {
            setMerchantData(null);
            setSelectedProductIds([]);
            return;
        }

        setMerchantLoading(true);
        setOrderResult(null);
        setReplyResult(null);
        setScenarioRunResult(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const response = await authenticatedRequest<MerchantTestKitData>(
                `/api/admin/merchants/${merchantId}/test-kit`,
                session.access_token,
            );
            setMerchantData(response);
            setSelectedProductIds(response.products.slice(0, 2).map((product) => product.id));
        } catch (err: any) {
            setError(err.message || 'Failed to load merchant test data');
        } finally {
            setMerchantLoading(false);
        }
    };

    useEffect(() => {
        void fetchMerchants();
        void fetchScenarioCatalog();
    }, []);

    useEffect(() => {
        if (selectedMerchantId) {
            void fetchMerchantData(selectedMerchantId);
        }
    }, [selectedMerchantId]);

    const toggleProduct = (productId: string, checked: boolean) => {
        setSelectedProductIds((current) => {
            if (checked) {
                return current.includes(productId) ? current : [...current, productId];
            }
            return current.filter((id) => id !== productId);
        });
    };

    const toggleScenario = (scenarioId: string, checked: boolean) => {
        setSelectedScenarioIds((current) => {
            if (checked) {
                return current.includes(scenarioId) ? current : [...current, scenarioId];
            }
            return current.filter((id) => id !== scenarioId);
        });
    };

    const createTestOrder = async () => {
        setCreatingOrder(true);
        setReplyResult(null);
        setError('');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const response = await authenticatedRequest<TestOrderResult>(
                '/api/admin/test-kit/order',
                session.access_token,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        merchantId: selectedMerchantId,
                        productIds: selectedProductIds,
                        customerName,
                        customerEmail,
                        customerPhone,
                        customerLocale,
                        markDelivered,
                    }),
                },
            );
            setOrderResult(response);
            setCustomerPhone(response.user.phone);
        } catch (err: any) {
            setError(err.message || 'Failed to create test order');
        } finally {
            setCreatingOrder(false);
        }
    };

    const simulateReply = async () => {
        setSimulatingReply(true);
        setError('');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const response = await authenticatedRequest<ReplyResult>(
                '/api/admin/test-kit/whatsapp-reply',
                session.access_token,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        merchantId: selectedMerchantId,
                        phone: customerPhone,
                        message: replyMessage,
                        orderId: orderResult?.order.id,
                        sendReplyLive,
                    }),
                },
            );
            setReplyResult(response);
        } catch (err: any) {
            setError(err.message || 'Failed to simulate customer reply');
        } finally {
            setSimulatingReply(false);
        }
    };

    const runShopifyScenarioSuite = async () => {
        setRunningScenarios(true);
        setError('');
        setScenarioRunResult(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const response = await authenticatedRequest<ShopifyScenarioRunResponse>(
                '/api/admin/test-kit/shopify-scenarios/run',
                session.access_token,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        merchantId: selectedMerchantId,
                        scenarioIds: selectedScenarioIds,
                        productIds: selectedProductIds,
                        customerName,
                        customerEmail,
                        customerPhone,
                        customerLocale,
                    }),
                },
            );
            setScenarioRunResult(response);
            setCustomerPhone(response.user.phone);
        } catch (err: any) {
            setError(err.message || 'Failed to run Shopify scenario suite');
        } finally {
            setRunningScenarios(false);
        }
    };

    const filteredProducts = useMemo(() => {
        return merchantData?.products.filter((product) => {
            const query = productQuery.trim().toLowerCase();
            if (!query) return true;
            return (
                product.name.toLowerCase().includes(query) ||
                (product.externalId || '').toLowerCase().includes(query)
            );
        }) || [];
    }, [merchantData?.products, productQuery]);

    const merchantOptions = [
        { label: 'Select merchant', value: '' },
        ...merchants.map((merchant) => ({
            label: merchant.name || merchant.id,
            value: merchant.id,
        })),
    ];

    const allScenariosSelected = scenarioCatalog.length > 0 && selectedScenarioIds.length === scenarioCatalog.length;
    const canCreateOrder = Boolean(selectedMerchantId && customerPhone.trim() && selectedProductIds.length > 0);
    const canSimulateReply = Boolean(selectedMerchantId && customerPhone.trim() && replyMessage.trim());
    const canRunScenarioSuite = Boolean(
        selectedMerchantId &&
        customerPhone.trim() &&
        selectedProductIds.length > 0 &&
        selectedScenarioIds.length > 0,
    );

    if (loading) {
        return (
            <SkeletonPage title="Merchant Test Kit">
                <Layout>
                    <Layout.Section>
                        <BlockStack gap="400">
                            <Card>
                                <Box padding="400">
                                    <BlockStack gap="200">
                                        <SkeletonDisplayText size="small" />
                                        <SkeletonBodyText lines={3} />
                                    </BlockStack>
                                </Box>
                            </Card>
                        </BlockStack>
                    </Layout.Section>
                </Layout>
            </SkeletonPage>
        );
    }

    return (
        <Page
            title="Merchant Test Kit"
            subtitle="Create real test orders, simulate customer replies, and run full Shopify scenario suites from Super Admin."
            fullWidth
        >
            <Layout>
                <Layout.Section>
                    <BlockStack gap="400">
                        <Banner tone="info">
                            <p>
                                This page includes an automated Shopify scenario runner. It creates a delivered test
                                order, reuses the real AI pipeline, and validates scenario assertions for each flow.
                            </p>
                        </Banner>

                        {error ? (
                            <Banner tone="critical" onDismiss={() => setError('')}>
                                <p>{error}</p>
                            </Banner>
                        ) : null}

                        <Card>
                            <Box padding="400">
                                <BlockStack gap="400">
                                    <InlineStack gap="300" blockAlign="center">
                                        <Store className="h-5 w-5 text-zinc-500" />
                                        <Text as="h2" variant="headingMd">1. Choose merchant</Text>
                                    </InlineStack>

                                    <InlineGrid columns={{ xs: '1fr', md: '2fr 1fr' }} gap="400">
                                        <Select
                                            label="Merchant"
                                            options={merchantOptions}
                                            value={selectedMerchantId}
                                            onChange={setSelectedMerchantId}
                                        />
                                        <Select
                                            label="Customer locale"
                                            options={[
                                                { label: 'Turkish (tr)', value: 'tr' },
                                                { label: 'English (en)', value: 'en' },
                                                { label: 'Hungarian (hu)', value: 'hu' },
                                                { label: 'German (de)', value: 'de' },
                                            ]}
                                            value={customerLocale}
                                            onChange={setCustomerLocale}
                                        />
                                    </InlineGrid>

                                    {merchantLoading ? (
                                        <SkeletonBodyText lines={3} />
                                    ) : merchantData ? (
                                        <InlineGrid columns={{ xs: '1fr', md: '1fr 1fr 1fr' }} gap="300">
                                            <Card>
                                                <Box padding="300">
                                                    <BlockStack gap="100">
                                                        <Text as="p" variant="bodySm" tone="subdued">Plan</Text>
                                                        <Text as="p" variant="headingSm">
                                                            {merchantData.merchant.subscription_plan || 'Unknown'}
                                                        </Text>
                                                        <Badge tone={merchantData.merchant.subscription_status === 'active' ? 'success' : 'warning'}>
                                                            {merchantData.merchant.subscription_status || 'unknown'}
                                                        </Badge>
                                                    </BlockStack>
                                                </Box>
                                            </Card>
                                            <Card>
                                                <Box padding="300">
                                                    <BlockStack gap="100">
                                                        <Text as="p" variant="bodySm" tone="subdued">WhatsApp</Text>
                                                        <InlineStack gap="200" wrap>
                                                            <Badge tone={merchantData.whatsapp.configured ? 'success' : 'attention'}>
                                                                {merchantData.whatsapp.configured ? 'Configured' : 'Missing config'}
                                                            </Badge>
                                                            {merchantData.whatsapp.provider ? (
                                                                <Badge>{merchantData.whatsapp.provider}</Badge>
                                                            ) : null}
                                                        </InlineStack>
                                                        <Text as="p" variant="bodySm">
                                                            {merchantData.whatsapp.from || 'No sender resolved yet'}
                                                        </Text>
                                                    </BlockStack>
                                                </Box>
                                            </Card>
                                            <Card>
                                                <Box padding="300">
                                                    <BlockStack gap="100">
                                                        <Text as="p" variant="bodySm" tone="subdued">Catalog</Text>
                                                        <Text as="p" variant="headingSm">
                                                            {merchantData.products.length} products available
                                                        </Text>
                                                        <InlineStack gap="200" wrap>
                                                            {merchantData.integrations.map((integration) => (
                                                                <Badge
                                                                    key={`${integration.provider}-${integration.status}`}
                                                                    tone={integration.status === 'active' ? 'success' : 'warning'}
                                                                >
                                                                    {integration.provider}
                                                                </Badge>
                                                            ))}
                                                        </InlineStack>
                                                    </BlockStack>
                                                </Box>
                                            </Card>
                                        </InlineGrid>
                                    ) : null}
                                </BlockStack>
                            </Box>
                        </Card>

                        <InlineGrid columns={{ xs: '1fr', md: '1fr 1fr' }} gap="400">
                            <Card>
                                <Box padding="400">
                                    <BlockStack gap="400">
                                        <InlineStack gap="300" blockAlign="center">
                                            <PackageCheck className="h-5 w-5 text-zinc-500" />
                                            <Text as="h2" variant="headingMd">2. Create delivered order</Text>
                                        </InlineStack>

                                        <TextField
                                            label="Customer phone"
                                            value={customerPhone}
                                            onChange={setCustomerPhone}
                                            autoComplete="tel"
                                            helpText="Use E.164 format for predictable test behavior."
                                        />
                                        <InlineGrid columns={{ xs: '1fr', md: '1fr 1fr' }} gap="300">
                                            <TextField
                                                label="Customer name"
                                                value={customerName}
                                                onChange={setCustomerName}
                                                autoComplete="name"
                                            />
                                            <TextField
                                                label="Customer email"
                                                value={customerEmail}
                                                onChange={setCustomerEmail}
                                                autoComplete="email"
                                            />
                                        </InlineGrid>
                                        <Checkbox
                                            label="Mark order as delivered immediately"
                                            checked={markDelivered}
                                            onChange={setMarkDelivered}
                                            helpText="Triggers delivered-event flow and follow-up scheduling right away."
                                        />
                                        <Button
                                            variant="primary"
                                            onClick={createTestOrder}
                                            loading={creatingOrder}
                                            disabled={!canCreateOrder}
                                        >
                                            Create test order
                                        </Button>

                                        {orderResult ? (
                                            <>
                                                <Divider />
                                                <Banner tone="success">
                                                    <p>
                                                        Test order <strong>{orderResult.order.externalOrderId}</strong> is now <strong>{orderResult.order.status}</strong>.
                                                    </p>
                                                </Banner>
                                                <BlockStack gap="100">
                                                    <Text as="p" variant="bodySm">
                                                        Order ID: {orderResult.order.id}
                                                    </Text>
                                                    <Text as="p" variant="bodySm">
                                                        Delivery date: {orderResult.order.deliveryDate || 'Not delivered'}
                                                    </Text>
                                                    <Text as="p" variant="bodySm">
                                                        Follow-up queue: {orderResult.queuedFollowUps ? 'Triggered' : 'Not triggered'}
                                                    </Text>
                                                </BlockStack>
                                            </>
                                        ) : null}
                                    </BlockStack>
                                </Box>
                            </Card>

                            <Card>
                                <Box padding="400">
                                    <BlockStack gap="400">
                                        <InlineStack gap="300" blockAlign="center">
                                            <FlaskConical className="h-5 w-5 text-zinc-500" />
                                            <Text as="h2" variant="headingMd">Selected products</Text>
                                        </InlineStack>
                                        <TextField
                                            label="Filter products"
                                            value={productQuery}
                                            onChange={setProductQuery}
                                            autoComplete="off"
                                            placeholder="Search by product name or external id"
                                        />
                                        <Scrollable shadow style={{ maxHeight: '380px' }}>
                                            <BlockStack gap="200">
                                                {filteredProducts.map((product) => (
                                                    <Card key={product.id}>
                                                        <Box padding="300">
                                                            <Checkbox
                                                                label={product.name}
                                                                checked={selectedProductIds.includes(product.id)}
                                                                onChange={(checked) => toggleProduct(product.id, checked)}
                                                                helpText={product.externalId || 'No external id'}
                                                            />
                                                        </Box>
                                                    </Card>
                                                ))}
                                                {!filteredProducts.length ? (
                                                    <Text as="p" tone="subdued">No products matched the current filter.</Text>
                                                ) : null}
                                            </BlockStack>
                                        </Scrollable>
                                    </BlockStack>
                                </Box>
                            </Card>
                        </InlineGrid>

                        <Card>
                            <Box padding="400">
                                <BlockStack gap="400">
                                    <InlineStack gap="300" blockAlign="center">
                                        <MessageSquareReply className="h-5 w-5 text-zinc-500" />
                                        <Text as="h2" variant="headingMd">3. Simulate customer reply</Text>
                                    </InlineStack>

                                    <Text as="p" tone="subdued">
                                        This runs one inbound message through the same AI pipeline used in production.
                                        Enable live send only for safe test numbers.
                                    </Text>

                                    <TextField
                                        label="Inbound customer message"
                                        value={replyMessage}
                                        onChange={setReplyMessage}
                                        multiline={4}
                                        autoComplete="off"
                                    />
                                    <Checkbox
                                        label="Send AI reply to customer as a live WhatsApp message"
                                        checked={sendReplyLive}
                                        onChange={setSendReplyLive}
                                        helpText="Keep disabled for dry-run validation."
                                    />
                                    <Button
                                        variant="primary"
                                        onClick={simulateReply}
                                        loading={simulatingReply}
                                        disabled={!canSimulateReply}
                                    >
                                        Simulate reply
                                    </Button>

                                    {replyResult ? (
                                        <>
                                            <Divider />
                                            <InlineGrid columns={{ xs: '1fr', md: '1fr 1fr' }} gap="300">
                                                <Card>
                                                    <Box padding="300">
                                                        <BlockStack gap="200">
                                                            <Text as="h3" variant="headingSm">Inbound</Text>
                                                            <Text as="p">{replyResult.inboundMessage}</Text>
                                                            <InlineStack gap="200" wrap>
                                                                {replyResult.intent ? <Badge>{replyResult.intent}</Badge> : null}
                                                                {replyResult.guardrailBlocked ? <Badge tone="critical">Guardrail blocked</Badge> : null}
                                                                {replyResult.upsellTriggered ? <Badge tone="success">Upsell triggered</Badge> : null}
                                                            </InlineStack>
                                                        </BlockStack>
                                                    </Box>
                                                </Card>
                                                <Card>
                                                    <Box padding="300">
                                                        <BlockStack gap="200">
                                                            <Text as="h3" variant="headingSm">AI reply</Text>
                                                            <Text as="p">{replyResult.aiReply}</Text>
                                                            {replyResult.liveSend ? (
                                                                <Badge tone={replyResult.liveSend.success ? 'success' : 'attention'}>
                                                                    {replyResult.liveSend.success ? 'Live reply sent' : replyResult.liveSend.error || 'Live send failed'}
                                                                </Badge>
                                                            ) : null}
                                                        </BlockStack>
                                                    </Box>
                                                </Card>
                                            </InlineGrid>
                                        </>
                                    ) : null}
                                </BlockStack>
                            </Box>
                        </Card>

                        <Card>
                            <Box padding="400">
                                <BlockStack gap="400">
                                    <InlineStack align="space-between" blockAlign="center">
                                        <InlineStack gap="300" blockAlign="center">
                                            <ListChecks className="h-5 w-5 text-zinc-500" />
                                            <Text as="h2" variant="headingMd">4. Run Shopify scenario suite</Text>
                                        </InlineStack>
                                        <InlineStack gap="200">
                                            <Button
                                                onClick={() => {
                                                    if (allScenariosSelected) {
                                                        setSelectedScenarioIds([]);
                                                    } else {
                                                        setSelectedScenarioIds(scenarioCatalog.map((scenario) => scenario.id));
                                                    }
                                                }}
                                                disabled={scenariosLoading || scenarioCatalog.length === 0}
                                            >
                                                {allScenariosSelected ? 'Clear all' : 'Select all'}
                                            </Button>
                                            <Button
                                                variant="primary"
                                                loading={runningScenarios}
                                                onClick={runShopifyScenarioSuite}
                                                disabled={!canRunScenarioSuite}
                                            >
                                                {`Run selected (${selectedScenarioIds.length})`}
                                            </Button>
                                        </InlineStack>
                                    </InlineStack>

                                    <Text as="p" tone="subdued">
                                        Covers Shopify order lifecycle, conversation intent handling, numeric product
                                        selection, routine requests, return and opt-out flows, and multilingual guidance.
                                    </Text>

                                    {scenariosLoading ? <SkeletonBodyText lines={4} /> : null}

                                    {!scenariosLoading && scenarioCatalog.length > 0 ? (
                                        <Scrollable shadow style={{ maxHeight: '360px' }}>
                                            <BlockStack gap="200">
                                                {scenarioCatalog.map((scenario) => (
                                                    <Card key={scenario.id}>
                                                        <Box padding="300">
                                                            <BlockStack gap="200">
                                                                <Checkbox
                                                                    label={scenario.title}
                                                                    checked={selectedScenarioIds.includes(scenario.id)}
                                                                    onChange={(checked) => toggleScenario(scenario.id, checked)}
                                                                    helpText={scenario.description}
                                                                />
                                                                <InlineStack gap="200" wrap>
                                                                    <Badge>{scenario.feature}</Badge>
                                                                    <Badge tone="info">{scenario.id}</Badge>
                                                                </InlineStack>
                                                            </BlockStack>
                                                        </Box>
                                                    </Card>
                                                ))}
                                            </BlockStack>
                                        </Scrollable>
                                    ) : null}

                                    {scenarioRunResult ? (
                                        <>
                                            <Divider />
                                            <Banner tone={scenarioRunResult.summary.failed === 0 ? 'success' : 'warning'}>
                                                <p>
                                                    Suite completed for <strong>{scenarioRunResult.merchant.name}</strong>:
                                                    {' '}{scenarioRunResult.summary.passed}/{scenarioRunResult.summary.total} passed,
                                                    {' '}{scenarioRunResult.summary.failed} failed.
                                                </p>
                                            </Banner>

                                            <InlineGrid columns={{ xs: '1fr', md: '1fr 1fr 1fr' }} gap="300">
                                                <Card>
                                                    <Box padding="300">
                                                        <BlockStack gap="100">
                                                            <Text as="p" variant="bodySm" tone="subdued">Test order</Text>
                                                            <Text as="p" variant="headingSm">{scenarioRunResult.order.externalOrderId}</Text>
                                                            <Text as="p" variant="bodySm">{scenarioRunResult.order.status}</Text>
                                                        </BlockStack>
                                                    </Box>
                                                </Card>
                                                <Card>
                                                    <Box padding="300">
                                                        <BlockStack gap="100">
                                                            <Text as="p" variant="bodySm" tone="subdued">Customer</Text>
                                                            <Text as="p" variant="headingSm">{scenarioRunResult.user.phone}</Text>
                                                            <Text as="p" variant="bodySm">
                                                                {scenarioRunResult.user.name || 'Unnamed test user'}
                                                            </Text>
                                                        </BlockStack>
                                                    </Box>
                                                </Card>
                                                <Card>
                                                    <Box padding="300">
                                                        <BlockStack gap="100">
                                                            <Text as="p" variant="bodySm" tone="subdued">Products</Text>
                                                            <Text as="p" variant="headingSm">{scenarioRunResult.products.length} selected</Text>
                                                        </BlockStack>
                                                    </Box>
                                                </Card>
                                            </InlineGrid>

                                            <BlockStack gap="300">
                                                {scenarioRunResult.results.map((result) => (
                                                    <Card key={result.id}>
                                                        <Box padding="300">
                                                            <BlockStack gap="200">
                                                                <InlineStack align="space-between" blockAlign="center" wrap>
                                                                    <InlineStack gap="200" blockAlign="center" wrap>
                                                                        <Text as="h3" variant="headingSm">{result.title}</Text>
                                                                        <Badge tone={result.passed ? 'success' : 'critical'}>
                                                                            {result.passed ? 'Passed' : 'Failed'}
                                                                        </Badge>
                                                                        <Badge>{result.intent}</Badge>
                                                                        {result.guardrailBlocked ? <Badge tone="critical">Guardrail</Badge> : null}
                                                                        {result.upsellTriggered ? <Badge tone="success">Upsell</Badge> : null}
                                                                    </InlineStack>
                                                                    <Badge tone="info">{result.feature}</Badge>
                                                                </InlineStack>
                                                                <Text as="p" variant="bodySm" tone="subdued">Inbound: {result.inboundMessage}</Text>
                                                                <Text as="p">{result.aiReply}</Text>
                                                                <BlockStack gap="100">
                                                                    {result.assertions.map((assertion) => (
                                                                        <InlineStack key={`${result.id}-${assertion.id}`} gap="200" blockAlign="start">
                                                                            <Badge tone={assertion.passed ? 'success' : 'critical'}>
                                                                                {assertion.passed ? 'PASS' : 'FAIL'}
                                                                            </Badge>
                                                                            <Text as="p" variant="bodySm">{assertion.message}</Text>
                                                                        </InlineStack>
                                                                    ))}
                                                                </BlockStack>
                                                            </BlockStack>
                                                        </Box>
                                                    </Card>
                                                ))}
                                            </BlockStack>
                                        </>
                                    ) : null}
                                </BlockStack>
                            </Box>
                        </Card>
                    </BlockStack>
                </Layout.Section>
            </Layout>
        </Page>
    );
}
