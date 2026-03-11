import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { CartIcon, CatalogIcon, SettingsIcon } from "@shopify/polaris-icons";
import { Button, Card, InlineGrid } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { fetchMerchantOverview } from "../platform.server";
import {
  MetricCard,
  SectionCard,
  ShellPage,
} from "../components/shell-ui";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return fetchMerchantOverview(session.shop);
};

export default function Index() {
  const data = useLoaderData<typeof loader>();
  return (
    <ShellPage
      title="Overview"
      subtitle="Merchant launch status and the fastest route to a usable retention workflow."
      primaryAction={{ content: "Open dashboard", url: "/app/dashboard", icon: CartIcon }}
    >
      <OverviewContent data={data} />
    </ShellPage>
  );
}

function OverviewContent({ data }: { data: Awaited<ReturnType<typeof loader>> }) {
  return (
    <>
      <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
        <MetricCard
          label="Orders"
          value={data.metrics.totalOrders}
          hint="Imported orders currently visible in the platform."
        />
        <MetricCard
          label="Active users"
          value={data.metrics.activeUsers}
          hint="Customers currently eligible for consent-safe engagement."
        />
        <MetricCard
          label="Products"
          value={data.metrics.totalProducts}
          hint="Catalog rows visible for scraping and enrichment."
        />
        <MetricCard
          label="Response rate"
          value={`${data.metrics.responseRate}%`}
          hint="Conversation reply coverage across active buyer threads."
        />
      </InlineGrid>

      <SectionCard
        title="Next actions"
        subtitle="These three areas should be enough for a merchant to move from install to a usable setup."
      >
        <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
          <Card padding="500">
            <Button fullWidth url="/app/products" icon={CatalogIcon} variant="primary">
              Review catalog
            </Button>
          </Card>
          <Card padding="500">
            <Button fullWidth url="/app/billing" icon={CartIcon} variant="primary">
              Check billing
            </Button>
          </Card>
          <Card padding="500">
            <Button fullWidth url="/app/settings" icon={SettingsIcon} variant="primary">
              Tune settings
            </Button>
          </Card>
        </InlineGrid>
      </SectionCard>
    </>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
