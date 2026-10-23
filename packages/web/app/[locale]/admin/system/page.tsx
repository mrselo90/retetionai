'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { Badge, Button, Card, Input, Select } from '@/components/recete';
import {
  Database,
  Server,
  Activity,
  AlertCircle,
  Info,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getErrorMessage } from '@/lib/errors';

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
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
  default_embedding_model?: string;
  allowed_embedding_models?: string[];
  default_vision_model?: string;
  allowed_vision_models?: string[];
  corporate_whatsapp_phone_number_display?: string | null;
  force_corporate_whatsapp_for_customer_messaging?: boolean;
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

/** Inset panel inside a card (stat tiles, result blocks). */
const insetPanelStyle: CSSProperties = {
  background: 'var(--r-surface-subtle)',
  borderRadius: 'var(--r-radius-lg)',
};

const insetPanelBorderedStyle: CSSProperties = {
  ...insetPanelStyle,
  border: '1px solid var(--r-border)',
};

/** Sub-section heading inside a card, one step below .r-card-title. */
const subheadingStyle: CSSProperties = {
  margin: 0,
  fontSize: 'var(--r-text-base-plus)',
  fontWeight: 'var(--r-weight-semibold)',
  color: 'var(--r-text)',
};

const statValueStyle: CSSProperties = {
  margin: 0,
  fontSize: 'var(--r-text-lg)',
  fontWeight: 'var(--r-weight-semibold)',
  color: 'var(--r-text)',
};

