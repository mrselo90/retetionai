'use client';

import { useTranslations } from 'next-intl';

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
        <section className="border-b border-[#F8F5E6]/10" style={{ background: 'linear-gradient(180deg, #0A3D2E 0%, #0d4a38 100%)' }}>
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-px sm:gap-0 bg-[#F8F5E6]/10">
                    {stats.map((stat, i) => (
                        <div
                            key={i}
                            className="text-center py-6 sm:py-8 px-3 sm:px-4 bg-[#0A3D2E] sm:bg-transparent sm:border-r border-[#F8F5E6]/10 last:border-r-0"
                        >
                            <div
                                className="text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight mb-1.5 sm:mb-2 tracking-tight break-words"
                                style={{ color: statColors[i] }}
                            >
                                <span aria-hidden>{statIcons[i]}</span> {stat.value}
                            </div>
                            <div className="text-xs sm:text-sm font-medium opacity-80 line-clamp-2 sm:line-clamp-none" style={{ color: '#F8F5E6' }}>{stat.label}</div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
