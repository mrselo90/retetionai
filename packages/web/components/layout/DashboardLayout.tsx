'use client';

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
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { useDashboardAuth } from '@/hooks/useDashboardAuth';
import { Logo } from '@/components/ui/logo';
import { useShopify } from '@/components/ShopifyProvider';

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
   * composer to the bottom, so the centred max-w-6xl column with page padding
   * would both squeeze it and let the composer fall off the end of the document.
   * Full-bleed pages get the whole width and a definite height instead.
   *
   * Definite is the operative word: with min-h-screen the shell has no ceiling,
   * so a long thread simply grew the document and took the composer off-screen
   * with it. h-dvh (not h-screen) because 100vh on mobile browsers is the
   * viewport *behind* the URL bar.
   *
   * Scoped to this one route on purpose. Adding min-h-0 to <main> app-wide would
   * finally let its overflow-y-auto fire, which is arguably how it was always
   * meant to work — today the document scrolls and that scroll container is
   * effectively dead — but that changes the scroll container on 16 other screens
   * and is not this change's job.
   */
  const isFullBleed = /\/dashboard\/conversations(\/|$)/.test(pathname);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const navItems = [
    { name: t('dashboard'), href: '/dashboard', icon: LayoutDashboard },
    { name: t('products'), href: '/dashboard/products', icon: Package },
    { name: t('customers'), href: '/dashboard/customers', icon: Users },
    { name: t('conversations'), href: '/dashboard/conversations', icon: MessageSquare },
    { name: t('analytics'), href: '/dashboard/analytics', icon: BarChart3 },
    { name: t('integrations'), href: '/dashboard/integrations', icon: Puzzle },
    { name: t('settings'), href: '/dashboard/settings', icon: Settings },
  ];

  if (loading) {
    return (
      <div className="shopify-dashboard-theme min-h-screen flex items-center justify-center bg-[hsl(var(--surface))]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className={cn("shopify-dashboard-theme bg-[hsl(var(--surface))] flex", isFullBleed ? "h-dvh" : "min-h-screen")}>
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && !isEmbedded && (
        <div
          className="fixed inset-0 bg-black/25 backdrop-blur-[2px] z-40 lg:hidden animate-fade-in"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      {!isEmbedded && (
        <aside
          className={cn(
            "shopify-app-sidebar fixed inset-y-0 left-0 z-50 w-[220px] border-r transition-transform duration-200 ease-out lg:translate-x-0 lg:static lg:block",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
          role="navigation"
          aria-label="Dashboard navigation"
        >
          <div className="h-full flex flex-col">

            {/* ── Logo row ── */}
            <div className="h-14 flex items-center px-4 border-b border-border shrink-0">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 font-semibold text-foreground min-w-0"
                onClick={() => setIsSidebarOpen(false)}
              >
                <Logo iconOnly className="w-7 h-7 rounded-md shrink-0" />
                <span
                  className="text-foreground text-[17px] font-bold tracking-tight"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                >
                  recete
                </span>
              </Link>
              {/* Close button — mobile only */}
              <button
                className="ml-auto lg:hidden text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-muted transition-colors"
                onClick={() => setIsSidebarOpen(false)}
                aria-label="Close navigation menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ── Nav Items ── */}
            <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto scrollbar-thin">
              {navItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "shopify-nav-item flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors duration-100",
                      isActive
                        ? "is-active bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    <Icon
                      className={cn("w-[18px] h-[18px] shrink-0", isActive ? "text-primary" : "text-muted-foreground")}
                      strokeWidth={1.8}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* ── User + sign-out footer ── */}
            <div className="px-2 py-3 border-t border-border shrink-0">
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg min-w-0">
                {/* Avatar initials */}
                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-bold shrink-0 ring-1 ring-border uppercase">
                  {userEmail ? userEmail[0] : 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-foreground truncate leading-tight">
                    {userEmail?.split('@')[0] || 'User'}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate leading-tight">
                    {userEmail || ''}
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* ── Main content ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Top header — mobile only burger + slim desktop topbar ── */}
        {!isEmbedded && (
          <header className="h-12 bg-card border-b border-border flex items-center px-4 justify-between sticky top-0 z-30">
            {/* Mobile: hamburger + logo */}
            <div className="flex items-center gap-2.5 lg:hidden min-w-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Open navigation menu"
              >
                <Menu className="w-4 h-4" />
              </Button>
              <Link href="/dashboard" className="flex items-center gap-1.5 font-semibold text-foreground">
                <Logo iconOnly className="w-6 h-6 rounded shrink-0" />
                <span className="text-[16px] font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>recete</span>
              </Link>
            </div>

            {/* Desktop: empty left, user info right */}
            <div className="hidden lg:flex items-center" />

            {/* Right: email + sign out — desktop only (mobile has it in sidebar) */}
            <div className="hidden lg:flex items-center gap-3 shrink-0">
              {userEmail && (
                <span className="text-[12px] text-muted-foreground truncate max-w-[200px]">
                  {userEmail}
                </span>
              )}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            </div>

            {/* Mobile right: sign out */}
            <div className="flex lg:hidden items-center">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleSignOut}
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </header>
        )}

        {/* ── Page Content ── */}
        {/* min-h-0 only in full-bleed mode: without it a flex item will not go
            below its content height, so the panes' h-full chain would have
            nothing definite to resolve against. Leaving it off elsewhere keeps
            every other screen scrolling exactly as it does today. */}
        <main className={cn(
          "flex-1",
          isFullBleed ? "min-h-0 overflow-hidden" : "overflow-y-auto scrollbar-thin",
          isEmbedded || isFullBleed ? "p-0" : "p-4 sm:p-6 lg:p-8"
        )}>
          <div className={cn(
            isFullBleed ? "h-full" : "max-w-6xl mx-auto",
            isEmbedded ? "p-0" : ""
          )}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
