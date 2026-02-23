'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { ArrowRight, Calendar } from 'lucide-react';

export function CTA() {
    const t = useTranslations('Landing.cta');

    return (
        <section className="py-20 sm:py-24 px-6" style={{ background: '#0A3D2E' }}>
            <div className="max-w-[860px] mx-auto">
                <div
                    className="relative overflow-hidden rounded-2xl border border-[#F8F5E6]/25 px-6 py-14 sm:px-12 sm:py-16 text-center"
                    style={{
                        background: 'linear-gradient(135deg, rgba(248,245,230,0.08) 0%, rgba(16,185,129,0.1) 50%, rgba(245,158,11,0.06) 100%)',
                    }}
                >
                    <div
                        aria-hidden
                        className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-40 rounded-full blur-[40px] opacity-70"
                        style={{
                            background: 'radial-gradient(circle, rgba(248,245,230,0.15) 0%, transparent 70%)',
                        }}
                    />

                    <h2 className="relative text-2xl sm:text-3xl md:text-4xl font-extrabold mb-4 leading-tight" style={{ color: '#F8F5E6' }}>
                        {t('title')}
                    </h2>
                    <p className="relative text-[1.05rem] max-w-[32rem] mx-auto mb-10 leading-relaxed opacity-90" style={{ color: '#F8F5E6' }}>
                        {t('subtitle')}
                    </p>

                    <div className="relative flex flex-wrap gap-4 justify-center">
                        <Link
                            href="/signup"
                            className="inline-flex items-center gap-2 font-bold text-base py-4 px-8 rounded-xl no-underline shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A3D2E]"
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
                            className="inline-flex items-center gap-2 py-4 px-8 rounded-xl font-semibold text-base no-underline border border-[#F8F5E6]/30 bg-white/5 backdrop-blur-sm transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A3D2E]"
                            style={{ color: '#F8F5E6' }}
                        >
                            <Calendar size={18} aria-hidden /> {t('secondaryCta')}
                        </Link>
                    </div>

                    <p className="relative mt-6 text-[13px] opacity-75" style={{ color: '#F8F5E6' }}>{t('footnote')}</p>
                </div>
            </div>
        </section>
    );
}
