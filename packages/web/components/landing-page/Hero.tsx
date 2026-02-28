'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import Image from 'next/image';
import { ArrowRight, Sparkles, ShieldCheck, Zap, MessageCircle, BarChart3, Clock } from 'lucide-react';

export function Hero() {
  const t = useTranslations('Landing');
  const tStats = useTranslations('Landing.stats');

  const highlights = [
    { icon: ShieldCheck, value: tStats('returns'), label: tStats('returnsLabel') },
    { icon: Zap, value: tStats('messages'), label: tStats('messagesLabel') },
    { icon: Sparkles, value: tStats('satisfaction'), label: tStats('satisfactionLabel') },
  ];

  const demoStats = [
    { label: tStats('merchantsLabel'), value: tStats('merchants') },
    { label: tStats('returnsLabel'), value: tStats('returns') },
    { label: tStats('messagesLabel'), value: tStats('messages') },
  ];

  const demoFeatures = [
    { icon: MessageCircle, label: 'Post-purchase WhatsApp' },
    { icon: BarChart3, label: 'ROI Dashboard' },
    { icon: Clock, label: 'Real-time Sync' },
  ];

  return (
    <section className="relative overflow-hidden pt-8 pb-8 sm:pt-11 sm:pb-12 md:pt-14 md:pb-16">
      {/* Background gradients */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-x-0 top-0 h-[420px] bg-[linear-gradient(180deg,#0a3d2e_0%,#0d4a38_65%,transparent_100%)]" />
        <div className="absolute top-10 left-[-8%] w-56 h-56 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="absolute top-24 right-[-5%] w-52 h-52 rounded-full bg-amber-300/10 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1.02fr_.98fr] gap-5 sm:gap-6 lg:gap-8 items-stretch">

          {/* ── LEFT: Main CTA card ── */}
          <div
            className="rounded-2xl sm:rounded-3xl border border-white/10 p-5 sm:p-6 lg:p-8 shadow-[0_24px_80px_rgba(10,61,46,0.25)]"
            style={{ background: '#0a3d2e', color: '#f8f5e6' }}
          >
            {/* Eyebrow badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs sm:text-sm font-semibold" style={{ color: '#f8f5e6' }}>
              <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-emerald-400/20">
                <Sparkles className="w-3.5 h-3.5 text-emerald-300" aria-hidden />
              </span>
              {t('forShopify')}
            </div>

            {/* H1 — explicit color to override any inheritance issues */}
            <h1
              className="mt-4 sm:mt-5 font-extrabold tracking-tight leading-[1.05]"
              style={{
                fontSize: 'clamp(1.75rem, 3vw + 1rem, 3.6rem)',
                letterSpacing: '-0.03em',
                color: '#f8f5e6',
              }}
            >
              {t('heroLine')}
            </h1>

            <p className="mt-4 text-sm sm:text-base leading-relaxed max-w-xl" style={{ color: 'rgba(248,245,230,0.88)' }}>
              {t('subtitle')}
            </p>
            <p className="mt-2 text-sm sm:text-base leading-relaxed max-w-xl" style={{ color: 'rgba(248,245,230,0.68)' }}>
              {t('description')}
            </p>

            {/* CTA row */}
            <div className="mt-5 sm:mt-7 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <Link href="/signup" className="inline-block">
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm sm:text-base font-bold shadow-[0_10px_30px_rgba(248,245,230,.18)] transition-transform hover:-translate-y-0.5"
                  style={{ background: '#f8f5e6', color: '#0a3d2e' }}
                >
                  {t('signup')}
                  <ArrowRight className="w-4 h-4" aria-hidden />
                </button>
              </Link>
              <Link href="/login" className="inline-block">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-5 py-3.5 text-sm sm:text-base font-semibold backdrop-blur transition-colors hover:bg-white/10"
                  style={{ color: '#f8f5e6' }}
                >
                  {t('login')}
                </button>
              </Link>
            </div>

            <div className="mt-4 text-xs sm:text-sm" style={{ color: 'rgba(248,245,230,0.75)' }}>
              {t('signupSmall')}
            </div>

            {/* Mini stats */}
            <div className="mt-5 sm:mt-7 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
              {highlights.map(({ icon: Icon, value, label }) => (
                <div
                  key={label}
                  className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4"
                >
                  <div className="flex items-center gap-2" style={{ color: 'rgba(248,245,230,0.70)' }}>
                    <Icon className="w-4 h-4 text-emerald-300" aria-hidden />
                    <span className="text-xs font-medium">{label}</span>
                  </div>
                  <div className="mt-1.5 text-xl sm:text-2xl font-extrabold tracking-tight" style={{ color: '#f8f5e6' }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT: Dashboard preview card ── */}
          <div
            className="relative rounded-2xl sm:rounded-3xl border border-black/8 bg-white shadow-[0_24px_80px_rgba(10,61,46,0.12)] overflow-hidden flex flex-col"
          >
            {/* Browser chrome */}
            <div className="relative p-4 sm:p-5 border-b border-black/5 bg-white/90 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
                <div className="ml-2 flex-1 min-w-0 rounded-lg border border-black/5 bg-[#f6f4ea] px-3 py-1.5 text-xs font-mono text-zinc-500 truncate">
                  app.recete.co.uk/dashboard
                </div>
              </div>
              {/* Stats bar */}
              <div className="mt-3 sm:mt-4 grid grid-cols-3 gap-2">
                {demoStats.map((item) => (
                  <div key={item.label} className="rounded-lg border border-black/5 bg-[#f8f5e6] px-3 py-2">
                    <div className="text-[10px] sm:text-xs text-zinc-500 truncate">{item.label}</div>
                    <div className="text-sm sm:text-base font-bold" style={{ color: '#0a3d2e' }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Screenshot */}
            <div className="p-2 sm:p-3 bg-[#f6f4ea] flex-1">
              <div className="relative rounded-xl sm:rounded-2xl border border-black/5 overflow-hidden bg-white">
                <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-white/70 to-transparent z-10 pointer-events-none" />
                <div className="relative w-full aspect-[16/11] sm:aspect-[16/10] min-h-[200px] sm:min-h-[220px]">
                  <Image
                    src="/dashboard-preview.png"
                    alt={t('dashboardAlt')}
                    width={1200}
                    height={750}
                    className="w-full h-full object-cover object-top"
                    priority
                    sizes="(max-width: 1024px) 100vw, 560px"
                  />
                </div>
              </div>
            </div>

            {/* Feature pills */}
            <div className="px-4 sm:px-5 pb-4 sm:pb-5 shrink-0">
              <div className="grid grid-cols-3 gap-2">
                {demoFeatures.map(({ icon: Icon, label }) => (
                  <div key={label} className="flex flex-col items-center gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50 px-2 py-2.5">
                    <Icon className="w-4 h-4 text-emerald-700" aria-hidden />
                    <span className="text-[10px] sm:text-xs font-semibold text-emerald-800 text-center leading-tight">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
