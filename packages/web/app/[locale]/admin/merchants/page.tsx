'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { Badge, Button, Select, TableWrap } from '@/components/recete';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { Store, Calendar, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/lib/toast';
import { getErrorMessage } from '@/lib/errors';

interface Merchant {
    id: string;
    name: string;
    created_at: string;
    is_super_admin: boolean;
    settings?: { capped_amount?: number;[key: string]: unknown };
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

/** Body copy at the dense table size, in the primary text colour. */
const BODY_TEXT = { fontSize: 'var(--r-text-base-plus)', color: 'var(--r-text)' } as const;
/** Neutral backdrop for the merchant store glyph (replaces the KPI icon's brand tint). */
const ICON_TILE = { background: 'var(--r-surface-muted)' } as const;

export default function AdminMerchantsPage() {
    const [merchants, setMerchants] = useState<Merchant[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [impersonatingMap, setImpersonatingMap] = useState<Record<string, boolean>>({});
    const [aiWindow, setAiWindow] = useState<'mtd' | '30d' | '7d'>('mtd');
    const [aiUsageModalMerchant, setAiUsageModalMerchant] = useState<Merchant | null>(null);
    const [aiUsageDetail, setAiUsageDetail] = useState<MerchantAiUsageDetailResponse | null>(null);
    const [aiUsageDetailLoading, setAiUsageDetailLoading] = useState(false);
    /** Bumped to refetch the merchant list for the current AI window. */
    const [merchantsReloadKey, setMerchantsReloadKey] = useState(0);

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
            setMerchantsReloadKey((key) => key + 1);
        } catch (err) {
            toast.error(getErrorMessage(err, 'Failed to update limit'));
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
        } catch (err) {
            toast.error('Impersonation failed', getErrorMessage(err, 'Impersonation failed'));
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
        } catch (err) {
            toast.error('Failed to load AI usage detail', getErrorMessage(err, 'Unknown error'));
        } finally {
            setAiUsageDetailLoading(false);
        }
    };

    // Loads on mount, when the AI window changes and after a limit update; state is only set after the first await.
    useEffect(() => {
        const fetchMerchants = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;

                const data = await authenticatedRequest<{ merchants: Merchant[]; ai_window?: string }>(`/api/admin/merchants?ai_window=${aiWindow}`, session.access_token);
                setMerchants(data.merchants || []);
            } catch (err) {
                setError(getErrorMessage(err, 'Failed to fetch merchants'));
            } finally {
                setLoading(false);
            }
        };

