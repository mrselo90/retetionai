'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { Badge, BlockStack, Box, Button, Card, IndexTable, InlineStack, Layout, Page, SkeletonBodyText, SkeletonDisplayText, SkeletonPage, Text } from '@shopify/polaris';
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
}

export default function AdminMerchantsPage() {
    const [merchants, setMerchants] = useState<Merchant[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [impersonatingMap, setImpersonatingMap] = useState<Record<string, boolean>>({});

    const fetchMerchants = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const data = await authenticatedRequest<{ merchants: Merchant[] }>('/api/admin/merchants', session.access_token);
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

    useEffect(() => {
        fetchMerchants();
    }, []);

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
                    <Card padding="0">
                        <IndexTable
                            resourceName={{ singular: 'merchant', plural: 'merchants' }}
                            itemCount={merchants.length}
                            selectable={false}
                            headings={[
                                { title: 'Merchant' },
                                { title: 'Status' },
                                { title: 'Integrations' },
                                { title: 'Registered', alignment: 'end' },
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
                                            <InlineStack align="end">
                                                <Text as="span" variant="bodyMd" fontWeight="medium">
                                                    ${merchant.settings?.capped_amount || 100}
                                                </Text>
                                            </InlineStack>
                                        </IndexTable.Cell>
                                        <IndexTable.Cell>
                                            <InlineStack align="center" gap="200" wrap>
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
                        {merchants.length === 0 && (
                            <Box padding="800">
                                <Text as="p" tone="subdued" alignment="center">No merchants found in the system.</Text>
                            </Box>
                        )}
                    </Card>
                    <Box paddingBlockStart="300">
                        <Text as="p" variant="bodySm" tone="subdued">
                            Admin actions here are operational tools. Use “Login As” to validate merchant-facing behavior in the real dashboard context.
                        </Text>
                    </Box>
                </Layout.Section>
            </Layout>
        </Page>
    );
}
