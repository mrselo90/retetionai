'use client';

import { useState, useEffect } from 'react';
import { Link, useRouter, usePathname } from '@/i18n/routing';
import { supabase } from '@/lib/supabase';
import {
    ShieldAlert,
    Users,
    BarChart3,
    LogOut,
    Menu,
    X,
    Server
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import apiClient from '@/lib/api-client';

interface AdminLayoutProps {
    children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initAdminAuth = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    // Verify Super Admin status by hitting An admin endpoint
                    try {
                        await apiClient.get('/api/admin/stats');
                        setUserEmail(user.email || 'Super Admin');
                        setLoading(false);
                    } catch (apiErr: any) {
                        console.error('Super Admin check failed:', apiErr);
                        router.push('/dashboard');
                    }
                } else {
                    router.push('/login');
                }
            } catch (err) {
                console.error('Auth check error:', err);
                router.push('/login');
            }
        };

        initAdminAuth();
    }, [router]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    const navItems = [
        { name: 'Global Overview', href: '/admin', icon: BarChart3 },
        { name: 'Merchants', href: '/admin/merchants', icon: Users },
        { name: 'System Health', href: '/admin/system', icon: Server },
    ];

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--surface))]">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-red-600 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 flex">
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar - Dark theme for Admin */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 w-72 bg-zinc-950 text-zinc-100 border-r border-zinc-900 shadow-xl transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:block",
                    isSidebarOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <div className="h-full flex flex-col">
                    {/* Logo */}
                    <div className="h-16 flex items-center px-4 border-b border-zinc-800">
                        <Link href="/admin" className="flex items-center gap-3 font-bold text-xl tracking-tight text-white">
                            <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-600/20">
                                <ShieldAlert className="w-6 h-6" />
                            </div>
                            <span className="text-white">Super Admin</span>
                        </Link>
                        <button
                            className="ml-auto lg:hidden text-zinc-400 hover:text-white p-2 rounded-lg hover:bg-zinc-800 transition-colors"
                            onClick={() => setIsSidebarOpen(false)}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Nav Items */}
                    <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(item.href));
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "relative flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-150",
                                        isActive
                                            ? "bg-red-600/10 text-red-500 font-semibold"
                                            : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                                    )}
                                    onClick={() => setIsSidebarOpen(false)}
                                >
                                    {isActive && (
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-red-500 rounded-r-full shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                                    )}
                                    <Icon className={cn("w-5 h-5", isActive ? "text-red-500" : "text-zinc-500")} />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* User Profile */}
                    <div className="p-4 border-t border-zinc-800">
                        <div className="flex items-center gap-3 mb-3 p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                            <Avatar className="ring-2 ring-red-500/20">
                                <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${userEmail || 'Admin'}&backgroundColor=dc2626`} />
                                <AvatarFallback className="bg-red-600 text-white font-semibold">A</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white truncate">
                                    {userEmail?.split('@')[0] || 'Super Admin'}
                                </p>
                                <p className="text-xs text-zinc-400 truncate font-medium">
                                    {userEmail || 'Loading...'}
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            className="w-full justify-start text-zinc-300 hover:text-white hover:bg-zinc-800 border-zinc-700 font-semibold"
                            onClick={handleSignOut}
                        >
                            <LogOut className="w-4 h-4 mr-2" />
                            Sign Out
                        </Button>
                    </div>
                </div>
            </aside>

            {/* ── Main Content ──────────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-zinc-50">
                {/* Mobile Header */}
                <header className="lg:hidden h-14 bg-white border-b border-zinc-200 flex items-center px-4 justify-between sticky top-0 z-30">
                    <Link href="/admin" className="font-bold text-lg text-zinc-900 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center">
                            <ShieldAlert className="w-4 h-4" />
                        </div>
                        Super Admin
                    </Link>
                    <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(true)} className="hover:bg-zinc-100">
                        <Menu className="w-6 h-6" />
                    </Button>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin">
                    <div className="max-w-7xl mx-auto space-y-6">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
