'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { ArrowRight } from 'lucide-react';

export function CTA() {
    const t = useTranslations('Landing.cta');

    return (
        <section className="py-20 sm:py-28 relative overflow-hidden">
            <div className="absolute inset-0 bg-primary/5 -z-10" />
            <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10 -z-10" />

            <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-6 tracking-tight">
                    {t('title')}
                </h2>

                <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
                    {t('subtitle')}
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link
                        href="/signup"
                        className="w-full sm:w-auto min-h-[56px] inline-flex items-center justify-center gap-2 px-10 py-4 bg-primary text-primary-foreground font-bold text-lg rounded-xl hover:opacity-90 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-primary/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                        {t('button')}
                        <ArrowRight className="w-5 h-5" aria-hidden />
                    </Link>
                    <Link
                        href="/demo"
                        className="w-full sm:w-auto min-h-[56px] inline-flex items-center justify-center px-10 py-4 border border-border bg-card text-foreground font-semibold text-lg rounded-xl hover:bg-muted transition-all hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                        {t('secondaryButton')}
                    </Link>
                </div>

                <p className="mt-6 text-sm text-muted-foreground/80">
                    {t('meta')}
                </p>
            </div>
        </section>
    );
}
