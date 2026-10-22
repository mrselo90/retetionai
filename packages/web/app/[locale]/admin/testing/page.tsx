'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { Badge, Button, Card, Input, Select, Textarea } from '@/components/recete';
import { FlaskConical, ListChecks, Loader2, MessageSquareReply, PackageCheck, Store } from 'lucide-react';
import { getErrorMessage } from '@/lib/errors';

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

/* Typography roles, built on the design tokens (app/design-tokens.css). */
const BODY = 'text-[length:var(--r-text-base-plus)] text-[color:var(--r-text)]';
const BODY_SUBDUED = 'text-[length:var(--r-text-base-plus)] text-[color:var(--r-text-muted)]';
const BODY_SM = 'text-[length:var(--r-text-sm-plus)] text-[color:var(--r-text-secondary)]';
const HEADING_SM = 'text-[length:var(--r-text-md)] font-semibold text-[color:var(--r-text)]';
const SECTION_ICON = 'h-5 w-5 shrink-0 text-[color:var(--r-text-subtle)]';
const DIVIDER_STYLE = { border: 0, borderTop: '1px solid var(--r-border)', margin: 0 } as const;

type CalloutTone = 'info' | 'success' | 'warning' | 'critical';

const CALLOUT_CLASS: Record<CalloutTone, string> = {
    info: 'r-alert-info',
    success: 'r-alert-success',
    warning: 'r-alert-warning',
    critical: 'r-alert-error',
};

function Callout({
    tone,
    onDismiss,
    children,
}: {
    tone: CalloutTone;
    onDismiss?: () => void;
    children: ReactNode;
}) {
    return (
        <div
            className={`r-alert ${CALLOUT_CLASS[tone]}`}
            role={tone === 'critical' || tone === 'warning' ? 'alert' : 'status'}
        >
            <div className="min-w-0 flex-1 text-[length:var(--r-text-base-plus)]">{children}</div>
            {onDismiss ? (
                <Button size="sm" onClick={onDismiss}>
                    Dismiss
                </Button>
            ) : null}
        </div>
    );
}

function CheckboxField({
    label,
    checked,
    onChange,
    help,
}: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    help?: string;
}) {
    const id = useId();
    const helpId = help ? `${id}-help` : undefined;
    return (
        <div className="flex items-start gap-2">
            <input
                id={id}
                type="checkbox"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
                aria-describedby={helpId}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
                style={{ accentColor: 'var(--r-brand)' }}
            />
            <div className="min-w-0">
                <label htmlFor={id} className={`block cursor-pointer font-medium ${BODY}`}>
                    {label}
                </label>
                {help ? (
                    <p id={helpId} className="r-field-help">
                        {help}
                    </p>
                ) : null}
            </div>
        </div>
    );
}

function SkeletonLines({ lines, label }: { lines: number; label?: string }) {
    return (
        <div
            className="flex flex-col gap-2"
            role={label ? 'status' : undefined}
            aria-label={label}
        >
            {Array.from({ length: lines }, (_, index) => (
                <div
                    key={index}
                    className="r-skeleton"
                    style={{ height: 12, width: index === lines - 1 ? '60%' : '100%' }}
                    aria-hidden="true"
                />
            ))}
        </div>
    );
}

