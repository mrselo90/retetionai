'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Twitter, Github, Linkedin } from 'lucide-react';

const productLinks = ['features', 'howItWorks', 'pricing', 'bookDemo'] as const;
const companyLinks = ['aboutUs', 'blog', 'careers', 'contact'] as const;
const legalLinks = ['privacyPolicy', 'termsOfService', 'cookiePolicy'] as const;

const productHrefs = ['/features', '/#how-it-works', '/pricing', '/contact'];
const companyHrefs = ['/about', '/blog', '/careers', '/contact'];
const legalHrefs = ['/privacy-policy', '/terms', '/cookie-policy'];

export function Footer() {
    const t = useTranslations('Landing.footer');

    return (
        <footer className="border-t border-[#F8F5E6]/10 pt-12 pb-8 px-4 sm:px-6" style={{ background: '#0A3D2E' }}>
            <div className="max-w-6xl mx-auto">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10 md:gap-12 mb-10 sm:mb-12">
                    {/* Brand — Recete */}
                    <div className="col-span-2 md:col-span-1">
                        <div className="flex items-center gap-3 mb-3 sm:mb-4">
                            <img src="/recete-logo-dark.svg" alt="Recete" className="h-7 sm:h-8 w-auto" width="140" height="34" />
                        </div>
                        <p className="text-xs sm:text-sm leading-relaxed max-w-[220px] opacity-80 text-[#F8F5E6]">{t('tagline')}</p>
                        <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-5">
                            {[Twitter, Github, Linkedin].map((Icon, i) => (
                                <a
                                    key={i}
                                    href="#"
                                    className="w-9 h-9 rounded-lg border border-[#F8F5E6]/15 bg-white/5 flex items-center justify-center no-underline transition-colors hover:bg-white/10 hover:border-[#F8F5E6]/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 text-[#F8F5E6] min-w-[44px] min-h-[44px]"
                                    aria-label={`Social link ${i + 1}`}
                                >
                                    <Icon size={18} />
                                </a>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h4 className="font-semibold text-xs sm:text-sm mb-3 sm:mb-4 text-[#F8F5E6]">{t('product')}</h4>
                        <ul className="space-y-2 sm:space-y-2.5">
                            {productLinks.map((key, i) => (
                                <li key={key}>
                                    <Link
                                        href={productHrefs[i]}
                                        className="block text-xs sm:text-sm no-underline leading-snug opacity-80 hover:opacity-100 transition-opacity text-[#F8F5E6] py-1"
                                    >
                                        {t(key)}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold text-xs sm:text-sm mb-3 sm:mb-4 text-[#F8F5E6]">{t('company')}</h4>
                        <ul className="space-y-2 sm:space-y-2.5">
                            {companyLinks.map((key, i) => (
                                <li key={key}>
                                    <Link
                                        href={companyHrefs[i]}
                                        className="block text-xs sm:text-sm no-underline leading-snug opacity-80 hover:opacity-100 transition-opacity text-[#F8F5E6] py-1"
                                    >
                                        {t(key)}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold text-xs sm:text-sm mb-3 sm:mb-4 text-[#F8F5E6]">{t('legal')}</h4>
                        <ul className="space-y-2 sm:space-y-2.5">
                            {legalLinks.map((key, i) => (
                                <li key={key}>
                                    <Link
                                        href={legalHrefs[i]}
                                        className="block text-xs sm:text-sm no-underline leading-snug opacity-80 hover:opacity-100 transition-opacity text-[#F8F5E6] py-1"
                                    >
                                        {t(key)}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="border-t border-[#F8F5E6]/10 pt-4 sm:pt-6 flex flex-col sm:flex-row flex-wrap justify-between items-center gap-3 text-center sm:text-left">
                    <p className="text-xs sm:text-[13px] opacity-75 text-[#F8F5E6] order-2 sm:order-1">{t('copyright')}</p>
                    <span className="text-xs font-semibold rounded-full border border-[#F8F5E6]/25 bg-[#F8F5E6]/10 px-3 py-1.5 text-[#F8F5E6] order-1 sm:order-2">
                        Built for Shopify ✓
                    </span>
                </div>
            </div>
        </footer>
    );
}
