'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

export function Hero() {
  const t = useTranslations('Landing');

  return (
    <section
      style={{
        background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        position: 'relative',
        overflow: 'hidden',
        paddingTop: '80px',
        paddingBottom: '0',
      }}
    >
      {/* Glow blobs */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', top: '-100px', left: '30%',
          width: '500px', height: '500px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }} />
        <div style={{
          position: 'absolute', top: '20%', right: '10%',
          width: '350px', height: '350px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(34,197,94,0.15) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }} />
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 1, textAlign: 'center' }}>
        {/* WhatsApp badge */}
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: '100px', padding: '8px 18px',
            color: '#4ade80', fontSize: '14px', fontWeight: 600,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.557 4.126 1.524 5.86L0 24l6.305-1.654A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.019-1.378l-.36-.214-3.737.98.999-3.648-.235-.374A9.818 9.818 0 012.182 12C2.182 6.573 6.573 2.182 12 2.182S21.818 6.573 21.818 12 17.427 21.818 12 21.818z" />
            </svg>
            WhatsApp-Powered Post-Purchase AI
          </span>
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', fontWeight: 800,
          color: '#ffffff', lineHeight: 1.05, marginBottom: '24px',
          letterSpacing: '-0.02em',
        }}>
          {t('heroLine')}
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: 'clamp(1.05rem, 2vw, 1.25rem)', color: '#94a3b8',
          maxWidth: '640px', margin: '0 auto 40px', lineHeight: 1.7,
        }}>
          {t('subtitle')}
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', marginBottom: '16px' }}>
          <Link href="/signup" style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            color: '#fff', fontWeight: 700, fontSize: '16px',
            padding: '14px 32px', borderRadius: '12px', textDecoration: 'none',
            boxShadow: '0 8px 32px rgba(99,102,241,0.4)',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}>
            {t('signup')} <ArrowRight size={18} />
          </Link>
          <Link href="/login" style={{
            display: 'inline-flex', alignItems: 'center',
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
            backdropFilter: 'blur(8px)',
            color: '#e2e8f0', fontWeight: 600, fontSize: '16px',
            padding: '14px 32px', borderRadius: '12px', textDecoration: 'none',
          }}>
            {t('login')}
          </Link>
        </div>
        <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '56px' }}>{t('signupSmall')}</p>

        {/* Dashboard preview */}
        <div style={{
          maxWidth: '960px', margin: '0 auto',
          borderRadius: '16px 16px 0 0',
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.1)',
          borderBottom: 'none',
          boxShadow: '0 -8px 60px rgba(99,102,241,0.2), 0 40px 80px rgba(0,0,0,0.5)',
        }}>
          {/* Browser bar */}
          <div style={{
            background: '#1e293b', padding: '10px 16px',
            display: 'flex', alignItems: 'center', gap: '8px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f57' }} />
            <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#febc2e' }} />
            <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#28c840' }} />
            <div style={{
              marginLeft: 12, flex: 1,
              background: 'rgba(255,255,255,0.06)', borderRadius: 6,
              padding: '4px 12px', fontSize: 12, color: '#64748b', maxWidth: 260,
            }}>app.recete.ai/dashboard</div>
          </div>
          <Image
            src="/dashboard-preview.png"
            alt={t('dashboardAlt')}
            width={1200} height={750}
            className="w-full h-auto block"
            priority
          />
        </div>
      </div>
    </section>
  );
}
