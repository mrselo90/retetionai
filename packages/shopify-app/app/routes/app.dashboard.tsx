import type { HeadersFunction, LoaderFunctionArgs } from 'react-router';
import { useLoaderData, useNavigate } from 'react-router';
import { boundary } from '@shopify/shopify-app-react-router/server';
import { authenticateEmbeddedAdmin } from '../lib/embeddedAuth.server';
import { shellSetupProgress, useAppBootstrapData } from './app';
import { fetchMerchantConversations } from '../platform.server';
import {
  fetchMerchantImpact,
  fetchMerchantOverviewFromRequest,
  settle,
  type MerchantImpact,
  type ShopifyMerchantOverview,
} from '../platform.server';
import { AppPage, MetricCard, MetricGrid, SectionCard } from '../components/shell-ui';

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

const IMPACT_WINDOWS = [7, 30, 90];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticateEmbeddedAdmin(request);
  const requestedDays = Number(new URL(request.url).searchParams.get('days'));
  const days = IMPACT_WINDOWS.includes(requestedDays) ? requestedDays : 30;
  const [overviewResult, conversationsResult, impact] = await Promise.all([
    settle(fetchMerchantOverviewFromRequest(request), EMPTY_OVERVIEW),
    fetchMerchantConversations(request).catch(() => ({ conversations: [] })),
    fetchMerchantImpact(request, days).catch(() => null),
  ]);

  return {
    overview: overviewResult.value,
    overviewUnavailable: !overviewResult.ok,
    conversations: conversationsResult.conversations || [],
    days,
    impact,
  };
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function impactTiles(impact: MerchantImpact) {
  const { replies, returns, consent, reorders, postPurchase } = impact;
  const checkins = Object.entries(postPurchase.byType)
    .filter(([type]) => type.startsWith('checkin'))
    .reduce((sum, [, n]) => sum + n, 0);
  const welcome = postPurchase.byType.welcome || 0;
  return [
    {
      label: 'Questions answered by AI',
      value: replies.answeredByAi,
      hint: [
        plural(replies.customerMessages, 'customer message'),
        replies.read > 0 ? `${replies.read} answers read` : null,
        replies.fallbacks > 0 ? `${replies.fallbacks} left for your team` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    },
    {
      label: 'Handed to your team',
      value: impact.handoffs,
      hint: 'Conversations the AI passed to you.',
    },
    {
      label: 'Post-purchase messages',
      value: postPurchase.sent,
      hint:
        postPurchase.sent > 0
          ? `${welcome} welcome · ${plural(checkins, 'check-in')}`
          : 'Sent after delivery to opted-in customers.',
    },
    {
      label: 'Return requests',
      value: returns.requests,
      hint: `${returns.handedToTeam} handed to your team · ${returns.laterReturned} returned`,
    },
    {
      label: 'New opt-ins',
      value: consent.optIns,
      hint: `${consent.optOuts} opted out`,
    },
    {
      label: 'Ordered again after a message',
      value: reorders.afterMessage,
      hint: `Of ${plural(reorders.repeatBuyers, 'customer')} who ordered again.`,
    },
  ];
}

export default function DashboardPage() {
  const { bootstrapData: shellBootstrap } = useAppBootstrapData();
  const {
    overview: data,
    overviewUnavailable,
    conversations,
    days,
    impact,
  } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const progress = shellSetupProgress(data, shellBootstrap);
  const { setupComplete } = progress;

  // A platform outage zeroes the overview, which getSetupProgress reads as
  // "setup not finished" — without this, a fully onboarded merchant would see
  // the setup wizard again during an outage, not their real dashboard.
  if (overviewUnavailable) {
    return (
      <AppPage heading="Dashboard">
        <s-banner tone="warning" heading="Couldn't reach Recete">
          <s-paragraph>
            We couldn&apos;t load your dashboard data right now. This isn&apos;t your real setup or
            activity status — refresh in a moment.
          </s-paragraph>
        </s-banner>
      </AppPage>
    );
  }

  const manualQueue = conversations.filter((c) => c.conversationStatus === 'human');
  const humanCount = manualQueue.length;
  const aiCount = conversations.filter((c) => c.conversationStatus === 'ai').length;
  const resolvedCount = conversations.filter((c) => c.conversationStatus === 'resolved').length;

  const responseValue = data.metrics.responseRate > 0 ? `${data.metrics.responseRate}%` : '—';

  if (!setupComplete) {
    // One call to action on this page: the setup banner above it already says
    // "Next: <step>". The page used to add "Continue setup" and "Back to setup"
    // on top of that, three buttons for one destination.
    const remaining = progress.totalSteps - progress.completedCount;
    return (
      <AppPage heading="Dashboard">
        <s-section>
          <s-stack gap="small-200">
            <s-heading>Finish setup to open the dashboard</s-heading>
            <s-paragraph color="subdued">
              {`Dashboard, Conversations and Analytics open once setup is done. ${remaining} of ${progress.totalSteps} steps left.`}
            </s-paragraph>
          </s-stack>
        </s-section>
      </AppPage>
    );
  }

  return (
    <AppPage
      heading="Dashboard"
      subtitle="Daily view of Recete activity."
      primaryAction={
        humanCount > 0
          ? {
              content: `Handle ${humanCount} escalation${humanCount === 1 ? '' : 's'}`,
              url: `/app/conversations/${manualQueue[0].id}`,
            }
          : { content: 'View conversations', url: '/app/conversations' }
      }
    >
      {/* ── Escalation alert ────────────────────────────────────────── */}
      {humanCount > 0 ? (
        <s-banner
          heading={`${humanCount} conversation${humanCount === 1 ? '' : 's'} need${humanCount === 1 ? 's' : ''} your attention`}
          tone="warning"
        >
          <s-paragraph>These threads have been escalated to human review.</s-paragraph>
          <s-button
            slot="secondary-actions"
            onClick={() => navigate(`/app/conversations/${manualQueue[0].id}`)}
          >
            Handle next
          </s-button>
        </s-banner>
      ) : null}

      {/* ── Key metrics ─────────────────────────────────────────────── */}
      <MetricGrid>
        <MetricCard
          label="Orders"
          value={data.metrics.totalOrders}
          hint={data.metrics.totalOrders > 0 ? 'Orders tracked by Recete.' : 'No orders yet.'}
        />
        <MetricCard
          label="Opted-in customers"
          value={data.metrics.activeUsers}
          hint={
            data.metrics.activeUsers > 0
              ? 'Customers ready for messaging.'
              : 'No consented customers yet.'
          }
        />
        <MetricCard
          label="Reply rate"
          value={responseValue}
          hint={
            data.metrics.responseRate > 0
              ? 'Replies vs. total buyer threads.'
              : 'Not available yet.'
          }
        />
        <MetricCard
          label="Conversations"
          value={conversations.length}
          hint={
            humanCount > 0
              ? `${humanCount} need${humanCount === 1 ? 's' : ''} manual attention.`
              : aiCount > 0
                ? `${aiCount} AI-owned, ${resolvedCount} resolved.`
                : 'No conversations yet.'
          }
        />
      </MetricGrid>

      {/* ── Impact ──────────────────────────────────────────────────── */}
      <SectionCard
        title="Impact"
        subtitle={`What Recete did in the last ${days} days. These are counts, not proof that Recete caused them: there is no comparison group yet.`}
      >
        <s-stack gap="base">
          <s-stack direction="inline" gap="small-200">
            {IMPACT_WINDOWS.map((window) => (
              <s-button
                key={window}
                variant={window === days ? 'primary' : 'secondary'}
                onClick={() => navigate(`?days=${window}`)}
              >
                {`${window} days`}
              </s-button>
            ))}
          </s-stack>
          {impact ? (
            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap="base">
              {impactTiles(impact).map((tile) => (
                <s-box key={tile.label} padding="base" borderRadius="base" background="subdued">
                  <s-stack gap="small-300">
                    <s-text color="subdued">{tile.label}</s-text>
                    <s-heading>{tile.value}</s-heading>
                    <s-text color="subdued">{tile.hint}</s-text>
                  </s-stack>
                </s-box>
              ))}
            </s-grid>
          ) : (
            <s-paragraph color="subdued">Impact numbers couldn&apos;t load. Refresh in a moment.</s-paragraph>
          )}
        </s-stack>
      </SectionCard>

      {/* ── Conversation queue ──────────────────────────────────────── */}
      {conversations.length > 0 ? (
        <SectionCard title="Conversation queue" subtitle="Live status across all buyer threads.">
          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(160px, 1fr))" gap="base">
            {[
              // s-box has no caution surface; "strong" keeps a pending manual
              // queue visually distinct from the other tiles.
              { label: 'Manual queue', count: humanCount, emphasis: humanCount > 0 },
              { label: 'AI-owned', count: aiCount, emphasis: false },
              { label: 'Resolved', count: resolvedCount, emphasis: false },
            ].map((tile) => (
              <s-box
                key={tile.label}
                padding="base"
                borderRadius="base"
                background={tile.emphasis ? 'strong' : 'subdued'}
              >
                <s-stack gap="small-300">
                  <s-heading>{tile.count}</s-heading>
                  <s-text color="subdued">{tile.label}</s-text>
                </s-stack>
              </s-box>
            ))}
          </s-grid>
        </SectionCard>
      ) : null}

      {/* ── Recent orders ────────────────────────────────────────────── */}
      <SectionCard title="Recent orders" subtitle="Latest order events seen by Recete.">
        {data.recentOrders.length > 0 ? (
          <s-stack gap="none">
            {data.recentOrders.slice(0, 8).map((order, index) => (
              <s-box key={order.id}>
                {index > 0 ? <s-divider /> : null}
                <s-grid
                  gridTemplateColumns="1fr auto"
                  gap="base"
                  alignItems="center"
                  paddingBlock="small"
                >
                  <s-stack gap="none">
                    <s-text type="strong">{order.external_order_id || order.id}</s-text>
                    <s-text color="subdued">
                      {new Intl.DateTimeFormat('en', {
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(new Date(order.created_at))}
                    </s-text>
                  </s-stack>
                  <s-badge
                    tone={
                      order.status === 'delivered'
                        ? 'success'
                        : order.status === 'created'
                          ? 'info'
                          : 'warning'
                    }
                  >
                    {order.status}
                  </s-badge>
                </s-grid>
              </s-box>
            ))}
          </s-stack>
        ) : (
          <s-paragraph color="subdued">
            No orders visible yet. Once orders flow through Recete, they appear here.
          </s-paragraph>
        )}
      </SectionCard>
    </AppPage>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
