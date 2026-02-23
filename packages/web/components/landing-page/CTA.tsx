'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { ArrowRight, Calendar } from 'lucide-react';

export function CTA() {
    const t = useTranslations('Landing.cta');

    return (
        <section className="py-14 sm:py-20 lg:py-24 px-4 sm:px-6" style={{ background: '#0A3D2E' }}>
            <div className="max-w-3xl mx-auto">
                <div
                    className="relative overflow-hidden rounded-xl sm:rounded-2xl border border-[#F8F5E6]/25 px-4 py-10 sm:px-8 sm:py-14 md:px-12 md:py-16 text-center"
                    style={{
                        background: 'linear-gradient(135deg, rgba(248,245,230,0.08) 0%, rgba(16,185,129,0.1) 50%, rgba(245,158,11,0.06) 100%)',
                    }}
                >
                    <div
                        aria-hidden
                        className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 sm:w-80 sm:h-40 rounded-full blur-[40px] opacity-70"
                        style={{
                            background: 'radial-gradient(circle, rgba(248,245,230,0.15) 0%, transparent 70%)',
                        }}
                    />

                    <h2 className="relative text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold mb-3 sm:mb-4 leading-tight text-[#F8F5E6] px-2">
                        {t('title')}
                    </h2>
                    <p className="relative text-sm sm:text-base max-w-[32rem] mx-auto mb-8 sm:mb-10 leading-relaxed opacity-90 text-[#F8F5E6] px-2">
                        {t('subtitle')}
                    </p>

                    <div className="relative flex flex-col sm:flex-row flex-wrap gap-3 justify-center items-stretch sm:items-center">
                        <Link
                            href="/signup"
                            className="inline-flex items-center justify-center gap-2 font-bold text-sm sm:text-base py-3.5 px-6 sm:py-4 sm:px-8 rounded-xl no-underline shadow-lg transition-all hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A3D2E] min-h-[44px] sm:min-h-0"
                            style={{
                                background: '#F8F5E6',
                                color: '#0A3D2E',
                                boxShadow: '0 8px 28px rgba(248,245,230,0.25)',
                            }}
                        >
                            {t('primaryCta')} <ArrowRight size={18} aria-hidden />
                        </Link>
                        <Link
                            href="/contact"
                            className="inline-flex items-center justify-center gap-2 py-3.5 px-6 sm:py-4 sm:px-8 rounded-xl font-semibold text-sm sm:text-base no-underline border border-[#F8F5E6]/30 bg-white/5 backdrop-blur-sm transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A3D2E] min-h-[44px] sm:min-h-0 text-[#F8F5E6]"
                        >
                            <Calendar size={18} aria-hidden /> {t('secondaryCta')}
                        </Link>
                    </div>

                    <p className="relative mt-4 sm:mt-6 text-xs sm:text-[13px] opacity-75 text-[#F8F5E6] px-2">{t('footnote')}</p>
                </div>
            </div>
        </section>
    );
}
