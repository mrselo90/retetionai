import { Button, Card, InlineStack, Text } from "@shopify/polaris";

type FloatingActionFeedbackProps = {
  tone: "success" | "critical" | "info";
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
};

const toneStyles: Record<FloatingActionFeedbackProps["tone"], { border: string; accent: string }> = {
  success: {
    border: "1px solid rgba(22, 119, 70, 0.22)",
    accent: "#167746",
  },
  critical: {
    border: "1px solid rgba(140, 36, 18, 0.22)",
    accent: "#8c2412",
  },
  info: {
    border: "1px solid rgba(0, 91, 211, 0.22)",
    accent: "#005bd3",
  },
};

export function FloatingActionFeedback({
  tone,
  title,
  message,
  actionLabel,
  onAction,
  onDismiss,
}: FloatingActionFeedbackProps) {
  const styles = toneStyles[tone];

  return (
    <div
      style={{
        position: "fixed",
        right: "1rem",
        bottom: "1rem",
        width: "min(28rem, calc(100vw - 2rem))",
        zIndex: 40,
      }}
    >
      <div
        style={{
          borderLeft: `4px solid ${styles.accent}`,
          borderRadius: "16px",
          boxShadow: "0 20px 45px rgba(15, 23, 42, 0.12)",
          overflow: "hidden",
        }}
      >
        <Card padding="400">
          <div style={{ border: styles.border, borderRadius: "12px", padding: "0.85rem 1rem", background: "#ffffff" }}>
            <div style={{ display: "grid", gap: "0.6rem" }}>
              <div style={{ display: "grid", gap: "0.2rem" }}>
                <Text as="p" variant="bodyMd" fontWeight="semibold">
                  {title}
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  {message}
                </Text>
              </div>
              {(actionLabel && onAction) || onDismiss ? (
                <InlineStack gap="200" align="end">
                  {actionLabel && onAction ? (
                    <Button size="slim" onClick={onAction} variant="primary">
                      {actionLabel}
                    </Button>
                  ) : null}
                  {onDismiss ? (
                    <Button size="slim" onClick={onDismiss}>
                      Dismiss
                    </Button>
                  ) : null}
                </InlineStack>
              ) : null}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
