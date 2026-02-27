'use client';

import { useTranslations } from 'next-intl';

const statAccents = ['#0a3d2e', '#059669', '#0a3d2e', '#b45309'];
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
        <section className="px-4 sm:px-6 pt-3 pb-7 sm:pt-4 sm:pb-8 -mt-1 sm:-mt-3 relative z-20" style={{ background: '#f6f4ea' }}>
            <div className="max-w-6xl mx-auto">
                <div className="rounded-2xl sm:rounded-3xl border border-zinc-100 bg-white shadow-[0_18px_60px_rgba(10,61,46,0.07)] overflow-hidden">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-zinc-100">
                        {stats.map((stat, i) => (
                            <div key={i} className="relative bg-white p-4 sm:p-5 lg:p-5">
                                {/* Accent top bar */}
                                <div
                                    aria-hidden
                                    className="absolute top-0 left-0 h-[3px] w-full"
                                    style={{ background: statAccents[i] }}
                                />
                                <div className="inline-flex items-center gap-2 rounded-full border border-zinc-100 bg-[#f6f4ea] px-2.5 py-1 text-xs font-semibold text-zinc-600">
                                    <span aria-hidden>{statIcons[i]}</span>
                                    {stat.label}
                                </div>
                                <div className="mt-2.5 text-2xl sm:text-3xl lg:text-[2.2rem] font-extrabold tracking-tight" style={{ color: statAccents[i] }}>
                                    {stat.value}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
