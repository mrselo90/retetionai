'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import Image from 'next/image';
import { ArrowRight, ShoppingBag } from 'lucide-react';

export function Hero() {
  const t = useTranslations('Landing');

  return (
    <section
      className="relative overflow-hidden pt-16 sm:pt-24 pb-0"
      style={{
        background: 'linear-gradient(180deg, #f0f4ff 0%, #fafafa 60%, #f6f6f7 100%)',
      }}
    >
      {/* Background decorative blobs */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden
      >
        <div
          style={{
            position: 'absolute',
            top: '-80px',
            left: '50%',
            transform: 'translateX(-60%)',
            width: '600px',
            height: '600px',
            background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(40px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '20%',
            right: '-100px',
            width: '400px',
            height: '400px',
            background: 'radial-gradient(circle, rgba(34,197,94,0.12) 0%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(60px)',
          }}
        />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10 w-full text-center">
        {/* Badge */}
        <p className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-border shadow-sm text-sm font-semibold text-foreground mb-8 animate-fade-in-up">
          <ShoppingBag className="w-4 h-4 shrink-0 text-primary" aria-hidden />
          {t('forShopify')}
        </p>

        {/* Headline */}
        <h1
          className="font-bold text-foreground tracking-tight max-w-4xl mx-auto leading-tight mb-6 animate-fade-in-up delay-100"
          style={{ fontSize: 'clamp(2rem, 5vw, 3.75rem)', lineHeight: '1.1' }}
        >
          {t('heroLine')}
        </h1>

        {/* Subtitle */}
        <p
          className="text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in-up delay-200"
          style={{ fontSize: 'clamp(1rem, 2vw, 1.2rem)', lineHeight: '1.7' }}
        >
          {t('subtitle')}
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4 animate-fade-in-up delay-300">
          <Link
            href="/signup"
            className="w-full sm:w-auto min-h-[52px] inline-flex items-center justify-center gap-2 px-10 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 transition-all hover:scale-105 active:scale-95 text-base"
            style={{ boxShadow: '0 8px 24px -4px rgba(26,32,44,0.35)' }}
          >
            {t('signup')}
            <ArrowRight className="w-5 h-5" aria-hidden />
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto min-h-[52px] inline-flex items-center justify-center px-10 py-3 border border-border bg-white text-foreground font-semibold rounded-xl hover:bg-muted transition-all hover:scale-105 active:scale-95 text-base"
          >
            {t('login')}
          </Link>
        </div>

        <p className="text-sm text-muted-foreground animate-fade-in-up delay-400 mb-12">
          {t('signupSmall')}
        </p>

        {/* Dashboard Preview */}
        <div
          className="relative max-w-5xl mx-auto w-full animate-fade-in-up delay-500 group"
          style={{
            borderRadius: '16px 16px 0 0',
            overflow: 'hidden',
            border: '1px solid rgba(0,0,0,0.08)',
            borderBottom: 'none',
            boxShadow: '0 -4px 40px -8px rgba(99,102,241,0.15), 0 20px 60px -12px rgba(0,0,0,0.25)',
          }}
        >
          {/* Browser chrome bar */}
          <div
            style={{
              background: '#f1f3f5',
              borderBottom: '1px solid rgba(0,0,0,0.08)',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
            <div
              style={{
                marginLeft: 12,
                flex: 1,
                background: '#e8eaed',
                borderRadius: 6,
                padding: '3px 10px',
                fontSize: 11,
                color: '#666',
                maxWidth: 280,
              }}
            >
              app.recete.ai/dashboard
            </div>
          </div>
          <Image
            src="/dashboard-preview.png"
            alt={t('dashboardAlt')}
            width={1200}
            height={750}
            className="w-full h-auto"
            priority
          />
        </div>
      </div>
    </section>
  );
}