        void fetchMerchants();
    }, [aiWindow, merchantsReloadKey]);

    if (loading) {
        return (
            <div className="flex flex-col gap-5">
                <h1 className="r-page-title">Merchants</h1>
                <div className="flex flex-col gap-5" role="status" aria-label="Loading merchants">
                    <div className="r-card flex flex-col gap-2" aria-hidden="true">
                        <div className="r-skeleton" style={{ height: 20, width: 160 }} />
                        <div className="r-skeleton" style={{ height: 12 }} />
                        <div className="r-skeleton" style={{ height: 12, width: '66%' }} />
                    </div>
                    <div className="r-skeleton" style={{ height: 384 }} aria-hidden="true" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col gap-5">
                <h1 className="r-page-title">Merchants</h1>
                <div className="r-alert r-alert-error" role="alert">
                    <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                        <h2 className="r-alert-title">An error occurred</h2>
                        <p className="r-alert-body" style={{ marginBottom: 0 }}>{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5">
            <div>
                <h1 className="r-page-title">Merchants</h1>
                <p className="r-page-sub">{`Viewing all ${merchants.length} registered merchants on the platform.`}</p>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-end">
                <div className="flex flex-col gap-1">
                    <p style={{ ...BODY_TEXT, color: 'var(--r-text-muted)' }}>
                        AI usage values below are estimated OpenAI costs aggregated per merchant and model.
                    </p>
                    <p className="r-hint">
                        Open AI Details for per-model and per-feature breakdowns without crowding the table.
                    </p>
                </div>
                <Select
                    label="AI usage window"
                    labelHidden
                    value={aiWindow}
                    onChange={(e) => setAiWindow((e.target.value as 'mtd' | '30d' | '7d') || 'mtd')}
                >
                    <option value="mtd">MTD</option>
                    <option value="30d">Last 30 days</option>
                    <option value="7d">Last 7 days</option>
                </Select>
            </div>

            <div className="flex flex-col gap-3 md:hidden">
                {merchants.map((merchant) => {
                    const shopifyInt = merchant.integrations?.find(i => i.provider === 'shopify');
                    const whatsappInt = merchant.integrations?.find(i => i.provider === 'whatsapp');
                    return (
                        <div key={merchant.id} className="r-card r-card-tight flex flex-col gap-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-3">
                                    <span className="r-kpi-icon" style={ICON_TILE} aria-hidden="true">
                                        <Store className="h-5 w-5 text-zinc-500" />
                                    </span>
                                    <div className="flex min-w-0 flex-col gap-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="r-table-strong">
                                                {merchant.name || 'Unnamed Store'}
                                            </span>
                                            {merchant.is_super_admin && <Badge tone="danger">ADMIN</Badge>}
                                        </div>
                                        <span className="r-hint">
                                            {merchant.id.split('-')[0]}...
                                        </span>
                                    </div>
                                </div>
                                {shopifyInt?.status === 'active' ? (
                                    <Badge tone="success">Active Store</Badge>
                                ) : (
                                    <Badge tone="neutral">Pending Setup</Badge>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                {shopifyInt && <Badge tone={shopifyInt.status === 'active' ? 'success' : 'neutral'}>Shopify</Badge>}
                                {whatsappInt && <Badge tone={whatsappInt.status === 'active' ? 'success' : 'neutral'}>WhatsApp</Badge>}
                                {!shopifyInt && !whatsappInt && <span className="r-hint">No integrations</span>}
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="r-hint">
                                    {merchant.created_at ? format(new Date(merchant.created_at), 'MMM d, yyyy') : 'Unknown'}
                                </span>
                                <span className="font-medium" style={BODY_TEXT}>
                                    ${merchant.settings?.capped_amount || 100}
                                </span>
                            </div>

                            <div className="flex flex-col gap-1.5 rounded-lg p-3" style={{ background: 'var(--r-surface-subtle)' }}>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="r-hint">AI ({aiWindow.toUpperCase()})</span>
                                    <Button variant="ghost" size="sm" onClick={() => openAiUsageDetail(merchant)}>
                                        Details
                                    </Button>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium" style={BODY_TEXT}>
                                        {(merchant.ai_usage_mtd?.total_tokens || 0).toLocaleString()} tok
                                    </span>
                                    <span className="r-hint">
                                        ${(merchant.ai_usage_mtd?.estimated_cost_usd || 0).toFixed(4)}
                                    </span>
                                </div>
                                {merchant.ai_usage_mtd?.top_model && (
                                    <p className="r-hint truncate">
                                        Top model: {merchant.ai_usage_mtd.top_model}
                                    </p>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    disabled={impersonatingMap[merchant.id]}
                                    onClick={() => handleSetLimit(merchant.id, merchant.settings?.capped_amount || 100)}
                                >
                                    Set Limit
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    disabled={impersonatingMap[merchant.id]}
                                    loading={!!impersonatingMap[merchant.id]}
                                    onClick={() => handleImpersonate(merchant.id)}
                                >
                                    {impersonatingMap[merchant.id] ? <Spinner size="sm" variant="default" /> : null}
                                    Login As
                                </Button>
                            </div>
                        </div>
                    );
                })}
                {merchants.length === 0 && (
                    <div className="r-card">
                        <p className="r-hint text-center">No merchants found in the system.</p>
                    </div>
                )}
            </div>

            <div className="hidden md:block">
                <TableWrap>
                    <table className="r-table" aria-label="Merchants">
                        <thead>
                            <tr>
                                <th scope="col">Merchant</th>
                                <th scope="col">Status</th>
                                <th scope="col">Integrations</th>
                                <th scope="col" style={{ textAlign: 'right' }}>Registered</th>
                                <th scope="col" style={{ textAlign: 'right' }}>{`AI (${aiWindow.toUpperCase()})`}</th>
                                <th scope="col" style={{ textAlign: 'right' }}>Limit</th>
                                <th scope="col" style={{ textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {merchants.map((merchant) => {
                                const shopifyInt = merchant.integrations?.find(i => i.provider === 'shopify');
                                const whatsappInt = merchant.integrations?.find(i => i.provider === 'whatsapp');

                                return (
                                    <tr key={merchant.id}>
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <span className="r-kpi-icon" style={ICON_TILE} aria-hidden="true">
                                                    <Store className="h-5 w-5 text-zinc-500" />
                                                </span>
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="r-table-strong">
                                                            {merchant.name || 'Unnamed Store'}
                                                        </span>
                                                        {merchant.is_super_admin && (
                                                            <Badge tone="danger">
                                                                ADMIN
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <span className="r-hint">
                                                        {merchant.id.split('-')[0]}...
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            {shopifyInt?.status === 'active' ? (
                                                <Badge tone="success">
                                                    Active Store
                                                </Badge>
                                            ) : (
                                                <Badge tone="neutral">
                                                    Pending Setup
                                                </Badge>
                                            )}
                                        </td>
                                        <td>
                                            <div className="flex flex-wrap items-center gap-2">
                                                {shopifyInt ? (
                                                    <Badge tone={shopifyInt.status === 'active' ? 'success' : 'neutral'}>
                                                        Shopify
                                                    </Badge>
                                                ) : null}
                                                {whatsappInt ? (
                                                    <Badge tone={whatsappInt.status === 'active' ? 'success' : 'neutral'}>
                                                        WhatsApp
                                                    </Badge>
                                                ) : null}
                                                {(!shopifyInt && !whatsappInt) && (
                                                    <span className="r-hint">No integrations</span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex items-center justify-end gap-1">
                                                <Calendar className="mr-2 h-4 w-4" aria-hidden="true" />
                                                <span className="r-hint">
                                                    {merchant.created_at ? format(new Date(merchant.created_at), 'MMM d, yyyy') : 'Unknown'}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="font-medium" style={BODY_TEXT}>
                                                    {(merchant.ai_usage_mtd?.total_tokens || 0).toLocaleString()} tok
                                                </span>
                                                <div className="flex flex-wrap items-center justify-end gap-1">
                                                    <span className="r-hint">
                                                        ${(merchant.ai_usage_mtd?.estimated_cost_usd || 0).toFixed(4)}
                                                    </span>
                                                    {merchant.ai_usage_mtd?.top_model && (
                                                        <span className="r-hint block min-w-0 max-w-[140px] truncate">
                                                            {merchant.ai_usage_mtd.top_model}
                                                        </span>
                                                    )}
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => openAiUsageDetail(merchant)}
                                                >
                                                    Details
                                                </Button>
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <span className="font-medium" style={BODY_TEXT}>
                                                ${merchant.settings?.capped_amount || 100}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex items-center justify-center gap-2">
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    disabled={impersonatingMap[merchant.id]}
                                                    onClick={() => handleSetLimit(merchant.id, merchant.settings?.capped_amount || 100)}
                                                >
                                                    Set Limit
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    disabled={impersonatingMap[merchant.id]}
                                                    loading={!!impersonatingMap[merchant.id]}
                                                    onClick={() => handleImpersonate(merchant.id)}
                                                >
                                                    {impersonatingMap[merchant.id] ? <Spinner size="sm" variant="default" /> : null}
                                                    Login As
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {merchants.length === 0 && (
                        <div className="p-8">
                            <p className="r-hint text-center">No merchants found in the system.</p>
                        </div>
                    )}
                </TableWrap>
            </div>

            <p className="r-hint">
                Admin actions here are operational tools. Use “Login As” to validate merchant-facing behavior in the real dashboard context.
            </p>

            <Dialog
                open={Boolean(aiUsageModalMerchant)}
                onOpenChange={(open) => { if (!open) { setAiUsageModalMerchant(null); setAiUsageDetail(null); } }}
            >
                <DialogContent className="max-w-2xl" aria-describedby={undefined}>
                    <DialogHeader>
                        <DialogTitle className="pr-8">
                            {`AI Usage Details${aiUsageModalMerchant ? ` · ${aiUsageModalMerchant.name}` : ''}`}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="min-w-0">
                        {aiUsageDetailLoading ? (
                            <p className="r-hint" role="status">Loading AI usage details...</p>
                        ) : aiUsageDetail ? (
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge tone="brand">{aiUsageDetail.ai_window.toUpperCase()}</Badge>
                                    <Badge>{`${aiUsageDetail.summary.total_tokens.toLocaleString()} tokens`}</Badge>
                                    <Badge tone="success">{`$${aiUsageDetail.summary.estimated_cost_usd.toFixed(4)}`}</Badge>
                                </div>

                                <section className="r-card r-card-tight flex flex-col gap-2">
                                    <h3 className="r-card-title">By Model</h3>
                                    {aiUsageDetail.summary.by_model.length === 0 ? (
                                        <p className="r-hint">No AI usage events yet.</p>
                                    ) : aiUsageDetail.summary.by_model.map((m) => (
                                        <div key={m.model} className="flex flex-wrap items-center justify-between gap-3">
                                            <span style={BODY_TEXT}>{m.model}</span>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="r-hint">{m.total_tokens.toLocaleString()} tok</span>
                                                <span className="r-hint">${m.estimated_cost_usd.toFixed(4)}</span>
                                                <Badge>{`${m.count} events`}</Badge>
                                            </div>
                                        </div>
                                    ))}
                                </section>

                                <section className="r-card r-card-tight flex flex-col gap-2">
                                    <h3 className="r-card-title">By Feature</h3>
                                    {aiUsageDetail.summary.by_feature.length === 0 ? (
                                        <p className="r-hint">No feature-level usage yet.</p>
                                    ) : aiUsageDetail.summary.by_feature.map((f) => (
                                        <div key={f.feature} className="flex flex-wrap items-center justify-between gap-3">
                                            <span style={BODY_TEXT}>{f.feature}</span>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="r-hint">{f.total_tokens.toLocaleString()} tok</span>
                                                <span className="r-hint">${f.estimated_cost_usd.toFixed(4)}</span>
                                                <Badge>{`${f.count} events`}</Badge>
                                            </div>
                                        </div>
                                    ))}
                                </section>

                                <section className="r-card r-card-tight flex flex-col gap-2">
                                    <h3 className="r-card-title">Recent Events</h3>
                                    {aiUsageDetail.recent_events.length === 0 ? (
                                        <p className="r-hint">No recent events.</p>
                                    ) : aiUsageDetail.recent_events.map((e) => (
                                        <div key={e.id} className="border-b py-1.5">
                                            <div className="grid gap-1 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                                                <div className="flex flex-col gap-0.5">
                                                    <p style={BODY_TEXT}>{e.feature}</p>
                                                    <p className="r-hint">
                                                        {e.model} · {e.request_kind} · {format(new Date(e.created_at), 'MMM d, HH:mm')}
                                                    </p>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="r-hint">{e.total_tokens.toLocaleString()} tok</span>
                                                    <span className="r-hint">${Number(e.estimated_cost_usd || 0).toFixed(4)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </section>
                            </div>
                        ) : (
                            <p className="r-hint">Select a merchant to view AI usage details.</p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="secondary"
                            onClick={() => { setAiUsageModalMerchant(null); setAiUsageDetail(null); }}
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
