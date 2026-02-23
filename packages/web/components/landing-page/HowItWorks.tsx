'use client';

import { useTranslations } from 'next-intl';
import { Store, Bot, LineChart } from 'lucide-react';

const steps = [
    {
        icon: Store,
        color: '#6366f1',
        bg: 'rgba(99,102,241,0.15)',
        border: 'rgba(99,102,241,0.3)',
        titleKey: 'step1Title',
        descKey: 'step1Desc',
    },
    {
        icon: Bot,
        color: '#22c55e',
        bg: 'rgba(34,197,94,0.15)',
        border: 'rgba(34,197,94,0.3)',
        titleKey: 'step2Title',
        descKey: 'step2Desc',
    },
    {
        icon: LineChart,
        color: '#3b82f6',
        bg: 'rgba(59,130,246,0.15)',
        border: 'rgba(59,130,246,0.3)',
        titleKey: 'step3Title',
        descKey: 'step3Desc',
    },
];

export function HowItWorks() {
    const t = useTranslations('Landing.howItWorks');

    return (
        <section className="py-20 sm:py-24 px-6" style={{ background: 'linear-gradient(180deg, #0a0f1e 0%, #0f172a 100%)' }}>
            <div className="max-w-[1100px] mx-auto">
                <div className="text-center mb-14 sm:mb-16">
                    <span
                        className="inline-block rounded-full border px-4 py-1.5 text-[13px] font-semibold uppercase tracking-wider mb-4"
                        style={{
                            background: 'rgba(34,197,94,0.14)',
                            borderColor: 'rgba(34,197,94,0.28)',
                            color: '#4ade80',
                        }}
                    >
                        How it Works
                    </span>
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-4 leading-tight">
                        {t('title')}
                    </h2>
                    <p className="text-slate-500 text-[1.05rem] max-w-[28rem] mx-auto">{t('subtitle')}</p>
                </div>

                <div className="grid sm:grid-cols-3 gap-10 sm:gap-8 relative">
                    {/* Connector line — desktop */}
                    <div
                        aria-hidden
                        className="hidden sm:block absolute top-14 left-[16.67%] right-[16.67%] h-px z-0"
                        style={{
                            background: 'linear-gradient(90deg, rgba(99,102,241,0.45), rgba(34,197,94,0.45), rgba(59,130,246,0.45))',
                        }}
                    />

                    {steps.map((step, i) => {
                        const Icon = step.icon;
                        return (
                            <div key={i} className="flex flex-col items-center text-center relative z-10">
                                <div
                                    className="w-28 h-28 rounded-2xl flex items-center justify-center mb-6 border relative"
                                    style={{ background: step.bg, borderColor: step.border }}
                                >
                                    <Icon size={40} color={step.color} aria-hidden />
                                    <span
                                        className="absolute -top-2 -right-2 w-7 h-7 rounded-full text-white text-[13px] font-extrabold flex items-center justify-center shadow-lg"
                                        style={{ background: step.color, boxShadow: `0 0 12px ${step.color}80` }}
                                    >
                                        {i + 1}
                                    </span>
                                </div>
                                <h3 className="text-slate-100 font-bold text-lg mb-3">{t(step.titleKey)}</h3>
                                <p className="text-slate-500 text-sm leading-relaxed max-w-[280px]">{t(step.descKey)}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
