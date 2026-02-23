'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

export function Hero() {
  const t = useTranslations('Landing');

  return (
    <section
      className="relative overflow-hidden pt-12 pb-8 sm:pt-16 sm:pb-10 md:pt-20 md:pb-12"
      style={{
        background: 'linear-gradient(165deg, #0A3D2E 0%, #0d4a38 45%, #0A3D2E 100%)',
      }}
    >
      {/* Ambient glow — Recete emerald/gold */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div
          className="absolute rounded-full blur-[60px] opacity-50"
          style={{
            top: '-120px',
            left: '28%',
            width: 'min(480px, 90vw)',
            height: '480px',
            background: 'radial-gradient(circle, rgba(16,185,129,0.25) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute rounded-full blur-[60px] opacity-40"
          style={{
            top: '18%',
            right: '8%',
            width: 'min(320px, 60vw)',
            height: '320px',
            background: 'radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%)',
          }}
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 text-center min-w-0">
        {/* Badge */}
        <div
          className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full border px-4 py-2 sm:px-5 sm:py-2.5 mb-5 sm:mb-8 text-xs sm:text-sm font-semibold"
          style={{
            background: 'rgba(248,245,230,0.12)',
            borderColor: 'rgba(248,245,230,0.28)',
            color: '#F8F5E6',
          }}
        >
          <svg className="shrink-0 w-3.5 h-3.5 sm:w-[14px] sm:h-[14px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.557 4.126 1.524 5.86L0 24l6.305-1.654A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
          </svg>
          <span>WhatsApp-Powered Post-Purchase AI</span>
        </div>

        {/* Headline */}
        <h1
          className="font-extrabold tracking-tight mb-4 sm:mb-6 leading-tight text-[#F8F5E6]"
          style={{
            fontSize: 'clamp(1.5rem, 5vw + 1rem, 3.5rem)',
            letterSpacing: '-0.02em',
          }}
        >
          {t('heroLine')}
        </h1>

        {/* Subtitle */}
        <p className="max-w-[32rem] sm:max-w-[36rem] mx-auto mb-6 sm:mb-10 text-sm sm:text-base leading-relaxed opacity-90 text-[#F8F5E6] px-1">
          {t('subtitle')}
        </p>

        {/* CTAs — full-width on mobile when stacked, side-by-side on desktop */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center mb-6 sm:mb-4 px-2 max-w-md sm:max-w-none mx-auto sm:mx-0">
          <Link
            href="/signup"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 font-bold text-sm sm:text-base py-3.5 px-5 sm:py-3.5 sm:px-7 rounded-xl no-underline shadow-lg transition-all duration-200 hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A3D2E] min-h-[44px] sm:min-h-0"
            style={{
              background: '#F8F5E6',
              color: '#0A3D2E',
              boxShadow: '0 8px 28px rgba(248,245,230,0.25)',
            }}
          >
            {t('signup')} <ArrowRight size={18} aria-hidden />
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center py-3.5 px-5 sm:py-3.5 sm:px-7 rounded-xl font-semibold text-sm sm:text-base no-underline border border-[#F8F5E6]/30 bg-white/5 text-[#F8F5E6] backdrop-blur-sm transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A3D2E] min-h-[44px] sm:min-h-0"
          >
            {t('login')}
          </Link>
        </div>
        <p className="text-[13px] sm:text-sm mb-8 sm:mb-12 opacity-85 text-[#F8F5E6] px-2">{t('signupSmall')}</p>

        {/* Dashboard preview — responsive; keeps aspect when image missing */}
        <div
          className="max-w-[min(960px,calc(100vw-2rem))] mx-auto rounded-t-xl sm:rounded-t-2xl overflow-hidden border border-white/10 border-b-0 bg-[#0d4a38]/50"
          style={{
            boxShadow: '0 -8px 48px rgba(10,61,46,0.4), 0 32px 64px rgba(0,0,0,0.35)',
          }}
        >
          <div className="flex items-center gap-2 bg-[#0d4a38] px-3 sm:px-4 py-2 sm:py-2.5 border-b border-white/10 min-w-0">
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-red-500/90 shrink-0" />
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-amber-400/90 shrink-0" />
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-500/90 shrink-0" />
            <span className="ml-2 sm:ml-3 flex-1 min-w-0 rounded bg-white/5 px-2 sm:px-3 py-1 text-[11px] sm:text-xs font-mono truncate opacity-80 text-[#F8F5E6]" title="app.recete.ai/dashboard">
              app.recete.ai/dashboard
            </span>
          </div>
          <div className="relative w-full aspect-[8/5] sm:aspect-[16/10] min-h-[180px] bg-[#0A3D2E]">
            <Image
              src="/dashboard-preview.png"
              alt={t('dashboardAlt')}
              width={1200}
              height={750}
              className="w-full h-full object-cover object-top"
              priority
              sizes="(max-width: 768px) 100vw, 960px"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
