'use client';

import { useTranslations } from 'next-intl';
import { MessageCircle, Bot, BarChart3, Clock, Zap, ShieldCheck } from 'lucide-react';

/* Recete brand: Deep Forest Green #0A3D2E, Cream #F8F5E6, emerald, gold */
const featureConfig = [
    { icon: MessageCircle, color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)', key: 'automated', descKey: 'automatedDesc', bulletsKey: 'automatedBullets' },
    { icon: Bot, color: '#F8F5E6', bg: 'rgba(248,245,230,0.12)', border: 'rgba(248,245,230,0.25)', key: 'aiPowered', descKey: 'aiPoweredDesc', bulletsKey: 'aiPoweredBullets' },
    { icon: BarChart3, color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)', key: 'analytics', descKey: 'analyticsDesc', bulletsKey: 'analyticsBullets' },
    { icon: Clock, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', key: 'realtimeSync', descKey: 'realtimeSyncDesc', bulletsKey: 'realtimeSyncBullets' },
    { icon: Zap, color: '#F8F5E6', bg: 'rgba(248,245,230,0.12)', border: 'rgba(248,245,230,0.25)', key: 'easyIntegration', descKey: 'easyIntegrationDesc', bulletsKey: 'easyIntegrationBullets' },
    { icon: ShieldCheck, color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)', key: 'security', descKey: 'securityDesc', bulletsKey: 'securityBullets' },
];

export function Features() {
    const t = useTranslations('Landing.features');

    return (
        <section id="features" className="py-14 sm:py-20 lg:py-24 px-4 sm:px-6 bg-[#f6f4ea] scroll-mt-24">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-10 sm:mb-14">
                    <span
                        className="inline-block rounded-full border px-4 py-1.5 text-xs sm:text-[13px] font-semibold uppercase tracking-wider mb-3 sm:mb-4"
                        style={{
                            background: 'rgba(10,61,46,0.04)',
                            borderColor: 'rgba(10,61,46,0.12)',
                            color: '#0A3D2E',
                        }}
                    >
                        Features
                    </span>
                    <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold mb-3 sm:mb-4 leading-tight text-[#0A3D2E] px-2 tracking-tight">
                        {t('title')}
                    </h2>
                    <p className="text-sm sm:text-base max-w-[36rem] mx-auto text-zinc-600 px-2">{t('subtitle')}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
                    {featureConfig.map((f) => {
                        const Icon = f.icon;
                        const bullets = t(f.bulletsKey).split('·').map((b: string) => b.trim());
                        return (
                            <div
                                key={f.key}
                                className="group rounded-2xl border border-black/5 bg-white p-5 sm:p-6 shadow-[0_10px_30px_rgba(10,61,46,.05)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(10,61,46,.1)]"
                            >
                                <div
                                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-4 sm:mb-5 border shrink-0"
                                    style={{ background: f.bg, borderColor: f.border }}
                                >
                                    <Icon size={22} color={f.color} aria-hidden />
                                </div>
                                <h3 className="font-bold text-base sm:text-[1.05rem] mb-2 text-[#0A3D2E] tracking-tight">{t(f.key)}</h3>
                                <p className="text-sm leading-relaxed mb-3 sm:mb-4 text-zinc-600">{t(f.descKey)}</p>
                                <div className="border-t border-black/5 pt-3 sm:pt-4 flex flex-wrap gap-1.5">
                                    {bullets.map((b: string, i: number) => (
                                        <span
                                            key={i}
                                            className="text-[11px] sm:text-xs font-semibold tracking-wide rounded-md px-2 py-0.5 border"
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
