/**
 * Labelled switch, design direction 1b.
 *
 * A real <input type="checkbox" role="switch"> under a custom visual, rather than
 * a styled div with an onClick: that way it is in the tab order, toggles with
 * Space, and is announced as a switch with its on/off state — none of which a div
 * gets for free.
 *
 * The design pairs the track with a label and a bold status word ("paused"), and
 * that word carries the state in text as well as in colour, so it does not rely
 * on the knob position alone.
 */

'use client';

import { useId } from 'react';

export function Switch({
  checked,
  onChange,
  label,
  stateLabel,
  stateTone = 'default',
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  /** Word shown after the track, e.g. "on" / "paused". */
  stateLabel?: string;
  stateTone?: 'default' | 'warning';
  disabled?: boolean;
}) {
  const id = useId();

  return (
    <span className="r-switch-wrap">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="r-switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      {stateLabel ? (
        <b
          style={{
            color: stateTone === 'warning' ? 'var(--r-warning)' : 'var(--r-text-secondary)',
            fontWeight: 'var(--r-weight-semibold)',
          }}
        >
          {stateLabel}
        </b>
      ) : null}
    </span>
  );
}
