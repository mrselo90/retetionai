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
    products_cache_ttl_seconds?: number;
}

interface RagSuiteProduct {
    id: string;
    name: string;
    url?: string;
    chunkCount: number;
}

interface RagSuiteCaseResult {
    query: string;
    ragLatencyMs: number;
    answerLatencyMs: number;
    ragCount: number;
    ragOk: boolean;
    answerOk: boolean;
    answerSkipped?: boolean;
    error?: string;
}

interface RagSuiteRunResult {
    startedAt: string;
    finishedAt: string;
    selectedProducts: RagSuiteProduct[];
    cases: RagSuiteCaseResult[];
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
    const [productsCacheTtlSeconds, setProductsCacheTtlSeconds] = useState('300');
    const [ragSuiteRunning, setRagSuiteRunning] = useState(false);
    const [ragSuiteError, setRagSuiteError] = useState('');
    const [ragSuiteResult, setRagSuiteResult] = useState<RagSuiteRunResult | null>(null);
    const [ragSuiteQueryPreset, setRagSuiteQueryPreset] = useState<'short' | 'medium' | 'wide'>('short');
    const [ragSuiteMode, setRagSuiteMode] = useState<'rag_only' | 'rag_and_answer'>('rag_and_answer');
    const [ragSuiteExcludedProductIds, setRagSuiteExcludedProductIds] = useState<string[]>([]);

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
            setProductsCacheTtlSeconds(String(ai.settings.products_cache_ttl_seconds ?? 300));
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
                        products_cache_ttl_seconds: Math.max(30, Math.min(3600, parseInt(productsCacheTtlSeconds || '300', 10) || 300)),
                    }),
                }
            );
            setAiSettings(next.settings);
            setSelectedLlmModel(next.settings.default_llm_model);
            setConversationMemoryMode(next.settings.conversation_memory_mode === 'full' ? 'full' : 'last_n');
            setConversationMemoryCount(String(next.settings.conversation_memory_count ?? 10));
            setProductsCacheTtlSeconds(String(next.settings.products_cache_ttl_seconds ?? 300));
        } catch (err: any) {
            setError(err.message || 'Failed to save AI settings');
        } finally {
            setSavingAiSettings(false);
        }
    };

    const runSuperAdminRagSuite = async () => {
        const suiteQueriesByPreset: Record<'short' | 'medium' | 'wide', string[]> = {
            short: [
                'Bu ürün nasıl kullanılır?',
                'İçindekiler nelerdir?',
                'Ne işe yarar?',
                'Nasıl saklanmalı?',
            ],
            medium: [
                'Bu ürün nasıl kullanılır?',
                'İçindekiler nelerdir?',
                'Ne işe yarar?',
                'Nasıl saklanmalı?',
                'Kimler için uygundur?',
                'Günde kaç kez kullanılmalı?',
                'Ne kadar süre kullanılmalı?',
                'Dikkat edilmesi gereken bir durum var mı?',
            ],
            wide: [
                'Bu ürün nasıl kullanılır?',
                'İçindekiler nelerdir?',
                'Ne işe yarar?',
                'Nasıl saklanmalı?',
                'Kimler için uygundur?',
                'Günde kaç kez kullanılmalı?',
                'Ne kadar süre kullanılmalı?',
                'Dikkat edilmesi gereken bir durum var mı?',
                'Açıldıktan sonra kullanım süresi nedir?',
                'Hangi saatlerde kullanmak daha uygundur?',
                'Farklı ürünlerle birlikte kullanılabilir mi?',
                'Hassas ciltler için uygun mu?',
            ],
        };
        const suiteQueries = suiteQueriesByPreset[ragSuiteQueryPreset];

        setRagSuiteRunning(true);
        setRagSuiteError('');
        setRagSuiteResult(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error('Oturum bulunamadı');
            }

            const startedAt = new Date().toISOString();

            const productsResponse = await authenticatedRequest<{ products?: Array<{ id: string; name: string; url?: string }> }>(
                '/api/products',
                session.access_token
            );
            const products = productsResponse.products ?? [];
            if (products.length === 0) {
                throw new Error('Bu merchant için ürün bulunamadı');
            }

            const chunkCountsResponse = await authenticatedRequest<{ chunkCounts?: Array<{ productId: string; chunkCount: number }> }>(
                '/api/products/chunks/batch',
                session.access_token,
                {
                    method: 'POST',
                    body: JSON.stringify({ productIds: products.map((p) => p.id) }),
                }
            );

            const chunkMap = new Map((chunkCountsResponse.chunkCounts ?? []).map((c) => [c.productId, c.chunkCount]));
            const candidateProducts: RagSuiteProduct[] = products
                .map((p) => ({
                    id: p.id,
                    name: p.name,
                    url: p.url,
                    chunkCount: chunkMap.get(p.id) ?? 0,
                }))
                .filter((p) => p.chunkCount > 0)
                .slice(0, 10);

            if (candidateProducts.length === 0) {
                throw new Error('Chunk/embedding hazır ürün bulunamadı (chunkCount > 0)');
            }

            const excludedIdSet = new Set(ragSuiteExcludedProductIds);
            const ragReadyProducts = candidateProducts.filter((p) => !excludedIdSet.has(p.id));
            if (ragReadyProducts.length === 0) {
                throw new Error('Hariç tutmalar sonrası test için ürün kalmadı');
            }

            const selectedProductIds = ragReadyProducts.map((p) => p.id);
            const caseResults: RagSuiteCaseResult[] = [];

            for (const query of suiteQueries) {
                const caseResult: RagSuiteCaseResult = {
                    query,
                    ragLatencyMs: 0,
                    answerLatencyMs: 0,
                    ragCount: 0,
                    ragOk: false,
                    answerOk: false,
                };

                try {
                    const ragStarted = performance.now();
                    const ragResponse = await authenticatedRequest<{ count?: number; results?: unknown[] }>(
                        '/api/test/rag',
                        session.access_token,
                        {
                            method: 'POST',
                            body: JSON.stringify({
                                query,
                                productIds: selectedProductIds,
                                topK: 5,
                            }),
                        }
                    );
                    caseResult.ragLatencyMs = Math.round(performance.now() - ragStarted);
                    caseResult.ragCount = typeof ragResponse.count === 'number'
                        ? ragResponse.count
                        : Array.isArray(ragResponse.results) ? ragResponse.results.length : 0;
                    caseResult.ragOk = caseResult.ragCount > 0;

                    if (ragSuiteMode === 'rag_only') {
                        caseResult.answerSkipped = true;
                        caseResult.answerOk = true;
                    } else {
                        const answerStarted = performance.now();
                        const answerResponse = await authenticatedRequest<{ answer?: string; error?: string }>(
                            '/api/test/rag/answer',
                            session.access_token,
                            {
                                method: 'POST',
                                body: JSON.stringify({
                                    query,
                                    productIds: selectedProductIds,
                                    topK: 5,
                                }),
                            }
                        );
                        caseResult.answerLatencyMs = Math.round(performance.now() - answerStarted);
                        caseResult.answerOk = typeof answerResponse.answer === 'string' && answerResponse.answer.trim().length > 0;
                        if (answerResponse.error) {
                            caseResult.error = answerResponse.error;
                        }
                    }
                } catch (err) {
                    caseResult.error = err instanceof Error ? err.message : 'RAG case failed';
                }

                caseResults.push(caseResult);
            }

            setRagSuiteResult({
                startedAt,
                finishedAt: new Date().toISOString(),
                selectedProducts: ragReadyProducts,
                cases: caseResults,
            });
        } catch (err) {
            setRagSuiteError(err instanceof Error ? err.message : 'RAG test suite failed');
        } finally {
            setRagSuiteRunning(false);
        }
    };

    const toggleRagSuiteExcludedProduct = (productId: string) => {
        setRagSuiteExcludedProductIds((prev) =>
            prev.includes(productId)
                ? prev.filter((id) => id !== productId)
                : [...prev, productId]
        );
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

    const ragSuitePassedCases = ragSuiteResult?.cases.filter((c) => c.ragOk && c.answerOk).length ?? 0;
    const ragSuiteTotalCases = ragSuiteResult?.cases.length ?? 0;

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
                                <TextField
                                    label="Products list cache TTL (seconds)"
                                    type="number"
                                    min={30}
                                    max={3600}
                                    autoComplete="off"
                                    value={productsCacheTtlSeconds}
                                    onChange={setProductsCacheTtlSeconds}
                                    helpText="Controls Redis cache duration for /api/products (30-3600 seconds)."
                                />
                            </BlockStack>
                            <Button variant="primary" onClick={saveAiSettings} loading={savingAiSettings} disabled={savingAiSettings}>
                                Save AI Model
                            </Button>
                        </InlineGrid>
                    </BlockStack>
                </Box>
            </Card>

            <Card>
                <Box padding="400">
                    <BlockStack gap="300">
                        <InlineStack align="space-between" blockAlign="center" gap="200">
                            <BlockStack gap="100">
                                <Text as="h2" variant="headingMd">RAG Test Suite (Super Admin)</Text>
                                <Text as="p" tone="subdued">
                                    Mevcut merchant için chunk&apos;ı olan ilk 10 ürünü seçer ve predefined RAG + RAG Answer smoke testlerini çalıştırır.
                                </Text>
                            </BlockStack>
                            <Badge tone="attention">Predefined</Badge>
                        </InlineStack>

                        <InlineGrid columns={{ xs: '1fr', md: 'repeat(3, minmax(0,1fr)) auto' }} gap="300" alignItems="end">
                            <BlockStack gap="100">
                                <Text as="p" variant="bodySm" tone="subdued">Suite ID</Text>
                                <Text as="p" variant="bodyMd" fontWeight="medium">rag_superadmin_10_products_smoke</Text>
                            </BlockStack>
                            <Select
                                label="Query set"
                                options={[
                                    { label: 'Kısa (4 soru)', value: 'short' },
                                    { label: 'Orta (8 soru)', value: 'medium' },
                                    { label: 'Geniş (12 soru)', value: 'wide' },
                                ]}
                                value={ragSuiteQueryPreset}
                                onChange={(value) => setRagSuiteQueryPreset((value === 'medium' || value === 'wide') ? value : 'short')}
                            />
                            <Select
                                label="Run mode"
                                options={[
                                    { label: 'RAG + Answer', value: 'rag_and_answer' },
                                    { label: 'Sadece RAG', value: 'rag_only' },
                                ]}
                                value={ragSuiteMode}
                                onChange={(value) => setRagSuiteMode(value === 'rag_only' ? 'rag_only' : 'rag_and_answer')}
                            />
                            <Box paddingBlockStart="500">
                                <Button variant="primary" onClick={runSuperAdminRagSuite} loading={ragSuiteRunning} disabled={ragSuiteRunning}>
                                    Run Suite
                                </Button>
                            </Box>
                        </InlineGrid>

                        {ragSuiteExcludedProductIds.length > 0 && (
                            <InlineStack gap="200" blockAlign="center">
                                <Badge tone="warning">{`${ragSuiteExcludedProductIds.length} excluded`}</Badge>
                                <Button size="slim" variant="tertiary" onClick={() => setRagSuiteExcludedProductIds([])}>
                                    Clear exclusions
                                </Button>
                            </InlineStack>
                        )}

                        {ragSuiteError && (
                            <Banner tone="critical">
                                <p>{ragSuiteError}</p>
                            </Banner>
                        )}

                        {ragSuiteResult && (
                            <BlockStack gap="300">
                                <InlineStack gap="200" blockAlign="center">
                                    <Badge tone={ragSuitePassedCases === ragSuiteTotalCases ? 'success' : 'warning'}>
                                        {`${ragSuitePassedCases}/${ragSuiteTotalCases} cases passed`}
                                    </Badge>
                                    <Badge tone="info">
                                        {`${ragSuiteResult.selectedProducts.length} products selected`}
                                    </Badge>
                                    <Text as="span" variant="bodySm" tone="subdued">
                                        {new Date(ragSuiteResult.finishedAt).toLocaleString()}
                                    </Text>
                                </InlineStack>

                                <Box background="bg-surface-secondary" borderRadius="300" padding="300">
                                    <BlockStack gap="200">
                                        <Text as="h3" variant="headingSm">Selected products (first 10 with chunks)</Text>
                                        <Text as="p" variant="bodySm" tone="subdued">
                                            Ürünleri sonraki çalıştırmadan hariç tutmak için karttaki butonu kullan.
                                        </Text>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {ragSuiteResult.selectedProducts.map((product) => (
                                                <div key={product.id} className="rounded border border-zinc-200 bg-white px-3 py-2">
                                                    <div className="text-sm font-medium text-zinc-800 truncate">{product.name || product.id}</div>
                                                    <div className="text-xs text-zinc-500 truncate">{product.id}</div>
                                                    <div className="text-xs text-zinc-600 mb-2">chunks: {product.chunkCount}</div>
                                                    <Button
                                                        size="slim"
                                                        variant={ragSuiteExcludedProductIds.includes(product.id) ? 'primary' : 'tertiary'}
                                                        onClick={() => toggleRagSuiteExcludedProduct(product.id)}
                                                    >
                                                        {ragSuiteExcludedProductIds.includes(product.id) ? 'Include next run' : 'Exclude next run'}
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </BlockStack>
                                </Box>

                                <Box background="bg-surface-secondary" borderRadius="300" padding="300">
                                    <BlockStack gap="200">
                                        <Text as="h3" variant="headingSm">Case results</Text>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="text-left text-zinc-500">
                                                        <th className="py-2 pr-3">Query</th>
                                                        <th className="py-2 pr-3">RAG</th>
                                                        <th className="py-2 pr-3">Count</th>
                                                        <th className="py-2 pr-3">RAG ms</th>
                                                        <th className="py-2 pr-3">Answer</th>
                                                        <th className="py-2 pr-3">Answer ms</th>
                                                        <th className="py-2">Error</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {ragSuiteResult.cases.map((row) => (
                                                        <tr key={row.query} className="border-t border-zinc-200">
                                                            <td className="py-2 pr-3 text-zinc-800">{row.query}</td>
                                                            <td className="py-2 pr-3">{row.ragOk ? 'PASS' : 'FAIL'}</td>
                                                            <td className="py-2 pr-3">{row.ragCount}</td>
                                                            <td className="py-2 pr-3">{row.ragLatencyMs}</td>
                                                            <td className="py-2 pr-3">{row.answerSkipped ? 'SKIP' : row.answerOk ? 'PASS' : 'FAIL'}</td>
                                                            <td className="py-2 pr-3">{row.answerSkipped ? '-' : row.answerLatencyMs}</td>
                                                            <td className="py-2 text-zinc-600">{row.error || '-'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </BlockStack>
                                </Box>
                            </BlockStack>
                        )}
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
