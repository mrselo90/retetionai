'use client';

import { useTranslations } from 'next-intl';

const statColors = ['#6366f1', '#22c55e', '#3b82f6', '#f59e0b'];
const statIcons = ['🏪', '↓', '💬', '⭐'];

export function Stats() {
    const t = useTranslations('Landing.stats');

    const stats = [
        { value: t('merchants'), label: t('merchantsLabel') },
        { value: t('returns'), label: t('returnsLabel') },
        { value: t('messages'), label: t('messagesLabel') },
        { value: t('satisfaction'), label: t('satisfactionLabel') },
    ];

    return (
        <section style={{
            background: 'linear-gradient(180deg, #0f172a 0%, #1a2540 100%)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
            <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '48px 24px' }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '0',
                }}>
                    {stats.map((stat, i) => (
                        <div key={i} style={{
                            textAlign: 'center',
                            padding: '24px 16px',
                            borderRight: i < 3 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                        }}>
                            <div style={{
                                fontSize: 'clamp(2rem, 4vw, 2.75rem)',
                                fontWeight: 800,
                                color: statColors[i],
                                lineHeight: 1,
                                marginBottom: '8px',
                                letterSpacing: '-0.02em',
                            }}>
                                {statIcons[i]} {stat.value}
                            </div>
                            <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 500 }}>
                                {stat.label}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
