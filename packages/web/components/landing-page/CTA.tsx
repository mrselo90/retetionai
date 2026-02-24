'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { ArrowRight, Calendar } from 'lucide-react';
import { SButton, SCard, SSection } from './PolarisWc';

export function CTA() {
    const t = useTranslations('Landing.cta');

    return (
        <SSection id="cta" className="block py-14 sm:py-20 lg:py-24 px-4 sm:px-6 bg-[#f6f4ea] scroll-mt-24">
            <div className="max-w-5xl mx-auto">
                <SCard
                    className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-[#0A3D2E]/10 px-4 py-10 sm:px-8 sm:py-14 md:px-12 md:py-16 text-center"
                    style={{
                        background: 'linear-gradient(135deg, #0A3D2E 0%, #0d4a38 60%, #125542 100%)',
                    }}
                >
                    <div
                        aria-hidden
                        className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 sm:w-80 sm:h-40 rounded-full blur-[40px] opacity-70"
                        style={{
                            background: 'radial-gradient(circle, rgba(248,245,230,0.15) 0%, transparent 70%)',
                        }}
                    />
                    <div
                        aria-hidden
                        className="absolute -bottom-10 -right-8 w-44 h-44 rounded-full blur-3xl opacity-60"
                        style={{ background: 'radial-gradient(circle, rgba(245,158,11,.18) 0%, transparent 70%)' }}
                    />

                    <h2 className="relative text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold mb-3 sm:mb-4 leading-tight text-[#F8F5E6] px-2">
                        {t('title')}
                    </h2>
                    <div className="relative mt-6 sm:mt-8 flex flex-col sm:flex-row flex-wrap gap-3 justify-center items-stretch sm:items-center">
                        <Link
                            href="/signup"
                            className="inline-block"
                        >
                            <SButton
                                className="inline-flex items-center justify-center gap-2 font-bold text-sm sm:text-base py-3.5 px-6 sm:py-4 sm:px-8 rounded-xl no-underline shadow-lg transition-all hover:opacity-95 min-h-[44px] sm:min-h-0"
                                style={{
                                    background: '#F8F5E6',
                                    color: '#0A3D2E',
                                    boxShadow: '0 8px 28px rgba(248,245,230,0.25)',
                                }}
                            >
                                {t('primaryCta')} <ArrowRight size={18} aria-hidden />
                            </SButton>
                        </Link>
                        <Link
                            href="/signup"
                            className="inline-block"
                        >
                            <SButton className="inline-flex items-center justify-center gap-2 py-3.5 px-6 sm:py-4 sm:px-8 rounded-xl font-semibold text-sm sm:text-base no-underline border border-[#F8F5E6]/30 bg-white/5 backdrop-blur-sm transition-colors hover:bg-white/10 min-h-[44px] sm:min-h-0 text-[#F8F5E6]">
                                <Calendar size={18} aria-hidden /> {t('secondaryCta')}
                            </SButton>
                        </Link>
                    </div>

                    <p className="relative mt-4 sm:mt-6 text-xs sm:text-[13px] opacity-75 text-[#F8F5E6] px-2">{t('footnote')}</p>
                </SCard>
            </div>
        </SSection>
    );
}
