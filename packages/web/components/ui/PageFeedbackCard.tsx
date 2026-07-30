'use client';

type PageFeedbackCardProps = {
  tone: 'success' | 'critical' | 'info';
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  dismissLabel?: string;
  onDismiss?: () => void;
};

const ALERT_TONE: Record<PageFeedbackCardProps['tone'], string> = {
  success: 'r-alert-success',
  critical: 'r-alert-error',
  info: 'r-alert-info',
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
    <div
      className={`r-alert ${ALERT_TONE[tone]}`}
      style={{ position: 'sticky', top: 16, zIndex: 20, flexWrap: 'wrap' }}
      role="status"
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="r-alert-title">{title}</p>
        <p className="r-alert-body">{message}</p>
      </div>
      {(actionLabel && onAction) || onDismiss ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexShrink: 0 }}>
          {actionLabel && onAction ? (
            <button className="r-btn r-btn-primary r-btn-sm" onClick={onAction}>
              {actionLabel}
            </button>
          ) : null}
          {onDismiss ? (
            <button className="r-btn r-btn-secondary r-btn-sm" onClick={onDismiss}>
              {dismissLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
