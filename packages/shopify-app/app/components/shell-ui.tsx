import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  EmptyState,
  type IconSource,
  InlineGrid,
  InlineStack,
  Layout,
  Page,
  Text,
} from "@shopify/polaris";

export function statusTone(
  status?: string | null,
): "success" | "attention" | "critical" | "info" | undefined {
  const value = (status || "").toLowerCase();
  if (["active", "connected", "approved", "resolved", "positive"].includes(value)) {
    return "success";
  }
  if (["pending", "trialing", "neutral", "ai"].includes(value)) {
    return "attention";
  }
  if (["inactive", "failed", "error", "negative", "human"].includes(value)) {
    return "critical";
  }
  return "info";
}

export function StatusBadge({
  children,
  status,
}: {
  children: string;
  status?: string | null;
}) {
  return <Badge tone={statusTone(status)}>{children}</Badge>;
}

export function ShellPage({
  title,
  subtitle,
  primaryAction,
  children,
}: {
  title: string;
  subtitle: string;
  primaryAction?: {
    content: string;
    url?: string;
    icon?: IconSource;
  };
  children: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <Page
      fullWidth
      title={title}
      subtitle={subtitle}
      primaryAction={
        primaryAction
          ? {
              content: primaryAction.content,
              onAction: primaryAction.url ? () => navigate(primaryAction.url!) : undefined,
              icon: primaryAction.icon as never,
            }
          : undefined
      }
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">{children}</BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export function SectionCard({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card padding="500">
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="start" gap="400">
          <BlockStack gap="100">
            <Text as="h2" variant="headingLg">
              {title}
            </Text>
            {subtitle ? (
              <Box maxWidth="560px">
                <Text as="p" variant="bodyMd" tone="subdued">
                  {subtitle}
                </Text>
              </Box>
            ) : null}
          </BlockStack>
          {badge}
        </InlineStack>
        {children}
      </BlockStack>
    </Card>
  );
}

export function MetricGrid({ children }: { children: ReactNode }) {
  return (
    <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
      {children}
    </InlineGrid>
  );
}

export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint: string;
}) {
  return (
    <Card padding="500">
      <BlockStack gap="200">
        <Text as="p" variant="bodySm" tone="subdued">
          {label}
        </Text>
        <Text as="p" variant="headingLg">
          {value}
        </Text>
        <Box maxWidth="18rem">
          <Text as="p" variant="bodyMd" tone="subdued">
            {hint}
          </Text>
        </Box>
      </BlockStack>
    </Card>
  );
}

export function DetailRows({
  rows,
}: {
  rows: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <BlockStack gap="300">
      {rows.map((row) => (
        <InlineStack key={row.label} align="space-between" gap="400">
          <Text as="span" variant="bodyMd" tone="subdued">
            {row.label}
          </Text>
          <Text as="span" variant="bodyMd" fontWeight="semibold">
            {row.value}
          </Text>
        </InlineStack>
      ))}
    </BlockStack>
  );
}

export function EmptyCard({
  heading,
  description,
  action,
}: {
  heading: string;
  description: string;
  action?: { content: string; url: string };
}) {
  const navigate = useNavigate();
  return (
    <Card padding="500">
      <EmptyState
        heading={heading}
        action={
          action
            ? {
                content: action.content,
                onAction: () => navigate(action.url),
              }
            : undefined
        }
        image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
      >
        <Text as="p" variant="bodyMd" tone="subdued">
          {description}
        </Text>
      </EmptyState>
    </Card>
  );
}

export function ActionCard({
  title,
  description,
  status,
  action,
}: {
  title: string;
  description: string;
  status?: string | null;
  action?: { content: string; url: string; icon?: IconSource };
}) {
  const navigate = useNavigate();
  return (
    <Card padding="500">
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="start" gap="300">
          <Text as="h3" variant="headingLg">
            {title}
          </Text>
          {status ? <StatusBadge status={status}>{status}</StatusBadge> : null}
        </InlineStack>
        <Box maxWidth="24rem">
          <Text as="p" variant="bodyMd" tone="subdued">
            {description}
          </Text>
        </Box>
        {action ? (
          <InlineStack>
            <Button onClick={() => navigate(action.url)} icon={action.icon as never} variant="primary">
              {action.content}
            </Button>
          </InlineStack>
        ) : null}
      </BlockStack>
    </Card>
  );
}
