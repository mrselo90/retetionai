'use client';

import { useTranslations } from 'next-intl';
import { Quote, ShieldCheck, Store, MessageCircleMore } from 'lucide-react';

export function SocialProof() {
  const t = useTranslations('Landing.socialProof');

  const proofItems = [
    { icon: Store, label: t('proof1') },
    { icon: MessageCircleMore, label: t('proof2') },
    { icon: ShieldCheck, label: t('proof3') },
  ];

  const testimonials = [
    {
      quote: t('testimonial1.quote'),
      name: t('testimonial1.name'),
      role: t('testimonial1.role'),
      metric: t('testimonial1.metric'),
    },
    {
      quote: t('testimonial2.quote'),
      name: t('testimonial2.name'),
      role: t('testimonial2.role'),
      metric: t('testimonial2.metric'),
    },
    {
      quote: t('testimonial3.quote'),
      name: t('testimonial3.name'),
      role: t('testimonial3.role'),
      metric: t('testimonial3.metric'),
    },
  ];

  return (
    <section className="py-14 sm:py-16 lg:py-20 px-4 sm:px-6" style={{ background: '#ffffff' }}>
      <div className="max-w-6xl mx-auto">
        <div className="rounded-2xl sm:rounded-3xl border border-zinc-100 bg-white p-5 sm:p-6 lg:p-7 shadow-[0_14px_50px_rgba(10,61,46,.06)]">

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 lg:gap-7 mb-5 sm:mb-7">
            {/* Left: title */}
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

            {/* Right: trust badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full lg:w-auto lg:min-w-[500px] self-stretch">
              {proofItems.map((item) => {
                const Icon = item.icon;
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

          {/* Testimonials */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-4 items-stretch">
            {testimonials.map((item, idx) => (
              <article
                key={idx}
                className="relative rounded-2xl border border-zinc-100 bg-white p-4 sm:p-5 shadow-[0_4px_16px_rgba(10,61,46,.04)] h-full flex flex-col"
              >
                <Quote className="w-5 h-5 text-emerald-600/60" aria-hidden />
                <p className="mt-3 text-sm sm:text-base leading-relaxed text-zinc-700 flex-1">
                  <span aria-hidden>&ldquo;</span>
                  {item.quote}
                  <span aria-hidden>&rdquo;</span>
                </p>
                <div className="mt-auto pt-4 border-t border-zinc-100 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#0a3d2e' }}>{item.name}</p>
                    <p className="text-xs text-zinc-500">{item.role}</p>
                  </div>
                  <span className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    {item.metric}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
