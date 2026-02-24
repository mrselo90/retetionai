'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Link } from '@/i18n/routing';
import { Twitter, Github, Linkedin } from 'lucide-react';
import { SCard } from './PolarisWc';

const productLinks = ['features', 'howItWorks', 'pricing', 'bookDemo'] as const;
const companyLinks = ['aboutUs', 'blog', 'careers', 'contact'] as const;
const legalLinks = ['privacyPolicy', 'termsOfService', 'cookiePolicy'] as const;

const legalHrefs = ['/privacy-policy', '/terms-of-service', '/cookie-policy'];

export function Footer() {
    const t = useTranslations('Landing.footer');

    return (
        <footer className="border-t border-black/5 pt-10 sm:pt-12 pb-8 px-4 sm:px-6 bg-[#f6f4ea]">
            <div className="max-w-6xl mx-auto">
                <SCard className="block rounded-2xl sm:rounded-3xl border border-black/5 bg-white p-6 sm:p-8 md:p-10 shadow-[0_12px_40px_rgba(10,61,46,.05)]">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-8 sm:gap-x-10 sm:gap-y-10 md:gap-x-12 mb-10 sm:mb-12">
                    {/* Brand — Recete */}
                    <div className="col-span-2 md:col-span-1">
                        <div className="flex items-center gap-3 mb-3 sm:mb-4">
                            <Image src="/recete-logo.svg" alt="Recete" className="h-7 sm:h-8 w-auto" width={140} height={34} />
                        </div>
                        <p className="text-xs sm:text-sm leading-relaxed max-w-[240px] text-zinc-600">{t('tagline')}</p>
                        <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-5">
                            {[Twitter, Github, Linkedin].map((Icon, i) => (
                                <a
                                    key={i}
                                    href="#"
                                    className="w-9 h-9 rounded-lg border border-black/10 bg-[#f6f4ea] flex items-center justify-center no-underline transition-colors hover:bg-white hover:border-black/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 text-[#0A3D2E] min-w-[44px] min-h-[44px]"
                                    aria-label={`Social link ${i + 1}`}
                                >
                                    <Icon size={18} />
                                </a>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h4 className="font-semibold text-xs sm:text-sm mb-3 sm:mb-4 text-[#0A3D2E]">{t('product')}</h4>
                        <ul className="space-y-2 sm:space-y-2.5">
                            {productLinks.map((key, i) => (
                                <li key={key}>
                                    <Link
                                        href={i === 0 ? '/#features' : i === 1 ? '/#how-it-works' : i === 2 ? '/signup' : '/#cta'}
                                        className="block text-xs sm:text-sm no-underline leading-snug text-zinc-600 hover:text-zinc-900 transition-colors py-1"
                                    >
                                        {t(key)}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold text-xs sm:text-sm mb-3 sm:mb-4 text-[#0A3D2E]">{t('company')}</h4>
                        <ul className="space-y-2 sm:space-y-2.5">
                            {companyLinks.map((key, i) => (
                                <li key={key}>
                                    <Link
                                        href={i === 3 ? '/#cta' : '/signup'}
                                        className="block text-xs sm:text-sm no-underline leading-snug text-zinc-600 hover:text-zinc-900 transition-colors py-1"
                                    >
                                        {t(key)}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold text-xs sm:text-sm mb-3 sm:mb-4 text-[#0A3D2E]">{t('legal')}</h4>
                        <ul className="space-y-2 sm:space-y-2.5">
                            {legalLinks.map((key, i) => (
                                <li key={key}>
                                    <Link
                                        href={legalHrefs[i]}
                                        className="block text-xs sm:text-sm no-underline leading-snug text-zinc-600 hover:text-zinc-900 transition-colors py-1"
                                    >
                                        {t(key)}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="border-t border-black/5 pt-4 sm:pt-6 flex flex-col sm:flex-row flex-wrap justify-between items-center gap-3 sm:gap-4 text-center sm:text-left">
                    <p className="text-xs sm:text-[13px] text-zinc-500 order-2 sm:order-1">{t('copyright')}</p>
                    <span className="text-xs font-semibold rounded-full border border-[#0A3D2E]/12 bg-[#0A3D2E]/5 px-3 py-1.5 text-[#0A3D2E] order-1 sm:order-2">
                        Built for Shopify ✓
                    </span>
                </div>
                </SCard>
            </div>
        </footer>
    );
}
