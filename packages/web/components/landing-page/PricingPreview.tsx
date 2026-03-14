'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Check, ArrowRight, X } from 'lucide-react';

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
      key: 'pro',
      featured: false,
      bullets: t('pro.bullets').split('·').map((b) => b.trim()).filter(Boolean),
    },
  ] as const;

  const comparisonRows = [
    {
      label: t('monthlyIncludedChats'),
      values: ['150', '1,000', '3,000'],
    },
    {
      label: t('overage'),
      values: ['$0.18 / chat', '$0.12 / chat', '$0.08 / chat'],
    },
    {
      label: t('recipes'),
      values: ['20 recipes', '500 recipes', 'Unlimited'],
    },
    {
      label: t('vision'),
      values: [t('starter.vision'), t('growth.vision'), t('pro.vision')],
    },
    {
      label: t('whatsapp'),
      values: ['Shared Recete number', 'Shared Recete number', 'Custom branded number'],
    },
    {
      label: t('analytics'),
      values: ['Basic', 'Basic', 'Advanced'],
    },
    {
      label: t('upsell'),
      values: [t('starter.upsell'), t('growth.upsell'), t('pro.upsell')],
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
          <p className="mt-3 text-sm sm:text-base text-zinc-600 max-w-3xl mx-auto">
            {t('subtitle')}
          </p>
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
                <p className="mt-2 text-sm font-semibold text-zinc-700">
                  {t(`${plan.key}.annualPrice`)} <span className="text-zinc-500 font-medium">{t('perYear')}</span>
                </p>
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

        <div className="mt-8 rounded-[28px] border border-black/5 bg-white shadow-[0_18px_45px_rgba(10,61,46,.08)] overflow-hidden">
          <div className="px-5 sm:px-7 py-5 border-b border-zinc-100">
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: '#0a3d2e' }}>
              {t('annualTitle')}
            </h3>
            <p className="mt-1 text-sm text-zinc-600">{t('annualSubtitle')}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="px-5 sm:px-7 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Feature</th>
                  {plans.map((plan) => (
                    <th key={plan.key} className="px-5 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-bold" style={{ color: '#0a3d2e' }}>{t(`${plan.key}.name`)}</span>
                        <span className="text-xs text-zinc-500">{t(`${plan.key}.annualPrice`)}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.label} className="border-b border-zinc-100 last:border-b-0">
                    <td className="px-5 sm:px-7 py-4 text-sm font-medium text-zinc-700">{row.label}</td>
                    {row.values.map((value, index) => (
                      <td key={`${row.label}-${index}`} className="px-5 py-4 text-sm text-zinc-600">
                        {value === 'Not available' ? (
                          <span className="inline-flex items-center gap-2 text-zinc-500">
                            <X className="w-4 h-4 text-rose-500" aria-hidden />
                            {value}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            {row.label === t('vision') ? (
                              <Check className="w-4 h-4 text-emerald-600" aria-hidden />
                            ) : null}
                            {value}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
