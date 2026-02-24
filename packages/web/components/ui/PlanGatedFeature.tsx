'use client';

/**
 * PlanGatedFeature — BFS 4.3.7 Plan-gated Feature UI
 *
 * Wraps any feature that requires a specific plan tier. When locked:
 *   - Visually greyed out (opacity 0.5)
 *   - Non-interactive (pointer-events: none on the content)
 *   - Shows a plan badge in the top-right corner
 *
 * This satisfies BFS 4.3.7: plan-gated features must be "disabled (both
 * visually and functionally) and clearly indicated."
 */
interface PlanGatedFeatureProps {
    isLocked: boolean;
    requiredPlan: 'Starter' | 'Pro';
    children: React.ReactNode;
    /** Optional extra message shown below the badge */
    lockMessage?: string;
}

const PLAN_COLORS: Record<string, string> = {
    Starter: 'hsl(155 61% 35%)',
    Pro: 'hsl(220 17% 25%)',
};

export function PlanGatedFeature({
    isLocked,
    requiredPlan,
    children,
    lockMessage,
}: PlanGatedFeatureProps) {
    if (!isLocked) return <>{children}</>;

    const badgeColor = PLAN_COLORS[requiredPlan] ?? '#6366f1';

    return (
        <div style={{ position: 'relative' }}>
            {/* Greyed-out, non-interactive wrapper */}
            <div
                aria-disabled="true"
                style={{
                    opacity: 0.55,
                    pointerEvents: 'none',
                    userSelect: 'none',
                }}
            >
                {children}
            </div>

            {/* Plan badge overlay */}
            <div
                style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    background: badgeColor,
                    color: '#fff',
                    borderRadius: 999,
                    padding: '4px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: '0.02em',
                    boxShadow: 'none',
                    zIndex: 1,
                    pointerEvents: 'none',
                }}
            >
                {requiredPlan} plan
            </div>

            {/* Optional upgrade prompt */}
            {lockMessage && (
                <p
                    style={{
                        marginTop: 8,
                        fontSize: 13,
                        color: 'hsl(220 10% 40%)',
                        textAlign: 'center',
                    }}
                >
                    {lockMessage}
                </p>
            )}
        </div>
    );
}
