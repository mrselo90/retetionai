'use client';

import { useTranslations } from 'next-intl';
import { MessageCircle, Package, BarChart3, Clock, Zap, ShieldCheck } from 'lucide-react';

export function Features() {
    const t = useTranslations('Landing.features');

    const features = [
        {
            icon: MessageCircle,
            title: t('automated'),
            desc: t('automatedDesc'),
            bullets: t('automatedBullets'),
            color: 'text-blue-500',
            bg: 'bg-blue-500/10'
        },
        {
            icon: Package,
            title: t('aiPowered'),
            desc: t('aiPoweredDesc'),
            bullets: t('aiPoweredBullets'),
            color: 'text-purple-500',
            bg: 'bg-purple-500/10'
        },
        {
            icon: BarChart3,
            title: t('analytics'),
            desc: t('analyticsDesc'),
            bullets: t('analyticsBullets'),
            color: 'text-green-500',
            bg: 'bg-green-500/10'
        },
        {
            icon: Clock,
            title: t('realTime'),
            desc: t('realTimeDesc'),
            bullets: t('realTimeBullets'),
            color: 'text-orange-500',
            bg: 'bg-orange-500/10'
        },
        {
            icon: Zap,
            title: t('integration'),
            desc: t('integrationDesc'),
            bullets: t('integrationBullets'),
            color: 'text-yellow-500',
            bg: 'bg-yellow-500/10'
        },
        {
            icon: ShieldCheck,
            title: t('secure'),
            desc: t('secureDesc'),
            bullets: t('secureBullets'),
            color: 'text-teal-500',
            bg: 'bg-teal-500/10'
        }
    ];

    return (
        <section className="py-20 sm:py-28 relative overflow-hidden" id="features">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                        {t('title')}
                    </h2>
                    <p className="text-lg text-muted-foreground">
                        {t('subtitle')}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                    {features.map((feature, index) => (
                        <div
                            key={index}
                            className="group relative rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-300 hover:-translate-y-1"
                        >
                            <div className={`w-14 h-14 rounded-xl ${feature.bg} flex items-center justify-center mb-6 ${feature.color} transition-transform group-hover:scale-110 duration-300`}>
                                <feature.icon className="w-7 h-7" aria-hidden />
                            </div>

                            <h3 className="font-bold text-xl text-foreground mb-3">
                                {feature.title}
                            </h3>

                            <p className="text-muted-foreground leading-relaxed mb-4">
                                {feature.desc}
                            </p>

                            <div className="border-t border-border pt-4 mt-auto">
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                                    {feature.bullets}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
