import { createContext, useContext, type ReactNode } from 'react';
import { useNavigate } from 'react-router';

/*
 * Shared page pieces, on Polaris web components and App Home compositions.
 * Display only: React 18 can't drive controlled s-* fields or custom events,
 * so these take plain props and use click handlers (which React 18 supports).
 * Pass `cond || undefined` for boolean attributes: React 18 writes `false` as
 * the string "false", which a custom element reads as set.
 */

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

const BADGE_TONE = {
  success: 'success',
  attention: 'warning',
  critical: 'critical',
  info: 'info',
} as const;

export function StatusBadge({ children, status }: { children: string; status?: string | null }) {
  return <s-badge tone={BADGE_TONE[statusTone(status) || 'info']}>{children}</s-badge>;
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
/**
 * A shell-level banner (the setup trail) that every AppPage shows first, inside
 * its s-page, so it lines up with the page content instead of spanning the
 * iframe above it.
 */
export const PageBannerContext = createContext<ReactNode>(null);

export function AppPage({
  heading,
  subtitle,
  primaryAction,
  secondaryActions,
  backAction,
  inlineSize = 'base',
  aside,
  showShellBanner = true,
  children,
}: {
  heading: string;
  subtitle?: ReactNode;
  primaryAction?: PageAction;
  secondaryActions?: PageAction[];
  backAction?: { content: string; url: string };
  inlineSize?: 'small' | 'base' | 'large';
  /** Sidebar content (s-page's aside slot): status and summaries next to a form. */
  aside?: ReactNode;
  /** Detail pages turn the setup trail off: it repeats on every record otherwise. */
  showShellBanner?: boolean;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const shellBanner = useContext(PageBannerContext);
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
          loading={primaryAction.loading || undefined}
          disabled={primaryAction.disabled || undefined}
          onClick={() => run(primaryAction)}
        >
          {primaryAction.content}
        </s-button>
      ) : null}
      {secondaryActions?.map((action) => (
        <s-button
          key={action.content}
          slot="secondary-actions"
          loading={action.loading || undefined}
          disabled={action.disabled || undefined}
          onClick={() => run(action)}
        >
          {action.content}
        </s-button>
      ))}
      <s-stack gap="large">
        {showShellBanner ? shellBanner : null}
        {typeof subtitle === 'string' ? <s-paragraph color="subdued">{subtitle}</s-paragraph> : subtitle}
        {children}
      </s-stack>
      {aside ? (
        <s-stack slot="aside" gap="base">
          {aside}
        </s-stack>
      ) : null}
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
    <s-section id={id}>
      <s-stack gap="base">
        <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="start">
          <s-stack gap="small-300">
            <s-heading>{title}</s-heading>
            {subtitle ? <s-paragraph color="subdued">{subtitle}</s-paragraph> : null}
          </s-stack>
          {badge ? <s-box>{badge}</s-box> : null}
        </s-grid>
        {children}
      </s-stack>
    </s-section>
  );
}

/** Metrics card composition: the numbers merchants check at a glance. */
export function MetricGrid({ children }: { children: ReactNode }) {
  return (
    <s-grid gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap="base">
      {children}
    </s-grid>
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
    <s-section>
      <s-stack gap="small-200">
        <s-text color="subdued">{label}</s-text>
        <s-heading>{value}</s-heading>
        <s-paragraph color="subdued">{hint}</s-paragraph>
      </s-stack>
    </s-section>
  );
}

export function DetailRows({ rows }: { rows: Array<{ label: string; value: ReactNode }> }) {
  return (
    <s-stack gap="small-300">
      {rows.map((row) => (
        <s-grid key={row.label} gridTemplateColumns="1fr auto" gap="base">
          <s-text color="subdued">{row.label}</s-text>
          <s-text type="strong">{row.value}</s-text>
        </s-grid>
      ))}
    </s-stack>
  );
}

/** Empty state composition. */
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
    <s-section>
      <s-grid gap="base" justifyItems="center" paddingBlock="large-400">
        <s-box maxInlineSize="200px" maxBlockSize="200px">
          <s-image
            aspectRatio="1/0.5"
            src="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            alt=""
          />
        </s-box>
        <s-grid justifyItems="center" maxInlineSize="450px" gap="small-300">
          <s-heading>{heading}</s-heading>
          <s-paragraph color="subdued">{description}</s-paragraph>
          {action ? (
            <s-button variant="primary" onClick={() => navigate(action.url)}>
              {action.content}
            </s-button>
          ) : null}
        </s-grid>
      </s-grid>
    </s-section>
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
  action?: { content: string; url: string };
}) {
  const navigate = useNavigate();
  return (
    <s-section>
      <s-stack gap="small-300">
        <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="start">
          <s-heading>{title}</s-heading>
          {status ? <StatusBadge status={status}>{status}</StatusBadge> : null}
        </s-grid>
        <s-paragraph color="subdued">{description}</s-paragraph>
        {action ? (
          <s-stack direction="inline">
            <s-button variant="tertiary" onClick={() => navigate(action.url)}>
              {action.content}
            </s-button>
          </s-stack>
        ) : null}
      </s-stack>
    </s-section>
  );
}

/** Callout card composition: where a screen stands and the one next step. */
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
  action?: { content: string; url: string };
}) {
  const navigate = useNavigate();
  const label =
    statusLabel ||
    (tone === 'critical'
      ? 'Needs attention'
      : tone === 'attention'
        ? 'In progress'
        : tone === 'success'
          ? 'Healthy'
          : 'Overview');
  return (
    <s-section>
      <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="end">
        <s-stack gap="small-200">
          <s-text color="subdued">{label}</s-text>
          <s-heading>{title}</s-heading>
          <s-paragraph>{description}</s-paragraph>
        </s-stack>
        {action ? (
          <s-button variant="primary" onClick={() => navigate(action.url)}>
            {action.content}
          </s-button>
        ) : null}
      </s-grid>
    </s-section>
  );
}

export type SetupDependencyItem = {
  label: string;
  state: 'completed' | 'current' | 'locked';
  hint: string;
};

export function SetupDependencyList({ items }: { items: SetupDependencyItem[] }) {
  return (
    <s-stack gap="small-300">
      {items.map((item) => (
        <s-grid key={item.label} gridTemplateColumns="1fr auto" gap="base" alignItems="start">
          <s-text>{item.label}</s-text>
          <s-stack gap="none" alignItems="end">
            <s-text type="strong">
              {item.state === 'completed'
                ? 'Completed'
                : item.state === 'current'
                  ? 'Current step'
                  : 'Locked'}
            </s-text>
            <s-text color="subdued">{item.hint}</s-text>
          </s-stack>
        </s-grid>
      ))}
    </s-stack>
  );
}

export function ValuePreview({ items }: { items: Array<{ title: string; description: string }> }) {
  return (
    <s-grid gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="base">
      {items.map((item) => (
        <s-section key={item.title}>
          <s-stack gap="small-200">
            <s-heading>{item.title}</s-heading>
            <s-paragraph color="subdued">{item.description}</s-paragraph>
          </s-stack>
        </s-section>
      ))}
    </s-grid>
  );
}
