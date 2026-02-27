'use client';

import { useTranslations } from 'next-intl';
import { Store, Bot, LineChart } from 'lucide-react';

const steps = [
    {
        icon: Store,
        iconColor: '#0A3D2E',
        iconBg: '#f6f4ea',
        iconBorder: 'rgba(10,61,46,0.25)',
        featured: false,
        titleKey: 'step1Title',
        descKey: 'step1Desc',
    },
    {
        icon: Bot,
        iconColor: '#f8f5e6',
        iconBg: '#0A3D2E',
        iconBorder: 'rgba(10,61,46,0.8)',
        featured: true,
        titleKey: 'step2Title',
        descKey: 'step2Desc',
    },
    {
        icon: LineChart,
        iconColor: '#059669',
        iconBg: 'rgba(5,150,105,0.10)',
        iconBorder: 'rgba(5,150,105,0.25)',
        featured: false,
        titleKey: 'step3Title',
        descKey: 'step3Desc',
    },
];

export function HowItWorks() {
    const t = useTranslations('Landing.howItWorks');

    return (
        <section
            id="how-it-works"
            className="py-14 sm:py-16 lg:py-20 px-4 sm:px-6 scroll-mt-24"
            style={{ background: '#f6f4ea' }}
        >
            <div className="max-w-6xl mx-auto">
                <div className="rounded-2xl sm:rounded-3xl border border-black/5 bg-white p-5 sm:p-7 lg:p-8 shadow-[0_16px_50px_rgba(10,61,46,.06)]">

                    <div className="text-center mb-8 sm:mb-10 lg:mb-12">
                        <span
                            className="inline-block rounded-full border px-4 py-1.5 text-xs sm:text-[13px] font-semibold uppercase tracking-wider mb-3 sm:mb-4"
                            style={{ background: 'rgba(10,61,46,.05)', borderColor: 'rgba(10,61,46,.15)', color: '#0A3D2E' }}
                        >
                            How it Works
                        </span>
                        <h2
                            className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold mb-3 sm:mb-4 leading-tight px-2 tracking-tight"
                            style={{ color: '#0A3D2E' }}
                        >
                            {t('title')}
                        </h2>
                        <p className="text-sm sm:text-base max-w-xl mx-auto text-zinc-600 px-2 text-center leading-relaxed">
                            {t('subtitle')}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-7 sm:gap-5 lg:gap-8 relative items-start">
                        {/* Connector line — desktop only */}
                        <div
                            aria-hidden
                            className="hidden sm:block absolute top-[4.5rem] left-[16.67%] right-[16.67%] h-px z-0 opacity-40"
                            style={{ background: 'linear-gradient(90deg, rgba(10,61,46,.1), rgba(5,150,105,.5), rgba(10,61,46,.1))' }}
                        />

                        {steps.map((step, i) => {
                            const Icon = step.icon;
                            return (
                                <div key={i} className="flex flex-col items-center text-center relative z-10">
                                    <div
                                        className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-6 border relative shrink-0 shadow-[0_12px_30px_rgba(10,61,46,.08)]"
                                        style={{ background: step.iconBg, borderColor: step.iconBorder }}
                                    >
                                        <Icon size={32} color={step.iconColor} aria-hidden />
                                        <span
                                            className="absolute -top-1.5 -right-1.5 w-6 h-6 sm:w-7 sm:h-7 rounded-full text-white text-xs sm:text-[13px] font-extrabold flex items-center justify-center shadow-lg"
                                            style={{ background: step.featured ? '#059669' : '#0A3D2E' }}
                                        >
                                            {i + 1}
                                        </span>
                                    </div>
                                    <h3 className="font-bold text-base sm:text-lg mb-2 sm:mb-3 px-1 tracking-tight" style={{ color: '#0A3D2E' }}>
                                        {t(step.titleKey)}
                                    </h3>
                                    <p className="text-sm leading-relaxed max-w-[280px] mx-auto text-zinc-600">
                                        {t(step.descKey)}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
}
