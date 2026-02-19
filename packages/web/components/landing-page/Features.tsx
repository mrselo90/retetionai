'use client';

import { useTranslations } from 'next-intl';
import { MessageCircle, Bot, BarChart3, Clock, Zap, ShieldCheck } from 'lucide-react';

const featureConfig = [
    {
        icon: MessageCircle,
        color: '#22c55e',
        bg: 'rgba(34,197,94,0.1)',
        border: 'rgba(34,197,94,0.2)',
        key: 'automated',
        descKey: 'automatedDesc',
        bulletsKey: 'automatedBullets',
    },
    {
        icon: Bot,
        color: '#6366f1',
        bg: 'rgba(99,102,241,0.1)',
        border: 'rgba(99,102,241,0.2)',
        key: 'aiPowered',
        descKey: 'aiPoweredDesc',
        bulletsKey: 'aiPoweredBullets',
    },
    {
        icon: BarChart3,
        color: '#3b82f6',
        bg: 'rgba(59,130,246,0.1)',
        border: 'rgba(59,130,246,0.2)',
        key: 'analytics',
        descKey: 'analyticsDesc',
        bulletsKey: 'analyticsBullets',
    },
    {
        icon: Clock,
        color: '#f59e0b',
        bg: 'rgba(245,158,11,0.1)',
        border: 'rgba(245,158,11,0.2)',
        key: 'realtimeSync',
        descKey: 'realtimeSyncDesc',
        bulletsKey: 'realtimeSyncBullets',
    },
    {
        icon: Zap,
        color: '#a855f7',
        bg: 'rgba(168,85,247,0.1)',
        border: 'rgba(168,85,247,0.2)',
        key: 'easyIntegration',
        descKey: 'easyIntegrationDesc',
        bulletsKey: 'easyIntegrationBullets',
    },
    {
        icon: ShieldCheck,
        color: '#14b8a6',
        bg: 'rgba(20,184,166,0.1)',
        border: 'rgba(20,184,166,0.2)',
        key: 'security',
        descKey: 'securityDesc',
        bulletsKey: 'securityBullets',
    },
];

export function Features() {
    const t = useTranslations('Landing.features');

    return (
        <section style={{ background: '#0a0f1e', padding: '96px 24px' }}>
            <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '64px' }}>
                    <span style={{
                        display: 'inline-block',
                        background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
                        borderRadius: '100px', padding: '6px 16px',
                        color: '#818cf8', fontSize: '13px', fontWeight: 600,
                        marginBottom: '16px', letterSpacing: '0.05em', textTransform: 'uppercase',
                    }}>Features</span>
                    <h2 style={{
                        fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', fontWeight: 800,
                        color: '#ffffff', marginBottom: '16px', lineHeight: 1.2,
                    }}>
                        {t('title')}
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '1.05rem', maxWidth: '560px', margin: '0 auto' }}>
                        {t('subtitle')}
                    </p>
                </div>

                {/* Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                    gap: '24px',
                }}>
                    {featureConfig.map((f) => {
                        const Icon = f.icon;
                        const bullets = t(f.bulletsKey).split('·').map((b: string) => b.trim());
                        return (
                            <div key={f.key} style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: `1px solid rgba(255,255,255,0.07)`,
                                borderRadius: '16px',
                                padding: '28px',
                                transition: 'border-color 0.2s, transform 0.2s',
                            }}>
                                <div style={{
                                    width: '48px', height: '48px', borderRadius: '12px',
                                    background: f.bg, border: `1px solid ${f.border}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    marginBottom: '20px',
                                }}>
                                    <Icon size={22} color={f.color} />
                                </div>
                                <h3 style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '1.05rem', marginBottom: '8px' }}>
                                    {t(f.key)}
                                </h3>
                                <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.6, marginBottom: '16px' }}>
                                    {t(f.descKey)}
                                </p>
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {bullets.map((b: string, i: number) => (
                                        <span key={i} style={{
                                            fontSize: '11px', fontWeight: 600, letterSpacing: '0.03em',
                                            color: f.color,
                                            background: f.bg,
                                            border: `1px solid ${f.border}`,
                                            borderRadius: '6px',
                                            padding: '3px 8px',
                                        }}>
                                            {b}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
