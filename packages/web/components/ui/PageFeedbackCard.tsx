'use client';

import { Box, Button, Card, InlineStack, Text } from '@shopify/polaris';

type PageFeedbackCardProps = {
  tone: 'success' | 'critical' | 'info';
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  dismissLabel?: string;
  onDismiss?: () => void;
};

const toneClasses: Record<PageFeedbackCardProps['tone'], string> = {
  success: 'border-emerald-500/20 from-emerald-50',
  critical: 'border-red-500/20 from-red-50',
  info: 'border-sky-500/20 from-sky-50',
};

export function PageFeedbackCard({
  tone,
  title,
  message,
  actionLabel,
  onAction,
  dismissLabel = 'Dismiss',
  onDismiss,
}: PageFeedbackCardProps) {
  return (
    <div className="sticky top-4 z-20">
      <Card>
        <Box padding="400">
          <div
            className={`flex flex-col gap-3 rounded-2xl border bg-gradient-to-r via-white to-white p-4 shadow-sm ${toneClasses[tone]}`}
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Text as="h2" variant="headingMd">
                  {title}
                </Text>
                <div className="mt-1">
                  <Text as="p" tone="subdued">
                    {message}
                  </Text>
                </div>
              </div>
              {(actionLabel && onAction) || onDismiss ? (
                <InlineStack gap="200" align="end">
                  {actionLabel && onAction ? (
                    <Button variant="primary" onClick={onAction}>
                      {actionLabel}
                    </Button>
                  ) : null}
                  {onDismiss ? <Button onClick={onDismiss}>{dismissLabel}</Button> : null}
                </InlineStack>
              ) : null}
            </div>
          </div>
        </Box>
      </Card>
    </div>
  );
}
