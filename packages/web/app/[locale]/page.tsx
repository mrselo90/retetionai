'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Logo } from '@/components/ui/logo';
import { Hero } from '@/components/landing-page/Hero';
import { Stats } from '@/components/landing-page/Stats';
import { Features } from '@/components/landing-page/Features';
import { SocialProof } from '@/components/landing-page/SocialProof';
import { HowItWorks } from '@/components/landing-page/HowItWorks';
import { PricingPreview } from '@/components/landing-page/PricingPreview';
import { FAQ } from '@/components/landing-page/FAQ';
import { Footer } from '@/components/landing-page/Footer';

export default function Home() {
  const t = useTranslations('Landing');
  const tFooter = useTranslations('Landing.footer');

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden" style={{ background: '#f6f4ea', color: '#17231f' }}>
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-black/5 backdrop-blur-xl shrink-0" style={{ background: 'rgba(246,244,234,0.92)' }}>
        <div className="block w-full max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3 min-w-0">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 min-w-0 shrink focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0a3d2e] focus-visible:ring-offset-2 rounded-lg"
            aria-label={t('brandName')}
          >
            <Logo className="h-7 w-auto min-w-[100px] sm:h-8 sm:min-w-[120px]" />
            <span className="hidden lg:inline text-sm font-medium text-zinc-500 truncate">{t('brandTagline')}</span>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1 mr-auto ml-6" aria-label="Primary">
            {[
              { href: '/#features', label: tFooter('features') },
              { href: '/#how-it-works', label: tFooter('howItWorks') },
              { href: '/#pricing', label: tFooter('pricing') },
              { href: '/#faq', label: 'FAQ' },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="inline-block">
                <span className="block px-3 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 rounded-lg hover:bg-white/80 transition-colors">
                  {item.label}
                </span>
              </Link>
            ))}
          </nav>

          {/* Auth buttons */}
          <nav className="flex items-center gap-2 sm:gap-3 shrink-0" aria-label="Account">
            <Link href="/login" className="hidden sm:inline-block">
              <span className="block py-2 px-3 sm:px-4 text-xs sm:text-sm font-medium text-zinc-800 hover:bg-white rounded-lg border border-transparent hover:border-black/5 transition-colors">
                {t('login')}
              </span>
            </Link>
            <Link href="/signup" className="inline-block">
              <span
                className="block py-2 px-3 sm:px-5 text-xs sm:text-sm font-semibold rounded-lg shadow-[0_8px_24px_rgba(10,61,46,0.2)] hover:opacity-95 transition-opacity whitespace-nowrap"
                style={{ background: '#0a3d2e', color: '#f8f5e6' }}
              >
                {t('signup')}
              </span>
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Page sections ── */}
      {/* Hero — dark green gradient background built into Hero component */}
      <div className="relative" style={{ background: '#f6f4ea' }}>
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

      {/* Section rhythm: cream → white → cream → white → cream → white → cream */}
      <Stats />        {/* cream */}
      <Features />     {/* white */}
      <HowItWorks />   {/* cream */}
      <SocialProof />  {/* white */}
      <PricingPreview />{/* cream */}
      <FAQ />          {/* white */}
      <Footer />       {/* cream */}

      {/* ── Mobile sticky CTA bar ── */}
      <div className="sm:hidden fixed bottom-3 inset-x-3 z-40 pb-[max(env(safe-area-inset-bottom),0px)]">
        <div className="rounded-2xl border border-black/10 bg-white/95 backdrop-blur shadow-[0_18px_45px_rgba(10,61,46,.14)] p-2 flex items-center gap-2">
          <Link href="/signup" className="flex-1 inline-block">
            <span
              className="w-full inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold"
              style={{ background: '#0a3d2e', color: '#f8f5e6' }}
            >
              {t('signup')}
            </span>
          </Link>
          <Link href="/#pricing" className="inline-block">
            <span
              className="inline-flex items-center justify-center rounded-xl border border-black/10 px-4 py-3 text-sm font-semibold"
              style={{ background: '#f6f4ea', color: '#0a3d2e' }}
            >
              {tFooter('pricing')}
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
