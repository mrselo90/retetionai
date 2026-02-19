'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { ArrowRight, Calendar } from 'lucide-react';

export function CTA() {
    const t = useTranslations('Landing.cta');

    return (
        <section style={{ background: '#0f172a', padding: '96px 24px' }}>
            <div style={{ maxWidth: '860px', margin: '0 auto' }}>
                <div style={{
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(168,85,247,0.15) 50%, rgba(59,130,246,0.2) 100%)',
                    border: '1px solid rgba(99,102,241,0.3)',
                    borderRadius: '24px',
                    padding: '64px 48px',
                    textAlign: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                }}>
                    {/* Purple glow */}
                    <div aria-hidden style={{
                        position: 'absolute', top: '-60px', left: '50%', transform: 'translateX(-50%)',
                        width: '400px', height: '200px', borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)',
                        filter: 'blur(40px)',
                    }} />

                    <h2 style={{
                        fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', fontWeight: 800,
                        color: '#ffffff', marginBottom: '16px', lineHeight: 1.2,
                        position: 'relative',
                    }}>
                        {t('title')}
                    </h2>
                    <p style={{ color: '#94a3b8', fontSize: '1.05rem', maxWidth: '520px', margin: '0 auto 40px', lineHeight: 1.7, position: 'relative' }}>
                        {t('subtitle')}
                    </p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center', position: 'relative' }}>
                        <Link href="/signup" style={{
                            display: 'inline-flex', alignItems: 'center', gap: '8px',
                            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                            color: '#fff', fontWeight: 700, fontSize: '16px',
                            padding: '16px 36px', borderRadius: '12px', textDecoration: 'none',
                            boxShadow: '0 8px 32px rgba(99,102,241,0.5)',
                        }}>
                            {t('primaryCta')} <ArrowRight size={18} />
                        </Link>
                        <Link href="/contact" style={{
                            display: 'inline-flex', alignItems: 'center', gap: '8px',
                            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                            color: '#e2e8f0', fontWeight: 600, fontSize: '16px',
                            padding: '16px 36px', borderRadius: '12px', textDecoration: 'none',
                        }}>
                            <Calendar size={18} /> {t('secondaryCta')}
                        </Link>
                    </div>

                    <p style={{ marginTop: '24px', color: '#475569', fontSize: '13px', position: 'relative' }}>
                        {t('footnote')}
                    </p>
                </div>
            </div>
        </section>
    );
}
