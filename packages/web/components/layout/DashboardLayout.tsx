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

  useEffect(() => {
    const getUser = async () => {
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
    };
    getUser();
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
      <div className="min-h-screen flex items-center justify-center bg-zinc-50/50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-zinc-50/50 to-primary/5 flex">
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
          "fixed inset-y-0 left-0 z-50 w-72 bg-white/95 backdrop-blur-xl border-r border-zinc-200/80 shadow-xl transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:block",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="h-20 flex items-center px-6 border-b border-zinc-100 bg-gradient-to-r from-primary/5 to-transparent">
            <Link href="/dashboard" className="flex items-center gap-3 font-bold text-xl tracking-tight text-zinc-900 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <span className="text-xl font-extrabold">R</span>
              </div>
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">Recete</span>
            </Link>
            <button
              className="ml-auto lg:hidden text-zinc-500 hover:text-zinc-700 p-2 rounded-lg hover:bg-zinc-100 transition-colors"
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
                    "relative flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 group",
                    isActive
                      ? "bg-gradient-to-r from-primary/10 to-primary/5 text-primary shadow-sm"
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                  )}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full"></div>
                  )}
                  <Icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", isActive ? "text-primary" : "text-zinc-500")} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User Profile */}
          <div className="p-4 border-t border-zinc-100 bg-gradient-to-r from-muted/20 to-transparent">
            <div className="flex items-center gap-3 mb-3 p-3 rounded-xl bg-white border border-zinc-100 shadow-sm">
              <Avatar className="ring-2 ring-primary/20">
                <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${userEmail || 'User'}&backgroundColor=14b8a6`} />
                <AvatarFallback className="bg-primary text-primary-foreground font-semibold">U</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-900 truncate">
                  {userEmail?.split('@')[0] || 'User'}
                </p>
                <p className="text-xs text-zinc-500 truncate font-medium">
                  {userEmail || 'Loading...'}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full justify-start text-zinc-600 hover:text-red-600 hover:bg-red-50 hover:border-red-200 border-zinc-200 font-semibold"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              {t('signOut')}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden h-16 bg-white/95 backdrop-blur-xl border-b border-zinc-200/80 flex items-center px-4 justify-between shadow-sm sticky top-0 z-30">
          <Link href="/dashboard" className="font-bold text-lg text-zinc-900 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center shadow">
              <span className="text-base font-extrabold">R</span>
            </div>
            Recete
          </Link>
          <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(true)} className="hover:bg-primary/10">
            <Menu className="w-6 h-6" />
          </Button>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