// Module level so it isn't a new component type on every render.
const QueueCard = ({
  title,
  stats,
  icon: Icon,
  colorClass,
}: {
  title: string;
  stats: QueueStats | undefined;
  icon: LucideIcon;
  colorClass: string;
}) => {
  if (!stats) return null;

  const hasFailed = stats.failed > 0;
  const hasBacklog = stats.waiting > 1000;

  return (
    <Card className="relative overflow-hidden">
      {/* Status indicator bar */}
      <div
        className={`absolute top-0 left-0 w-full h-1 ${hasFailed ? 'bg-red-500' : hasBacklog ? 'bg-amber-500' : 'bg-emerald-500'}`}
      />
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="r-kpi-icon" aria-hidden="true">
              <Icon className={`w-4 h-4 ${colorClass}`} />
            </span>
            <h3 style={subheadingStyle}>{title}</h3>
          </div>
          {hasFailed && <Badge tone="danger">{`${stats.failed} Errors`}</Badge>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3" style={insetPanelBorderedStyle}>
            <p className="r-hint" style={{ margin: 0 }}>
              Active / Pending
            </p>
            <p className="r-kpi-value" style={{ fontSize: 'var(--r-text-2xl)', margin: 0 }}>
              {stats.active.toLocaleString()}{' '}
              <span className="text-zinc-300 font-light mx-1">/</span>{' '}
              <span className={`${hasBacklog ? 'text-amber-500' : 'text-zinc-600'}`}>
                {stats.waiting.toLocaleString()}
              </span>
            </p>
          </div>
          <div className="p-3 flex flex-col gap-2" style={insetPanelBorderedStyle}>
            <div className="flex items-center justify-between gap-2">
              <span className="r-hint">Processed</span>
              <span className="r-table-strong">{stats.completed.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="r-hint">Delayed</span>
              <span className="r-table-strong">{stats.delayed.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default function SystemHealthPage() {
  const defaultLlmModels = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'];
  const defaultEmbeddingModels = ['text-embedding-3-small'];
  const defaultVisionModels = ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'];
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  // Starts true: the initial health load is already in flight when the page mounts.
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [aiSettings, setAiSettings] = useState<PlatformAiSettings | null>(null);
  const [savingAiSettings, setSavingAiSettings] = useState(false);
  const [selectedLlmModel, setSelectedLlmModel] = useState('gpt-4o-mini');
  const [allowedLlmModelsInput, setAllowedLlmModelsInput] = useState(defaultLlmModels.join(', '));
  const [selectedEmbeddingModel, setSelectedEmbeddingModel] = useState('text-embedding-3-small');
  const [allowedEmbeddingModelsInput, setAllowedEmbeddingModelsInput] = useState(
    defaultEmbeddingModels.join(', ')
  );
  const [selectedVisionModel, setSelectedVisionModel] = useState('gpt-4o');
  const [allowedVisionModelsInput, setAllowedVisionModelsInput] = useState(
    defaultVisionModels.join(', ')
  );
  const [corporateWhatsAppPhoneDisplay, setCorporateWhatsAppPhoneDisplay] = useState('');
  const [
    forceCorporateWhatsAppForCustomerMessaging,
    setForceCorporateWhatsAppForCustomerMessaging,
  ] = useState(false);
  const [conversationMemoryMode, setConversationMemoryMode] = useState<'last_n' | 'full'>('last_n');
  const [conversationMemoryCount, setConversationMemoryCount] = useState('10');
  const [productsCacheTtlSeconds, setProductsCacheTtlSeconds] = useState('300');
  const [ragSuiteRunning, setRagSuiteRunning] = useState(false);
  const [ragSuiteError, setRagSuiteError] = useState('');
  const [ragSuiteResult, setRagSuiteResult] = useState<RagSuiteRunResult | null>(null);
  const [ragSuiteQueryPreset, setRagSuiteQueryPreset] = useState<
    'short' | 'medium' | 'wide' | 'hungarian'
  >('short');
  const [ragSuiteMode, setRagSuiteMode] = useState<'rag_only' | 'rag_and_answer'>('rag_and_answer');
  const [ragSuiteExcludedProductIds, setRagSuiteExcludedProductIds] = useState<string[]>([]);

  /** Loads health and AI settings; only sets state after its first await. */
  const loadHealth = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const data = await authenticatedRequest<SystemHealth>(
        '/api/admin/system-health',
        session.access_token
      );
      setHealth(data);
      const ai = await authenticatedRequest<{ settings: PlatformAiSettings }>(
        '/api/admin/ai-settings',
        session.access_token
      );
      setAiSettings(ai.settings);
      setSelectedLlmModel(ai.settings.default_llm_model || 'gpt-4o-mini');
      setAllowedLlmModelsInput((ai.settings.allowed_llm_models || defaultLlmModels).join(', '));
      setSelectedEmbeddingModel(ai.settings.default_embedding_model || 'text-embedding-3-small');
      setAllowedEmbeddingModelsInput(
        (ai.settings.allowed_embedding_models || defaultEmbeddingModels).join(', ')
      );
      setSelectedVisionModel(
        ai.settings.default_vision_model || ai.settings.default_llm_model || 'gpt-4o'
      );
      setAllowedVisionModelsInput(
        (ai.settings.allowed_vision_models || defaultVisionModels).join(', ')
      );
      setCorporateWhatsAppPhoneDisplay(ai.settings.corporate_whatsapp_phone_number_display || '');
      setForceCorporateWhatsAppForCustomerMessaging(
        Boolean(ai.settings.force_corporate_whatsapp_for_customer_messaging)
      );
      setConversationMemoryMode(
        ai.settings.conversation_memory_mode === 'full' ? 'full' : 'last_n'
      );
      setConversationMemoryCount(String(ai.settings.conversation_memory_count ?? 10));
      setProductsCacheTtlSeconds(String(ai.settings.products_cache_ttl_seconds ?? 300));
      setLastUpdated(new Date());
      setError('');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to fetch system health'));
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  /** Manual and interval refresh: flags the refresh, then reloads. */
  const fetchHealth = () => {
    setIsRefreshing(true);
    return loadHealth();
  };

  const parseCommaList = (value: string, fallback: string[]) => {
    const parsed = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item, index, arr) => arr.indexOf(item) === index);
    return parsed.length > 0 ? parsed : fallback;
  };

  const saveAiSettings = async () => {
    setSavingAiSettings(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const allowedLlmModels = parseCommaList(allowedLlmModelsInput, defaultLlmModels);
      const allowedEmbeddingModels = parseCommaList(
        allowedEmbeddingModelsInput,
        defaultEmbeddingModels
      );
      const allowedVisionModels = parseCommaList(allowedVisionModelsInput, defaultVisionModels);
      const next = await authenticatedRequest<{ settings: PlatformAiSettings }>(
        '/api/admin/ai-settings',
        session.access_token,
        {
          method: 'PUT',
          body: JSON.stringify({
            default_llm_model: selectedLlmModel,
            allowed_llm_models: allowedLlmModels,
            default_embedding_model: selectedEmbeddingModel,
            allowed_embedding_models: allowedEmbeddingModels,
            default_vision_model: selectedVisionModel,
            allowed_vision_models: allowedVisionModels,
            corporate_whatsapp_phone_number_display: corporateWhatsAppPhoneDisplay.trim() || null,
            force_corporate_whatsapp_for_customer_messaging:
              forceCorporateWhatsAppForCustomerMessaging,
            conversation_memory_mode: conversationMemoryMode,
            conversation_memory_count: Math.max(
              1,
              Math.min(200, parseInt(conversationMemoryCount || '10', 10) || 10)
            ),
            products_cache_ttl_seconds: Math.max(
              30,
              Math.min(3600, parseInt(productsCacheTtlSeconds || '300', 10) || 300)
            ),
          }),
        }
      );
      setAiSettings(next.settings);
      setSelectedLlmModel(next.settings.default_llm_model);
      setAllowedLlmModelsInput((next.settings.allowed_llm_models || defaultLlmModels).join(', '));
      setSelectedEmbeddingModel(next.settings.default_embedding_model || 'text-embedding-3-small');
      setAllowedEmbeddingModelsInput(
        (next.settings.allowed_embedding_models || defaultEmbeddingModels).join(', ')
      );
      setSelectedVisionModel(
        next.settings.default_vision_model || next.settings.default_llm_model || 'gpt-4o'
      );
      setAllowedVisionModelsInput(
        (next.settings.allowed_vision_models || defaultVisionModels).join(', ')
      );
      setCorporateWhatsAppPhoneDisplay(next.settings.corporate_whatsapp_phone_number_display || '');
      setForceCorporateWhatsAppForCustomerMessaging(
        Boolean(next.settings.force_corporate_whatsapp_for_customer_messaging)
      );
      setConversationMemoryMode(
        next.settings.conversation_memory_mode === 'full' ? 'full' : 'last_n'
      );
      setConversationMemoryCount(String(next.settings.conversation_memory_count ?? 10));
      setProductsCacheTtlSeconds(String(next.settings.products_cache_ttl_seconds ?? 300));
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save AI settings'));
    } finally {
      setSavingAiSettings(false);
    }
  };

  const runSuperAdminRagSuite = async () => {
    const suiteQueriesByPreset: Record<'short' | 'medium' | 'wide' | 'hungarian', string[]> = {
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
      hungarian: [
        'Hogyan kell használni ezt a terméket?',
        'Milyen összetevőket tartalmaz?',
        'Mire való ez a termék?',
        'Hogyan kell tárolni?',
        'Kinek ajánlott ez a termék?',
        'Naponta hányszor érdemes használni?',
        'Mennyi ideig javasolt használni?',
        'Van valamilyen fontos figyelmeztetés?',
        'Felbontás után meddig használható?',
        'Érzékeny bőrre is megfelelő?',
        'Használható más termékekkel együtt?',
        'Mikor várható látható eredmény?',
      ],
    };
    const suiteQueries = suiteQueriesByPreset[ragSuiteQueryPreset];

    setRagSuiteRunning(true);
    setRagSuiteError('');
    setRagSuiteResult(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Session not found');
      }

      const startedAt = new Date().toISOString();

      const productsResponse = await authenticatedRequest<{
        products?: Array<{ id: string; name: string; url?: string }>;
      }>('/api/products', session.access_token);
      const products = productsResponse.products ?? [];
      if (products.length === 0) {
        throw new Error('No products found for this merchant');
      }

      const chunkCountsResponse = await authenticatedRequest<{
        chunkCounts?: Array<{ productId: string; chunkCount: number }>;
      }>('/api/products/chunks/batch', session.access_token, {
        method: 'POST',
        body: JSON.stringify({ productIds: products.map((p) => p.id) }),
      });

      const chunkMap = new Map(
        (chunkCountsResponse.chunkCounts ?? []).map((c) => [c.productId, c.chunkCount])
      );
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
        throw new Error('No products found with chunks/embeddings (chunkCount > 0)');
      }

      const excludedIdSet = new Set(ragSuiteExcludedProductIds);
      const ragReadyProducts = candidateProducts.filter((p) => !excludedIdSet.has(p.id));
      if (ragReadyProducts.length === 0) {
        throw new Error('No products left after exclusions');
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
          caseResult.ragCount =
            typeof ragResponse.count === 'number'
              ? ragResponse.count
              : Array.isArray(ragResponse.results)
                ? ragResponse.results.length
                : 0;
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
            caseResult.answerOk =
              typeof answerResponse.answer === 'string' && answerResponse.answer.trim().length > 0;
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
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  useEffect(() => {
    // Initial load. isRefreshing already starts true, so nothing is set synchronously here; the
    // rule cannot see that loadHealth only sets state after an await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadHealth();
    // Auto refresh every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: string) => {
    const secs = parseInt(seconds, 10);
    if (isNaN(secs)) return seconds;
    const d = Math.floor(secs / (3600 * 24));
    const h = Math.floor((secs % (3600 * 24)) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  };

  const ragSuitePassedCases =
    ragSuiteResult?.cases.filter((c) => c.ragOk && c.answerOk).length ?? 0;
  const ragSuiteTotalCases = ragSuiteResult?.cases.length ?? 0;

  if (loading && !health) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="r-page-title">System Health</h1>
        <div className="flex flex-col gap-5" role="status" aria-label="Loading system health">
          <Card>
            <div className="flex flex-col gap-2" aria-hidden="true">
              <div className="r-skeleton" style={{ height: 22, width: '40%' }} />
              <div className="r-skeleton" style={{ height: 12 }} />
              <div className="r-skeleton" style={{ height: 12, width: '70%' }} />
            </div>
          </Card>
          <Card>
            <div className="r-skeleton h-32" aria-hidden="true" />
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <div className="r-skeleton h-56" aria-hidden="true" />
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && !health) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="r-page-title">System Health</h1>
        <Card>
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 mt-0.5 text-red-600 shrink-0" aria-hidden="true" />
            <div className="flex flex-col gap-2">
              <h2 className="r-card-title" style={{ margin: 0, color: 'var(--r-danger)' }}>
                System connection failed
              </h2>
              <p style={{ margin: 0, fontSize: 'var(--r-text-base-plus)', color: 'var(--r-danger)' }}>
                {error}
              </p>
              <div>
                <Button variant="secondary" size="sm" onClick={fetchHealth}>
                  Try Again
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }


  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="r-page-title">System Health</h1>
        <p className="r-page-sub">Monitoring background workers and infrastructure</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {health && <Badge tone="success">Live</Badge>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <span className="r-hint">Last checked: {formatDistanceToNow(lastUpdated)} ago</span>
          <Button variant="secondary" size="sm" onClick={fetchHealth} disabled={isRefreshing}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Core Infrastructure */}
      {health && (
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <span className="r-kpi-icon" style={{ width: 48, height: 48 }} aria-hidden="true">
                <Database className="w-6 h-6 text-zinc-300" />
              </span>
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="r-card-title" style={{ margin: 0 }}>
                    Redis Message Broker
                  </h2>
                  {health.redis.connected ? (
                    <Badge tone="success">Connected</Badge>
                  ) : (
                    <Badge tone="danger">Disconnected</Badge>
                  )}
                </div>
                <p className="r-hint" style={{ margin: 0 }}>
                  Used for BullMQ job queues and rate limiting across instances.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-start gap-6">
              <div className="flex flex-col gap-1">
                <p className="r-hint" style={{ margin: 0 }}>
                  Uptime
                </p>
                <p style={statValueStyle}>{formatUptime(health.redis.uptime)}</p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="r-hint" style={{ margin: 0 }}>
                  State
                </p>
                <p style={statValueStyle}>{health.status === 'healthy' ? 'OK' : 'DEGRADED'}</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Global AI Model Settings */}
      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col gap-1">
              <h2 className="r-card-title" style={{ margin: 0 }}>
                Global AI Model
              </h2>
              <p className="r-hint" style={{ margin: 0 }}>
                Super admin runtime defaults for chat answers, embeddings, WhatsApp AI vision, and
                the Recete corporate WhatsApp sender.
              </p>
            </div>
            {aiSettings && <Badge tone="brand">Runtime configurable</Badge>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
            <div className="flex flex-col gap-3">
              <Select
                label="Default LLM model"
                value={selectedLlmModel}
                onChange={(e) => setSelectedLlmModel(e.target.value)}
              >
                {parseCommaList(allowedLlmModelsInput || '', defaultLlmModels).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
              <Input
                label="Allowed LLM models"
                autoComplete="off"
                value={allowedLlmModelsInput}
                onChange={(e) => setAllowedLlmModelsInput(e.target.value)}
                help="Comma-separated list of chat models available in the super admin runtime config."
              />
              <Select
                label="Default embedding model"
                value={selectedEmbeddingModel}
                onChange={(e) => setSelectedEmbeddingModel(e.target.value)}
                help="Used for multilingual chunk indexing and retrieval embeddings. Keep this aligned with the vector dimension schema."
              >
                {parseCommaList(allowedEmbeddingModelsInput || '', defaultEmbeddingModels).map(
                  (m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  )
                )}
              </Select>
              <Input
                label="Allowed embedding models"
                autoComplete="off"
                value={allowedEmbeddingModelsInput}
                onChange={(e) => setAllowedEmbeddingModelsInput(e.target.value)}
                help="Comma-separated list. Current production schema is configured for 1536-dimension embeddings, so only compatible models should be listed."
              />
              <Select
                label="Default vision model"
                value={selectedVisionModel}
                onChange={(e) => setSelectedVisionModel(e.target.value)}
                help="Used for customer photo analysis in WhatsApp AI vision flows."
              >
                {parseCommaList(allowedVisionModelsInput || '', defaultVisionModels).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
              <Input
                label="Allowed vision models"
                autoComplete="off"
                value={allowedVisionModelsInput}
                onChange={(e) => setAllowedVisionModelsInput(e.target.value)}
                help="Comma-separated list of models allowed for WhatsApp AI vision."
              />
              <Input
                label="Corporate WhatsApp display number"
                autoComplete="off"
                value={corporateWhatsAppPhoneDisplay}
                onChange={(e) => setCorporateWhatsAppPhoneDisplay(e.target.value)}
                help="Optional human-readable display value used in platform contact surfaces."
              />
              <Select
                label="Conversation memory mode"
                value={conversationMemoryMode}
                onChange={(e) =>
                  setConversationMemoryMode(e.target.value === 'full' ? 'full' : 'last_n')
                }
                help="Controls how much conversation history is sent to the model for customer chat responses."
              >
                <option value="last_n">Last N messages</option>
                <option value="full">Full conversation</option>
              </Select>
              {conversationMemoryMode === 'last_n' && (
                <Input
                  label="Conversation memory count"
                  type="number"
                  min={1}
                  max={200}
                  autoComplete="off"
                  value={conversationMemoryCount}
                  onChange={(e) => setConversationMemoryCount(e.target.value)}
                  help="Number of latest messages to include in model context (1-200)."
                />
              )}
              <Input
                label="Products list cache TTL (seconds)"
                type="number"
                min={30}
                max={3600}
                autoComplete="off"
                value={productsCacheTtlSeconds}
                onChange={(e) => setProductsCacheTtlSeconds(e.target.value)}
                help="Controls Redis cache duration for /api/products (30-3600 seconds)."
              />
            </div>
            <Button
              variant="primary"
              onClick={saveAiSettings}
              loading={savingAiSettings}
              disabled={savingAiSettings}
            >
              {savingAiSettings && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              Save AI Settings
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col gap-1">
              <h2 className="r-card-title" style={{ margin: 0 }}>
                RAG Test Suite (Super Admin)
              </h2>
              <p className="r-hint" style={{ margin: 0 }}>
                Selects the first 10 products with chunks for the current merchant and runs
                predefined RAG + Answer smoke tests.
              </p>
            </div>
            <Badge tone="caution">Predefined</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[repeat(3,minmax(0,1fr))_auto] items-end gap-3">
            <div className="flex flex-col gap-1">
              <p className="r-hint" style={{ margin: 0 }}>
                Suite ID
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 'var(--r-text-base-plus)',
                  fontWeight: 'var(--r-weight-medium)',
                  color: 'var(--r-text)',
                }}
              >
                rag_superadmin_10_products_smoke
              </p>
            </div>
            <Select
              label="Query set"
              value={ragSuiteQueryPreset}
              onChange={(e) => {
                const value = e.target.value;
                setRagSuiteQueryPreset(
                  value === 'medium' || value === 'wide' || value === 'hungarian' ? value : 'short'
                );
              }}
            >
              <option value="short">Short (4 queries)</option>
              <option value="medium">Medium (8 queries)</option>
              <option value="wide">Wide (12 queries)</option>
              <option value="hungarian">Hungarian (12 queries)</option>
            </Select>
            <Select
              label="Run mode"
              value={ragSuiteMode}
              onChange={(e) =>
                setRagSuiteMode(e.target.value === 'rag_only' ? 'rag_only' : 'rag_and_answer')
              }
            >
              <option value="rag_and_answer">RAG + Answer</option>
              <option value="rag_only">RAG Only</option>
            </Select>
            <div className="pt-5">
              <Button
                variant="primary"
                onClick={runSuperAdminRagSuite}
                loading={ragSuiteRunning}
                disabled={ragSuiteRunning}
              >
                {ragSuiteRunning && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                Run Suite
              </Button>
            </div>
          </div>

          {ragSuiteExcludedProductIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="warning">{`${ragSuiteExcludedProductIds.length} excluded`}</Badge>
              <Button size="sm" variant="ghost" onClick={() => setRagSuiteExcludedProductIds([])}>
                Clear exclusions
              </Button>
            </div>
          )}

          {ragSuiteError && (
            <div className="r-alert r-alert-error" role="alert">
              <AlertCircle size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
              <p className="r-alert-body" style={{ margin: 0, flex: 1 }}>
                {ragSuiteError}
              </p>
            </div>
          )}

          {ragSuiteResult && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={ragSuitePassedCases === ragSuiteTotalCases ? 'success' : 'warning'}>
                  {`${ragSuitePassedCases}/${ragSuiteTotalCases} cases passed`}
                </Badge>
                <Badge tone="brand">
                  {`${ragSuiteResult.selectedProducts.length} products selected`}
                </Badge>
                <span className="r-hint">
                  {new Date(ragSuiteResult.finishedAt).toLocaleString()}
                </span>
              </div>

              <div className="p-3 flex flex-col gap-2" style={insetPanelStyle}>
                <h3 style={subheadingStyle}>Selected products (first 10 with chunks)</h3>
                <p className="r-hint" style={{ margin: 0 }}>
                  Use the button on each card to exclude products from the next run.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {ragSuiteResult.selectedProducts.map((product) => (
                    <div
                      key={product.id}
                      className="rounded border border-zinc-200 bg-white px-3 py-2"
                    >
                      <div className="text-sm font-medium text-zinc-800 truncate">
                        {product.name || product.id}
                      </div>
                      <div className="text-xs text-zinc-500 truncate">{product.id}</div>
                      <div className="text-xs text-zinc-600 mb-2">
                        chunks: {product.chunkCount}
                      </div>
                      <Button
                        size="sm"
                        variant={
                          ragSuiteExcludedProductIds.includes(product.id) ? 'primary' : 'ghost'
                        }
                        onClick={() => toggleRagSuiteExcludedProduct(product.id)}
                      >
                        {ragSuiteExcludedProductIds.includes(product.id)
                          ? 'Include next run'
                          : 'Exclude next run'}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 flex flex-col gap-2" style={insetPanelStyle}>
                <h3 style={subheadingStyle}>Case results</h3>
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
                          <td className="py-2 pr-3">
                            {row.answerSkipped ? 'SKIP' : row.answerOk ? 'PASS' : 'FAIL'}
                          </td>
                          <td className="py-2 pr-3">
                            {row.answerSkipped ? '-' : row.answerLatencyMs}
                          </td>
                          <td className="py-2 text-zinc-600">{row.error || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Background Worker Queues */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-zinc-500" aria-hidden="true" />
          <h2 className="r-card-title" style={{ margin: 0 }}>
            Distributed Queues (BullMQ)
          </h2>
        </div>
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
      </section>

      <div className="r-alert r-alert-info">
        <Info size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <p className="r-alert-title">Queue Management (Coming Soon)</p>
          <p className="r-alert-body" style={{ marginBottom: 0 }}>
            In a future update, you will be able to pause queues, retry failed jobs in bulk, and
            clear backlogs directly from this dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
