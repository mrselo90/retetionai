'use client';

import { useTranslations } from 'next-intl';
import { MessageCircle, Bot, BarChart3, Clock, Zap, ShieldCheck } from 'lucide-react';

const featureConfig = [
    {
        icon: MessageCircle,
        color: '#22c55e',
        bg: 'rgba(34,197,94,0.1)',
        border: 'rgba(34,197,94,0.2)',
        key: 'automated',
        descKey: 'automatedDesc',
        bulletsKey: 'automatedBullets',
    },
    {
        icon: Bot,
        color: '#6366f1',
        bg: 'rgba(99,102,241,0.1)',
        border: 'rgba(99,102,241,0.2)',
        key: 'aiPowered',
        descKey: 'aiPoweredDesc',
        bulletsKey: 'aiPoweredBullets',
    },
    {
        icon: BarChart3,
        color: '#3b82f6',
        bg: 'rgba(59,130,246,0.1)',
        border: 'rgba(59,130,246,0.2)',
        key: 'analytics',
        descKey: 'analyticsDesc',
        bulletsKey: 'analyticsBullets',
    },
    {
        icon: Clock,
        color: '#f59e0b',
        bg: 'rgba(245,158,11,0.1)',
        border: 'rgba(245,158,11,0.2)',
        key: 'realtimeSync',
        descKey: 'realtimeSyncDesc',
        bulletsKey: 'realtimeSyncBullets',
    },
    {
        icon: Zap,
        color: '#a855f7',
        bg: 'rgba(168,85,247,0.1)',
        border: 'rgba(168,85,247,0.2)',
        key: 'easyIntegration',
        descKey: 'easyIntegrationDesc',
        bulletsKey: 'easyIntegrationBullets',
    },
    {
        icon: ShieldCheck,
        color: '#14b8a6',
        bg: 'rgba(20,184,166,0.1)',
        border: 'rgba(20,184,166,0.2)',
        key: 'security',
        descKey: 'securityDesc',
        bulletsKey: 'securityBullets',
    },
];

export function Features() {
    const t = useTranslations('Landing.features');

    return (
        <section className="bg-[#0a0f1e] py-20 sm:py-24 px-6">
            <div className="max-w-[1100px] mx-auto">
                <div className="text-center mb-14 sm:mb-16">
                    <span
                        className="inline-block rounded-full border px-4 py-1.5 text-[13px] font-semibold uppercase tracking-wider mb-4"
                        style={{
                            background: 'rgba(99,102,241,0.14)',
                            borderColor: 'rgba(99,102,241,0.28)',
                            color: '#818cf8',
                        }}
                    >
                        Features
                    </span>
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-4 leading-tight">
                        {t('title')}
                    </h2>
                    <p className="text-slate-500 text-[1.05rem] max-w-[32rem] mx-auto">{t('subtitle')}</p>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                    {featureConfig.map((f) => {
                        const Icon = f.icon;
                        const bullets = t(f.bulletsKey).split('·').map((b: string) => b.trim());
                        return (
                            <div
                                key={f.key}
                                className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-6 transition-colors hover:border-white/[0.1]"
                            >
                                <div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 border"
                                    style={{ background: f.bg, borderColor: f.border }}
                                >
                                    <Icon size={22} color={f.color} aria-hidden />
                                </div>
                                <h3 className="text-slate-100 font-bold text-[1.05rem] mb-2">{t(f.key)}</h3>
                                <p className="text-slate-500 text-sm leading-relaxed mb-4">{t(f.descKey)}</p>
                                <div className="border-t border-white/[0.06] pt-4 flex flex-wrap gap-1.5">
                                    {bullets.map((b: string, i: number) => (
                                        <span
                                            key={i}
                                            className="text-[11px] font-semibold tracking-wide rounded-md px-2 py-0.5 border"
                                            style={{ color: f.color, background: f.bg, borderColor: f.border }}
                                        >
                                            {b}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
