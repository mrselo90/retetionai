'use client';

import { useEffect, useState } from 'react';
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
import { FlaskConical, MessageSquareReply, PackageCheck, Store } from 'lucide-react';

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
    const [replyMessage, setReplyMessage] = useState('Ürünü nasıl kullanmalıyım?');
    const [sendReplyLive, setSendReplyLive] = useState(false);
    const [simulatingReply, setSimulatingReply] = useState(false);
    const [replyResult, setReplyResult] = useState<ReplyResult | null>(null);

    const fetchMerchants = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const response = await authenticatedRequest<{ merchants: MerchantOption[] }>(
                '/api/admin/merchants',
                session.access_token
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

    const fetchMerchantData = async (merchantId: string) => {
        if (!merchantId) {
            setMerchantData(null);
            setSelectedProductIds([]);
            return;
        }

        setMerchantLoading(true);
        setOrderResult(null);
        setReplyResult(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const response = await authenticatedRequest<MerchantTestKitData>(
                `/api/admin/merchants/${merchantId}/test-kit`,
                session.access_token
            );
            setMerchantData(response);
            setSelectedProductIds(response.products.slice(0, 1).map((product) => product.id));
        } catch (err: any) {
            setError(err.message || 'Failed to load merchant test data');
        } finally {
            setMerchantLoading(false);
        }
    };

    useEffect(() => {
        void fetchMerchants();
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
                }
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
                }
            );
            setReplyResult(response);
        } catch (err: any) {
            setError(err.message || 'Failed to simulate customer reply');
        } finally {
            setSimulatingReply(false);
        }
    };

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

    const filteredProducts = merchantData?.products.filter((product) => {
        const query = productQuery.trim().toLowerCase();
        if (!query) return true;
        return (
            product.name.toLowerCase().includes(query) ||
            (product.externalId || '').toLowerCase().includes(query)
        );
    }) || [];

    const merchantOptions = [
        { label: 'Select merchant', value: '' },
        ...merchants.map((merchant) => ({
            label: merchant.name || merchant.id,
            value: merchant.id,
        })),
    ];

    const canCreateOrder = Boolean(selectedMerchantId && customerPhone.trim() && selectedProductIds.length > 0);
    const canSimulateReply = Boolean(selectedMerchantId && customerPhone.trim() && replyMessage.trim());

    return (
        <Page
            title="Merchant Test Kit"
            subtitle="Create a realistic test order, move it into delivered state, and verify the AI WhatsApp follow-up path for any merchant."
            fullWidth
        >
            <Layout>
                <Layout.Section>
                    <BlockStack gap="400">
                        <Banner tone="info">
                            <p>
                                Use this screen to prepare the merchant state for WhatsApp testing without impersonation. The order action uses the real order processor. The reply action simulates the inbound message path and can optionally send the AI answer through the merchant’s live WhatsApp provider.
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
                                            helpText="Use a real WhatsApp number in E.164 format if you want live follow-up messages to arrive."
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
                                            helpText="When enabled, the real delivered-event flow runs right away and post-delivery message scheduling is triggered."
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
                                        This lets super admin test the AI answer path without waiting for a real provider webhook. If you enable live send, the generated AI answer is also pushed to the customer through the merchant’s active WhatsApp sender.
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
                                        helpText="Leave this off for a dry run. Turn it on only when the merchant has a safe test number configured."
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
                    </BlockStack>
                </Layout.Section>
            </Layout>
        </Page>
    );
}
