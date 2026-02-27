'use client';

import { useTranslations } from 'next-intl';

export function FAQ() {
  const t = useTranslations('Landing.faq');

  const items = ['q1', 'q2', 'q3', 'q4'] as const;

  return (
    <section id="faq" className="py-14 sm:py-16 lg:py-20 px-4 sm:px-6 scroll-mt-24" style={{ background: '#ffffff' }}>
      <div className="max-w-4xl mx-auto">
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
          <p className="mt-2 text-sm sm:text-base text-zinc-600 text-center max-w-2xl mx-auto leading-relaxed">
            {t('subtitle')}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-100 bg-white shadow-[0_8px_32px_rgba(10,61,46,.05)] overflow-hidden">
          <div className="divide-y divide-zinc-100">
            {items.map((key) => (
              <details key={key} className="group p-4 sm:p-5">
                <summary className="list-none cursor-pointer flex items-start sm:items-center justify-between gap-4">
                  <span className="text-sm sm:text-base font-semibold" style={{ color: '#0a3d2e' }}>
                    {t(`${key}.question`)}
                  </span>
                  <span
                    className="shrink-0 w-6 h-6 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-500 group-open:rotate-45 transition-transform text-base leading-none font-light"
                    aria-hidden
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm sm:text-base text-zinc-600 leading-relaxed pr-6">
                  {t(`${key}.answer`)}
                </p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
