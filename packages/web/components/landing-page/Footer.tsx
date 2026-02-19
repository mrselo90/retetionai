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
        <footer style={{
            background: '#080d18',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            padding: '64px 24px 32px',
        }}>
            <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '48px', marginBottom: '48px' }}>
                    {/* Brand */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                            <div style={{
                                width: '36px', height: '36px', borderRadius: '10px',
                                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 800, color: '#fff', fontSize: '16px',
                            }}>R</div>
                            <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '16px' }}>Recete</span>
                        </div>
                        <p style={{ color: '#475569', fontSize: '14px', lineHeight: 1.7, maxWidth: '200px' }}>
                            {t('tagline')}
                        </p>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                            {[Twitter, Github, Linkedin].map((Icon, i) => (
                                <a key={i} href="#" style={{
                                    width: '36px', height: '36px', borderRadius: '8px',
                                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#64748b', textDecoration: 'none',
                                }}>
                                    <Icon size={16} />
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Product */}
                    <div>
                        <h4 style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '14px', marginBottom: '16px' }}>
                            {t('product')}
                        </h4>
                        {productLinks.map((key, i) => (
                            <Link key={key} href={productHrefs[i]} style={{
                                display: 'block', color: '#475569', fontSize: '14px',
                                textDecoration: 'none', marginBottom: '10px', lineHeight: 1.4,
                            }}>
                                {t(key)}
                            </Link>
                        ))}
                    </div>

                    {/* Company */}
                    <div>
                        <h4 style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '14px', marginBottom: '16px' }}>
                            {t('company')}
                        </h4>
                        {companyLinks.map((key, i) => (
                            <Link key={key} href={companyHrefs[i]} style={{
                                display: 'block', color: '#475569', fontSize: '14px',
                                textDecoration: 'none', marginBottom: '10px', lineHeight: 1.4,
                            }}>
                                {t(key)}
                            </Link>
                        ))}
                    </div>

                    {/* Legal */}
                    <div>
                        <h4 style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '14px', marginBottom: '16px' }}>
                            {t('legal')}
                        </h4>
                        {legalLinks.map((key, i) => (
                            <Link key={key} href={legalHrefs[i]} style={{
                                display: 'block', color: '#475569', fontSize: '14px',
                                textDecoration: 'none', marginBottom: '10px', lineHeight: 1.4,
                            }}>
                                {t(key)}
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Bottom row */}
                <div style={{
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    paddingTop: '24px',
                    display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center',
                    gap: '12px',
                }}>
                    <p style={{ color: '#334155', fontSize: '13px' }}>{t('copyright')}</p>
                    <span style={{
                        fontSize: '12px', fontWeight: 600,
                        background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
                        borderRadius: '100px', padding: '4px 12px', color: '#4ade80',
                    }}>
                        Built for Shopify ✓
                    </span>
                </div>
            </div>
        </footer>
    );
}
