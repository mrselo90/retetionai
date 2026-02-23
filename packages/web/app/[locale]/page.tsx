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
      className="min-h-screen bg-[hsl(var(--surface))] flex flex-col"
      role="main"
      aria-label={t('title')}
    >
      {/* Header — Recete brand + nav */}
      <header className="sticky top-0 z-50 border-b border-border/80 bg-white/90 backdrop-blur-md shadow-sm shadow-black/[0.03]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-3 font-bold text-foreground tracking-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg"
          >
            <div
              className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-sm"
              aria-hidden
            >
              <span className="text-xl font-extrabold">R</span>
            </div>
            <span className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
              <span className="text-xl text-foreground">{t('brandName')}</span>
              <span className="text-sm font-medium text-muted-foreground hidden sm:inline">{t('brandTagline')}</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2 shrink-0" aria-label="Language and account">
            <div className="flex rounded-xl border border-border bg-muted/30 p-1" role="group" aria-label="Language">
              <Link
                href="/"
                locale="en"
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${isEn ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                aria-current={isEn ? 'page' : undefined}
              >
                EN
              </Link>
              <Link
                href="/"
                locale="tr"
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${!isEn ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}
                aria-current={!isEn ? 'page' : undefined}
              >
                TR
              </Link>
            </div>
            <Link
              href="/login"
              className="px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {t('login')}
            </Link>
            <Link
              href="/signup"
              className="px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-xl shadow-sm hover:bg-primary-hover transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
