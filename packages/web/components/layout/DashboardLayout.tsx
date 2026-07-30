'use client';

/**
 * Dashboard shell, design direction 1b.
 *
 * The screens were migrated onto the token layer bottom-up — tables, cards,
 * badges — while this file kept the old chrome, so the app still read as the old
 * design: a cream #FCFAF3 topbar, a #F3F4F6 Tailwind-grey canvas instead of the
 * brand's #F6F7F6, and a translucent primary/10 active nav state rather than the
 * brand tint. The chrome carries most of the visual identity, so none of the body
 * work showed until this changed.
 *
 * Every behaviour is kept: the auth guard, embedded mode (Shopify admin supplies
 * its own chrome, so ours is hidden), the mobile drawer, sign-out, and the
 * full-bleed inbox exception.
 *
 * `shopify-dashboard-theme` deliberately stays on the content wrapper rather than
 * the root. It scopes the legacy d-* rules that several screens still depend on
 * (Dashboard, Analytics, Integrations, and two Settings tabs); dropping it here
 * would restyle the chrome and unstyle those pages in the same commit.
 */

import { useState } from 'react';
import { Link, usePathname } from '@/i18n/routing';
import { supabase } from '@/lib/supabase';
import {
  LayoutDashboard,
  Package,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  X,
  BarChart3,
  Puzzle,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { useDashboardAuth } from '@/hooks/useDashboardAuth';
import { useShopify } from '@/components/ShopifyProvider';
import { Avatar } from '@/components/recete';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const t = useTranslations('Dashboard.sidebar');
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { userEmail, loading } = useDashboardAuth();
  const { isEmbedded } = useShopify();

  /**
   * The inbox is a three-pane surface that scrolls its own panes and pins a
   * composer to the bottom, so the padded content column would both squeeze it
   * and let the composer fall off the end of the document.
   *
   * Definite height is the operative part: with min-h-screen the shell has no
   * ceiling, so a long thread simply grew the document and took the composer
   * off-screen with it. h-dvh, not h-screen, because 100vh on mobile browsers is
   * the viewport *behind* the URL bar.
   */
  const isFullBleed = /\/dashboard\/conversations(\/|$)/.test(pathname);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  /**
   * Grouped as the design groups them: what you work in, then what you configure.
   * Only routes that exist — the design also shows Flows and Playground, which
   * this dashboard has no pages for, and a nav item leading nowhere is worse than
   * an absent one.
   */
  const navSections = [
    {
      label: t('sectionWorkspace'),
      items: [
        { name: t('dashboard'), href: '/dashboard', icon: LayoutDashboard },
        { name: t('conversations'), href: '/dashboard/conversations', icon: MessageSquare },
        { name: t('products'), href: '/dashboard/products', icon: Package },
        { name: t('customers'), href: '/dashboard/customers', icon: Users },
        { name: t('analytics'), href: '/dashboard/analytics', icon: BarChart3 },
      ],
    },
    {
      label: t('sectionConfigure'),
      items: [
        { name: t('integrations'), href: '/dashboard/integrations', icon: Puzzle },
        { name: t('settings'), href: '/dashboard/settings', icon: Settings },
      ],
    },
  ];

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && (pathname?.startsWith(`${href}/`) ?? false));

  if (loading) {
    return (
      <div
        className="r-app"
        style={{ alignItems: 'center', justifyContent: 'center' }}
        role="status"
        aria-label={t('loading')}
      >
        <span
          style={{
            width: 32,
            height: 32,
            border: '2px solid var(--r-border)',
            borderTopColor: 'var(--r-brand)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      </div>
    );
  }

  /* Embedded in Shopify admin: Polaris supplies the frame, so ours would double up. */
  if (isEmbedded) {
    return <div className="shopify-dashboard-theme">{children}</div>;
  }

  return (
    <div className="r-app" style={isFullBleed ? { height: '100dvh' } : undefined}>
      {isSidebarOpen && (
        <div className="r-scrim" onClick={() => setIsSidebarOpen(false)} aria-hidden="true" />
      )}

      <nav className="r-sidebar" data-open={isSidebarOpen} aria-label={t('navLabel')}>
        <div className="r-brand-row">
          <Link
            href="/dashboard"
            onClick={() => setIsSidebarOpen(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              textDecoration: 'none',
              minWidth: 0,
            }}
          >
            <span className="r-brand-mark" aria-hidden="true">
              R
            </span>
            <span className="r-brand-name">Recete</span>
          </Link>
          {/* Mobile only — the drawer needs a way out that is not the scrim. */}
          <button
            type="button"
            className="r-nav-close"
            onClick={() => setIsSidebarOpen(false)}
            aria-label={t('closeNav')}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {navSections.map((section) => (
          <div key={section.label}>
            <div className="r-nav-section">{section.label}</div>
            <div className="r-nav-list">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="r-nav-item"
                    /* The state is a fact for assistive tech, not just a colour. */
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    <span className="r-nav-icon" aria-hidden="true">
                      <Icon size={17} strokeWidth={1.8} />
                    </span>
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        <div className="r-sidebar-foot">
          <div className="r-user-row">
            <Avatar name={userEmail || 'U'} solid />
            <span style={{ minWidth: 0, flex: 1 }}>
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
                {userEmail?.split('@')[0] || 'User'}
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: 'var(--r-text-xs)',
                  color: 'var(--r-text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {userEmail || ''}
              </span>
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label={t('signOut')}
              title={t('signOut')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--r-text-muted)',
                display: 'flex',
                padding: 4,
                flexShrink: 0,
              }}
            >
              <LogOut size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      </nav>

      <div className="r-main">
        {/*
          Identity and sign-out live once, in the sidebar footer below — this bar
          used to repeat both next to a second sign-out button, so the topbar is
          just the mobile nav toggle now.
        */}
        <div className="r-topbar">
          <div className="r-status-line">
            <button
              type="button"
              className="r-btn r-btn-secondary r-btn-sm r-nav-toggle"
              onClick={() => setIsSidebarOpen(true)}
              aria-expanded={isSidebarOpen}
              aria-label={t('openNav')}
            >
              <Menu size={15} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/*
          The legacy theme class lives here, not on the root: it scopes the d-*
          rules the un-migrated screens still need, without reaching the chrome.
        */}
        <main
          className={cn('shopify-dashboard-theme', isFullBleed ? 'r-main-full' : 'r-main-inner')}
          style={isFullBleed ? undefined : { paddingTop: 24 }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
