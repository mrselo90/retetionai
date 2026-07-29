/**
 * Pill filter chips, design direction 1b.
 *
 * Deliberately NOT role="tablist". These filter the table below rather than
 * swapping panels, and the ARIA tabs pattern would promise things this control
 * does not do: arrow-key navigation between tabs, a roving tabindex, and an
 * aria-controls tabpanel. Single-select toggle buttons with aria-pressed describe
 * exactly what happens, and work with plain Tab + Enter.
 *
 * The count is inside the button so it becomes part of the accessible name —
 * "At risk · 4" rather than a silent number.
 *
 * Semantic tones persist when a chip is not selected: the design keeps "At risk"
 * orange whether or not it is the active filter, so the count reads as a warning
 * at a glance instead of only once you select it.
 */

'use client';

export interface FilterTab<T extends string> {
  value: T;
  label: string;
  count?: number;
  tone?: 'warning' | 'success';
}

export function FilterTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: Array<FilterTab<T>>;
  value: T;
  onChange: (next: T) => void;
  /** Accessible name for the group, e.g. "Filter products by status". */
  label: string;
}) {
  return (
    <div className="r-tabs" role="group" aria-label={label}>
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            aria-pressed={selected}
            className={`r-tab${tab.tone && !selected ? ` r-tab-${tab.tone}` : ''}`}
            onClick={() => onChange(tab.value)}
          >
            {tab.label}
            {tab.count !== undefined ? <span className="r-tab-count"> · {tab.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
