'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { authenticatedRequest } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database, Server, Activity, RefreshCw, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';

interface QueueStats {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
}

interface SystemHealth {
    status: string;
    redis: {
        connected: boolean;
        uptime: string;
    };
    queues: {
        scheduledMessages: QueueStats;
        scrapeJobs: QueueStats;
        analytics: QueueStats;
    };
}

export default function SystemHealthPage() {
    const [health, setHealth] = useState<SystemHealth | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchHealth = async () => {
        setIsRefreshing(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const data = await authenticatedRequest<SystemHealth>('/api/admin/system-health', session.access_token);
            setHealth(data);
            setLastUpdated(new Date());
            setError('');
        } catch (err: any) {
            setError(err.message || 'Failed to fetch system health');
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchHealth();
        // Auto refresh every 30 seconds
        const interval = setInterval(fetchHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    const formatUptime = (seconds: string) => {
        const secs = parseInt(seconds, 10);
        if (isNaN(secs)) return seconds;
        const d = Math.floor(secs / (3600 * 24));
        const h = Math.floor(secs % (3600 * 24) / 3600);
        const m = Math.floor(secs % 3600 / 60);
        return `${d}d ${h}h ${m}m`;
    };

    if (loading && !health) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-10 w-64 bg-zinc-200 rounded-lg"></div>
                <div className="h-32 bg-zinc-200 rounded-xl"></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-64 bg-zinc-200 rounded-xl"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (error && !health) {
        return (
            <div className="p-6 bg-red-50 text-red-600 rounded-lg border border-red-200 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div>
                    <h3 className="font-semibold text-lg">System connection failed</h3>
                    <p className="mt-1 text-sm text-red-500">{error}</p>
                    <Button variant="outline" size="sm" className="mt-4 bg-white" onClick={fetchHealth}>
                        Try Again
                    </Button>
                </div>
            </div>
        );
    }

    const QueueCard = ({ title, stats, icon: Icon, colorClass }: { title: string, stats: QueueStats | undefined, icon: any, colorClass: string }) => {
        if (!stats) return null;

        const hasFailed = stats.failed > 0;
        const hasBacklog = stats.waiting > 1000;

        return (
            <Card className="border-none shadow-md overflow-hidden relative">
                {/* Status indicator bar */}
                <div className={`absolute top-0 left-0 w-full h-1 ${hasFailed ? 'bg-red-500' : hasBacklog ? 'bg-amber-500' : 'bg-emerald-500'}`} />

                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <div className={`p-2 rounded-lg ${colorClass} bg-opacity-10`}>
                                <Icon className={`w-4 h-4 ${colorClass}`} />
                            </div>
                            {title}
                        </CardTitle>
                        {hasFailed && (
                            <Badge variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-100 border-none font-semibold text-xs py-0">
                                {stats.failed} Errors
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-100">
                            <div className="text-xs text-zinc-500 font-medium mb-1">Active / Pending</div>
                            <div className="text-2xl font-bold text-zinc-900">
                                {stats.active.toLocaleString()} <span className="text-zinc-300 font-light mx-1">/</span> <span className={`${hasBacklog ? 'text-amber-500' : 'text-zinc-600'}`}>{stats.waiting.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-100 flex flex-col justify-center">
                            <div className="flex justify-between items-center text-sm mb-1.5">
                                <span className="text-zinc-500">Processed</span>
                                <span className="font-semibold text-zinc-700">{stats.completed.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-zinc-500">Delayed</span>
                                <span className="font-semibold text-zinc-700">{stats.delayed.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="space-y-6 pb-12">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900">System Health</h1>
                    <p className="text-zinc-500 mt-2 flex items-center gap-2">
                        Monitoring background workers and infrastructure
                        {health && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                                Live
                            </span>
                        )}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-400 font-medium">
                        Last checked: {formatDistanceToNow(lastUpdated)} ago
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchHealth}
                        disabled={isRefreshing}
                        className="bg-white"
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Core Infrastructure */}
            {health && (
                <Card className="border-none shadow-md overflow-hidden bg-gradient-to-br from-zinc-900 to-zinc-950 text-white">
                    <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center border border-zinc-700 shadow-inner">
                                    <Database className="w-6 h-6 text-zinc-300" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold flex items-center gap-2">
                                        Redis Message Broker
                                        {health.redis.connected ? (
                                            <Badge className="bg-emerald-500/20 text-emerald-400 border-none hover:bg-emerald-500/20">Connected</Badge>
                                        ) : (
                                            <Badge variant="destructive" className="border-none">Disconnected</Badge>
                                        )}
                                    </h2>
                                    <p className="text-zinc-400 text-sm mt-1">Used for BullMQ job queues and rate limiting across instances.</p>
                                </div>
                            </div>

                            <div className="flex gap-8 md:px-8 md:border-l border-zinc-800">
                                <div>
                                    <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-1">Uptime</p>
                                    <p className="font-mono text-lg">{formatUptime(health.redis.uptime)}</p>
                                </div>
                                <div>
                                    <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-1">State</p>
                                    <p className="font-mono text-lg flex items-center">
                                        {health.status === 'healthy' ? 'OK' : 'DEGRADED'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Background Worker Queues */}
            <div>
                <h3 className="text-lg font-semibold mb-4 mt-8 flex items-center text-zinc-800">
                    <Activity className="w-5 h-5 mr-2 text-zinc-500" />
                    Distributed Queues (BullMQ)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <QueueCard
                        title="Scheduled Messages"
                        stats={health?.queues.scheduledMessages}
                        icon={Server}
                        colorClass="text-blue-500"
                    />
                    <QueueCard
                        title="Web Scraper Jobs"
                        stats={health?.queues.scrapeJobs}
                        icon={Server}
                        colorClass="text-emerald-500"
                    />
                    <QueueCard
                        title="Analytics Pipeline"
                        stats={health?.queues.analytics}
                        icon={Server}
                        colorClass="text-purple-500"
                    />
                </div>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex items-start gap-3 mt-6">
                <div className="mt-0.5 rounded-full bg-blue-100 p-1 flex-shrink-0">
                    <AlertCircle className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">Queue Management (Coming Soon)</p>
                    <p className="text-blue-700/80">In a future update, you will be able to pause queues, retry failed jobs in bulk, and clear backlogs directly from this dashboard.</p>
                </div>
            </div>
        </div>
    );
}
