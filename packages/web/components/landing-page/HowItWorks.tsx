'use client';

import { useTranslations } from 'next-intl';
import { Store, Bot, LineChart, ArrowRight } from 'lucide-react';

export function HowItWorks() {
    const t = useTranslations('Landing.howItWorks');

    const steps = [
        {
            icon: Store,
            title: t('step1Title'),
            desc: t('step1Desc'),
            step: 1
        },
        {
            icon: Bot,
            title: t('step2Title'),
            desc: t('step2Desc'),
            step: 2
        },
        {
            icon: LineChart,
            title: t('step3Title'),
            desc: t('step3Desc'),
            step: 3
        }
    ];

    return (
        <section className="py-20 sm:py-28 bg-muted/30 border-y border-border/50 relative overflow-hidden">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                        {t('title')}
                    </h2>
                    <p className="text-lg text-muted-foreground">
                        {t('subtitle')}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                    {/* Connector Line (Desktop) */}
                    <div className="hidden md:block absolute top-[2.5rem] left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-border via-primary/30 to-border z-0" />

                    {steps.map((step, index) => (
                        <div key={index} className="relative z-10 flex flex-col items-center text-center group">
                            <div className="relative mb-6">
                                <div className="w-20 h-20 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-center text-primary group-hover:scale-110 transition-all duration-300 group-hover:border-primary/50 group-hover:shadow-lg">
                                    <step.icon className="w-9 h-9" aria-hidden />
                                </div>
                                <div className="absolute -bottom-3 -right-3 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shadow-md ring-4 ring-background">
                                    {step.step}
                                </div>
                            </div>

                            <h3 className="text-xl font-bold text-foreground mb-3">
                                {step.title}
                            </h3>

                            <p className="text-muted-foreground leading-relaxed max-w-xs mx-auto">
                                {step.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
