import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { ConnectIcon, CreditCardIcon, SettingsIcon } from "@shopify/polaris-icons";
import { Button, InlineGrid } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { fetchMerchantOverviewFromRequest } from "../platform.server";
import { ActionCard, MetricCard, SectionCard, ShellPage, StatusBadge } from "../components/shell-ui";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return fetchMerchantOverviewFromRequest(request);
};

export default function IntegrationsPage() {
  const data = useLoaderData<typeof loader>();
  const activeCount = data.integrations.filter((integration) =>
    ["active", "connected", "approved"].includes((integration.status || "").toLowerCase()),
  ).length;
  const pendingCount = data.integrations.filter((integration) =>
    ["pending", "trialing"].includes((integration.status || "").toLowerCase()),
  ).length;
  const failedCount = data.integrations.length - activeCount - pendingCount;

  return (
    <ShellPage
      title="Integrations"
      subtitle="Connection health across Shopify and the merchant’s adjacent service stack."
      primaryAction={{ content: "Review billing", url: "/app/billing", icon: CreditCardIcon }}
    >
      <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
        <MetricCard label="Connected" value={activeCount} hint="Integrations in a healthy active state." />
        <MetricCard label="Pending" value={pendingCount} hint="Connections awaiting approval or completion." />
        <MetricCard label="Attention needed" value={failedCount} hint="Broken or inactive providers requiring merchant review." />
        <MetricCard label="Total" value={data.integrations.length} hint="Integration records currently visible." />
      </InlineGrid>

      <SectionCard
        title="Operator guidance"
        subtitle="Connection status should tell the merchant what is healthy and where to go next."
      >
        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          <ActionCard
            title="Billing"
            description="Billing approval should be visible here because it directly gates feature availability."
            status={data.subscription?.status || "inactive"}
            action={{ content: "Open billing", url: "/app/billing", icon: CreditCardIcon }}
          />
          <ActionCard
            title="Settings"
            description="If delivery or bot behavior feels wrong, settings should be the next merchant stop."
            status="info"
            action={{ content: "Open settings", url: "/app/settings", icon: SettingsIcon }}
          />
        </InlineGrid>
      </SectionCard>

      <SectionCard
        title="Live connections"
        subtitle="Each provider should show recency and a plain-language state."
      >
        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          {data.integrations.map((integration) => (
            <ActionCard
              key={integration.id}
              title={integration.provider}
              description={
                integration.updated_at
                  ? `Updated ${new Date(integration.updated_at).toLocaleString()}`
                  : "No update timestamp available."
              }
              status={integration.status}
              action={{ content: "Review dashboard", url: "/app/dashboard", icon: ConnectIcon }}
            />
          ))}
        </InlineGrid>
      </SectionCard>
    </ShellPage>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
