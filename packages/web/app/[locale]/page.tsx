'use client';

import { useTranslations, useLocale } from 'next-intl';
import Image from 'next/image';
import { Link } from '@/i18n/routing';
import { Hero } from '@/components/landing-page/Hero';
import { Stats } from '@/components/landing-page/Stats';
import { Features } from '@/components/landing-page/Features';
import { SocialProof } from '@/components/landing-page/SocialProof';
import { HowItWorks } from '@/components/landing-page/HowItWorks';
import { PricingPreview } from '@/components/landing-page/PricingPreview';
import { FAQ } from '@/components/landing-page/FAQ';
import { Footer } from '@/components/landing-page/Footer';
import { SButton, SCard, SPage } from '@/components/landing-page/PolarisWc';

export default function Home() {
  const t = useTranslations('Landing');
  const tFooter = useTranslations('Landing.footer');
  const locale = useLocale();
  const isEn = locale === 'en';

  return (
    <SPage
      className="min-h-screen bg-[#f6f4ea] text-[#17231f] flex flex-col overflow-x-hidden"
      role="main"
      aria-label={t('title')}
    >
      {/* Header — mobile-first: logo + nav, no overflow */}
      <header className="sticky top-0 z-50 border-b border-black/5 bg-[#f6f4ea]/90 backdrop-blur-xl shrink-0">
        <SCard className="block w-full max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3 min-w-0 bg-transparent border-0 shadow-none">
          <Link
            href="/"
            className="flex items-center gap-2 min-w-0 shrink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg"
            aria-label={t('brandName')}
          >
            <Image src="/recete-logo.svg" alt="" className="h-7 w-auto min-w-[100px] sm:h-8 sm:min-w-[120px]" width={160} height={40} />
            <span className="hidden lg:inline text-sm font-medium text-zinc-500 truncate">{t('brandTagline')}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 mr-auto ml-6" aria-label="Primary">
            {[
              { href: '/#features', label: tFooter('features') },
              { href: '/#how-it-works', label: tFooter('howItWorks') },
              { href: '/#pricing', label: tFooter('pricing') },
              { href: '/#faq', label: 'FAQ' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-block"
              >
                <SButton className="px-3 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 rounded-lg hover:bg-white/80 transition-colors">
                  {item.label}
                </SButton>
              </Link>
            ))}
          </nav>
          <nav className="flex items-center gap-2 sm:gap-3 shrink-0" aria-label="Language and account">
            <SCard className="block flex rounded-lg border border-border bg-muted/30 p-0.5 shadow-none" role="group" aria-label="Language">
              <Link
                href="/"
                locale="en"
                className="inline-block"
                aria-current={isEn ? 'page' : undefined}
              >
                <SButton className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${isEn ? 'bg-[#0a3d2e] text-[#f8f5e6] shadow-sm' : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/80'}`}>
                  EN
                </SButton>
              </Link>
              <Link
                href="/"
                locale="tr"
                className="inline-block"
                aria-current={!isEn ? 'page' : undefined}
              >
                <SButton className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${!isEn ? 'bg-[#0a3d2e] text-[#f8f5e6] shadow-sm' : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/80'}`}>
                  TR
                </SButton>
              </Link>
            </SCard>
            <Link
              href="/login"
              className="hidden sm:inline-block"
            >
              <SButton className="py-2 px-3 sm:px-4 text-xs sm:text-sm font-medium text-zinc-800 hover:bg-white rounded-lg border border-transparent hover:border-black/5 transition-colors">
                {t('login')}
              </SButton>
            </Link>
            <Link
              href="/signup"
              className="inline-block"
            >
              <SButton className="py-2 px-3 sm:px-5 text-xs sm:text-sm font-semibold bg-[#0a3d2e] text-[#f8f5e6] rounded-lg shadow-[0_8px_24px_rgba(10,61,46,0.2)] hover:opacity-95 transition-opacity whitespace-nowrap">
                {t('signup')}
              </SButton>
            </Link>
          </nav>
        </SCard>
      </header>

      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-70"
          style={{
            background:
              'radial-gradient(circle at 12% 18%, rgba(16,185,129,.14), transparent 45%), radial-gradient(circle at 85% 14%, rgba(245,158,11,.1), transparent 38%)',
          }}
        />
        <Hero />
      </div>
      <Stats />
      <Features />
      <HowItWorks />
      <SocialProof />
      <PricingPreview />
      <FAQ />
      <Footer />

      <div className="sm:hidden fixed bottom-3 inset-x-3 z-40 pb-[max(env(safe-area-inset-bottom),0px)]">
        <SCard className="block rounded-2xl border border-black/10 bg-white/95 backdrop-blur shadow-[0_18px_45px_rgba(10,61,46,.14)] p-2 flex items-center gap-2">
          <Link
            href="/signup"
            className="flex-1 inline-block"
          >
            <SButton className="w-full inline-flex items-center justify-center rounded-xl bg-[#0a3d2e] px-4 py-3 text-sm font-semibold text-[#f8f5e6]">
              {t('signup')}
            </SButton>
          </Link>
          <Link
            href="/#pricing"
            className="inline-block"
          >
            <SButton className="inline-flex items-center justify-center rounded-xl border border-black/10 bg-[#f6f4ea] px-4 py-3 text-sm font-semibold text-[#0a3d2e]">
              {tFooter('pricing')}
            </SButton>
          </Link>
        </SCard>
      </div>
    </SPage>
  );
}