function ButtonSpinner({ loading }: { loading: boolean }) {
    return loading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null;
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
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to load merchants'));
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
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to load Shopify scenarios'));
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
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to load merchant test data'));
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
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to create test order'));
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
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to simulate customer reply'));
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
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to run Shopify scenario suite'));
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
            <div className="flex flex-col gap-4">
                <h1 className="r-page-title">Merchant Test Kit</h1>
                <Card role="status" aria-label="Loading merchant test kit" className="flex flex-col gap-3">
                    <div className="r-skeleton" style={{ height: 18, width: 200 }} aria-hidden="true" />
                    <SkeletonLines lines={3} />
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <header>
                <h1 className="r-page-title">Merchant Test Kit</h1>
                <p className="r-page-sub">
                    Create real test orders, simulate customer replies, and run full Shopify scenario suites from Super Admin.
                </p>
            </header>

            <Callout tone="info">
                <p>
                    This page includes an automated Shopify scenario runner. It creates a delivered test
                    order, reuses the real AI pipeline, and validates scenario assertions for each flow.
                </p>
            </Callout>

            {error ? (
                <Callout tone="critical" onDismiss={() => setError('')}>
                    <p>{error}</p>
                </Callout>
            ) : null}

            <Card className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                    <Store className={SECTION_ICON} aria-hidden="true" />
                    <h2 className="r-card-title">1. Choose merchant</h2>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr]">
                    <Select
                        label="Merchant"
                        value={selectedMerchantId}
                        onChange={(event) => setSelectedMerchantId(event.target.value)}
                    >
                        {merchantOptions.map((option) => (
                            <option key={option.value || 'none'} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </Select>
                    <Select
                        label="Customer locale"
                        value={customerLocale}
                        onChange={(event) => setCustomerLocale(event.target.value)}
                    >
                        <option value="tr">Turkish (tr)</option>
                        <option value="en">English (en)</option>
                        <option value="hu">Hungarian (hu)</option>
                        <option value="de">German (de)</option>
                    </Select>
                </div>

                {merchantLoading ? (
                    <SkeletonLines lines={3} label="Loading merchant test data" />
                ) : merchantData ? (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <Card padding="tight" className="flex flex-col gap-1">
                            <p className="r-hint">Plan</p>
                            <p className={HEADING_SM}>
                                {merchantData.merchant.subscription_plan || 'Unknown'}
                            </p>
                            <div>
                                <Badge tone={merchantData.merchant.subscription_status === 'active' ? 'success' : 'warning'}>
                                    {merchantData.merchant.subscription_status || 'unknown'}
                                </Badge>
                            </div>
                        </Card>
                        <Card padding="tight" className="flex flex-col gap-1">
                            <p className="r-hint">WhatsApp</p>
                            <div className="flex flex-wrap gap-2">
                                <Badge tone={merchantData.whatsapp.configured ? 'success' : 'caution'}>
                                    {merchantData.whatsapp.configured ? 'Configured' : 'Missing config'}
                                </Badge>
                                {merchantData.whatsapp.provider ? (
                                    <Badge>{merchantData.whatsapp.provider}</Badge>
                                ) : null}
                            </div>
                            <p className={BODY_SM}>
                                {merchantData.whatsapp.from || 'No sender resolved yet'}
                            </p>
                        </Card>
                        <Card padding="tight" className="flex flex-col gap-1">
                            <p className="r-hint">Catalog</p>
                            <p className={HEADING_SM}>
                                {merchantData.products.length} products available
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {merchantData.integrations.map((integration) => (
                                    <Badge
                                        key={`${integration.provider}-${integration.status}`}
                                        tone={integration.status === 'active' ? 'success' : 'warning'}
                                    >
                                        {integration.provider}
                                    </Badge>
                                ))}
                            </div>
                        </Card>
                    </div>
                ) : null}
            </Card>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <PackageCheck className={SECTION_ICON} aria-hidden="true" />
                        <h2 className="r-card-title">2. Create delivered order</h2>
                    </div>

                    <Input
                        label="Customer phone"
                        value={customerPhone}
                        onChange={(event) => setCustomerPhone(event.target.value)}
                        autoComplete="tel"
                        help="Use E.164 format for predictable test behavior."
                    />
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <Input
                            label="Customer name"
                            value={customerName}
                            onChange={(event) => setCustomerName(event.target.value)}
                            autoComplete="name"
                        />
                        <Input
                            label="Customer email"
                            value={customerEmail}
                            onChange={(event) => setCustomerEmail(event.target.value)}
                            autoComplete="email"
                        />
                    </div>
                    <CheckboxField
                        label="Mark order as delivered immediately"
                        checked={markDelivered}
                        onChange={setMarkDelivered}
                        help="Triggers delivered-event flow and follow-up scheduling right away."
                    />
                    <div>
                        <Button
                            variant="primary"
                            onClick={createTestOrder}
                            loading={creatingOrder}
                            disabled={!canCreateOrder}
                        >
                            <ButtonSpinner loading={creatingOrder} />
                            Create test order
                        </Button>
                    </div>

                    {orderResult ? (
                        <>
                            <hr style={DIVIDER_STYLE} />
                            <Callout tone="success">
                                <p>
                                    Test order <strong>{orderResult.order.externalOrderId}</strong> is now <strong>{orderResult.order.status}</strong>.
                                </p>
                            </Callout>
                            <div className="flex flex-col gap-1">
                                <p className={BODY_SM}>
                                    Order ID: {orderResult.order.id}
                                </p>
                                <p className={BODY_SM}>
                                    Delivery date: {orderResult.order.deliveryDate || 'Not delivered'}
                                </p>
                                <p className={BODY_SM}>
                                    Follow-up queue: {orderResult.queuedFollowUps ? 'Triggered' : 'Not triggered'}
                                </p>
                            </div>
                        </>
                    ) : null}
                </Card>

                <Card className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <FlaskConical className={SECTION_ICON} aria-hidden="true" />
                        <h2 className="r-card-title">Selected products</h2>
                    </div>
                    <Input
                        label="Filter products"
                        value={productQuery}
                        onChange={(event) => setProductQuery(event.target.value)}
                        autoComplete="off"
                        placeholder="Search by product name or external id"
                    />
                    <div className="max-h-[380px] overflow-y-auto pr-1">
                        <div className="flex flex-col gap-2">
                            {filteredProducts.map((product) => (
                                <Card key={product.id} padding="tight">
                                    <CheckboxField
                                        label={product.name}
                                        checked={selectedProductIds.includes(product.id)}
                                        onChange={(checked) => toggleProduct(product.id, checked)}
                                        help={product.externalId || 'No external id'}
                                    />
                                </Card>
                            ))}
                            {!filteredProducts.length ? (
                                <p className={BODY_SUBDUED}>No products matched the current filter.</p>
                            ) : null}
                        </div>
                    </div>
                </Card>
            </div>

            <Card className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                    <MessageSquareReply className={SECTION_ICON} aria-hidden="true" />
                    <h2 className="r-card-title">3. Simulate customer reply</h2>
                </div>

                <p className={BODY_SUBDUED}>
                    This runs one inbound message through the same AI pipeline used in production.
                    Enable live send only for safe test numbers.
                </p>

                <Textarea
                    label="Inbound customer message"
                    value={replyMessage}
                    onChange={(event) => setReplyMessage(event.target.value)}
                    rows={4}
                    autoComplete="off"
                />
                <CheckboxField
                    label="Send AI reply to customer as a live WhatsApp message"
                    checked={sendReplyLive}
                    onChange={setSendReplyLive}
                    help="Keep disabled for dry-run validation."
                />
                <div>
                    <Button
                        variant="primary"
                        onClick={simulateReply}
                        loading={simulatingReply}
                        disabled={!canSimulateReply}
                    >
                        <ButtonSpinner loading={simulatingReply} />
                        Simulate reply
                    </Button>
                </div>

                {replyResult ? (
                    <>
                        <hr style={DIVIDER_STYLE} />
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <Card padding="tight" className="flex flex-col gap-2">
                                <h3 className={HEADING_SM}>Inbound</h3>
                                <p className={BODY}>{replyResult.inboundMessage}</p>
                                <div className="flex flex-wrap gap-2">
                                    {replyResult.intent ? <Badge>{replyResult.intent}</Badge> : null}
                                    {replyResult.guardrailBlocked ? <Badge tone="danger">Guardrail blocked</Badge> : null}
                                    {replyResult.upsellTriggered ? <Badge tone="success">Upsell triggered</Badge> : null}
                                </div>
                            </Card>
                            <Card padding="tight" className="flex flex-col gap-2">
                                <h3 className={HEADING_SM}>AI reply</h3>
                                <p className={BODY}>{replyResult.aiReply}</p>
                                {replyResult.liveSend ? (
                                    <div>
                                        <Badge tone={replyResult.liveSend.success ? 'success' : 'caution'}>
                                            {replyResult.liveSend.success ? 'Live reply sent' : replyResult.liveSend.error || 'Live send failed'}
                                        </Badge>
                                    </div>
                                ) : null}
                            </Card>
                        </div>
                    </>
                ) : null}
            </Card>

            <Card className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <ListChecks className={SECTION_ICON} aria-hidden="true" />
                        <h2 className="r-card-title">4. Run Shopify scenario suite</h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
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
                            <ButtonSpinner loading={runningScenarios} />
                            {`Run selected (${selectedScenarioIds.length})`}
                        </Button>
                    </div>
                </div>

                <p className={BODY_SUBDUED}>
                    Covers Shopify order lifecycle, conversation intent handling, numeric product
                    selection, routine requests, return and opt-out flows, and multilingual guidance.
                </p>

                {scenariosLoading ? <SkeletonLines lines={4} label="Loading Shopify scenarios" /> : null}

                {!scenariosLoading && scenarioCatalog.length > 0 ? (
                    <div className="max-h-[360px] overflow-y-auto pr-1">
                        <div className="flex flex-col gap-2">
                            {scenarioCatalog.map((scenario) => (
                                <Card key={scenario.id} padding="tight" className="flex flex-col gap-2">
                                    <CheckboxField
                                        label={scenario.title}
                                        checked={selectedScenarioIds.includes(scenario.id)}
                                        onChange={(checked) => toggleScenario(scenario.id, checked)}
                                        help={scenario.description}
                                    />
                                    <div className="flex flex-wrap gap-2">
                                        <Badge>{scenario.feature}</Badge>
                                        <Badge tone="brand">{scenario.id}</Badge>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                ) : null}

                {scenarioRunResult ? (
                    <>
                        <hr style={DIVIDER_STYLE} />
                        <Callout tone={scenarioRunResult.summary.failed === 0 ? 'success' : 'warning'}>
                            <p>
                                Suite completed for <strong>{scenarioRunResult.merchant.name}</strong>:
                                {' '}{scenarioRunResult.summary.passed}/{scenarioRunResult.summary.total} passed,
                                {' '}{scenarioRunResult.summary.failed} failed.
                            </p>
                        </Callout>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <Card padding="tight" className="flex flex-col gap-1">
                                <p className="r-hint">Test order</p>
                                <p className={HEADING_SM}>{scenarioRunResult.order.externalOrderId}</p>
                                <p className={BODY_SM}>{scenarioRunResult.order.status}</p>
                            </Card>
                            <Card padding="tight" className="flex flex-col gap-1">
                                <p className="r-hint">Customer</p>
                                <p className={HEADING_SM}>{scenarioRunResult.user.phone}</p>
                                <p className={BODY_SM}>
                                    {scenarioRunResult.user.name || 'Unnamed test user'}
                                </p>
                            </Card>
                            <Card padding="tight" className="flex flex-col gap-1">
                                <p className="r-hint">Products</p>
                                <p className={HEADING_SM}>{scenarioRunResult.products.length} selected</p>
                            </Card>
                        </div>

                        <div className="flex flex-col gap-3">
                            {scenarioRunResult.results.map((result) => (
                                <Card key={result.id} padding="tight" className="flex flex-col gap-2">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className={HEADING_SM}>{result.title}</h3>
                                            <Badge tone={result.passed ? 'success' : 'danger'}>
                                                {result.passed ? 'Passed' : 'Failed'}
                                            </Badge>
                                            <Badge>{result.intent}</Badge>
                                            {result.guardrailBlocked ? <Badge tone="danger">Guardrail</Badge> : null}
                                            {result.upsellTriggered ? <Badge tone="success">Upsell</Badge> : null}
                                        </div>
                                        <Badge tone="brand">{result.feature}</Badge>
                                    </div>
                                    <p className="r-hint">Inbound: {result.inboundMessage}</p>
                                    <p className={BODY}>{result.aiReply}</p>
                                    <div className="flex flex-col gap-1">
                                        {result.assertions.map((assertion) => (
                                            <div key={`${result.id}-${assertion.id}`} className="flex items-start gap-2">
                                                <Badge tone={assertion.passed ? 'success' : 'danger'}>
                                                    {assertion.passed ? 'PASS' : 'FAIL'}
                                                </Badge>
                                                <p className={BODY_SM}>{assertion.message}</p>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </>
                ) : null}
            </Card>
        </div>
    );
}
