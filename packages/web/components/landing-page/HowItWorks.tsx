'use client';

import { useTranslations } from 'next-intl';
import { Store, Bot, LineChart } from 'lucide-react';

const steps = [
    {
        icon: Store,
        color: '#6366f1',
        bg: 'rgba(99,102,241,0.15)',
        border: 'rgba(99,102,241,0.3)',
        titleKey: 'step1Title',
        descKey: 'step1Desc',
    },
    {
        icon: Bot,
        color: '#22c55e',
        bg: 'rgba(34,197,94,0.15)',
        border: 'rgba(34,197,94,0.3)',
        titleKey: 'step2Title',
        descKey: 'step2Desc',
    },
    {
        icon: LineChart,
        color: '#3b82f6',
        bg: 'rgba(59,130,246,0.15)',
        border: 'rgba(59,130,246,0.3)',
        titleKey: 'step3Title',
        descKey: 'step3Desc',
    },
];

export function HowItWorks() {
    const t = useTranslations('Landing.howItWorks');

    return (
        <section style={{
            background: 'linear-gradient(180deg, #0a0f1e 0%, #0f172a 100%)',
            padding: '96px 24px',
        }}>
            <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '72px' }}>
                    <span style={{
                        display: 'inline-block',
                        background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
                        borderRadius: '100px', padding: '6px 16px',
                        color: '#4ade80', fontSize: '13px', fontWeight: 600,
                        marginBottom: '16px', letterSpacing: '0.05em', textTransform: 'uppercase',
                    }}>How it Works</span>
                    <h2 style={{
                        fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', fontWeight: 800,
                        color: '#ffffff', marginBottom: '16px', lineHeight: 1.2,
                    }}>
                        {t('title')}
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '1.05rem', maxWidth: '480px', margin: '0 auto' }}>
                        {t('subtitle')}
                    </p>
                </div>

                {/* Steps */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px', position: 'relative' }}>
                    {/* Connector line - desktop only */}
                    <div aria-hidden style={{
                        position: 'absolute', top: '60px', left: '16.67%', right: '16.67%',
                        height: '1px',
                        background: 'linear-gradient(90deg, rgba(99,102,241,0.5), rgba(34,197,94,0.5), rgba(59,130,246,0.5))',
                    }} />

                    {steps.map((step, i) => {
                        const Icon = step.icon;
                        return (
                            <div key={i} style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                                position: 'relative',
                            }}>
                                {/* Number badge */}
                                <div style={{
                                    width: '120px', height: '120px', borderRadius: '24px',
                                    background: step.bg, border: `1px solid ${step.border}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    marginBottom: '24px', position: 'relative', zIndex: 1,
                                }}>
                                    <Icon size={40} color={step.color} />
                                    <span style={{
                                        position: 'absolute', top: '-10px', right: '-10px',
                                        width: '28px', height: '28px', borderRadius: '50%',
                                        background: step.color, color: '#fff',
                                        fontSize: '13px', fontWeight: 800,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        boxShadow: `0 0 12px ${step.color}80`,
                                    }}>
                                        {i + 1}
                                    </span>
                                </div>
                                <h3 style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '1.15rem', marginBottom: '12px' }}>
                                    {t(step.titleKey)}
                                </h3>
                                <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.7, maxWidth: '280px' }}>
                                    {t(step.descKey)}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
