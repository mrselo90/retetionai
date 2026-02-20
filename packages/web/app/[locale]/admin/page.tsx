'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, ShoppingBag, MessageSquare, BarChart3, TrendingUp } from 'lucide-react';

interface GlobalStats {
    totalMerchants: number;
    totalUsers: number;
    totalOrders: number;
    totalConversations: number;
}

export default function AdminDashboardPage() {
    const [stats, setStats] = useState<GlobalStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;

                const data = await authenticatedRequest<{ stats: GlobalStats }>('/api/admin/stats', session.access_token);
                setStats(data.stats);
            } catch (err) {
                console.error('Failed to fetch admin stats:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (loading || !stats) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-10 w-64 bg-zinc-200 rounded-lg"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-32 bg-zinc-200 rounded-xl"></div>
                    ))}
                </div>
            </div>
        );
    }

    const statCards = [
        {
            title: 'Total Active Merchants',
            value: stats.totalMerchants.toLocaleString(),
            icon: Users,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
        },
        {
            title: 'Total End Customers',
            value: stats.totalUsers.toLocaleString(),
            icon: Users,
            color: 'text-indigo-600',
            bg: 'bg-indigo-50',
        },
        {
            title: 'Total Orders Tracked',
            value: stats.totalOrders.toLocaleString(),
            icon: ShoppingBag,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
        },
        {
            title: 'Conversations Handled',
            value: stats.totalConversations.toLocaleString(),
            icon: MessageSquare,
            color: 'text-purple-600',
            bg: 'bg-purple-50',
        }
    ];

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Platform Overview</h1>
                <p className="text-zinc-500 mt-2">Global metrics across all merchants on Recete AI.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <Card key={card.title} className="border-none shadow-md overflow-hidden group">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between space-y-0 pb-4">
                                    <p className="text-sm font-medium text-zinc-500">{card.title}</p>
                                    <div className={`p-2.5 rounded-lg ${card.bg} transition-transform group-hover:scale-110`}>
                                        <Icon className={`h-5 w-5 ${card.color}`} />
                                    </div>
                                </div>
                                <div className="flex items-baseline space-x-2">
                                    <h2 className="text-3xl font-bold tracking-tight text-zinc-900">{card.value}</h2>
                                    <span className="flex items-center text-sm font-medium text-emerald-600">
                                        <TrendingUp className="w-3 h-3 mr-1" />
                                        Live
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <Card className="border-none shadow-md">
                <CardHeader>
                    <CardTitle>Recent Platform Activity</CardTitle>
                    <CardDescription>System events and new signups across the platform.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50">
                        <div className="flex flex-col items-center justify-center text-center space-y-3">
                            <BarChart3 className="w-12 h-12 text-zinc-300" />
                            <p className="text-zinc-500 max-w-sm">
                                Activity feed feature not yet implemented. Coming in v1.1.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
