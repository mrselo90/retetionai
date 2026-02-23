'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { ArrowRight, Calendar } from 'lucide-react';

export function CTA() {
    const t = useTranslations('Landing.cta');

    return (
        <section className="bg-slate-900 py-20 sm:py-24 px-6">
            <div className="max-w-[860px] mx-auto">
                <div
                    className="relative overflow-hidden rounded-2xl border border-indigo-500/30 px-6 py-14 sm:px-12 sm:py-16 text-center"
                    style={{
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(168,85,247,0.12) 50%, rgba(59,130,246,0.18) 100%)',
                    }}
                >
                    <div
                        aria-hidden
                        className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-40 rounded-full blur-[40px] opacity-70"
                        style={{
                            background: 'radial-gradient(circle, rgba(99,102,241,0.35) 0%, transparent 70%)',
                        }}
                    />

                    <h2 className="relative text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-4 leading-tight">
                        {t('title')}
                    </h2>
                    <p className="relative text-slate-400 text-[1.05rem] max-w-[32rem] mx-auto mb-10 leading-relaxed">
                        {t('subtitle')}
                    </p>

                    <div className="relative flex flex-wrap gap-4 justify-center">
                        <Link
                            href="/signup"
                            className="inline-flex items-center gap-2 text-white font-bold text-base py-4 px-8 rounded-xl no-underline shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                            style={{
                                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                boxShadow: '0 8px 28px rgba(99,102,241,0.45)',
                            }}
                        >
                            {t('primaryCta')} <ArrowRight size={18} aria-hidden />
                        </Link>
                        <Link
                            href="/contact"
                            className="inline-flex items-center gap-2 py-4 px-8 rounded-xl font-semibold text-base no-underline border border-white/20 bg-white/10 text-slate-200 backdrop-blur-sm transition-colors hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                        >
                            <Calendar size={18} aria-hidden /> {t('secondaryCta')}
                        </Link>
                    </div>

                    <p className="relative mt-6 text-slate-500 text-[13px]">{t('footnote')}</p>
                </div>
            </div>
        </section>
    );
}
