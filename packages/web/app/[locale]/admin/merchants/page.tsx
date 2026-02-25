'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { Badge, BlockStack, Box, Button, Card, IndexTable, InlineStack, Layout, Modal, Page, Select, SkeletonBodyText, SkeletonDisplayText, SkeletonPage, Text } from '@shopify/polaris';
import { Store, Calendar, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/lib/toast';

interface Merchant {
    id: string;
    name: string;
    created_at: string;
    is_super_admin: boolean;
    settings?: { capped_amount?: number;[key: string]: any };
    integrations: Array<{ provider: string; status: string }>;
    ai_usage_mtd?: {
        total_tokens: number;
        estimated_cost_usd: number;
        top_model: string | null;
        by_model: Array<{ model: string; total_tokens: number; estimated_cost_usd: number }>;
        by_feature?: Array<{ feature: string; total_tokens: number; estimated_cost_usd: number }>;
    };
}

interface MerchantAiUsageDetailResponse {
    merchant: { id: string; name: string };
    ai_window: 'mtd' | '30d' | '7d';
    summary: {
        total_tokens: number;
        estimated_cost_usd: number;
        by_model: Array<{ model: string; total_tokens: number; estimated_cost_usd: number; count: number }>;
        by_feature: Array<{ feature: string; total_tokens: number; estimated_cost_usd: number; count: number }>;
    };
    recent_events: Array<{
        id: string;
        model: string;
        feature: string;
        request_kind: string;
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
        estimated_cost_usd: number;
        created_at: string;
    }>;
}

export default function AdminMerchantsPage() {
    const [merchants, setMerchants] = useState<Merchant[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [impersonatingMap, setImpersonatingMap] = useState<Record<string, boolean>>({});
    const [aiWindow, setAiWindow] = useState<'mtd' | '30d' | '7d'>('mtd');
    const [aiUsageModalMerchant, setAiUsageModalMerchant] = useState<Merchant | null>(null);
    const [aiUsageDetail, setAiUsageDetail] = useState<MerchantAiUsageDetailResponse | null>(null);
    const [aiUsageDetailLoading, setAiUsageDetailLoading] = useState(false);

    const fetchMerchants = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const data = await authenticatedRequest<{ merchants: Merchant[]; ai_window?: string }>(`/api/admin/merchants?ai_window=${aiWindow}`, session.access_token);
            setMerchants(data.merchants || []);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch merchants');
        } finally {
            setLoading(false);
        }
    };

    const handleSetLimit = async (merchantId: string, currentLimit: number) => {
        const amountStr = prompt(`Enter new Capped Amount for merchant (Current: $${currentLimit})`, currentLimit.toString());
        if (!amountStr) return;
        const amount = Number(amountStr);
        if (isNaN(amount) || amount <= 0) {
            toast.error('Invalid amount. Must be a positive number.');
            return;
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            await authenticatedRequest('/api/admin/set-capped-amount', session.access_token, {
                method: 'POST',
                body: JSON.stringify({ merchantId, cappedAmount: amount })
            });
            toast.success(`Capped amount requested to $${amount}`);
            await fetchMerchants();
        } catch (err: any) {
            toast.error(err.message || 'Failed to update limit');
        }
    };

    const handleImpersonate = async (merchantId: string) => {
        setImpersonatingMap(prev => ({ ...prev, [merchantId]: true }));
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const res = await authenticatedRequest<{ impersonationUrl: string }>('/api/admin/impersonate', session.access_token, {
                method: 'POST',
                body: JSON.stringify({ targetUserId: merchantId })
            });

            if (res.impersonationUrl) {
                // Redirect the current tab to the magic link to avoid Popup Blockers
                // This swaps the session in localStorage and logs the admin into the merchant dashboard
                window.location.href = res.impersonationUrl;
            }
        } catch (err: any) {
            toast.error('Impersonation failed', err.message);
        } finally {
            setImpersonatingMap(prev => ({ ...prev, [merchantId]: false }));
        }
    };

    const openAiUsageDetail = async (merchant: Merchant) => {
        setAiUsageModalMerchant(merchant);
        setAiUsageDetail(null);
        setAiUsageDetailLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const data = await authenticatedRequest<MerchantAiUsageDetailResponse>(
                `/api/admin/merchants/${merchant.id}/ai-usage?ai_window=${aiWindow}`,
                session.access_token
            );
            setAiUsageDetail(data);
        } catch (err: any) {
            toast.error('Failed to load AI usage detail', err.message || 'Unknown error');
        } finally {
            setAiUsageDetailLoading(false);
        }
    };

    useEffect(() => {
        fetchMerchants();
    }, [aiWindow]);

    if (loading) {
        return (
            <SkeletonPage title="Merchants">
                <Layout>
                    <Layout.Section>
                        <BlockStack gap="500">
                            <Card><Box padding="400"><BlockStack gap="200"><SkeletonDisplayText size="small" /><SkeletonBodyText lines={2} /></BlockStack></Box></Card>
                            <Card><Box padding="400"><div className="h-96 animate-pulse rounded bg-zinc-100" /></Box></Card>
                        </BlockStack>
                    </Layout.Section>
                </Layout>
            </SkeletonPage>
        );
    }

    if (error) {
        return (
            <Page title="Merchants">
                <Layout>
                    <Layout.Section>
                        <Card>
                            <Box padding="400">
                                <InlineStack gap="200" blockAlign="start">
                                    <ShieldAlert className="w-5 h-5 text-red-600 mt-0.5" />
                                    <BlockStack gap="100">
                                        <Text as="h3" variant="headingMd" tone="critical">An error occurred</Text>
                                        <Text as="p" tone="critical">{error}</Text>
                                    </BlockStack>
                                </InlineStack>
                            </Box>
                        </Card>
                    </Layout.Section>
                </Layout>
            </Page>
        );
    }

    return (
        <Page title="Merchants" subtitle={`Viewing all ${merchants.length} registered merchants on the platform.`} fullWidth>
            <Layout>
                <Layout.Section>
                    <Box paddingBlockEnd="300">
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-end">
                            <Box>
                                <BlockStack gap="100">
                                    <Text as="p" tone="subdued">
                                        AI usage values below are estimated OpenAI costs aggregated per merchant and model.
                                    </Text>
                                    <Text as="p" variant="bodySm" tone="subdued">
                                        Open AI Details for per-model and per-feature breakdowns without crowding the table.
                                    </Text>
                                </BlockStack>
                            </Box>
                            <Box>
                                <Select
                                    label="AI usage window"
                                    labelHidden
                                    value={aiWindow}
                                    onChange={(v) => setAiWindow((v as 'mtd' | '30d' | '7d') || 'mtd')}
                                    options={[
                                        { label: 'MTD', value: 'mtd' },
                                        { label: 'Last 30 days', value: '30d' },
                                        { label: 'Last 7 days', value: '7d' },
                                    ]}
                                />
                            </Box>
                        </div>
                    </Box>
                    <div className="md:hidden">
                        <BlockStack gap="300">
                            {merchants.map((merchant) => {
                                const shopifyInt = merchant.integrations?.find(i => i.provider === 'shopify');
                                const whatsappInt = merchant.integrations?.find(i => i.provider === 'whatsapp');
                                return (
                                    <Card key={merchant.id}>
                                        <Box padding="400">
                                            <BlockStack gap="300">
                                                <InlineStack align="space-between" blockAlign="start" wrap>
                                                    <InlineStack gap="300" blockAlign="center" wrap={false}>
                                                        <Box background="bg-surface-secondary" borderRadius="300" padding="200">
                                                            <Store className="w-5 h-5 text-zinc-500" />
                                                        </Box>
                                                        <BlockStack gap="100">
                                                            <InlineStack gap="200" blockAlign="center" wrap>
                                                                <Text as="span" variant="bodyMd" fontWeight="semibold">
                                                                    {merchant.name || 'Unnamed Store'}
                                                                </Text>
                                                                {merchant.is_super_admin && <Badge tone="critical">ADMIN</Badge>}
                                                            </InlineStack>
                                                            <Text as="span" variant="bodySm" tone="subdued">
                                                                {merchant.id.split('-')[0]}...
                                                            </Text>
                                                        </BlockStack>
                                                    </InlineStack>
                                                    {shopifyInt?.status === 'active' ? (
                                                        <Badge tone="success">Active Store</Badge>
                                                    ) : (
                                                        <Badge tone="enabled">Pending Setup</Badge>
                                                    )}
                                                </InlineStack>

                                                <InlineStack gap="200" wrap>
                                                    {shopifyInt && <Badge tone={shopifyInt.status === 'active' ? 'success' : 'enabled'}>Shopify</Badge>}
                                                    {whatsappInt && <Badge tone={whatsappInt.status === 'active' ? 'success' : 'enabled'}>WhatsApp</Badge>}
                                                    {!shopifyInt && !whatsappInt && <Text as="span" variant="bodySm" tone="subdued">No integrations</Text>}
                                                </InlineStack>

                                                <InlineStack align="space-between" wrap gap="200">
                                                    <Text as="span" variant="bodySm" tone="subdued">
                                                        {merchant.created_at ? format(new Date(merchant.created_at), 'MMM d, yyyy') : 'Unknown'}
                                                    </Text>
                                                    <Text as="span" variant="bodyMd" fontWeight="medium">
                                                        ${merchant.settings?.capped_amount || 100}
                                                    </Text>
                                                </InlineStack>

                                                <Box background="bg-surface-secondary" borderRadius="200" padding="300">
                                                    <BlockStack gap="150">
                                                        <InlineStack align="space-between" gap="200" wrap>
                                                            <Text as="span" variant="bodySm" tone="subdued">AI ({aiWindow.toUpperCase()})</Text>
                                                            <Button variant="plain" size="micro" onClick={() => openAiUsageDetail(merchant)}>
                                                                Details
                                                            </Button>
                                                        </InlineStack>
                                                        <InlineStack gap="200" wrap>
                                                            <Text as="span" variant="bodyMd" fontWeight="medium">
                                                                {(merchant.ai_usage_mtd?.total_tokens || 0).toLocaleString()} tok
                                                            </Text>
                                                            <Text as="span" variant="bodySm" tone="subdued">
                                                                ${(merchant.ai_usage_mtd?.estimated_cost_usd || 0).toFixed(4)}
                                                            </Text>
                                                        </InlineStack>
                                                        {merchant.ai_usage_mtd?.top_model && (
                                                            <Text as="p" variant="bodySm" tone="subdued" truncate>
                                                                Top model: {merchant.ai_usage_mtd.top_model}
                                                            </Text>
                                                        )}
                                                    </BlockStack>
                                                </Box>

                                                <InlineStack gap="200" wrap>
                                                    <Button
                                                        variant="secondary"
                                                        size="slim"
                                                        disabled={impersonatingMap[merchant.id]}
                                                        onClick={() => handleSetLimit(merchant.id, merchant.settings?.capped_amount || 100)}
                                                    >
                                                        Set Limit
                                                    </Button>
                                                    <Button
                                                        variant="secondary"
                                                        size="slim"
                                                        disabled={impersonatingMap[merchant.id]}
                                                        loading={!!impersonatingMap[merchant.id]}
                                                        onClick={() => handleImpersonate(merchant.id)}
                                                    >
                                                        Login As
                                                    </Button>
                                                </InlineStack>
                                            </BlockStack>
                                        </Box>
                                    </Card>
                                );
                            })}
                            {merchants.length === 0 && (
                                <Card>
                                    <Box padding="500">
                                        <Text as="p" tone="subdued" alignment="center">No merchants found in the system.</Text>
                                    </Box>
                                </Card>
                            )}
                        </BlockStack>
                    </div>

                    <div className="hidden md:block">
                    <Card padding="0">
                        <div className="overflow-x-auto">
                        <IndexTable
                            resourceName={{ singular: 'merchant', plural: 'merchants' }}
                            itemCount={merchants.length}
                            selectable={false}
                            headings={[
                                { title: 'Merchant' },
                                { title: 'Status' },
                                { title: 'Integrations' },
                                { title: 'Registered', alignment: 'end' },
                                { title: `AI (${aiWindow.toUpperCase()})`, alignment: 'end' },
                                { title: 'Limit', alignment: 'end' },
                                { title: 'Actions', alignment: 'center' },
                            ]}
                        >
                            {merchants.map((merchant, index) => {
                                const shopifyInt = merchant.integrations?.find(i => i.provider === 'shopify');
                                const whatsappInt = merchant.integrations?.find(i => i.provider === 'whatsapp');

                                return (
                                    <IndexTable.Row id={merchant.id} key={merchant.id} position={index}>
                                        <IndexTable.Cell>
                                            <InlineStack gap="300" blockAlign="center" wrap={false}>
                                                <Box background="bg-surface-secondary" borderRadius="300" padding="200">
                                                    <Store className="w-5 h-5 text-zinc-500" />
                                                </Box>
                                                <BlockStack gap="100">
                                                    <InlineStack gap="200" blockAlign="center" wrap>
                                                        <Text as="span" variant="bodyMd" fontWeight="semibold">
                                                        {merchant.name || 'Unnamed Store'}
                                                        </Text>
                                                        {merchant.is_super_admin && (
                                                            <Badge tone="critical">
                                                                ADMIN
                                                            </Badge>
                                                        )}
                                                    </InlineStack>
                                                    <Text as="span" variant="bodySm" tone="subdued">
                                                        {merchant.id.split('-')[0]}...
                                                    </Text>
                                                </BlockStack>
                                            </InlineStack>
                                        </IndexTable.Cell>
                                        <IndexTable.Cell>
                                            {shopifyInt?.status === 'active' ? (
                                                <Badge tone="success">
                                                    Active Store
                                                </Badge>
                                            ) : (
                                                <Badge tone="enabled">
                                                    Pending Setup
                                                </Badge>
                                            )}
                                        </IndexTable.Cell>
                                        <IndexTable.Cell>
                                            <InlineStack gap="200" wrap>
                                                {shopifyInt ? (
                                                    <Badge tone={shopifyInt.status === 'active' ? 'success' : 'enabled'}>
                                                        Shopify
                                                    </Badge>
                                                ) : null}
                                                {whatsappInt ? (
                                                    <Badge tone={whatsappInt.status === 'active' ? 'success' : 'enabled'}>
                                                        WhatsApp
                                                    </Badge>
                                                ) : null}
                                                {(!shopifyInt && !whatsappInt) && (
                                                    <Text as="span" variant="bodySm" tone="subdued">No integrations</Text>
                                                )}
                                            </InlineStack>
                                        </IndexTable.Cell>
                                        <IndexTable.Cell>
                                            <InlineStack align="end" gap="100" blockAlign="center">
                                                <Calendar className="w-4 h-4 mr-2" />
                                                <Text as="span" variant="bodySm" tone="subdued">
                                                    {merchant.created_at ? format(new Date(merchant.created_at), 'MMM d, yyyy') : 'Unknown'}
                                                </Text>
                                            </InlineStack>
                                        </IndexTable.Cell>
                                        <IndexTable.Cell>
                                            <BlockStack gap="100">
                                                <InlineStack align="end" gap="100" blockAlign="center" wrap>
                                                    <Text as="span" variant="bodyMd" fontWeight="medium">
                                                        {(merchant.ai_usage_mtd?.total_tokens || 0).toLocaleString()} tok
                                                    </Text>
                                                </InlineStack>
                                                <InlineStack align="end" gap="100" blockAlign="center" wrap>
                                                    <Text as="span" variant="bodySm" tone="subdued">
                                                        ${(merchant.ai_usage_mtd?.estimated_cost_usd || 0).toFixed(4)}
                                                    </Text>
                                                    {merchant.ai_usage_mtd?.top_model && (
                                                        <Box maxWidth="140px">
                                                            <Text as="span" variant="bodySm" tone="subdued" truncate>
                                                                {merchant.ai_usage_mtd.top_model}
                                                            </Text>
                                                        </Box>
                                                    )}
                                                </InlineStack>
                                                <InlineStack align="end">
                                                    <Button
                                                        variant="plain"
                                                        size="micro"
                                                        onClick={() => openAiUsageDetail(merchant)}
                                                    >
                                                        Details
                                                    </Button>
                                                </InlineStack>
                                            </BlockStack>
                                        </IndexTable.Cell>
                                        <IndexTable.Cell>
                                            <InlineStack align="end">
                                                <Text as="span" variant="bodyMd" fontWeight="medium">
                                                    ${merchant.settings?.capped_amount || 100}
                                                </Text>
                                            </InlineStack>
                                        </IndexTable.Cell>
                                        <IndexTable.Cell>
                                            <InlineStack align="center" gap="200" wrap={false}>
                                                <Button
                                                    variant="secondary"
                                                    size="slim"
                                                    disabled={impersonatingMap[merchant.id]}
                                                    onClick={() => handleSetLimit(merchant.id, merchant.settings?.capped_amount || 100)}
                                                >
                                                    Set Limit
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    size="slim"
                                                    disabled={impersonatingMap[merchant.id]}
                                                    loading={!!impersonatingMap[merchant.id]}
                                                    onClick={() => handleImpersonate(merchant.id)}
                                                >
                                                    Login As
                                                </Button>
                                            </InlineStack>
                                        </IndexTable.Cell>
                                    </IndexTable.Row>
                                );
                            })}
                        </IndexTable>
                        </div>
                        {merchants.length === 0 && (
                            <Box padding="800">
                                <Text as="p" tone="subdued" alignment="center">No merchants found in the system.</Text>
                            </Box>
                        )}
                    </Card>
                    </div>
                    <Box paddingBlockStart="300">
                        <Text as="p" variant="bodySm" tone="subdued">
                            Admin actions here are operational tools. Use “Login As” to validate merchant-facing behavior in the real dashboard context.
                        </Text>
                    </Box>
                </Layout.Section>
            </Layout>

            <Modal
                open={Boolean(aiUsageModalMerchant)}
                onClose={() => { setAiUsageModalMerchant(null); setAiUsageDetail(null); }}
                title={`AI Usage Details${aiUsageModalMerchant ? ` · ${aiUsageModalMerchant.name}` : ''}`}
                primaryAction={undefined}
                secondaryActions={[
                    {
                        content: 'Close',
                        onAction: () => { setAiUsageModalMerchant(null); setAiUsageDetail(null); },
                    },
                ]}
            >
                <Modal.Section>
                    {aiUsageDetailLoading ? (
                        <BlockStack gap="300">
                            <Text as="p" tone="subdued">Loading AI usage details...</Text>
                        </BlockStack>
                    ) : aiUsageDetail ? (
                        <BlockStack gap="400">
                            <InlineStack gap="200" wrap>
                                <Badge tone="info">{aiUsageDetail.ai_window.toUpperCase()}</Badge>
                                <Badge>{`${aiUsageDetail.summary.total_tokens.toLocaleString()} tokens`}</Badge>
                                <Badge tone="success">{`$${aiUsageDetail.summary.estimated_cost_usd.toFixed(4)}`}</Badge>
                            </InlineStack>

                            <Card>
                                <Box padding="300">
                                    <BlockStack gap="200">
                                        <Text as="h3" variant="headingSm">By Model</Text>
                                        {aiUsageDetail.summary.by_model.length === 0 ? (
                                            <Text as="p" tone="subdued">No AI usage events yet.</Text>
                                        ) : aiUsageDetail.summary.by_model.map((m) => (
                                            <InlineStack key={m.model} align="space-between" gap="300" wrap>
                                                <Text as="span">{m.model}</Text>
                                                <InlineStack gap="200" wrap>
                                                    <Text as="span" tone="subdued">{m.total_tokens.toLocaleString()} tok</Text>
                                                    <Text as="span" tone="subdued">${m.estimated_cost_usd.toFixed(4)}</Text>
                                                    <Badge>{`${m.count} events`}</Badge>
                                                </InlineStack>
                                            </InlineStack>
                                        ))}
                                    </BlockStack>
                                </Box>
                            </Card>

                            <Card>
                                <Box padding="300">
                                    <BlockStack gap="200">
                                        <Text as="h3" variant="headingSm">By Feature</Text>
                                        {aiUsageDetail.summary.by_feature.length === 0 ? (
                                            <Text as="p" tone="subdued">No feature-level usage yet.</Text>
                                        ) : aiUsageDetail.summary.by_feature.map((f) => (
                                            <InlineStack key={f.feature} align="space-between" gap="300" wrap>
                                                <Text as="span">{f.feature}</Text>
                                                <InlineStack gap="200" wrap>
                                                    <Text as="span" tone="subdued">{f.total_tokens.toLocaleString()} tok</Text>
                                                    <Text as="span" tone="subdued">${f.estimated_cost_usd.toFixed(4)}</Text>
                                                    <Badge>{`${f.count} events`}</Badge>
                                                </InlineStack>
                                            </InlineStack>
                                        ))}
                                    </BlockStack>
                                </Box>
                            </Card>

                            <Card>
                                <Box padding="300">
                                    <BlockStack gap="200">
                                        <Text as="h3" variant="headingSm">Recent Events</Text>
                                        {aiUsageDetail.recent_events.length === 0 ? (
                                            <Text as="p" tone="subdued">No recent events.</Text>
                                        ) : aiUsageDetail.recent_events.map((e) => (
                                            <Box key={e.id} paddingBlock="150" borderBlockEndWidth="025" borderColor="border">
                                                <div className="grid gap-1 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                                                    <BlockStack gap="050">
                                                        <Text as="p" variant="bodyMd">{e.feature}</Text>
                                                        <Text as="p" variant="bodySm" tone="subdued">
                                                            {e.model} · {e.request_kind} · {format(new Date(e.created_at), 'MMM d, HH:mm')}
                                                        </Text>
                                                    </BlockStack>
                                                    <InlineStack gap="200" wrap>
                                                        <Text as="span" variant="bodySm" tone="subdued">{e.total_tokens.toLocaleString()} tok</Text>
                                                        <Text as="span" variant="bodySm" tone="subdued">${Number(e.estimated_cost_usd || 0).toFixed(4)}</Text>
                                                    </InlineStack>
                                                </div>
                                            </Box>
                                        ))}
                                    </BlockStack>
                                </Box>
                            </Card>
                        </BlockStack>
                    ) : (
                        <Text as="p" tone="subdued">Select a merchant to view AI usage details.</Text>
                    )}
                </Modal.Section>
            </Modal>
        </Page>
    );
}
