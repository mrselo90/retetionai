'use client';

import { useState, useEffect } from 'react';
import { Link, useRouter, usePathname } from '@/i18n/routing';
import { supabase } from '@/lib/supabase';
import {
  LayoutDashboard,
  Package,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  X,
  CreditCard,
  BarChart3,
  Puzzle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTranslations } from 'next-intl';
import { isShopifyEmbedded, getShopifySessionToken, getShopifyShop } from '@/lib/shopifyEmbedded';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const t = useTranslations('Dashboard.sidebar');
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [embedded, setEmbedded] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      const shopifyEmbedded = isShopifyEmbedded();
      setEmbedded(shopifyEmbedded);

      if (shopifyEmbedded) {
        // ── Embedded in Shopify Admin ──────────────────────────────────────
        // 1. Check if we already have a valid Supabase session
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserEmail(user.email || null);
          setLoading(false);
          return;
        }

        // 2. No session → perform Token Exchange with our API
        try {
          const sessionToken = await getShopifySessionToken();
          const shop = getShopifyShop();

          if (!sessionToken || !shop) {
            // Fallback: redirect to login
            router.push('/login');
            return;
          }

          const res = await fetch('/api/integrations/shopify/verify-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: sessionToken, shop }),
          });

          const data = await res.json();

          if (data.auth_url) {
            // Redirect to Supabase magic link — auto-authenticates the merchant
            window.location.href = data.auth_url;
            return; // navigation in progress
          }

          // If no auth_url (unexpected), still try to proceed
          setLoading(false);
        } catch (err) {
          console.error('Shopify Token Exchange failed:', err);
          router.push('/login');
        }
      } else {
        // ── Standalone web app ─────────────────────────────────────────────
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            setUserEmail(user.email || null);
            setLoading(false);
          } else {
            router.push('/login');
          }
        } catch (err) {
          console.error('Auth check error:', err);
          router.push('/login');
        }
      }
    };

    initAuth();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
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
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--surface))]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--surface))] flex">

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
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <aside
            className={cn(
              "fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border shadow-sm transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:block",
              isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            <div className="h-full flex flex-col">
              {/* Logo */}
              <div className="h-16 flex items-center px-4 border-b border-border">
                <Link href="/dashboard" className="flex items-center gap-3 font-bold text-xl tracking-tight text-foreground">
                  <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
                    <span className="text-xl font-extrabold">R</span>
                  </div>
                  <span className="text-foreground">Recete</span>
                </Link>
                <button
                  className="ml-auto lg:hidden text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-muted transition-colors"
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Nav Items */}
              <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto scrollbar-thin">
                {navItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "relative flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-150",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                      onClick={() => setIsSidebarOpen(false)}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full"></div>
                      )}
                      <Icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-muted-foreground")} />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>

              {/* User Profile */}
              <div className="p-4 border-t border-border">
                <div className="flex items-center gap-3 mb-3 p-3 rounded-lg bg-[hsl(var(--surface))] border border-border">
                  <Avatar className="ring-2 ring-primary/20">
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
                  className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 border-border font-semibold"
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
            <Link href="/dashboard" className="font-bold text-lg text-foreground flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                <span className="text-base font-extrabold">R</span>
              </div>
              Recete
            </Link>
            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(true)} className="hover:bg-primary/15">
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
