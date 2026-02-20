'use client';

import { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Store, Calendar, ShieldAlert, Key } from 'lucide-react';
import { format } from 'date-fns';

interface Merchant {
    id: string;
    name: string;
    created_at: string;
    is_super_admin: boolean;
    integrations: Array<{ provider: string; status: string }>;
}

export default function AdminMerchantsPage() {
    const [merchants, setMerchants] = useState<Merchant[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchMerchants = async () => {
            try {
                const data = await apiClient.get('/api/admin/merchants');
                setMerchants(data.merchants || []);
            } catch (err: any) {
                setError(err.message || 'Failed to fetch merchants');
            } finally {
                setLoading(false);
            }
        };
        fetchMerchants();
    }, []);

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Merchants</h1>
                    <p className="text-zinc-500 mt-2">Manage all registered merchants on the platform.</p>
                </div>
                <Card className="border-none shadow-sm">
                    <CardContent className="p-0">
                        <div className="divide-y divide-zinc-100">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="p-6 flex items-center gap-4">
                                    <div className="w-12 h-12 bg-zinc-200 rounded-lg animate-pulse"></div>
                                    <div className="space-y-2 flex-1">
                                        <Skeleton className="h-5 w-48" />
                                        <Skeleton className="h-4 w-32" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-red-50 text-red-600 rounded-lg border border-red-200">
                <h3 className="font-semibold text-lg flex items-center">
                    <ShieldAlert className="w-5 h-5 mr-2" />
                    An error occurred
                </h3>
                <p className="mt-2">{error}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Merchants</h1>
                    <p className="text-zinc-500 mt-2">
                        Viewing all {merchants.length} registered merchants on the platform.
                    </p>
                </div>
            </div>

            <Card className="border-none shadow-md overflow-hidden bg-white">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-medium">
                            <tr>
                                <th className="px-6 py-4">Merchant</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Integrations</th>
                                <th className="px-6 py-4 text-right">Registered</th>
                                <th className="px-6 py-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 text-zinc-700">
                            {merchants.map((merchant) => {
                                const shopifyInt = merchant.integrations?.find(i => i.provider === 'shopify');
                                const whatsappInt = merchant.integrations?.find(i => i.provider === 'whatsapp');

                                return (
                                    <tr key={merchant.id} className="hover:bg-zinc-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center flex-shrink-0 border border-zinc-200">
                                                    <Store className="w-5 h-5 text-zinc-500" />
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-zinc-900 flex items-center gap-2">
                                                        {merchant.name || 'Unnamed Store'}
                                                        {merchant.is_super_admin && (
                                                            <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 text-[10px] px-1.5 py-0 h-4">
                                                                ADMIN
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-zinc-400 font-mono mt-0.5" title={merchant.id}>
                                                        {merchant.id.split('-')[0]}...
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {shopifyInt?.status === 'active' ? (
                                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                                    Active Store
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-zinc-50 text-zinc-600 border-zinc-200">
                                                    Pending Setup
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-2">
                                                {shopifyInt ? (
                                                    <div className={`px-2 py-1 rounded text-xs font-semibold ${shopifyInt.status === 'active' ? 'bg-[#95bf47]/10 text-[#5e8e3e]' : 'bg-zinc-100 text-zinc-500'}`}>
                                                        Shopify
                                                    </div>
                                                ) : null}
                                                {whatsappInt ? (
                                                    <div className={`px-2 py-1 rounded text-xs font-semibold ${whatsappInt.status === 'active' ? 'bg-[#25D366]/10 text-[#128C7E]' : 'bg-zinc-100 text-zinc-500'}`}>
                                                        WhatsApp
                                                    </div>
                                                ) : null}
                                                {(!shopifyInt && !whatsappInt) && (
                                                    <span className="text-zinc-400 italic text-xs">No integrations</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end text-zinc-500">
                                                <Calendar className="w-4 h-4 mr-2" />
                                                {merchant.created_at ? format(new Date(merchant.created_at), 'MMM d, yyyy') : 'Unknown'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <Badge variant="secondary" className="hover:bg-zinc-200 cursor-not-allowed opacity-50">
                                                <Key className="w-3 h-3 mr-1" />
                                                Impersonate (Soon)
                                            </Badge>
                                        </td>
                                    </tr>
                                );
                            })}
                            {merchants.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                                        No merchants found in the system.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
