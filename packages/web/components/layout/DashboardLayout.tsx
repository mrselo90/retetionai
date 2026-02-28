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
  Puzzle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTranslations } from 'next-intl';
import { useDashboardAuth } from '@/hooks/useDashboardAuth';
import { Logo } from '@/components/ui/logo';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const t = useTranslations('Dashboard.sidebar');
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { userEmail, loading, embedded } = useDashboardAuth();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const navItems = [
    { name: t('dashboard'), href: '/dashboard', icon: LayoutDashboard },
    { name: t('products'), href: '/dashboard/products', icon: Package },
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
    <div className="shopify-dashboard-theme min-h-screen bg-[hsl(var(--surface))] flex">

      {/* ── Embedded Mode: App Bridge s-app-nav (BFS 4.1.4) ─────────────── */}
      {embedded && (
        /* @ts-expect-error - App Bridge web component */
        <s-app-nav>
          {navItems.map((item) => (
            /* @ts-expect-error - App Bridge web component */
            <s-app-nav-item
              key={item.href}
              id={`nav-${item.href.replace(/\//g, '-').replace(/^-/, '')}`}
              label={item.name}
              url={`/en${item.href}`}
            />
          ))}
          {/* @ts-expect-error - App Bridge web component */}
        </s-app-nav>
      )}

      {/* ── Standalone Mode: Custom Sidebar ──────────────────────────────── */}
      {!embedded && (
        <>
          {/* Mobile Sidebar Overlay */}
          {isSidebarOpen && (
            <div
              className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-40 lg:hidden animate-fade-in"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <aside
            className={cn(
              "shopify-app-sidebar fixed inset-y-0 left-0 z-50 w-64 border-r transition-transform duration-200 ease-out lg:translate-x-0 lg:static lg:block",
              isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            <div className="h-full flex flex-col">
              {/* Logo */}
              <div className="h-14 flex items-center px-4 border-b border-border">
                <Link href="/dashboard" className="flex items-center gap-2.5 font-semibold text-[14px] tracking-normal text-foreground">
                  <Logo iconOnly className="w-8 h-8 rounded-md shrink-0" />
                  <span className="text-foreground -ml-1 text-lg font-bold" style={{ fontFamily: "'Playfair Display', 'Georgia', 'Times New Roman', serif" }}>recete</span>
                </Link>
                <button
                  className="ml-auto lg:hidden text-muted-foreground hover:text-foreground p-2 rounded-md hover:bg-muted transition-colors"
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Nav Items */}
              <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
                {navItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "shopify-nav-item relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-150",
                        isActive
                          ? "is-active bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                      onClick={() => setIsSidebarOpen(false)}
                    >
                      <Icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-muted-foreground")} strokeWidth={1.8} />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>

              {/* User Profile */}
              <div className="p-4 border-t border-border">
                <div className="flex items-center gap-3 mb-3 p-3 rounded-lg bg-[hsl(var(--surface))] border border-border">
                  <Avatar className="ring-1 ring-border">
                    <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${userEmail || 'User'}&backgroundColor=0A3D2E`} />
                    <AvatarFallback className="bg-primary text-primary-foreground font-semibold">U</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {userEmail?.split('@')[0] || 'User'}
                    </p>
                    <p className="text-xs text-zinc-500 truncate font-medium">
                      {userEmail || 'Loading...'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleSignOut}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {t('signOut')}
                </Button>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header — standalone mode only */}
        {!embedded && (
          <header className="lg:hidden h-14 bg-card border-b border-border flex items-center px-4 justify-between sticky top-0 z-30">
            <Link href="/dashboard" className="font-semibold text-sm text-foreground flex items-center gap-2">
              <Logo iconOnly className="w-7 h-7 rounded-md shrink-0" />
              <span className="-ml-1 text-lg font-bold" style={{ fontFamily: "'Playfair Display', 'Georgia', 'Times New Roman', serif" }}>recete</span>
            </Link>
            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(true)}>
              <Menu className="w-6 h-6" />
            </Button>
          </header>
        )}

        {/* Page Content — Polaris-aligned: 32px horizontal padding on large, 24px medium, 16px small */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 scrollbar-thin">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
