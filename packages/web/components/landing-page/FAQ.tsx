'use client';

import { useTranslations } from 'next-intl';
import { SBadge, SCard, SSection } from './PolarisWc';

export function FAQ() {
  const t = useTranslations('Landing.faq');

  const items = [
    'q1',
    'q2',
    'q3',
    'q4',
  ] as const;

  return (
    <SSection id="faq" className="block py-16 sm:py-20 lg:py-24 px-4 sm:px-6 bg-[#f6f4ea] scroll-mt-24">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8 sm:mb-10 lg:mb-12">
          <SBadge className="inline-flex items-center rounded-full border border-[#0a3d2e]/10 bg-[#0a3d2e]/5 px-3 py-1 text-xs font-semibold text-[#0a3d2e]">
            {t('eyebrow')}
          </SBadge>
          <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[#0a3d2e]">
            {t('title')}
          </h2>
          <p className="mt-2 text-sm sm:text-base text-zinc-600 text-center max-w-2xl mx-auto leading-relaxed">
            {t('subtitle')}
          </p>
        </div>

        <SCard className="block rounded-2xl border border-black/5 bg-white shadow-[0_12px_40px_rgba(10,61,46,.05)] overflow-hidden">
          <div className="divide-y divide-black/5">
            {items.map((key) => (
              <details key={key} className="group p-4 sm:p-5">
                <summary className="list-none cursor-pointer flex items-start sm:items-center justify-between gap-4">
                  <span className="text-sm sm:text-base font-semibold text-[#0a3d2e]">
                    {t(`${key}.question`)}
                  </span>
                  <span className="shrink-0 text-zinc-400 group-open:rotate-45 transition-transform text-xl leading-none" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm sm:text-base text-zinc-600 leading-relaxed pr-6">
                  {t(`${key}.answer`)}
                </p>
              </details>
            ))}
          </div>
        </SCard>
      </div>
    </SSection>
  );
}
