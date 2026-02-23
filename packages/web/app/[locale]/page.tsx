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
      {/* Header — mobile-first: logo + nav, no overflow */}
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/95 backdrop-blur-md shrink-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3 min-w-0">
          <Link
            href="/"
            className="flex items-center gap-2 min-w-0 shrink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg"
            aria-label={t('brandName')}
          >
            <img src="/recete-logo.svg" alt="" className="h-7 w-auto min-w-[100px] sm:h-8 sm:min-w-[120px]" width="160" height="40" />
            <span className="hidden md:inline text-sm font-medium text-muted-foreground truncate">{t('brandTagline')}</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3 shrink-0" aria-label="Language and account">
            <div className="flex rounded-lg border border-border bg-muted/30 p-0.5" role="group" aria-label="Language">
              <Link
                href="/"
                locale="en"
                className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${isEn ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                aria-current={isEn ? 'page' : undefined}
              >
                EN
              </Link>
              <Link
                href="/"
                locale="tr"
                className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${!isEn ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                aria-current={!isEn ? 'page' : undefined}
              >
                TR
              </Link>
            </div>
            <Link
              href="/login"
              className="py-2 px-3 sm:px-4 text-xs sm:text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {t('login')}
            </Link>
            <Link
              href="/signup"
              className="py-2 px-3 sm:px-5 text-xs sm:text-sm font-semibold bg-primary text-primary-foreground rounded-lg shadow-sm hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 whitespace-nowrap"
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
