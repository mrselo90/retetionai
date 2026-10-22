'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { Users, ShoppingBag, MessageSquare, BarChart3, TrendingUp, Info } from 'lucide-react';

interface GlobalStats {
    totalMerchants: number;
    totalUsers: number;
    totalOrders: number;
    totalConversations: number;
}

const PAGE_TITLE = 'Platform Overview';

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
            <div className="flex flex-col gap-5">
                <h1 className="r-page-title">{PAGE_TITLE}</h1>
                <div className="flex flex-col gap-5" role="status" aria-label="Loading platform overview">
                    <div className="r-card flex flex-col gap-3" aria-hidden="true">
                        <div className="r-skeleton" style={{ height: 20, width: 160 }} />
                        <div className="r-skeleton" style={{ height: 12 }} />
                        <div className="r-skeleton" style={{ height: 12, width: '66%' }} />
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="r-skeleton" style={{ height: 110 }} />
                        ))}
                    </div>
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
        },
        {
            title: 'Total End Customers',
            value: stats.totalUsers.toLocaleString(),
            icon: Users,
            color: 'text-indigo-600',
        },
        {
            title: 'Total Orders Tracked',
            value: stats.totalOrders.toLocaleString(),
            icon: ShoppingBag,
            color: 'text-emerald-600',
        },
        {
            title: 'Conversations Handled',
            value: stats.totalConversations.toLocaleString(),
            icon: MessageSquare,
            color: 'text-purple-600',
        }
    ];

    return (
        <div className="flex flex-col gap-5">
            <div>
                <h1 className="r-page-title">{PAGE_TITLE}</h1>
                <p className="r-page-sub">Global metrics across all merchants on Recete AI.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {statCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <div key={card.title} className="r-card r-card-tight flex flex-col gap-3">
                            <div className="flex items-center justify-between gap-3">
                                <p className="r-hint">{card.title}</p>
                                <span className="r-kpi-icon" style={{ background: 'var(--r-surface-muted)' }} aria-hidden="true">
                                    <Icon className={`h-5 w-5 ${card.color}`} />
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="r-kpi-value" style={{ fontSize: 'var(--r-text-2xl)' }}>{card.value}</p>
                                <span className="flex items-center gap-1">
                                    <TrendingUp className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                                    <span className="text-xs font-medium" style={{ color: 'var(--r-success)' }}>Live</span>
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            <section className="r-card flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                    <h2 className="r-card-title">Recent Platform Activity</h2>
                    <p className="r-hint">System events and new signups across the platform.</p>
                </div>
                <div
                    className="flex flex-col items-center gap-3 rounded-lg border p-8"
                    style={{ borderColor: 'var(--r-border)', background: 'var(--r-surface-subtle)' }}
                >
                    <BarChart3 className="h-12 w-12 text-zinc-400" aria-hidden="true" />
                    <p className="r-hint text-center">
                        Activity feed feature not yet implemented. Coming in v1.1.
                    </p>
                </div>
            </section>

            <div className="r-alert r-alert-info">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p style={{ margin: 0, fontSize: 'var(--r-text-base-plus)' }}>
                    Platform admin dashboards are Polaris-standardized for operations, while merchant-facing screens remain the primary UX priority.
                </p>
            </div>
        </div>
    );
}
