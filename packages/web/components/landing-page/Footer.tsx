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
        <footer className="border-t border-[#F8F5E6]/10 pt-16 pb-8 px-6" style={{ background: '#0A3D2E' }}>
            <div className="max-w-[1100px] mx-auto">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-10 sm:gap-12 mb-12">
                    {/* Brand — Recete */}
                    <div className="col-span-2 sm:col-span-1">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-lg shadow-sm" style={{ background: '#F8F5E6', color: '#0A3D2E' }}>
                                R
                            </div>
                            <span className="font-bold text-base" style={{ color: '#F8F5E6' }}>Recete</span>
                        </div>
                        <p className="text-sm leading-relaxed max-w-[200px] opacity-80" style={{ color: '#F8F5E6' }}>{t('tagline')}</p>
                        <div className="flex gap-3 mt-5">
                            {[Twitter, Github, Linkedin].map((Icon, i) => (
                                <a
                                    key={i}
                                    href="#"
                                    className="w-9 h-9 rounded-lg border border-[#F8F5E6]/15 bg-white/5 flex items-center justify-center no-underline transition-colors hover:bg-white/10 hover:border-[#F8F5E6]/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                                    style={{ color: '#F8F5E6' }}
                                    aria-label={`Social link ${i + 1}`}
                                >
                                    <Icon size={16} />
                                </a>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h4 className="font-semibold text-sm mb-4" style={{ color: '#F8F5E6' }}>{t('product')}</h4>
                        {productLinks.map((key, i) => (
                            <Link
                                key={key}
                                href={productHrefs[i]}
                                className="block text-sm no-underline mb-2.5 leading-snug opacity-80 hover:opacity-100 transition-opacity"
                                style={{ color: '#F8F5E6' }}
                            >
                                {t(key)}
                            </Link>
                        ))}
                    </div>

                    <div>
                        <h4 className="font-semibold text-sm mb-4" style={{ color: '#F8F5E6' }}>{t('company')}</h4>
                        {companyLinks.map((key, i) => (
                            <Link
                                key={key}
                                href={companyHrefs[i]}
                                className="block text-sm no-underline mb-2.5 leading-snug opacity-80 hover:opacity-100 transition-opacity"
                                style={{ color: '#F8F5E6' }}
                            >
                                {t(key)}
                            </Link>
                        ))}
                    </div>

                    <div>
                        <h4 className="font-semibold text-sm mb-4" style={{ color: '#F8F5E6' }}>{t('legal')}</h4>
                        {legalLinks.map((key, i) => (
                            <Link
                                key={key}
                                href={legalHrefs[i]}
                                className="block text-sm no-underline mb-2.5 leading-snug opacity-80 hover:opacity-100 transition-opacity"
                                style={{ color: '#F8F5E6' }}
                            >
                                {t(key)}
                            </Link>
                        ))}
                    </div>
                </div>

                <div className="border-t border-[#F8F5E6]/10 pt-6 flex flex-wrap justify-between items-center gap-3">
                    <p className="text-[13px] opacity-75" style={{ color: '#F8F5E6' }}>{t('copyright')}</p>
                    <span className="text-xs font-semibold rounded-full border border-[#F8F5E6]/25 bg-[#F8F5E6]/10 px-3 py-1.5" style={{ color: '#F8F5E6' }}>
                        Built for Shopify ✓
                    </span>
                </div>
            </div>
        </footer>
    );
}
