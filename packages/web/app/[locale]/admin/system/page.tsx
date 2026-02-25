'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { Badge, Banner, BlockStack, Box, Button, Card, InlineGrid, InlineStack, Layout, Page, Select, SkeletonBodyText, SkeletonDisplayText, SkeletonPage, Text, TextField } from '@shopify/polaris';
import { Database, Server, Activity, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface QueueStats {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
}

interface SystemHealth {
    status: string;
    redis: {
        connected: boolean;
        uptime: string;
    };
    queues: {
        scheduledMessages: QueueStats;
        scrapeJobs: QueueStats;
        analytics: QueueStats;
    };
}

interface PlatformAiSettings {
    id: string;
    default_llm_model: string;
    allowed_llm_models: string[];
    conversation_memory_mode?: 'last_n' | 'full';
    conversation_memory_count?: number;
}

export default function SystemHealthPage() {
    const [health, setHealth] = useState<SystemHealth | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [aiSettings, setAiSettings] = useState<PlatformAiSettings | null>(null);
    const [savingAiSettings, setSavingAiSettings] = useState(false);
    const [selectedLlmModel, setSelectedLlmModel] = useState('gpt-4o-mini');
    const [conversationMemoryMode, setConversationMemoryMode] = useState<'last_n' | 'full'>('last_n');
    const [conversationMemoryCount, setConversationMemoryCount] = useState('10');

    const fetchHealth = async () => {
        setIsRefreshing(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const data = await authenticatedRequest<SystemHealth>('/api/admin/system-health', session.access_token);
            setHealth(data);
            const ai = await authenticatedRequest<{ settings: PlatformAiSettings }>('/api/admin/ai-settings', session.access_token);
            setAiSettings(ai.settings);
            setSelectedLlmModel(ai.settings.default_llm_model || 'gpt-4o-mini');
            setConversationMemoryMode(ai.settings.conversation_memory_mode === 'full' ? 'full' : 'last_n');
            setConversationMemoryCount(String(ai.settings.conversation_memory_count ?? 10));
            setLastUpdated(new Date());
            setError('');
        } catch (err: any) {
            setError(err.message || 'Failed to fetch system health');
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    const saveAiSettings = async () => {
        setSavingAiSettings(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const next = await authenticatedRequest<{ settings: PlatformAiSettings }>(
                '/api/admin/ai-settings',
                session.access_token,
                {
                    method: 'PUT',
                    body: JSON.stringify({
                        default_llm_model: selectedLlmModel,
                        allowed_llm_models: aiSettings?.allowed_llm_models || ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'],
                        conversation_memory_mode: conversationMemoryMode,
                        conversation_memory_count: Math.max(1, Math.min(200, parseInt(conversationMemoryCount || '10', 10) || 10)),
                    }),
                }
            );
            setAiSettings(next.settings);
            setSelectedLlmModel(next.settings.default_llm_model);
            setConversationMemoryMode(next.settings.conversation_memory_mode === 'full' ? 'full' : 'last_n');
            setConversationMemoryCount(String(next.settings.conversation_memory_count ?? 10));
        } catch (err: any) {
            setError(err.message || 'Failed to save AI settings');
        } finally {
            setSavingAiSettings(false);
        }
    };

    useEffect(() => {
        fetchHealth();
        // Auto refresh every 30 seconds
        const interval = setInterval(fetchHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    const formatUptime = (seconds: string) => {
        const secs = parseInt(seconds, 10);
        if (isNaN(secs)) return seconds;
        const d = Math.floor(secs / (3600 * 24));
        const h = Math.floor(secs % (3600 * 24) / 3600);
        const m = Math.floor(secs % 3600 / 60);
        return `${d}d ${h}h ${m}m`;
    };

    if (loading && !health) {
        return (
            <SkeletonPage title="System Health">
                <Layout>
                    <Layout.Section>
                        <BlockStack gap="500">
                            <Card><Box padding="400"><BlockStack gap="200"><SkeletonDisplayText size="small" /><SkeletonBodyText lines={2} /></BlockStack></Box></Card>
                            <Card><Box padding="400"><div className="h-32 rounded bg-zinc-100 animate-pulse" /></Box></Card>
                            <InlineGrid columns={{ xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }} gap="400">
                                {[1, 2, 3].map((i) => <Card key={i}><Box padding="400"><div className="h-56 rounded bg-zinc-100 animate-pulse" /></Box></Card>)}
                            </InlineGrid>
                        </BlockStack>
                    </Layout.Section>
                </Layout>
            </SkeletonPage>
        );
    }

    if (error && !health) {
        return (
            <Page title="System Health">
                <Layout>
                    <Layout.Section>
                        <Card>
                            <Box padding="400">
                                <InlineStack gap="200" blockAlign="start">
                                    <AlertCircle className="w-5 h-5 mt-0.5 text-red-600" />
                                    <BlockStack gap="200">
                                        <Text as="h3" variant="headingMd" tone="critical">System connection failed</Text>
                                        <Text as="p" tone="critical">{error}</Text>
                                        <InlineStack align="start">
                                            <Button variant="secondary" size="slim" onClick={fetchHealth}>Try Again</Button>
                                        </InlineStack>
                                    </BlockStack>
                                </InlineStack>
                            </Box>
                        </Card>
                    </Layout.Section>
                </Layout>
            </Page>
        );
    }

    const QueueCard = ({ title, stats, icon: Icon, colorClass }: { title: string, stats: QueueStats | undefined, icon: any, colorClass: string }) => {
        if (!stats) return null;

        const hasFailed = stats.failed > 0;
        const hasBacklog = stats.waiting > 1000;

        return (
            <Card>
                {/* Status indicator bar */}
                <div className={`absolute top-0 left-0 w-full h-1 ${hasFailed ? 'bg-red-500' : hasBacklog ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                <Box padding="400">
                    <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center" gap="200">
                        <InlineStack gap="200" blockAlign="center">
                            <Box padding="200" borderRadius="200" background="bg-surface-secondary">
                                <Icon className={`w-4 h-4 ${colorClass}`} />
                            </Box>
                            <Text as="h3" variant="headingSm">{title}</Text>
                        </InlineStack>
                        {hasFailed && (
                            <Badge tone="critical">
                                {`${stats.failed} Errors`}
                            </Badge>
                        )}
                    </InlineStack>
                    <InlineGrid columns={{ xs: '1fr', sm: '1fr 1fr' }} gap="300">
                        <Box background="bg-surface-secondary" borderRadius="300" borderWidth="025" borderColor="border" padding="300">
                            <Text as="p" variant="bodySm" tone="subdued">Active / Pending</Text>
                            <Text as="p" variant="headingLg">
                                {stats.active.toLocaleString()} <span className="text-zinc-300 font-light mx-1">/</span> <span className={`${hasBacklog ? 'text-amber-500' : 'text-zinc-600'}`}>{stats.waiting.toLocaleString()}</span>
                            </Text>
                        </Box>
                        <Box background="bg-surface-secondary" borderRadius="300" borderWidth="025" borderColor="border" padding="300">
                            <BlockStack gap="200">
                                <InlineStack align="space-between" blockAlign="center">
                                    <Text as="span" variant="bodySm" tone="subdued">Processed</Text>
                                    <Text as="span" variant="bodyMd" fontWeight="semibold">{stats.completed.toLocaleString()}</Text>
                                </InlineStack>
                                <InlineStack align="space-between" blockAlign="center">
                                    <Text as="span" variant="bodySm" tone="subdued">Delayed</Text>
                                    <Text as="span" variant="bodyMd" fontWeight="semibold">{stats.delayed.toLocaleString()}</Text>
                                </InlineStack>
                            </BlockStack>
                        </Box>
                    </InlineGrid>
                    </BlockStack>
                </Box>
            </Card>
        );
    };

    return (
        <Page title="System Health" subtitle="Monitoring background workers and infrastructure" fullWidth>
            <Layout>
                <Layout.Section>
        <BlockStack gap="500">
            <InlineGrid columns={{ xs: '1fr', md: '1fr auto' }} gap="300" alignItems="center">
                <InlineStack gap="200" blockAlign="center">
                    {health && <Badge tone="success">Live</Badge>}
                </InlineStack>
                <InlineStack align="end" gap="300" blockAlign="center">
                    <Text as="span" variant="bodySm" tone="subdued">
                        Last checked: {formatDistanceToNow(lastUpdated)} ago
                    </Text>
                    <Button variant="secondary" size="slim" onClick={fetchHealth} disabled={isRefreshing}>
                        Refresh
                    </Button>
                </InlineStack>
            </InlineGrid>

            {/* Core Infrastructure */}
            {health && (
                <Card>
                    <Box padding="400">
                        <InlineGrid columns={{ xs: '1fr', md: 'minmax(0,1fr) auto' }} gap="400" alignItems="center">
                            <InlineStack gap="400" blockAlign="center">
                                <Box padding="300" borderRadius="300" background="bg-surface-secondary">
                                    <Database className="w-6 h-6 text-zinc-300" />
                                </Box>
                                <BlockStack gap="100">
                                    <InlineStack gap="200" blockAlign="center">
                                        <Text as="h2" variant="headingMd">
                                            Redis Message Broker
                                        </Text>
                                        {health.redis.connected ? (
                                            <Badge tone="success">Connected</Badge>
                                        ) : (
                                            <Badge tone="critical">Disconnected</Badge>
                                        )}
                                    </InlineStack>
                                    <Text as="p" tone="subdued">Used for BullMQ job queues and rate limiting across instances.</Text>
                                </BlockStack>
                            </InlineStack>

                            <InlineStack gap="600" blockAlign="start">
                                <BlockStack gap="100">
                                    <Text as="p" variant="bodySm" tone="subdued">Uptime</Text>
                                    <Text as="p" variant="headingMd">{formatUptime(health.redis.uptime)}</Text>
                                </BlockStack>
                                <BlockStack gap="100">
                                    <Text as="p" variant="bodySm" tone="subdued">State</Text>
                                    <Text as="p" variant="headingMd">
                                        {health.status === 'healthy' ? 'OK' : 'DEGRADED'}
                                    </Text>
                                </BlockStack>
                            </InlineStack>
                        </InlineGrid>
                    </Box>
                </Card>
            )}

            {/* Global AI Model Settings */}
            <Card>
                <Box padding="400">
                    <BlockStack gap="300">
                        <InlineStack align="space-between" blockAlign="center" gap="200">
                            <BlockStack gap="100">
                                <Text as="h2" variant="headingMd">Global AI Model</Text>
                                <Text as="p" tone="subdued">
                                    Super admin runtime default model for chatbot and RAG answer generation (env fallback remains if DB setting unavailable).
                                </Text>
                            </BlockStack>
                            {aiSettings && <Badge tone="info">Runtime configurable</Badge>}
                        </InlineStack>
                        <InlineGrid columns={{ xs: '1fr', md: 'minmax(0,1fr) auto' }} gap="300" alignItems="end">
                            <BlockStack gap="300">
                                <Select
                                    label="Default LLM model"
                                    options={(aiSettings?.allowed_llm_models || ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1']).map((m) => ({
                                        label: m,
                                        value: m,
                                    }))}
                                    value={selectedLlmModel}
                                    onChange={setSelectedLlmModel}
                                />
                                <Select
                                    label="Conversation memory mode"
                                    options={[
                                        { label: 'Last N messages', value: 'last_n' },
                                        { label: 'Full conversation', value: 'full' },
                                    ]}
                                    value={conversationMemoryMode}
                                    onChange={(value) => setConversationMemoryMode(value === 'full' ? 'full' : 'last_n')}
                                    helpText="Controls how much conversation history is sent to the model for customer chat responses."
                                />
                                {conversationMemoryMode === 'last_n' && (
                                    <TextField
                                        label="Conversation memory count"
                                        type="number"
                                        min={1}
                                        max={200}
                                        autoComplete="off"
                                        value={conversationMemoryCount}
                                        onChange={setConversationMemoryCount}
                                        helpText="Number of latest messages to include in model context (1-200)."
                                    />
                                )}
                            </BlockStack>
                            <Button variant="primary" onClick={saveAiSettings} loading={savingAiSettings} disabled={savingAiSettings}>
                                Save AI Model
                            </Button>
                        </InlineGrid>
                    </BlockStack>
                </Box>
            </Card>

            {/* Background Worker Queues */}
            <BlockStack gap="300">
                <InlineStack gap="200" blockAlign="center">
                    <Activity className="w-5 h-5 text-zinc-500" />
                    <Text as="h3" variant="headingMd">Distributed Queues (BullMQ)</Text>
                </InlineStack>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <QueueCard
                        title="Scheduled Messages"
                        stats={health?.queues.scheduledMessages}
                        icon={Server}
                        colorClass="text-blue-500"
                    />
                    <QueueCard
                        title="Web Scraper Jobs"
                        stats={health?.queues.scrapeJobs}
                        icon={Server}
                        colorClass="text-emerald-500"
                    />
                    <QueueCard
                        title="Analytics Pipeline"
                        stats={health?.queues.analytics}
                        icon={Server}
                        colorClass="text-purple-500"
                    />
                </div>
            </BlockStack>

            <Banner tone="info">
                <p className="font-semibold mb-1">Queue Management (Coming Soon)</p>
                <p>In a future update, you will be able to pause queues, retry failed jobs in bulk, and clear backlogs directly from this dashboard.</p>
            </Banner>
        </BlockStack>
                </Layout.Section>
            </Layout>
        </Page>
    );
}
