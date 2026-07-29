/**
 * Dashboard shell — sidebar + topbar, per design direction 1b.
 *
 * Replaces the sidebar in components/layout/DashboardLayout.tsx, which hid itself
 * entirely below 1039px and put nothing in its place: on a phone the only way to
 * move between screens was whatever in-page buttons happened to exist. Here the
 * same breakpoint turns the sidebar into a proper drawer with a toggle and scrim.
 *
 * Navigation is real <Link>s with aria-current, not onClick handlers, so keyboard
 * and middle-click both work and the active item is announced.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { Link, usePathname } from '@/i18n/routing';
import type { ReactNode } from 'react';
import { Button, CountBadge, ProgressBar } from './index';

export interface ShellNavItem {
  href: string;
  label: string;
  /** Monospace-ish glyph from the design; decorative, hidden from screen readers. */
  icon: string;
  /** Renders the loud filled count (inbox threads awaiting a human). */
  count?: number;
  countLabel?: string;
}

export interface ShellProps {
  sections: Array<{ label: string; items: ShellNavItem[] }>;
  brandPlan?: string;
  user?: { name: string; org?: string };
  setup?: { done: number; total: number; nextLabel: string; href: string };
  status?: { label: string; tone?: 'ok' | 'warn' };
  actions?: ReactNode;
  children: ReactNode;
}

export function Shell({
  sections,
  brandPlan,
  user,
  setup,
  status,
  actions,
  children,
}: ShellProps) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Route change closes the drawer, otherwise it stays open over the new screen.
  // Adjusted during render rather than in an effect — setting state synchronously
  // inside an effect cascades an extra render, which is the same pattern React
  // documents against and that this codebase has been cleaning up elsewhere.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setNavOpen(false);
  }

  // Escape closes it and returns focus to the control that opened it.
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNavOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navOpen]);

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));

  return (
    <div className="r-app">
      {navOpen ? (
        <div className="r-scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />
      ) : null}

      <nav className="r-sidebar" data-open={navOpen} aria-label="Dashboard">
        <div className="r-brand-row">
          <span className="r-brand-mark" aria-hidden="true">R</span>
          <span className="r-brand-name">Recete</span>
          {brandPlan ? <span className="r-plan-chip">{brandPlan}</span> : null}
        </div>

        {sections.map((section) => (
          <div key={section.label}>
            <div className="r-nav-section">{section.label}</div>
            <div className="r-nav-list">
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="r-nav-item"
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className="r-nav-icon" aria-hidden="true">{item.icon}</span>
                    <span>{item.label}</span>
                    {item.count ? (
                      <span className="r-nav-spacer">
                        <CountBadge count={item.count} label={item.countLabel ?? item.label} />
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        <div className="r-sidebar-foot">
          {setup && setup.done < setup.total ? (
            <Link href={setup.href} className="r-setup-card">
              <div className="r-setup-title">
                Setup {setup.done}/{setup.total} complete
              </div>
              <div style={{ marginTop: 8 }}>
                <ProgressBar
                  value={(setup.done / setup.total) * 100}
                  label={`Setup ${setup.done} of ${setup.total} complete`}
                />
              </div>
              <div className="r-setup-next">{setup.nextLabel}</div>
            </Link>
          ) : null}

          {user ? (
            <div className="r-user-row">
              <span className="r-avatar r-avatar-solid" aria-hidden="true">
                {user.name
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0] ?? '')
                  .join('')
                  .toLocaleUpperCase('tr-TR')}
              </span>
              <span style={{ minWidth: 0 }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 'var(--r-text-sm-plus)',
                    fontWeight: 'var(--r-weight-semibold)',
                    color: 'var(--r-text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {user.name}
                </span>
                {user.org ? (
                  <span
                    style={{
                      display: 'block',
                      fontSize: 'var(--r-text-xs)',
                      color: 'var(--r-text-subtle)',
                    }}
                  >
                    {user.org}
                  </span>
                ) : null}
              </span>
            </div>
          ) : null}
        </div>
      </nav>

      <div className="r-main">
        <div className="r-topbar">
          <div className="r-status-line">
            <Button
              ref={toggleRef}
              className="r-nav-toggle"
              variant="secondary"
              size="sm"
              aria-expanded={navOpen}
              aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
              onClick={() => setNavOpen((open) => !open)}
            >
              ☰
            </Button>
            {status ? (
              <>
                <span
                  className={`r-status-dot${status.tone === 'warn' ? ' r-status-dot-warn' : ''}`}
                  aria-hidden="true"
                />
                <span>{status.label}</span>
              </>
            ) : null}
          </div>
          {actions ? <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{actions}</div> : null}
        </div>

        <div className="r-main-inner">{children}</div>
      </div>
    </div>
  );
}
