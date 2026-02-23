'use client';

import { useTranslations } from 'next-intl';

const statColors = ['#6366f1', '#22c55e', '#3b82f6', '#f59e0b'];
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
        <section className="border-b border-white/6" style={{ background: 'linear-gradient(180deg, #0f172a 0%, #1a2540 100%)' }}>
            <div className="max-w-[1100px] mx-auto px-6 py-12 sm:py-14">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-0">
                    {stats.map((stat, i) => (
                        <div
                            key={i}
                            className={`text-center py-6 px-4 border-white/[0.07] ${i === 0 || i === 2 ? 'border-r' : ''} ${i < 3 && i !== 2 ? 'sm:border-r' : ''}`}
                        >
                            <div
                                className="text-3xl sm:text-4xl font-extrabold leading-none mb-2 tracking-tight"
                                style={{ color: statColors[i] }}
                            >
                                {statIcons[i]} {stat.value}
                            </div>
                            <div className="text-sm text-slate-500 font-medium">{stat.label}</div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
