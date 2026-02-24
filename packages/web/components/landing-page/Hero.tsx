'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import Image from 'next/image';
import { ArrowRight, Sparkles, ShieldCheck, Zap } from 'lucide-react';

export function Hero() {
  const t = useTranslations('Landing');
  const tStats = useTranslations('Landing.stats');

  const highlights = [
    { icon: ShieldCheck, value: tStats('returns'), label: tStats('returnsLabel') },
    { icon: Zap, value: tStats('messages'), label: tStats('messagesLabel') },
    { icon: Sparkles, value: tStats('satisfaction'), label: tStats('satisfactionLabel') },
  ];

  return (
    <section className="relative overflow-hidden pt-8 pb-10 sm:pt-12 sm:pb-14 md:pt-16 md:pb-20">
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-x-0 top-0 h-[420px] bg-[linear-gradient(180deg,#0a3d2e_0%,#0d4a38_65%,transparent_100%)]" />
        <div className="absolute top-10 left-[-8%] w-56 h-56 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="absolute top-24 right-[-5%] w-52 h-52 rounded-full bg-amber-300/10 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1.02fr_.98fr] gap-6 lg:gap-8 items-stretch">
          <div className="rounded-2xl sm:rounded-3xl border border-white/10 bg-[#0a3d2e] text-[#f8f5e6] p-5 sm:p-7 lg:p-8 shadow-[0_24px_80px_rgba(10,61,46,0.25)]">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs sm:text-sm font-semibold">
              <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">
                <Sparkles className="w-3.5 h-3.5" aria-hidden />
              </span>
              {t('forShopify')}
            </div>

            <h1
              className="mt-4 sm:mt-6 font-extrabold tracking-tight leading-[1.05]"
              style={{ fontSize: 'clamp(2rem, 3vw + 1.2rem, 4.2rem)', letterSpacing: '-0.03em' }}
            >
              {t('heroLine')}
            </h1>

            <p className="mt-4 text-sm sm:text-base leading-relaxed text-[#f8f5e6]/88 max-w-xl">
              {t('subtitle')}
            </p>
            <p className="mt-2 text-sm sm:text-base leading-relaxed text-[#f8f5e6]/68 max-w-xl">
              {t('description')}
            </p>

            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#f8f5e6] px-5 py-3.5 text-sm sm:text-base font-bold text-[#0a3d2e] shadow-[0_10px_30px_rgba(248,245,230,.18)] transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {t('signup')}
                <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-5 py-3.5 text-sm sm:text-base font-semibold text-[#f8f5e6] backdrop-blur transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {t('login')}
              </Link>
            </div>

            <div className="mt-4 text-xs sm:text-sm text-[#f8f5e6]/75">{t('signupSmall')}</div>

            <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {highlights.map(({ icon: Icon, value, label }) => (
                <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4">
                  <div className="flex items-center gap-2 text-[#f8f5e6]/70">
                    <Icon className="w-4 h-4 text-emerald-300" aria-hidden />
                    <span className="text-xs font-medium">{label}</span>
                  </div>
                  <div className="mt-1.5 text-xl sm:text-2xl font-extrabold tracking-tight">{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative rounded-2xl sm:rounded-3xl border border-black/5 bg-white shadow-[0_24px_80px_rgba(10,61,46,0.12)] overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(10,61,46,.06),transparent)]" aria-hidden />
            <div className="relative p-4 sm:p-5 border-b border-black/5 bg-white/90">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
                <div className="ml-2 flex-1 min-w-0 rounded-lg border border-black/5 bg-[#f6f4ea] px-3 py-1.5 text-xs font-mono text-zinc-500 truncate">
                  app.recete.ai/dashboard
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { label: tStats('merchantsLabel'), value: tStats('merchants') },
                  { label: tStats('returnsLabel'), value: tStats('returns') },
                  { label: tStats('messagesLabel'), value: tStats('messages') },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-black/5 bg-[#f8f5e6] px-3 py-2">
                    <div className="text-[10px] sm:text-xs text-zinc-500 truncate">{item.label}</div>
                    <div className="text-sm sm:text-base font-bold text-[#0a3d2e]">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-2 sm:p-3 bg-[#f6f4ea]">
              <div className="relative rounded-xl sm:rounded-2xl border border-black/5 overflow-hidden bg-white">
                <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-white/70 to-transparent z-10 pointer-events-none" />
                <div className="relative w-full aspect-[16/11] sm:aspect-[16/10] min-h-[220px]">
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

            <div className="px-4 sm:px-5 pb-4 sm:pb-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                  <p className="text-xs text-emerald-700 font-semibold">{tStats('returnsLabel')}</p>
                  <p className="text-sm text-emerald-900 mt-0.5">{t('description')}</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                  <p className="text-xs text-amber-700 font-semibold">{tStats('satisfactionLabel')}</p>
                  <p className="text-sm text-amber-900 mt-0.5">{t('subtitle')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
