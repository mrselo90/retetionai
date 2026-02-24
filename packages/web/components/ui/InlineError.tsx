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
                className={`mt-1 flex items-center gap-1 text-xs text-destructive ${className}`}
            >
                <span aria-hidden="true">⚠</span>
                {message}
            </p>
        );
    }

    return (
        <div
            role="alert"
            className={`mb-4 flex items-center gap-2 rounded-lg border border-destructive/25 bg-card px-4 py-3 text-sm font-medium text-destructive ${className}`}
        >
            <span aria-hidden="true" className="text-base">⚠</span>
            <span className="flex-1">{message}</span>
            {onDismiss && (
                <button
                    aria-label="Dismiss error"
                    onClick={onDismiss}
                    className="rounded p-0.5 text-destructive hover:bg-destructive/10"
                >
                    ✕
                </button>
            )}
        </div>
    );
}
