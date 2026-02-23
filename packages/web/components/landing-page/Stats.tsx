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
            <div className="max-w-[1100px] mx-auto px-6 py-12 sm:py-14">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-0">
                    {stats.map((stat, i) => (
                        <div
                            key={i}
                            className={`text-center py-6 px-4 border-[#F8F5E6]/10 ${i === 0 || i === 2 ? 'border-r' : ''} ${i < 3 && i !== 2 ? 'sm:border-r' : ''}`}
                        >
                            <div
                                className="text-3xl sm:text-4xl font-extrabold leading-none mb-2 tracking-tight"
                                style={{ color: statColors[i] }}
                            >
                                {statIcons[i]} {stat.value}
                            </div>
                            <div className="text-sm font-medium opacity-80" style={{ color: '#F8F5E6' }}>{stat.label}</div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
