import type { HeadersFunction, LoaderFunctionArgs } from 'react-router';
import { redirect, useLoaderData, useNavigate } from 'react-router';
import { boundary } from '@shopify/shopify-app-react-router/server';
import { isPlanKey } from '../services/planDefinitions';
import { SectionCard, ShellPage } from '../components/shell-ui';
import { authenticateEmbeddedAdmin } from '../lib/embeddedAuth.server';

const STARTER_MONTHLY_PLAN = 'starter-monthly';
const GROWTH_MONTHLY_PLAN = 'growth-monthly';
const PRO_MONTHLY_PLAN = 'pro-monthly';

// Yearly plans are only named in types on this page.
type PlanKey =
  | typeof STARTER_MONTHLY_PLAN
  | 'starter-yearly'
  | typeof GROWTH_MONTHLY_PLAN
  | 'growth-yearly'
  | typeof PRO_MONTHLY_PLAN
  | 'pro-yearly';

function getStoreHandle(shop: string) {
  return shop.replace(/\.myshopify\.com$/i, '');
}

function getManagedPricingUrl(shop: string) {
  const storeHandle = getStoreHandle(shop);
  const appHandle = process.env.SHOPIFY_MANAGED_PRICING_APP_HANDLE?.trim() || 'blackeagle';
  return `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;
}

const PLAN_TIERS: ReadonlyArray<{
  tier: string;
  monthly: string;
  yearly: string;
  planKey: PlanKey;
  recommended?: boolean;
  audience: string;
  yearlySavings: string;
  ctaLabel: string;
  features: readonly string[];
}> = [
  {
    tier: 'Starter',
    monthly: '$29/mo',
    yearly: '$290/yr',
    planKey: STARTER_MONTHLY_PLAN,
    audience: 'Best for new or low-volume stores starting post-purchase support.',
    yearlySavings: 'Save $58 with yearly billing (2 months free).',
    ctaLabel: 'Choose Starter plan',
    features: [
      '150 included chats per month',
      'Up to 20 recipes',
      'Your own WhatsApp number',
      'Basic analytics',
    ],
  },
  {
    tier: 'Growth',
    monthly: '$69/mo',
    yearly: '$690/yr',
    planKey: GROWTH_MONTHLY_PLAN,
    recommended: true,
    audience: 'Best for active stores with daily support traffic and regular repeat orders.',
    yearlySavings: 'Save $138 with yearly billing (2 months free).',
    ctaLabel: 'Choose Growth plan',
    features: [
      '1,000 included chats per month',
      'Up to 500 recipes',
      'Your own WhatsApp number',
      'AI vision for product photos',
      'Upsell links in conversations',
    ],
  },
  {
    tier: 'Pro',
    monthly: '$169/mo',
    yearly: '$1,690/yr',
    planKey: PRO_MONTHLY_PLAN,
    audience: 'Best for high-volume operations that need advanced automation and insights.',
    yearlySavings: 'Save $338 with yearly billing (2 months free).',
    ctaLabel: 'Choose Pro plan',
    features: [
      '3,000 included chats per month',
      'Unlimited recipes',
      'Your own WhatsApp number',
      'Advanced analytics',
      'Smart re-order engine',
    ],
  },
] as const;

function extractBillingErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'errorData' in err) {
    const data = (err as { errorData: Array<{ message: string }> }).errorData;
    if (Array.isArray(data) && data.length > 0) {
      return data.map((e) => e.message).join('; ');
    }
  }
  return err instanceof Error ? err.message : 'An unexpected billing error occurred.';
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const url = new URL(request.url);
    const requestedPlan = String(
      url.searchParams.get('plan') || url.searchParams.get('upgradePlan') || ''
    ).trim();
    const { billing, session } = await authenticateEmbeddedAdmin(request);
    // Any active subscription counts. Plans are sold through Shopify Managed
    // Pricing, whose subscription names ("Growth", ...) never matched the
    // "growth-monthly" keys this filtered on, and development stores only get
    // test charges, which isTest:false dropped. Both made a paid plan read as
    // "No plan" right after approval. Real stores cannot hold test charges.
    const billingState = await billing.check({ isTest: true });

    const subscriptions = billingState.appSubscriptions.map((subscription) => ({
      id: subscription.id,
      name: subscription.name,
      status: subscription.status,
      lineItems: subscription.lineItems.length,
    }));

    return {
      hasActivePayment: billingState.hasActivePayment,
      hasDeclinedSubscription: subscriptions.some(
        (s) => s.status === 'DECLINED' || s.status === 'EXPIRED' || s.status === 'CANCELLED'
      ),
      managedPricingUrl: getManagedPricingUrl(session.shop),
      requestedPlan: isPlanKey(requestedPlan) ? requestedPlan : null,
      subscriptions,
      error: null as string | null,
    };
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error('[billing-loader]', err);
    return {
      hasActivePayment: false,
      hasDeclinedSubscription: false,
      managedPricingUrl: null as string | null,
      requestedPlan: null as PlanKey | null,
      subscriptions: [] as Array<{ id: string; name: string; status: string; lineItems: number }>,
      error: extractBillingErrorMessage(err),
    };
  }
};

export const action = async ({ request }: { request: Request }) => {
  const formData = await request.formData();
  const requestedPlan = String(formData.get('plan') || '').trim();

  if (!isPlanKey(requestedPlan)) {
    return Response.json({ ok: false, error: 'Unknown billing plan.' }, { status: 400 });
  }

  throw redirect(`/app/billing?plan=${encodeURIComponent(requestedPlan)}`);
};

export default function BillingPage() {
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const activePlanName = data.subscriptions.find(
    (s) => s.status === 'ACTIVE' || s.status === 'ACCEPTED'
  )?.name;

  return (
    <ShellPage
      title="Billing"
      subtitle="Choose the plan that matches your monthly support volume to activate Recete."
    >
      {data.error ? (
        <s-section>
          <s-paragraph tone="critical">
            Unable to load billing status: {data.error}
          </s-paragraph>
        </s-section>
      ) : null}

      <s-section>
        <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
          <s-text color="subdued">Current Status</s-text>
          <s-badge tone={data.hasActivePayment ? 'success' : 'warning'}>
            {data.hasActivePayment
              ? `Active${activePlanName ? ` · ${activePlanName}` : ''}`
              : 'Free / No Plan'}
          </s-badge>
        </s-grid>
      </s-section>

      {data.hasDeclinedSubscription ? (
        <s-banner tone="critical" heading="Billing requires attention">
          Your previous subscription was declined or expired. Choose a plan below to reactivate
          Recete.
          {data.managedPricingUrl ? (
            <s-button slot="secondary-actions" href={data.managedPricingUrl} target="_top">
              Reactivate billing
            </s-button>
          ) : null}
        </s-banner>
      ) : null}

      <SectionCard
        title="Compare plans"
        subtitle="Pick based on chat volume and feature depth. You will confirm billing inside Shopify on the next screen."
      >
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(240px, 1fr))" gap="base">
          {PLAN_TIERS.map((plan) => {
            const isCurrentTier = activePlanName?.toLowerCase().includes(plan.tier.toLowerCase());
            const planSelectionUrl = data.managedPricingUrl
              ? `${data.managedPricingUrl}?plan=${encodeURIComponent(plan.planKey)}`
              : undefined;
            return (
              <s-box
                key={plan.tier}
                padding="large"
                border="base"
                borderRadius="base"
                background={isCurrentTier ? 'subdued' : 'base'}
              >
                <s-stack gap="base">
                  <s-stack gap="small-200">
                    <s-grid gridTemplateColumns="1fr auto auto" gap="small-200" alignItems="center">
                      <s-heading>{plan.tier}</s-heading>
                      {plan.recommended ? <s-badge tone="success">Recommended</s-badge> : null}
                      {isCurrentTier ? <s-badge tone="info">Current</s-badge> : null}
                    </s-grid>
                    <s-stack direction="inline" gap="small-200" alignItems="center">
                      <s-badge tone="info">{plan.monthly}</s-badge>
                      <s-badge>{plan.yearly}</s-badge>
                    </s-stack>
                    <s-paragraph color="subdued">
                      {plan.audience}
                    </s-paragraph>
                  </s-stack>

                  <s-unordered-list>
                    {plan.features.map((feature) => (
                      <s-list-item key={feature}>{feature}</s-list-item>
                    ))}
                  </s-unordered-list>

                  <s-box background="subdued" padding="small" borderRadius="base">
                    <s-paragraph color="subdued">
                      {plan.yearlySavings}
                    </s-paragraph>
                  </s-box>

                  <s-button
                    variant="primary"
                    inlineSize="fill"
                    disabled={!planSelectionUrl || undefined}
                    href={planSelectionUrl}
                    target="_top"
                  >
                    {plan.ctaLabel}
                  </s-button>
                  <s-paragraph color="subdued">
                    {planSelectionUrl
                      ? 'Redirects to Shopify billing approval.'
                      : 'Billing is temporarily unavailable. Refresh the page or contact support if this continues.'}
                  </s-paragraph>
                </s-stack>
              </s-box>
            );
          })}
        </s-grid>
      </SectionCard>

      <s-section>
        <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
          <s-text color="subdued">Need help choosing the right plan?</s-text>
          <s-button variant="tertiary" onClick={() => navigate('/app/integrations')}>
            Billing support
          </s-button>
        </s-grid>
      </s-section>
    </ShellPage>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
