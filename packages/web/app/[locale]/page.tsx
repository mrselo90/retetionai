'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import { MessageCircle, Package, BarChart3, ShoppingBag } from 'lucide-react';

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
      <header className="sticky top-0 z-50 border-b border-border bg-card">
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

      {/* Hero */}
      <section className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-12 sm:py-20 text-center">
        <p className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-sm font-medium mb-6">
          <ShoppingBag className="w-4 h-4 shrink-0" aria-hidden />
          {t('forShopify')}
        </p>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground tracking-tight max-w-2xl mx-auto leading-tight mb-4">
          {t('heroLine')}
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto mb-8">
          {t('subtitle')}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/signup"
            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {t('signup')}
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center px-6 py-2.5 border border-border bg-card text-foreground font-medium rounded-lg hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {t('login')}
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-card py-12 sm:py-16" aria-label="Features">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            <article className="rounded-lg border border-border bg-background p-6 shadow-sm text-center sm:text-left">
              <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-3 mx-auto sm:mx-0 text-primary">
                <MessageCircle className="w-5 h-5" aria-hidden />
              </div>
              <h2 className="font-semibold text-foreground text-base mb-1.5">{t('features.automated')}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{t('features.automatedDesc')}</p>
            </article>
            <article className="rounded-lg border border-border bg-background p-6 shadow-sm text-center sm:text-left">
              <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-3 mx-auto sm:mx-0 text-primary">
                <Package className="w-5 h-5" aria-hidden />
              </div>
              <h2 className="font-semibold text-foreground text-base mb-1.5">{t('features.aiPowered')}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{t('features.aiPoweredDesc')}</p>
            </article>
            <article className="rounded-lg border border-border bg-background p-6 shadow-sm text-center sm:text-left">
              <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-3 mx-auto sm:mx-0 text-primary">
                <BarChart3 className="w-5 h-5" aria-hidden />
              </div>
              <h2 className="font-semibold text-foreground text-base mb-1.5">{t('features.analytics')}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{t('features.analyticsDesc')}</p>
            </article>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-5 bg-card" role="contentinfo">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-sm text-muted-foreground">
          <Link href="/privacy-policy" className="hover:text-primary hover:underline transition-colors">
            {t('privacy')}
          </Link>
          <span className="hidden sm:inline text-border">·</span>
          <Link href="/terms-of-service" className="hover:text-primary hover:underline transition-colors">
            {t('terms')}
          </Link>
        </div>
      </footer>
    </main>
  );
}
