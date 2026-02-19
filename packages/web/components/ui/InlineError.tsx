'use client';

/**
 * InlineError — BFS 4.2.4 Persistent Error Messages
 *
 * BFS requires errors to NOT auto-disappear. This component renders a
 * persistent red banner that stays visible until explicitly dismissed.
 * Use this for API/save failures instead of auto-dismissing toasts.
 *
 * For field-level errors, pass a className and render inline below the field.
 */
interface InlineErrorProps {
    message: string | null;
    onDismiss?: () => void;
    className?: string;
    /** When true, renders as a small inline field error instead of a banner */
    fieldLevel?: boolean;
}

export function InlineError({ message, onDismiss, className = '', fieldLevel = false }: InlineErrorProps) {
    if (!message) return null;

    if (fieldLevel) {
        return (
            <p
                role="alert"
                style={{
                    color: '#dc2626',
                    fontSize: 13,
                    marginTop: 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                }}
                className={className}
            >
                <span aria-hidden="true">⚠</span>
                {message}
            </p>
        );
    }

    return (
        <div
            role="alert"
            style={{
                background: '#fff0f0',
                border: '1px solid #dc2626',
                borderRadius: 8,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: '#dc2626',
                marginBottom: 16,
                fontSize: 14,
                fontWeight: 500,
            }}
            className={className}
        >
            <span aria-hidden="true" style={{ fontSize: 16 }}>⚠</span>
            <span style={{ flex: 1 }}>{message}</span>
            {onDismiss && (
                <button
                    aria-label="Dismiss error"
                    onClick={onDismiss}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#dc2626',
                        fontWeight: 700,
                        fontSize: 16,
                        lineHeight: 1,
                        padding: '0 2px',
                    }}
                >
                    ✕
                </button>
            )}
        </div>
    );
}
