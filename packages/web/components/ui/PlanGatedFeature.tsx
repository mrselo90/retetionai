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
    Starter: '#10b981',
    Pro: '#6366f1',
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
                    opacity: 0.5,
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
                    borderRadius: 6,
                    padding: '3px 10px',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
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
                        color: '#6b7280',
                        textAlign: 'center',
                    }}
                >
                    {lockMessage}
                </p>
            )}
        </div>
    );
}
