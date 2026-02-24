'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { BlockStack, Box, Card, InlineGrid, InlineStack, Layout, Page, SkeletonBodyText, SkeletonDisplayText, SkeletonPage, Text } from '@shopify/polaris';
import { Users, ShoppingBag, MessageSquare, BarChart3, TrendingUp } from 'lucide-react';

interface GlobalStats {
    totalMerchants: number;
    totalUsers: number;
    totalOrders: number;
    totalConversations: number;
}

export default function AdminDashboardPage() {
    const [stats, setStats] = useState<GlobalStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;

                const data = await authenticatedRequest<{ stats: GlobalStats }>('/api/admin/stats', session.access_token);
                setStats(data.stats);
            } catch (err) {
                console.error('Failed to fetch admin stats:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (loading || !stats) {
        return (
            <SkeletonPage title="Platform Overview">
                <Layout>
                    <Layout.Section>
                        <BlockStack gap="500">
                            <Card>
                                <Box padding="400">
                                    <BlockStack gap="300">
                                        <SkeletonDisplayText size="small" />
                                        <SkeletonBodyText lines={2} />
                                    </BlockStack>
                                </Box>
                            </Card>
                            <InlineGrid columns={{ xs: '1fr', md: '1fr 1fr', lg: 'repeat(4, minmax(0, 1fr))' }} gap="400">
                                {[1, 2, 3, 4].map((i) => (
                                    <Card key={i}>
                                        <Box padding="400"><div className="h-24 animate-pulse rounded bg-zinc-100" /></Box>
                                    </Card>
                                ))}
                            </InlineGrid>
                        </BlockStack>
                    </Layout.Section>
                </Layout>
            </SkeletonPage>
        );
    }

    const statCards = [
        {
            title: 'Total Active Merchants',
            value: stats.totalMerchants.toLocaleString(),
            icon: Users,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
        },
        {
            title: 'Total End Customers',
            value: stats.totalUsers.toLocaleString(),
            icon: Users,
            color: 'text-indigo-600',
            bg: 'bg-indigo-50',
        },
        {
            title: 'Total Orders Tracked',
            value: stats.totalOrders.toLocaleString(),
            icon: ShoppingBag,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
        },
        {
            title: 'Conversations Handled',
            value: stats.totalConversations.toLocaleString(),
            icon: MessageSquare,
            color: 'text-purple-600',
            bg: 'bg-purple-50',
        }
    ];

    return (
        <Page title="Platform Overview" subtitle="Global metrics across all merchants on Recete AI." fullWidth>
            <Layout>
                <Layout.Section>
                    <BlockStack gap="500">
                        <InlineGrid columns={{ xs: '1fr', md: '1fr 1fr', lg: 'repeat(4, minmax(0, 1fr))' }} gap="400">
                            {statCards.map((card) => {
                                const Icon = card.icon;
                                return (
                                    <Card key={card.title}>
                                        <Box padding="400">
                                            <BlockStack gap="300">
                                                <InlineStack align="space-between" blockAlign="center">
                                                    <Text as="p" variant="bodySm" tone="subdued">{card.title}</Text>
                                                    <Box borderRadius="300" padding="200" background="bg-surface-secondary">
                                                        <Icon className={`h-5 w-5 ${card.color}`} />
                                                    </Box>
                                                </InlineStack>
                                                <InlineStack gap="200" blockAlign="center">
                                                    <Text as="h2" variant="headingLg">{card.value}</Text>
                                                    <InlineStack gap="100" blockAlign="center">
                                                        <TrendingUp className="w-3 h-3 text-emerald-600" />
                                                        <Text as="span" variant="bodySm" tone="success">Live</Text>
                                                    </InlineStack>
                                                </InlineStack>
                                            </BlockStack>
                                        </Box>
                                    </Card>
                                );
                            })}
                        </InlineGrid>

                        <Card>
                            <Box padding="400">
                                <BlockStack gap="300">
                                    <BlockStack gap="100">
                                        <Text as="h2" variant="headingMd">Recent Platform Activity</Text>
                                        <Text as="p" tone="subdued">System events and new signups across the platform.</Text>
                                    </BlockStack>
                                    <Box padding="800" borderWidth="025" borderColor="border" borderRadius="300" background="bg-surface-secondary">
                                        <BlockStack gap="300" inlineAlign="center">
                                            <BarChart3 className="w-12 h-12 text-zinc-400" />
                                            <Text as="p" tone="subdued" alignment="center">
                                                Activity feed feature not yet implemented. Coming in v1.1.
                                            </Text>
                                        </BlockStack>
                                    </Box>
                                </BlockStack>
                            </Box>
                        </Card>
                    </BlockStack>
                </Layout.Section>
            </Layout>
        </Page>
    );
}
