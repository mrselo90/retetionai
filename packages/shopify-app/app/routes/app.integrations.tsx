import type { HeadersFunction, LoaderFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import { boundary } from '@shopify/shopify-app-react-router/server';
import { ViewIcon } from '@shopify/polaris-icons';
import { Banner, BlockStack, Button, InlineStack, Text } from '@shopify/polaris';
import { authenticateEmbeddedAdmin } from '../lib/embeddedAuth.server';
import {
  fetchMerchantOverviewFromRequest,
  fetchWhatsAppConnection,
  settle,
  type ShopifyMerchantOverview,
  type WhatsAppConnectionStatus,
} from '../platform.server';
import { WhatsAppConnectCard } from '../components/WhatsAppConnectCard';
import { SectionCard, ShellPage, StatusBadge } from '../components/shell-ui';
import { shellSetupProgress, useAppBootstrapData } from './app';

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
  const [result, whatsapp] = await Promise.all([
    settle(fetchMerchantOverviewFromRequest(request), EMPTY_OVERVIEW),
    settle<WhatsAppConnectionStatus | null>(fetchWhatsAppConnection(request), null),
  ]);
  return { ...result.value, overviewUnavailable: !result.ok, whatsapp: whatsapp.value };
};

/**
 * Two connections matter to a store: its WhatsApp number and its Shopify
 * orders. This page used to add four counter cards, an "Operator guidance"
 * section and a provider list written for the Recete team; none of it helped a
 * merchant decide anything, and its "Open dashboard" links led to a locked page
 * during setup.
 */
export default function IntegrationsPage() {
  const { bootstrapData: shellBootstrap } = useAppBootstrapData();
  const data = useLoaderData<typeof loader>();
  const { setupComplete } = shellSetupProgress(data, shellBootstrap);
  const orderCount = data.metrics.totalOrders;
  const shopify = data.integrations.find((integration) => integration.provider === 'shopify');
  const shopifyActive = ['active', 'connected', 'approved'].includes(
    String(shopify?.status || data.integration.status || '').toLowerCase()
  );

  return (
    <ShellPage title="Integrations" subtitle="Your WhatsApp number and your Shopify store.">
      {data.overviewUnavailable ? (
        <Banner tone="warning" title="Couldn't reach Recete">
          <p>What you see below may be out of date. Refresh in a moment.</p>
        </Banner>
      ) : null}

      {/* The store's own number, linked by QR. Nothing reaches customers without it. */}
      <WhatsAppConnectCard initial={data.whatsapp} />

      <SectionCard
        title="Shopify orders"
        subtitle="Recete messages customers after their order is delivered."
        badge={
          <StatusBadge status={shopifyActive ? 'active' : 'pending'}>
            {shopifyActive ? 'Connected' : 'Not connected'}
          </StatusBadge>
        }
      >
        <BlockStack gap="300">
          <Text as="p" variant="bodyMd">
            {orderCount > 0
              ? `${orderCount} order${orderCount === 1 ? '' : 's'} received so far.`
              : 'No orders yet. Recete starts with your next delivered order — nothing else to set up here.'}
          </Text>
          {setupComplete && orderCount > 0 ? (
            <InlineStack>
              <Button url="/app/dashboard" icon={ViewIcon}>
                Open dashboard
              </Button>
            </InlineStack>
          ) : null}
        </BlockStack>
      </SectionCard>
    </ShellPage>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
