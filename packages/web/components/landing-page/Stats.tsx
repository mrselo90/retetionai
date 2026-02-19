'use client';

import { useTranslations } from 'next-intl';

export function Stats() {
    const t = useTranslations('Landing.stats');

    const stats = [
        {
            value: t('merchants'),
            label: t('merchantsLabel'),
            color: 'text-foreground'
        },
        {
            value: t('returns'),
            label: t('returnsLabel'),
            color: 'text-green-600'
        },
        {
            value: t('messages'),
            label: t('messagesLabel'),
            color: 'text-blue-600'
        },
        {
            value: t('satisfaction'),
            label: t('satisfactionLabel'),
            color: 'text-orange-500'
        }
    ];

    return (
        <section className="border-y border-border/50 bg-card/30 backdrop-blur-sm py-10">
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
                    {stats.map((stat, index) => (
                        <div key={index} className="text-center group">
                            <p className={`text-3xl sm:text-4xl font-bold ${stat.color} mb-1 transition-transform group-hover:scale-110 duration-300`}>
                                {stat.value}
                            </p>
                            <p className="text-sm sm:text-base text-muted-foreground font-medium">
                                {stat.label}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
