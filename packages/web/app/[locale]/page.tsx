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
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-foreground tracking-tight">
            <div
              className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0"
              aria-hidden
            >
              <span className="text-lg font-extrabold">R</span>
            </div>
            <span className="text-lg truncate">{t('title')}</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3 shrink-0" aria-label="Language and account">
            <div className="flex rounded-lg border border-border p-0.5" role="group" aria-label="Language">
              <Link
                href="/"
                locale="en"
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isEn ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                aria-current={isEn ? 'page' : undefined}
              >
                EN
              </Link>
              <Link
                href="/"
                locale="tr"
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${!isEn ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                aria-current={!isEn ? 'page' : undefined}
              >
                TR
              </Link>
            </div>
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              {t('login')}
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
