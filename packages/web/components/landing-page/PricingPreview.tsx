'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Check, ArrowRight } from 'lucide-react';

export function PricingPreview() {
  const t = useTranslations('Landing.pricing');

  const plans = [
    {
      key: 'starter',
      featured: false,
      bullets: t('starter.bullets').split('·').map((b) => b.trim()).filter(Boolean),
    },
    {
      key: 'growth',
      featured: true,
      bullets: t('growth.bullets').split('·').map((b) => b.trim()).filter(Boolean),
    },
    {
      key: 'scale',
      featured: false,
      bullets: t('scale.bullets').split('·').map((b) => b.trim()).filter(Boolean),
    },
  ] as const;

  return (
    <section id="pricing" className="py-14 sm:py-16 lg:py-20 px-4 sm:px-6 scroll-mt-24" style={{ background: '#f6f4ea' }}>
      <div className="max-w-6xl mx-auto">

        {/* Section header */}
        <div className="text-center mb-7 sm:mb-8 lg:mb-10">
          <span
            className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold"
            style={{ borderColor: 'rgba(10,61,46,0.12)', background: 'rgba(10,61,46,0.05)', color: '#0a3d2e' }}
          >
            {t('eyebrow')}
          </span>
          <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight" style={{ color: '#0a3d2e' }}>
            {t('title')}
          </h2>
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
          {plans.map((plan) => (
            <div
              key={plan.key}
              className={`relative rounded-2xl border bg-white p-5 sm:p-5 lg:p-6 h-full flex flex-col ${plan.featured
                  ? 'border-[#0a3d2e]/20 shadow-[0_20px_50px_rgba(10,61,46,.12)] ring-1 ring-[#0a3d2e]/10'
                  : 'border-zinc-100 shadow-[0_6px_24px_rgba(10,61,46,.05)]'
                }`}
            >
              {/* Most popular badge */}
              {plan.featured && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-bold whitespace-nowrap shadow-sm"
                  style={{ background: '#0a3d2e', color: '#f8f5e6' }}
                >
                  {t('mostPopular')}
                </div>
              )}

              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold tracking-tight" style={{ color: '#0a3d2e' }}>
                    {t(`${plan.key}.name`)}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-600">{t(`${plan.key}.desc`)}</p>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-end gap-2">
                  <span className="text-3xl sm:text-4xl font-extrabold tracking-tight" style={{ color: '#0a3d2e' }}>
                    {t(`${plan.key}.price`)}
                  </span>
                  <span className="text-sm text-zinc-500 mb-1">{t('perMonth')}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">{t(`${plan.key}.note`)}</p>
              </div>

              <ul className="mt-5 space-y-2.5 flex-1">
                {plan.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2 text-sm text-zinc-700">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200">
                      <Check className="w-3 h-3 text-emerald-700" aria-hidden />
                    </span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>

              {/* Polaris-style CTA button */}
              <Link href="/signup" className="inline-block w-full mt-6">
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
                  style={
                    plan.featured
                      ? { background: '#0a3d2e', color: '#f8f5e6' }
                      : { background: '#f6f4ea', color: '#0a3d2e', border: '1px solid rgba(10,61,46,0.15)' }
                  }
                >
                  {t('cta')}
                  <ArrowRight className="w-4 h-4" aria-hidden />
                </button>
              </Link>
            </div>
          ))}
        </div>

        {/* ROI note */}
        <div className="mt-5 sm:mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 sm:px-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-center sm:text-left">
            <p className="text-sm text-emerald-900 font-medium">{t('roiNote')}</p>
            <Link href="/signup" className="text-sm font-semibold text-emerald-800 hover:text-emerald-900 self-center sm:self-auto">
              {t('secondaryCta')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
