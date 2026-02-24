'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Check, ArrowRight } from 'lucide-react';
import { SBadge, SButton, SCard, SSection } from './PolarisWc';

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
    <SSection id="pricing" className="block py-16 sm:py-20 lg:py-24 px-4 sm:px-6 bg-[#f6f4ea] scroll-mt-24">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8 sm:mb-10 lg:mb-12">
          <SBadge className="inline-flex items-center rounded-full border border-[#0a3d2e]/10 bg-[#0a3d2e]/5 px-3 py-1 text-xs font-semibold text-[#0a3d2e]">
            {t('eyebrow')}
          </SBadge>
          <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[#0a3d2e]">
            {t('title')}
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 items-stretch">
          {plans.map((plan) => (
            <SCard
              key={plan.key}
              className={`relative rounded-2xl border p-5 sm:p-6 bg-white h-full flex flex-col ${
                plan.featured
                  ? 'border-[#0a3d2e]/25 shadow-[0_20px_50px_rgba(10,61,46,.12)]'
                  : 'border-black/5 shadow-[0_10px_28px_rgba(10,61,46,.05)]'
              }`}
            >
              {plan.featured && (
                <div className="absolute -top-2.5 left-5 rounded-full bg-[#0a3d2e] px-3 py-1 text-xs font-semibold text-[#f8f5e6]">
                  {t('mostPopular')}
                </div>
              )}

              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-[#0a3d2e] tracking-tight">{t(`${plan.key}.name`)}</h3>
                  <p className="mt-1 text-sm text-zinc-600">{t(`${plan.key}.desc`)}</p>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex items-end gap-2">
                  <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0a3d2e]">
                    {t(`${plan.key}.price`)}
                  </span>
                  <span className="text-sm text-zinc-500 mb-1">{t('perMonth')}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">{t(`${plan.key}.note`)}</p>
              </div>

              <ul className="mt-5 space-y-2.5 min-h-0">
                {plan.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2 text-sm text-zinc-700">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200">
                      <Check className="w-3 h-3 text-emerald-700" aria-hidden />
                    </span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>

              <Link href="/signup" className="mt-6 inline-block w-full mt-auto">
                <SButton
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                    plan.featured
                      ? 'bg-[#0a3d2e] text-[#f8f5e6] hover:bg-[#0d4a38]'
                      : 'border border-black/10 bg-[#f6f4ea] text-[#0a3d2e] hover:bg-white'
                  }`}
                >
                  {t('cta')}
                  <ArrowRight className="w-4 h-4" aria-hidden />
                </SButton>
              </Link>
            </SCard>
          ))}
        </div>

        <SCard className="block mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 sm:px-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-center sm:text-left">
          <p className="text-sm text-emerald-900 font-medium">{t('roiNote')}</p>
          <Link href="/signup" className="text-sm font-semibold text-emerald-800 hover:text-emerald-900 self-center sm:self-auto">
            {t('secondaryCta')}
          </Link>
        </div>
        </SCard>
      </div>
    </SSection>
  );
}
