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
        <footer className="border-t border-white/[0.06] bg-[#080d18] pt-16 pb-8 px-6">
            <div className="max-w-[1100px] mx-auto">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-10 sm:gap-12 mb-12">
                    {/* Brand — Recete */}
                    <div className="col-span-2 sm:col-span-1">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center font-extrabold text-white text-lg shadow-sm">
                                R
                            </div>
                            <span className="text-slate-100 font-bold text-base">Recete</span>
                        </div>
                        <p className="text-slate-500 text-sm leading-relaxed max-w-[200px]">{t('tagline')}</p>
                        <div className="flex gap-3 mt-5">
                            {[Twitter, Github, Linkedin].map((Icon, i) => (
                                <a
                                    key={i}
                                    href="#"
                                    className="w-9 h-9 rounded-lg border border-white/[0.08] bg-white/[0.05] flex items-center justify-center text-slate-500 no-underline transition-colors hover:text-slate-300 hover:border-white/[0.12] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                                    aria-label={`Social link ${i + 1}`}
                                >
                                    <Icon size={16} />
                                </a>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-slate-100 font-semibold text-sm mb-4">{t('product')}</h4>
                        {productLinks.map((key, i) => (
                            <Link
                                key={key}
                                href={productHrefs[i]}
                                className="block text-slate-500 text-sm no-underline mb-2.5 leading-snug hover:text-slate-300 transition-colors"
                            >
                                {t(key)}
                            </Link>
                        ))}
                    </div>

                    <div>
                        <h4 className="text-slate-100 font-semibold text-sm mb-4">{t('company')}</h4>
                        {companyLinks.map((key, i) => (
                            <Link
                                key={key}
                                href={companyHrefs[i]}
                                className="block text-slate-500 text-sm no-underline mb-2.5 leading-snug hover:text-slate-300 transition-colors"
                            >
                                {t(key)}
                            </Link>
                        ))}
                    </div>

                    <div>
                        <h4 className="text-slate-100 font-semibold text-sm mb-4">{t('legal')}</h4>
                        {legalLinks.map((key, i) => (
                            <Link
                                key={key}
                                href={legalHrefs[i]}
                                className="block text-slate-500 text-sm no-underline mb-2.5 leading-snug hover:text-slate-300 transition-colors"
                            >
                                {t(key)}
                            </Link>
                        ))}
                    </div>
                </div>

                <div className="border-t border-white/[0.06] pt-6 flex flex-wrap justify-between items-center gap-3">
                    <p className="text-slate-600 text-[13px]">{t('copyright')}</p>
                    <span className="text-xs font-semibold rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-emerald-400">
                        Built for Shopify ✓
                    </span>
                </div>
            </div>
        </footer>
    );
}
