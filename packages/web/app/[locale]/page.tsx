'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Hero } from '@/components/landing-page/Hero';
import { Stats } from '@/components/landing-page/Stats';
import { Features } from '@/components/landing-page/Features';
import { HowItWorks } from '@/components/landing-page/HowItWorks';
import { CTA } from '@/components/landing-page/CTA';
import { Footer } from '@/components/landing-page/Footer';

export default function Home() {
  const t = useTranslations('Landing');
  const locale = useLocale();
  const isEn = locale === 'en';

  return (
    <main
      className="min-h-screen bg-[hsl(var(--surface))] flex flex-col overflow-x-hidden"
      role="main"
      aria-label={t('title')}
    >
      {/* Header — Recete brand + nav (mobile-first, no truncation) */}
      <header className="sticky top-0 z-50 border-b border-border/80 bg-white/95 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
          <Link
            href="/"
            className="flex items-center gap-2 sm:gap-3 font-bold text-foreground tracking-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg min-w-0 shrink-0"
          >
            <div
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 text-base sm:text-xl font-extrabold"
              aria-hidden
            >
              R
            </div>
            <span className="text-base sm:text-xl text-foreground whitespace-nowrap">{t('brandName')}</span>
            <span className="hidden sm:inline text-sm font-medium text-muted-foreground shrink-0">{t('brandTagline')}</span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2 shrink-0" aria-label="Language and account">
            <div className="flex rounded-lg sm:rounded-xl border border-border bg-muted/30 p-0.5 sm:p-1" role="group" aria-label="Language">
              <Link
                href="/"
                locale="en"
                className={`px-2 py-1.5 sm:px-3 sm:py-2 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${isEn ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                aria-current={isEn ? 'page' : undefined}
              >
                EN
              </Link>
              <Link
                href="/"
                locale="tr"
                className={`px-2 py-1.5 sm:px-3 sm:py-2 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${!isEn ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                aria-current={!isEn ? 'page' : undefined}
              >
                TR
              </Link>
            </div>
            <Link
              href="/login"
              className="px-2 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium text-foreground hover:bg-muted rounded-lg sm:rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {t('login')}
            </Link>
            <Link
              href="/signup"
              className="px-3 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-semibold bg-primary text-primary-foreground rounded-lg sm:rounded-xl shadow-sm hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 whitespace-nowrap"
            >
              {t('signup')}
            </Link>
          </nav>
        </div>
      </header>

      <Hero />
      <Stats />
      <Features />
      <HowItWorks />
      <CTA />
      <Footer />
    </main>
  );
}
