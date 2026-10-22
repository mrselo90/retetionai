import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  EmptyState,
  InlineGrid,
  InlineStack,
  type IconSource,
  Text,
} from '@shopify/polaris';

export function statusTone(
  status?: string | null
): 'success' | 'attention' | 'critical' | 'info' | undefined {
  const value = (status || '').toLowerCase();
  if (['active', 'connected', 'approved', 'resolved', 'positive'].includes(value)) {
    return 'success';
  }
  if (['pending', 'trialing', 'neutral', 'ai'].includes(value)) {
    return 'attention';
  }
  if (['inactive', 'failed', 'error', 'negative', 'human'].includes(value)) {
    return 'critical';
  }
  return 'info';
}

export function StatusBadge({ children, status }: { children: string; status?: string | null }) {
  return <Badge tone={statusTone(status)}>{children}</Badge>;
}

export interface PageAction {
  content: string;
  url?: string;
  onAction?: () => void;
  loading?: boolean;
  disabled?: boolean;
}

/**
 * Page shell on Polaris web components. `s-page` hands its heading, back link
 * and actions to the Shopify admin title bar; Polaris React's `Page` could only
 * draw them inside the iframe. `s-page` has no subtitle, so it opens the content.
 * Children can still be Polaris React while routes migrate.
 */
export function AppPage({
  heading,
  subtitle,
  primaryAction,
  secondaryActions,
  backAction,
  inlineSize = 'base',
  children,
}: {
  heading: string;
  subtitle?: ReactNode;
  primaryAction?: PageAction;
  secondaryActions?: PageAction[];
  backAction?: { content: string; url: string };
  inlineSize?: 'small' | 'base' | 'large';
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const run = (action: PageAction) => {
    if (action.onAction) action.onAction();
    else if (action.url) navigate(action.url);
  };

  return (
    <s-page heading={heading} inlineSize={inlineSize}>
      {backAction ? (
        <s-link
          slot="breadcrumb-actions"
          href={backAction.url}
          onClick={(event) => {
            event.preventDefault();
            navigate(backAction.url);
          }}
        >
          {backAction.content}
        </s-link>
      ) : null}
      {primaryAction ? (
        <s-button
          slot="primary-action"
          variant="primary"
          loading={primaryAction.loading}
          disabled={primaryAction.disabled}
          onClick={() => run(primaryAction)}
        >
          {primaryAction.content}
        </s-button>
      ) : null}
      {secondaryActions?.map((action) => (
        <s-button
          key={action.content}
          slot="secondary-actions"
          loading={action.loading}
          disabled={action.disabled}
          onClick={() => run(action)}
        >
          {action.content}
        </s-button>
      ))}
      <BlockStack gap="500">
        {typeof subtitle === 'string' ? (
          <Text as="p" tone="subdued">
            {subtitle}
          </Text>
        ) : (
          subtitle
        )}
        {children}
      </BlockStack>
    </s-page>
  );
}

export function ShellPage({
  title,
  subtitle,
  primaryAction,
  children,
}: {
  title: string;
  subtitle: string;
  primaryAction?: { content: string; url?: string };
  children: ReactNode;
}) {
  return (
    <AppPage heading={title} subtitle={subtitle} primaryAction={primaryAction} inlineSize="large">
      {children}
    </AppPage>
  );
}

export function SectionCard({
  id,
  title,
  subtitle,
  badge,
  children,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box id={id}>
      <Card padding="400" roundedAbove="sm">
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="start" gap="400">
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd">
                {title}
              </Text>
              {subtitle ? (
                <Box maxWidth="36rem">
                  <Text as="p" variant="bodySm">
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
    </Box>
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
    <Card padding="400" roundedAbove="sm">
      <BlockStack gap="200">
        <Text as="p" variant="bodySm" tone="subdued">
          {label}
        </Text>
        <Text as="p" variant="headingLg">
          {value}
        </Text>
        <Box maxWidth="18rem">
          <Text as="p" variant="bodySm">
            {hint}
          </Text>
        </Box>
      </BlockStack>
    </Card>
  );
}

export function DetailRows({ rows }: { rows: Array<{ label: string; value: ReactNode }> }) {
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
    <Card padding="400" roundedAbove="sm">
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="start" gap="300">
          <Text as="h3" variant="headingMd">
            {title}
          </Text>
          {status ? <StatusBadge status={status}>{status}</StatusBadge> : null}
        </InlineStack>
        <Box maxWidth="24rem">
          <Text as="p" variant="bodySm">
            {description}
          </Text>
        </Box>
        {action ? (
          <InlineStack>
            <Button
              onClick={() => navigate(action.url)}
              icon={action.icon as never}
              variant="tertiary"
            >
              {action.content}
            </Button>
          </InlineStack>
        ) : null}
      </BlockStack>
    </Card>
  );
}

export function StatePanel({
  title,
  description,
  tone = 'info',
  statusLabel,
  action,
}: {
  title: string;
  description: string;
  tone?: 'success' | 'attention' | 'critical' | 'info';
  statusLabel?: string;
  action?: { content: string; url: string; icon?: IconSource };
}) {
  const navigate = useNavigate();
  return (
    <Card padding="500" roundedAbove="sm">
      <BlockStack gap="200">
        <Text as="p" variant="bodySm" tone="subdued">
          {statusLabel
            ? statusLabel
            : tone === 'critical'
              ? 'Needs attention'
              : tone === 'attention'
                ? 'In progress'
                : tone === 'success'
                  ? 'Healthy'
                  : 'Overview'}
        </Text>
        <InlineStack align="space-between" blockAlign="end" gap="300" wrap>
          <Box maxWidth="42rem">
            <BlockStack gap="150">
              <Text as="h2" variant="headingLg">
                {title}
              </Text>
              <Text as="p" variant="bodyMd">
                {description}
              </Text>
            </BlockStack>
          </Box>
          {action ? (
            <Button
              onClick={() => navigate(action.url)}
              icon={action.icon as never}
              variant="primary"
            >
              {action.content}
            </Button>
          ) : null}
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

export type SetupDependencyItem = {
  label: string;
  state: 'completed' | 'current' | 'locked';
  hint: string;
};

export function SetupDependencyList({ items }: { items: SetupDependencyItem[] }) {
  return (
    <BlockStack gap="200">
      {items.map((item) => (
        <InlineStack key={item.label} align="space-between" blockAlign="start" gap="400">
          <Text as="p" variant="bodyMd">
            {item.label}
          </Text>
          <BlockStack gap="100" inlineAlign="end">
            <Text as="p" variant="bodySm" fontWeight="semibold">
              {item.state === 'completed'
                ? 'Completed'
                : item.state === 'current'
                  ? 'Current step'
                  : 'Locked'}
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              {item.hint}
            </Text>
          </BlockStack>
        </InlineStack>
      ))}
    </BlockStack>
  );
}

export function ValuePreview({ items }: { items: Array<{ title: string; description: string }> }) {
  return (
    <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
      {items.map((item) => (
        <Card key={item.title} padding="400" roundedAbove="sm">
          <BlockStack gap="200">
            <Text as="h3" variant="headingMd">
              {item.title}
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              {item.description}
            </Text>
          </BlockStack>
        </Card>
      ))}
    </InlineGrid>
  );
}
