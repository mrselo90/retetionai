'use client';

import { useTranslations } from 'next-intl';
import { SCard, SSection } from './PolarisWc';

/* Recete brand: Deep Forest Green, Cream, emerald, gold */
const statColors = ['#F8F5E6', '#10b981', '#F8F5E6', '#f59e0b'];
const statIcons = ['🏪', '↓', '💬', '⭐'];

export function Stats() {
    const t = useTranslations('Landing.stats');

    const stats = [
        { value: t('merchants'), label: t('merchantsLabel') },
        { value: t('returns'), label: t('returnsLabel') },
        { value: t('messages'), label: t('messagesLabel') },
        { value: t('satisfaction'), label: t('satisfactionLabel') },
    ];

    return (
        <SSection className="block px-4 sm:px-6 pt-3 pb-7 sm:pt-4 sm:pb-8 bg-[#f6f4ea] -mt-1 sm:-mt-3 relative z-20">
            <div className="max-w-6xl mx-auto">
                <SCard className="block rounded-2xl sm:rounded-3xl border border-black/5 bg-white shadow-[0_18px_60px_rgba(10,61,46,0.07)] overflow-hidden">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-black/5">
                        {stats.map((stat, i) => (
                            <div
                                key={i}
                                className="relative bg-white p-4 sm:p-5 lg:p-5"
                            >
                                <div
                                    aria-hidden
                                    className="absolute top-0 left-0 h-1 w-full opacity-90"
                                    style={{ background: `linear-gradient(90deg, ${statColors[i]}40, ${statColors[i]})` }}
                                />
                                <div className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-[#f6f4ea] px-2.5 py-1 text-xs font-semibold text-zinc-600">
                                    <span aria-hidden>{statIcons[i]}</span>
                                    {stat.label}
                                </div>
                                <div className="mt-2.5 text-2xl sm:text-3xl lg:text-[2.2rem] font-extrabold tracking-tight text-[#0a3d2e]">
                                    {stat.value}
                                </div>
                            </div>
                        ))}
                    </div>
                </SCard>
            </div>
        </SSection>
    );
}
