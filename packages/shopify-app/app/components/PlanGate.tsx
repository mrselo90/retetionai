import type { PlanType } from "@prisma/client";
import type { PlanKey } from "../services/planDefinitions";

export function PlanGate({
  blocked,
  requiredPlan,
  upgradePlan,
  upgradeUrl,
  title,
  message,
  children,
}: {
  blocked: boolean;
  requiredPlan: PlanType;
  upgradePlan: PlanKey;
  upgradeUrl?: string;
  title: string;
  message: string;
  children: React.ReactNode;
}) {
  const requestUpgrade = () => {
    const targetUrl = upgradeUrl || `/app/billing?plan=${encodeURIComponent(upgradePlan)}`;
    window.open(targetUrl, "_top");
  };

  if (!blocked) {
    return <>{children}</>;
  }

  return (
    <s-stack gap="base">
      <s-banner tone="warning" heading={`${title} requires the ${requiredPlan} plan`}>
        <s-paragraph>{message}</s-paragraph>
        <s-button slot="secondary-actions" onClick={requestUpgrade}>
          Upgrade to {requiredPlan}
        </s-button>
      </s-banner>
      <s-section>
        {/* s-box has no opacity; dim the locked preview with a plain wrapper. */}
        <div style={{ opacity: 0.55 }}>
          <s-stack gap="base">
            {children}
            {/* requestUpgrade opens upgradeUrl (or billing) in _top, as the old url+target did. */}
            <s-stack direction="inline">
              <s-button variant="secondary" onClick={requestUpgrade}>
                Upgrade to {requiredPlan}
              </s-button>
            </s-stack>
          </s-stack>
        </div>
      </s-section>
    </s-stack>
  );
}
