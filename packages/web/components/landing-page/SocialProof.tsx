'use client';

import { useTranslations } from 'next-intl';
import { TrendingDown, Zap, RefreshCw, ShieldCheck, MessageCircleMore, Store } from 'lucide-react';

const outcomeIcons = {
  returns: TrendingDown,
  support: Zap,
  ltv: RefreshCw,
};

const proofIcons = {
  0: Store,
  1: MessageCircleMore,
  2: ShieldCheck,
};

export function SocialProof() {
  const t = useTranslations('Landing.socialProof');

  const proofItems = [
    { iconKey: 0 as const, label: t('proof1') },
    { iconKey: 1 as const, label: t('proof2') },
    { iconKey: 2 as const, label: t('proof3') },
  ];

  const outcomes = [
    {
      iconKey: 'returns' as const,
      metric: t('outcome1.metric'),
      title: t('outcome1.title'),
      desc: t('outcome1.desc'),
      accent: '#0a3d2e',
      accentBg: 'rgba(10,61,46,0.07)',
    },
    {
      iconKey: 'support' as const,
      metric: t('outcome2.metric'),
      title: t('outcome2.title'),
      desc: t('outcome2.desc'),
      accent: '#059669',
      accentBg: 'rgba(5,150,105,0.08)',
    },
    {
      iconKey: 'ltv' as const,
      metric: t('outcome3.metric'),
      title: t('outcome3.title'),
      desc: t('outcome3.desc'),
      accent: '#b45309',
      accentBg: 'rgba(180,83,9,0.08)',
    },
  ];

  return (
    <section className="py-14 sm:py-16 lg:py-20 px-4 sm:px-6" style={{ background: '#ffffff' }}>
      <div className="max-w-6xl mx-auto">
        <div className="rounded-2xl sm:rounded-3xl border border-zinc-100 bg-white p-5 sm:p-6 lg:p-7 shadow-[0_14px_50px_rgba(10,61,46,.06)]">

          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 lg:gap-7 mb-5 sm:mb-7">
            <div className="w-full lg:flex-1 text-center lg:text-left">
              <span
                className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold"
                style={{ borderColor: 'rgba(10,61,46,0.12)', background: 'rgba(10,61,46,0.05)', color: '#0a3d2e' }}
              >
                {t('eyebrow')}
              </span>
              <h2
                className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight"
                style={{ color: '#0a3d2e' }}
              >
                {t('title')}
              </h2>
              <p className="mt-2 text-sm sm:text-base text-zinc-600 max-w-2xl mx-auto lg:mx-0 text-center lg:text-left leading-relaxed">
                {t('subtitle')}
              </p>
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full lg:w-auto lg:min-w-[500px] self-stretch">
              {proofItems.map((item) => {
                const Icon = proofIcons[item.iconKey];
                return (
                  <div
                    key={item.label}
                    className="rounded-xl border border-zinc-100 px-3 py-2.5 flex items-center gap-2"
                    style={{ background: '#f6f4ea' }}
                  >
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white border border-zinc-100">
                      <Icon className="w-4 h-4" style={{ color: '#0a3d2e' }} aria-hidden />
                    </span>
                    <span className="text-xs sm:text-sm font-medium text-zinc-700">{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Outcome cards — honest benefit cards instead of unverified testimonials */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-4 items-stretch">
            {outcomes.map((item) => {
              const Icon = outcomeIcons[item.iconKey];
              return (
                <article
                  key={item.iconKey}
                  className="relative rounded-2xl border border-zinc-100 bg-white p-4 sm:p-5 shadow-[0_4px_16px_rgba(10,61,46,.04)] h-full flex flex-col"
                >
                  {/* Icon + metric badge */}
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ background: item.accentBg }}
                    >
                      <Icon className="w-5 h-5" style={{ color: item.accent }} aria-hidden />
                    </span>
                    <span
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                      style={{
                        background: item.accentBg,
                        color: item.accent,
                        border: `1px solid ${item.accentBg}`,
                      }}
                    >
                      {item.metric}
                    </span>
                  </div>

                  {/* Content */}
                  <h3 className="text-sm sm:text-base font-bold mb-2" style={{ color: '#0a3d2e' }}>
                    {item.title}
                  </h3>
                  <p className="text-sm text-zinc-600 leading-relaxed flex-1">
                    {item.desc}
                  </p>
                </article>
              );
            })}
          </div>

        </div>
      </div>
    </section>
  );
}
