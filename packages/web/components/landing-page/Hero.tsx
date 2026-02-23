'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

export function Hero() {
  const t = useTranslations('Landing');

  return (
    <section
      className="relative overflow-hidden pt-20 pb-0"
      style={{
        background: 'linear-gradient(165deg, #0f172a 0%, #1e293b 45%, #0f172a 100%)',
      }}
    >
      {/* Ambient glow */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div
          className="absolute rounded-full blur-[60px] opacity-60"
          style={{
            top: '-120px',
            left: '28%',
            width: '480px',
            height: '480px',
            background: 'radial-gradient(circle, rgba(99,102,241,0.22) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute rounded-full blur-[60px] opacity-50"
          style={{
            top: '18%',
            right: '8%',
            width: '320px',
            height: '320px',
            background: 'radial-gradient(circle, rgba(34,197,94,0.14) 0%, transparent 70%)',
          }}
        />
      </div>

      <div className="relative z-10 max-w-[1100px] mx-auto px-4 sm:px-6 text-center min-w-0">
        {/* Badge — wraps on mobile */}
        <div
          className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full border px-4 py-2 sm:px-5 sm:py-2.5 mb-6 sm:mb-8 animate-[fade-in_0.6s_ease-out]"
          style={{
            background: 'rgba(34,197,94,0.12)',
            borderColor: 'rgba(34,197,94,0.28)',
            color: '#4ade80',
            fontSize: 'clamp(12px, 2.5vw, 14px)',
            fontWeight: 600,
          }}
        >
          <svg className="shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.557 4.126 1.524 5.86L0 24l6.305-1.654A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.019-1.378l-.36-.214-3.737.98.999-3.648-.235-.374A9.818 9.818 0 012.182 12C2.182 6.573 6.573 2.182 12 2.182S21.818 6.573 21.818 12 17.427 21.818 12 21.818z" />
          </svg>
          <span className="text-center">WhatsApp-Powered Post-Purchase AI</span>
        </div>

        {/* Headline — scales for mobile, no overflow */}
        <h1
          className="text-white font-extrabold tracking-tight mb-5 sm:mb-6 animate-[fade-in_0.7s_ease-out_0.1s_both] leading-tight"
          style={{
            fontSize: 'clamp(1.75rem, 6vw, 4.25rem)',
            letterSpacing: '-0.02em',
          }}
        >
          {t('heroLine')}
        </h1>

        {/* Subtitle — readable on small screens */}
        <p
          className="text-slate-400 max-w-[36rem] mx-auto mb-8 sm:mb-10 animate-[fade-in_0.7s_ease-out_0.2s_both] text-[15px] sm:text-base leading-relaxed"
        >
          {t('subtitle')}
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap gap-2 sm:gap-3 justify-center mb-3 sm:mb-4 animate-[fade-in_0.7s_ease-out_0.3s_both]">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 text-white font-bold text-sm sm:text-base py-3 px-5 sm:py-3.5 sm:px-7 rounded-xl no-underline shadow-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1e293b]"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              boxShadow: '0 8px 28px rgba(99,102,241,0.4)',
            }}
          >
            {t('signup')} <ArrowRight size={18} aria-hidden />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center py-3 px-5 sm:py-3.5 sm:px-7 rounded-xl font-semibold text-sm sm:text-base no-underline border border-white/20 bg-white/10 text-slate-200 backdrop-blur-sm transition-colors hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1e293b]"
          >
            {t('login')}
          </Link>
        </div>
        <p className="text-slate-500 text-xs sm:text-[13px] mb-10 sm:mb-14 animate-[fade-in_0.7s_ease-out_0.35s_both]">{t('signupSmall')}</p>

        {/* Dashboard preview — URL bar truncates on mobile */}
        <div
          className="max-w-[960px] mx-auto rounded-xl sm:rounded-2xl rounded-b-none overflow-hidden border border-white/10 border-b-0 animate-[fade-in_0.8s_ease-out_0.4s_both]"
          style={{
            boxShadow: '0 -8px 48px rgba(99,102,241,0.18), 0 32px 64px rgba(0,0,0,0.45)',
          }}
        >
          <div className="flex items-center gap-2 bg-slate-800 px-3 sm:px-4 py-2 sm:py-2.5 border-b border-white/10 min-w-0">
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-red-500/90 shrink-0" />
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-amber-400/90 shrink-0" />
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-500/90 shrink-0" />
            <span className="ml-2 sm:ml-3 flex-1 min-w-0 rounded bg-white/5 px-2 sm:px-3 py-1 text-[11px] sm:text-xs text-slate-500 font-mono truncate" title="app.recete.ai/dashboard">
              app.recete.ai/dashboard
            </span>
          </div>
          <Image
            src="/dashboard-preview.png"
            alt={t('dashboardAlt')}
            width={1200}
            height={750}
            className="w-full h-auto block"
            priority
          />
        </div>
      </div>
    </section>
  );
}
