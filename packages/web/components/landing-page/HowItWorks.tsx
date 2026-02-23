'use client';

import { useTranslations } from 'next-intl';
import { Store, Bot, LineChart } from 'lucide-react';

/* Recete brand: Deep Forest Green, Cream, emerald, gold */
const steps = [
    {
        icon: Store,
        color: '#0A3D2E',
        bg: 'rgba(10,61,46,0.12)',
        border: 'rgba(10,61,46,0.3)',
        titleKey: 'step1Title',
        descKey: 'step1Desc',
    },
    {
        icon: Bot,
        color: '#10b981',
        bg: 'rgba(16,185,129,0.15)',
        border: 'rgba(16,185,129,0.3)',
        titleKey: 'step2Title',
        descKey: 'step2Desc',
    },
    {
        icon: LineChart,
        color: '#0A3D2E',
        bg: 'rgba(248,245,230,0.2)',
        border: 'rgba(10,61,46,0.25)',
        titleKey: 'step3Title',
        descKey: 'step3Desc',
    },
];

export function HowItWorks() {
    const t = useTranslations('Landing.howItWorks');

    return (
        <section className="py-20 sm:py-24 px-6" style={{ background: 'linear-gradient(180deg, #0A3D2E 0%, #0d4a38 100%)' }}>
            <div className="max-w-[1100px] mx-auto">
                <div className="text-center mb-14 sm:mb-16">
                    <span
                        className="inline-block rounded-full border px-4 py-1.5 text-[13px] font-semibold uppercase tracking-wider mb-4"
                        style={{
                            background: 'rgba(248,245,230,0.12)',
                            borderColor: 'rgba(248,245,230,0.28)',
                            color: '#F8F5E6',
                        }}
                    >
                        How it Works
                    </span>
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-4 leading-tight" style={{ color: '#F8F5E6' }}>
                        {t('title')}
                    </h2>
                    <p className="text-[1.05rem] max-w-[28rem] mx-auto opacity-85" style={{ color: '#F8F5E6' }}>{t('subtitle')}</p>
                </div>

                <div className="grid sm:grid-cols-3 gap-10 sm:gap-8 relative">
                    {/* Connector line — desktop */}
                    <div
                        aria-hidden
                        className="hidden sm:block absolute top-14 left-[16.67%] right-[16.67%] h-px z-0 opacity-5"
                        style={{
                            background: 'linear-gradient(90deg, #F8F5E6, #10b981, #F8F5E6)',
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
                                <h3 className="font-bold text-lg mb-3" style={{ color: '#F8F5E6' }}>{t(step.titleKey)}</h3>
                                <p className="text-sm leading-relaxed max-w-[280px] opacity-85" style={{ color: '#F8F5E6' }}>{t(step.descKey)}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
