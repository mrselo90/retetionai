/**
 * Recete UI primitives.
 *
 * Thin wrappers over the class layer in app/recete-ui.css, which is itself built
 * on app/design-tokens.css. Anatomies come from the design prototype.
 *
 * Accessibility is built in here rather than retrofitted, because the audit found
 * the same gaps repeated across the old screens: inputs labelled only by
 * placeholder, a hand-rolled modal with no focus management, table rows made
 * clickable via onClick so keyboard users could not reach the detail page, and
 * skeletons that announced nothing. Using these primitives makes the correct
 * version the default.
 */

'use client';

import { forwardRef, useId } from 'react';
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/* ============================ Button ============================ */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  /** Disables the button and marks it busy for assistive tech. */
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading = false, disabled, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={rest.type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx('r-btn', `r-btn-${variant}`, size === 'sm' && 'r-btn-sm', className)}
      {...rest}
    >
      {children}
    </button>
  );
});

/* ============================ Card ============================ */

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** `flush` removes padding for tables; `invert` is the dashboard hero metric. */
  tone?: 'default' | 'invert';
  padding?: 'default' | 'tight' | 'flush';
}

export function Card({ tone = 'default', padding = 'default', className, children, ...rest }: CardProps) {
  return (
    <div
      className={cx(
        'r-card',
        padding === 'tight' && 'r-card-tight',
        padding === 'flush' && 'r-card-flush',
        tone === 'invert' && 'r-card-invert',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/* ============================ Badge ============================ */

export type BadgeTone = 'success' | 'warning' | 'caution' | 'danger' | 'neutral' | 'brand';

export function Badge({
  tone = 'neutral',
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span className={cx('r-badge', `r-badge-${tone}`, className)} {...rest}>
      {children}
    </span>
  );
}

/** Loud filled count, e.g. unread threads in the sidebar. */
export function CountBadge({ count, label }: { count: number; label: string }) {
  if (count <= 0) return null;
  return (
    <span className="r-badge-count" aria-label={`${count} ${label}`}>
      {count}
    </span>
  );
}

/* ============================ Fields ============================ */

interface FieldShellProps {
  label: string;
  /** Visually hides the label without removing it from the accessibility tree. */
  labelHidden?: boolean;
  help?: string;
  error?: string;
  children: (ids: { inputId: string; describedBy?: string }) => ReactNode;
}

/**
 * Owns the label/description wiring so every field is programmatically labelled.
 * The old screens relied on placeholders, which vanish on input and are
 * announced inconsistently.
 */
function FieldShell({ label, labelHidden, help, error, children }: FieldShellProps) {
  const base = useId();
  const inputId = `${base}-input`;
  const helpId = help ? `${base}-help` : undefined;
  const errorId = error ? `${base}-error` : undefined;
  const describedBy = [errorId, helpId].filter(Boolean).join(' ') || undefined;

  return (
    <div>
      <label htmlFor={inputId} className={cx('r-label', labelHidden && 'sr-only')}>
        {label}
      </label>
      {children({ inputId, describedBy })}
      {error ? (
        <p id={errorId} className="r-field-error" role="alert">
          {error}
        </p>
      ) : null}
      {help && !error ? (
        <p id={helpId} className="r-field-help">
          {help}
        </p>
      ) : null}
    </div>
  );
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  labelHidden?: boolean;
  help?: string;
  error?: string;
}

export function Input({ label, labelHidden, help, error, className, ...rest }: InputProps) {
  return (
    <FieldShell label={label} labelHidden={labelHidden} help={help} error={error}>
      {({ inputId, describedBy }) => (
        <input
          id={inputId}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={cx('r-input', error && 'r-input-invalid', className)}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  labelHidden?: boolean;
  help?: string;
  error?: string;
}

export function Textarea({ label, labelHidden, help, error, className, ...rest }: TextareaProps) {
  return (
    <FieldShell label={label} labelHidden={labelHidden} help={help} error={error}>
      {({ inputId, describedBy }) => (
        <textarea
          id={inputId}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={cx('r-textarea', error && 'r-input-invalid', className)}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string;
  labelHidden?: boolean;
  help?: string;
  error?: string;
}

export function Select({ label, labelHidden, help, error, className, children, ...rest }: SelectProps) {
  return (
    <FieldShell label={label} labelHidden={labelHidden} help={help} error={error}>
      {({ inputId, describedBy }) => (
        <select id={inputId} aria-describedby={describedBy} className={cx('r-select', className)} {...rest}>
          {children}
        </select>
      )}
    </FieldShell>
  );
}

/* ============================ Progress ============================ */

export function ProgressBar({
  value,
  label,
  tone = 'brand',
}: {
  /** 0-100. Clamped, so a bad server value cannot overflow the track. */
  value: number;
  label: string;
  tone?: 'brand' | 'caution' | 'warning';
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className="r-progress"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cx(
          'r-progress-fill',
          tone === 'caution' && 'r-progress-fill-caution',
          tone === 'warning' && 'r-progress-fill-warning',
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ============================ Avatar ============================ */

export function Avatar({
  name,
  size = 'md',
  solid = false,
}: {
  name: string;
  size?: 'md' | 'lg';
  solid?: boolean;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toLocaleUpperCase('tr-TR');

  return (
    <span
      className={cx('r-avatar', size === 'lg' && 'r-avatar-lg', solid && 'r-avatar-solid')}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

/* ============================ Empty state ============================ */

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  /** Decorative glyph shown above the title; hidden from screen readers. */
  icon?: ReactNode;
}) {
  return (
    <div className="r-empty">
      {icon ? (
        <span className="r-empty-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <p className="r-empty-title">{title}</p>
      {body ? <p className="r-empty-body">{body}</p> : null}
      {action}
    </div>
  );
}

/* ============================ Skeleton ============================ */

export function Skeleton({
  height = 16,
  width = '100%',
  label,
}: {
  height?: number | string;
  width?: number | string;
  /** Announced while loading; the old skeletons were silent to screen readers. */
  label: string;
}) {
  return (
    <div role="status" aria-live="polite" aria-label={label}>
      <div className="r-skeleton" style={{ height, width }} />
    </div>
  );
}

/* ============================ Table ============================ */

export function TableWrap({ children, className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('r-table-wrap', className)} {...rest}>
      {children}
    </div>
  );
}
