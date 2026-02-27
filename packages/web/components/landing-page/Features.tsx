'use client';

import { useTranslations } from 'next-intl';
import { MessageCircle, Bot, BarChart3, Clock, Zap, ShieldCheck } from 'lucide-react';

/* Accessible contrast: all icons on white card background */
const featureConfig = [
    {
        icon: MessageCircle,
        iconColor: '#059669',     // emerald-600
        iconBg: 'rgba(5,150,105,0.10)',
        iconBorder: 'rgba(5,150,105,0.22)',
        tagColor: '#065f46',
        tagBg: 'rgba(5,150,105,0.08)',
        tagBorder: 'rgba(5,150,105,0.18)',
        key: 'automated',
        descKey: 'automatedDesc',
        bulletsKey: 'automatedBullets',
    },
    {
        icon: Bot,
        iconColor: '#0a3d2e',     // brand green — readable on white
        iconBg: 'rgba(10,61,46,0.08)',
        iconBorder: 'rgba(10,61,46,0.18)',
        tagColor: '#0a3d2e',
        tagBg: 'rgba(10,61,46,0.06)',
        tagBorder: 'rgba(10,61,46,0.15)',
        key: 'aiPowered',
        descKey: 'aiPoweredDesc',
        bulletsKey: 'aiPoweredBullets',
    },
    {
        icon: BarChart3,
        iconColor: '#059669',
        iconBg: 'rgba(5,150,105,0.10)',
        iconBorder: 'rgba(5,150,105,0.22)',
        tagColor: '#065f46',
        tagBg: 'rgba(5,150,105,0.08)',
        tagBorder: 'rgba(5,150,105,0.18)',
        key: 'analytics',
        descKey: 'analyticsDesc',
        bulletsKey: 'analyticsBullets',
    },
    {
        icon: Clock,
        iconColor: '#b45309',     // amber-700
        iconBg: 'rgba(180,83,9,0.08)',
        iconBorder: 'rgba(180,83,9,0.18)',
        tagColor: '#92400e',
        tagBg: 'rgba(180,83,9,0.06)',
        tagBorder: 'rgba(180,83,9,0.15)',
        key: 'realtimeSync',
        descKey: 'realtimeSyncDesc',
        bulletsKey: 'realtimeSyncBullets',
    },
    {
        icon: Zap,
        iconColor: '#0a3d2e',
        iconBg: 'rgba(10,61,46,0.08)',
        iconBorder: 'rgba(10,61,46,0.18)',
        tagColor: '#0a3d2e',
        tagBg: 'rgba(10,61,46,0.06)',
        tagBorder: 'rgba(10,61,46,0.15)',
        key: 'easyIntegration',
        descKey: 'easyIntegrationDesc',
        bulletsKey: 'easyIntegrationBullets',
    },
    {
        icon: ShieldCheck,
        iconColor: '#059669',
        iconBg: 'rgba(5,150,105,0.10)',
        iconBorder: 'rgba(5,150,105,0.22)',
        tagColor: '#065f46',
        tagBg: 'rgba(5,150,105,0.08)',
        tagBorder: 'rgba(5,150,105,0.18)',
        key: 'security',
        descKey: 'securityDesc',
        bulletsKey: 'securityBullets',
    },
];

export function Features() {
    const t = useTranslations('Landing.features');

    return (
        <section
            id="features"
            className="py-14 sm:py-16 lg:py-20 px-4 sm:px-6 scroll-mt-24"
            style={{ background: '#ffffff' }}  /* white break — alternating sections */
        >
            <div className="max-w-6xl mx-auto">
                {/* Section header */}
                <div className="text-center mb-8 sm:mb-10 lg:mb-12">
                    <span
                        className="inline-block rounded-full border px-4 py-1.5 text-xs sm:text-[13px] font-semibold uppercase tracking-wider mb-3 sm:mb-4"
                        style={{ background: 'rgba(10,61,46,0.05)', borderColor: 'rgba(10,61,46,0.15)', color: '#0A3D2E' }}
                    >
                        Features
                    </span>
                    <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold mb-3 sm:mb-4 leading-tight px-2 tracking-tight" style={{ color: '#0A3D2E' }}>
                        {t('title')}
                    </h2>
                    <p className="text-sm sm:text-base max-w-2xl mx-auto text-zinc-600 px-2 text-center leading-relaxed">{t('subtitle')}</p>
                </div>

                {/* Feature cards grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-5">
                    {featureConfig.map((f) => {
                        const Icon = f.icon;
                        const bullets = t(f.bulletsKey).split('·').map((b: string) => b.trim()).filter(Boolean);
                        return (
                            <article
                                key={f.key}
                                className="group h-full rounded-2xl border border-zinc-100 bg-white p-5 sm:p-6 shadow-[0_4px_20px_rgba(10,61,46,.06)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_14px_32px_rgba(10,61,46,.10)] flex flex-col"
                            >
                                {/* Icon */}
                                <div
                                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-4 sm:mb-5 border shrink-0"
                                    style={{ background: f.iconBg, borderColor: f.iconBorder }}
                                >
                                    <Icon size={22} color={f.iconColor} aria-hidden />
                                </div>

                                <h3 className="font-bold text-base sm:text-[1.05rem] mb-2 tracking-tight" style={{ color: '#0A3D2E' }}>
                                    {t(f.key)}
                                </h3>
                                <p className="text-sm leading-relaxed mb-3 sm:mb-4 text-zinc-600">{t(f.descKey)}</p>

                                {/* Bullet tags */}
                                <div className="mt-auto border-t border-zinc-100 pt-3 sm:pt-4 flex flex-wrap gap-1.5">
                                    {bullets.map((b: string, i: number) => (
                                        <span
                                            key={i}
                                            className="text-[11px] sm:text-xs font-semibold tracking-wide rounded-md px-2 py-0.5 border"
                                            style={{ color: f.tagColor, background: f.tagBg, borderColor: f.tagBorder }}
                                        >
                                            {b}
                                        </span>
                                    ))}
                                </div>
                            </article>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
