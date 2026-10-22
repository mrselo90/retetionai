import type { HeadersFunction, LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import { boundary } from '@shopify/shopify-app-react-router/server';
import { authenticateEmbeddedAdmin } from '../lib/embeddedAuth.server';
import { shellSetupProgress, useAppBootstrapData } from './app';
import {
  extractPlatformErrorMessage,
  fetchMerchantCustomers,
  fetchMerchantOverviewFromRequest,
  settle,
  type ShopifyMerchantOverview,
} from '../platform.server';
import {
  ActionCard,
  AppPage,
  EmptyCard,
  MetricCard,
  MetricGrid,
  SectionCard,
  SetupDependencyList,
  type SetupDependencyItem,
  ShellPage,
  StatePanel,
  ValuePreview,
} from '../components/shell-ui';

const EMPTY_OVERVIEW: ShopifyMerchantOverview = {
  merchant: { id: '', name: '' },
  shop: '',
  integration: { id: '', provider: 'shopify', status: 'unknown' },
  subscription: null,
  metrics: { totalOrders: 0, activeUsers: 0, totalProducts: 0, responseRate: 0 },
  analytics: {
    avgSentiment: 0,
    returnRate: 0,
    preventedReturns: 0,
    totalConversations: 0,
    resolvedConversations: 0,
  },
  settings: {},
  integrations: [],
  products: [],
  recentOrders: [],
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticateEmbeddedAdmin(request);

  const overviewResult = await settle(fetchMerchantOverviewFromRequest(request), EMPTY_OVERVIEW);
  const overview = overviewResult.value;
  const overviewUnavailable = !overviewResult.ok;

  try {
    const customerData = await fetchMerchantCustomers(request, { page: 1, limit: 20 });
    return {
      overview,
      overviewUnavailable,
      ...customerData,
    };
  } catch (error) {
    return {
      overview,
      overviewUnavailable,
      customers: [],
      total: 0,
      page: 1,
      limit: 20,
      unavailableReason: await extractPlatformErrorMessage(error, 'Customer data is unavailable.'),
    };
  }
};

export default function CustomersPage() {
  const { bootstrapData: shellBootstrap } = useAppBootstrapData();
  const data = useLoaderData<typeof loader>();
  const customers = data.customers || [];
  const sortedCustomers = [...customers].sort(
    (left, right) =>
      (right.churnProbability || 0) - (left.churnProbability || 0) ||
      (right.conversationCount || 0) - (left.conversationCount || 0)
  );
  const unavailableReason =
    'unavailableReason' in data
      ? ((data as Record<string, unknown>).unavailableReason as string | undefined)
      : undefined;
  const highRiskCustomers = sortedCustomers.filter((item) => (item.churnProbability || 0) >= 0.6);
  const highRiskCount = highRiskCustomers.length;
  const engagedCustomers = sortedCustomers.filter((item) => (item.conversationCount || 0) > 0);
  const engagedCount = engagedCustomers.length;

  // A platform outage zeroes the overview, which getSetupProgress reads as
  // "onboarding incomplete" — without this, a fully onboarded merchant would
  // see the setup checklist here instead of their real customer data.
  if (data.overviewUnavailable) {
    return (
      <AppPage heading="Customers">
        <s-banner tone="warning" heading="Couldn't reach Recete">
          <s-paragraph>
            We couldn&apos;t load your customer data right now. This isn&apos;t your real setup or
            activity status — refresh in a moment.
          </s-paragraph>
        </s-banner>
      </AppPage>
    );
  }

  const progress = shellSetupProgress(data.overview, shellBootstrap);
  const hasBilling = progress.hasBilling;
  const hasProducts = progress.hasProducts;
  const hasMessagingConfigured = progress.hasMessagingConfigured;
  const hasOrders = progress.hasOrders;
  const setupReady = hasBilling && hasProducts && hasMessagingConfigured;

  const uiState: 'onboarding_incomplete' | 'ready_no_data' | 'has_data' =
    customers.length > 0 ? 'has_data' : setupReady ? 'ready_no_data' : 'onboarding_incomplete';

  const primaryCta =
    uiState === 'has_data'
      ? {
          content: highRiskCount > 0 ? 'Review at-risk customers' : 'Open conversations',
          url: '/app/conversations',
        }
      : !hasBilling
        ? { content: 'Activate plan', url: '/app/billing' }
        : !hasProducts
          ? { content: 'Add products', url: '/app/products' }
          : !hasMessagingConfigured
            ? { content: 'Configure messaging', url: '/app/setup/messaging' }
            : { content: 'Check order flow', url: '/app/integrations#orders-flow' };

  const setupDependencies: SetupDependencyItem[] = [
    {
      label: 'Plan activation',
      state: hasBilling ? 'completed' : 'current',
      hint: hasBilling ? 'Billing approved.' : 'Activate your plan to continue setup.',
    },
    {
      label: 'Product sync',
      state: hasProducts ? 'completed' : hasBilling ? 'current' : 'locked',
      hint: hasProducts
        ? 'Products are available.'
        : hasBilling
          ? 'Add products to unlock customer intelligence.'
          : 'Available after plan activation.',
    },
    {
      label: 'Messaging setup',
      state: hasMessagingConfigured
        ? 'completed'
        : hasBilling && hasProducts
          ? 'current'
          : 'locked',
      hint: hasMessagingConfigured
        ? 'Messaging is configured.'
        : hasBilling && hasProducts
          ? 'Configure WhatsApp/bot settings.'
          : 'Available after product sync.',
    },
    {
      label: 'First order',
      state: hasOrders ? 'completed' : setupReady ? 'current' : 'locked',
      hint: hasOrders
        ? 'Order flow started.'
        : setupReady
          ? 'Waiting for first order to generate customer records.'
          : 'Available after messaging setup.',
    },
    {
      label: 'Conversations',
      state: customers.length > 0 ? 'completed' : hasOrders ? 'current' : 'locked',
      hint:
        customers.length > 0
          ? 'Customer intelligence is active.'
          : hasOrders
            ? 'Waiting for first conversation signals.'
            : 'Available after first order.',
    },
  ];

  return (
    <ShellPage
      title="Customers"
      subtitle={
        uiState === 'onboarding_incomplete'
          ? 'This section unlocks after setup milestones are complete.'
          : uiState === 'ready_no_data'
            ? 'Setup is complete. Customer insights will appear after first activity.'
            : 'Customer health, segment visibility, and churn risk inside Shopify Admin.'
      }
      primaryAction={primaryCta}
    >
      <s-banner tone="info">
        <s-paragraph>
          Customer insights shown here (churn risk, segments, conversation history) are derived from
          WhatsApp post-purchase conversations handled by Recete — not collected via Shopify&apos;s
          storefront or checkout. No customer data is modified in your Shopify admin.
        </s-paragraph>
      </s-banner>

      {uiState === 'onboarding_incomplete' ? (
        <>
          <StatePanel
            title="This section is not available yet because setup is incomplete"
            description="Complete setup to unlock customer insights and analytics. Recete needs billing, products, messaging, and first order activity first."
            tone="attention"
            statusLabel="In progress"
          />

          <SectionCard
            title="Setup dependencies"
            subtitle="Follow this order to unlock customer intelligence."
          >
            <SetupDependencyList items={setupDependencies} />
          </SectionCard>

          <SectionCard
            title="What will appear here after setup"
            subtitle="Preview of the value you unlock once live data starts flowing."
          >
            <ValuePreview
              items={[
                {
                  title: 'Customer segments',
                  description: 'Identify at-risk buyers and engaged customers automatically.',
                },
                {
                  title: 'Conversation insights',
                  description: 'Understand engagement quality from real buyer conversations.',
                },
                {
                  title: 'Retention opportunities',
                  description: 'Prioritize churn-prevention actions early.',
                },
              ]}
            />
          </SectionCard>
        </>
      ) : null}

      {uiState === 'ready_no_data' ? (
        <>
          <StatePanel
            title={
              unavailableReason
                ? 'Customer data is temporarily unavailable'
                : 'Setup complete. Waiting for first customer data'
            }
            description={
              unavailableReason
                ? 'Customer analytics will load automatically once connectivity is restored.'
                : 'No customer records yet because no order and conversation signals exist. This workspace will update automatically after first activity.'
            }
            tone={unavailableReason ? 'attention' : 'info'}
            statusLabel="Ready"
          />

          <SectionCard
            title="What to do now"
            subtitle="The system is ready. Trigger first live data to activate customer insights."
          >
            <s-stack gap="small-200">
              <s-paragraph>
                Create a test order in Shopify to generate the first customer record.
              </s-paragraph>
              <s-paragraph>
                Start a conversation to unlock churn risk and engagement segments.
              </s-paragraph>
            </s-stack>
          </SectionCard>

          <SectionCard
            title="Preview after first data"
            subtitle="These sections will fill automatically."
          >
            <MetricGrid>
              <MetricCard
                label="Visible customers"
                value="—"
                hint="Will appear after first order sync."
              />
              <MetricCard
                label="At risk"
                value="—"
                hint="Will appear after conversation signals exist."
              />
              <MetricCard
                label="Engaged"
                value="—"
                hint="Will appear after active conversation history."
              />
              <MetricCard
                label="Segments"
                value="—"
                hint="Will appear when customer profiles are scored."
              />
            </MetricGrid>
          </SectionCard>
        </>
      ) : null}

      {uiState === 'has_data' ? (
        <>
          <StatePanel
            title={
              unavailableReason
                ? 'Customer health is temporarily unavailable'
                : highRiskCount > 0
                  ? 'High-risk buyers need review'
                  : 'Customer board looks healthy'
            }
            description={
              unavailableReason
                ? 'Risk and segment decisions should wait until the latest customer data loads.'
                : highRiskCount > 0
                  ? `${highRiskCount} customer${highRiskCount === 1 ? '' : 's'} currently show elevated churn risk.`
                  : 'Use this screen to prioritize retention actions and monitor customer health.'
            }
            tone={unavailableReason || highRiskCount > 0 ? 'attention' : 'success'}
            statusLabel="Live"
          />

          <MetricGrid>
            <MetricCard
              label="Visible customers"
              value={data.total || customers.length}
              hint="Buyer records visible in the current shell batch."
            />
            <MetricCard
              label="At risk"
              value={highRiskCount}
              hint="Customers with high churn probability."
            />
            <MetricCard
              label="Engaged"
              value={engagedCount}
              hint="Customers with active conversation history."
            />
            <MetricCard
              label="Page size"
              value={data.limit || 20}
              hint="Customer records loaded for the current shell view."
            />
          </MetricGrid>

          <SectionCard
            title="Recommended customer actions"
            subtitle="Prioritize action queues with the strongest expected impact."
          >
            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
              <ActionCard
                title="At-risk buyers"
                description={
                  highRiskCustomers.length > 0
                    ? `${highRiskCustomers.length} customer${highRiskCustomers.length === 1 ? '' : 's'} currently need retention review.`
                    : 'No customer currently crosses the high-risk threshold.'
                }
                status={highRiskCustomers.length > 0 ? 'failed' : 'active'}
                action={{
                  content:
                    highRiskCustomers.length > 0
                      ? 'Review risky conversations'
                      : 'Open conversations',
                  url: '/app/conversations',
                }}
              />
              <ActionCard
                title="Engaged buyers"
                description={
                  engagedCustomers.length > 0
                    ? `${engagedCustomers.length} customer${engagedCustomers.length === 1 ? '' : 's'} already have conversation history.`
                    : 'No conversation-linked customers are visible yet.'
                }
                status={engagedCustomers.length > 0 ? 'active' : 'pending'}
                action={{
                  content: 'Inspect conversation health',
                  url: '/app/conversations',
                }}
              />
            </s-grid>
          </SectionCard>

          <SectionCard
            title="High-risk customers"
            subtitle="Prioritize buyers with the strongest churn signals first."
          >
            {highRiskCustomers.length > 0 ? (
              <s-grid gridTemplateColumns="repeat(auto-fit, minmax(260px, 1fr))" gap="base">
                {highRiskCustomers.map((customer) => (
                  <ActionCard
                    key={customer.id}
                    title={customer.name}
                    description={`${customer.phone} · ${customer.orderCount} orders · ${(customer.churnProbability || 0).toFixed(2)} churn risk`}
                    status="failed"
                    action={{
                      content: 'Review buyer thread',
                      url: '/app/conversations',
                    }}
                  />
                ))}
              </s-grid>
            ) : (
              <EmptyCard
                heading="No high-risk customers"
                description="No urgent retention queue right now. Continue monitoring conversation health."
                action={{ content: 'Open conversations', url: '/app/conversations' }}
              />
            )}
          </SectionCard>

          <SectionCard
            title="Customer board"
            subtitle="Segments and risk should be legible enough for daily decisions."
          >
            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(260px, 1fr))" gap="base">
              {sortedCustomers.map((customer) => (
                <ActionCard
                  key={customer.id}
                  title={customer.name}
                  description={`${customer.phone} · ${customer.orderCount} orders · ${customer.conversationCount} conversations · Segment ${customer.segment || 'new'}`}
                  status={
                    (customer.churnProbability || 0) >= 0.6 ? 'failed' : customer.segment || 'info'
                  }
                  action={{
                    content:
                      (customer.churnProbability || 0) >= 0.6
                        ? 'Review buyer thread'
                        : 'View conversation context',
                    url: '/app/conversations',
                  }}
                />
              ))}
            </s-grid>
          </SectionCard>
        </>
      ) : null}
    </ShellPage>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
