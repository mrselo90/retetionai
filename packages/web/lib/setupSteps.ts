/**
 * The web dashboard's three setup steps, computed from /api/merchants/me/stats.
 *
 * Shared by the Dashboard home (the Getting Started card) and the sidebar's
 * "next step" card, so both always agree on what is done and where to go next.
 * Titles and descriptions live in messages under Dashboard.home.setup.steps.
 */

export type SetupStepId = 'connectShopify' | 'addProduct' | 'sendFirstWhatsApp';

export type SetupStats = {
  kpis?: { totalProducts?: number; messagesSent?: number };
  recentActivity?: { conversations?: unknown[] };
  alerts?: Array<{ type: string }>;
};

export type SetupStep = {
  id: SetupStepId;
  completed: boolean;
  actionUrl: '/dashboard/integrations' | '/dashboard/products' | '/dashboard/settings';
};

export function computeSetupSteps(stats: SetupStats): SetupStep[] {
  const alerts = stats.alerts ?? [];
  const hasIntegrationIssue = alerts.some(
    (a) => a.type === 'no_integration' || a.type === 'integration_error'
  );
  const hasProducts = (stats.kpis?.totalProducts ?? 0) > 0;
  const hasConversationActivity =
    (stats.kpis?.messagesSent ?? 0) > 0 || (stats.recentActivity?.conversations?.length ?? 0) > 0;

  return [
    { id: 'connectShopify', completed: !hasIntegrationIssue, actionUrl: '/dashboard/integrations' },
    { id: 'addProduct', completed: hasProducts, actionUrl: '/dashboard/products' },
    {
      id: 'sendFirstWhatsApp',
      completed: hasConversationActivity,
      actionUrl: '/dashboard/settings',
    },
  ];
}
