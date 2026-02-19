'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import Image from 'next/image';
import { MessageCircle, Package, BarChart3, ShoppingBag, Store, Bot, LineChart, ArrowRight, Mail } from 'lucide-react';

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

      {/* Hero */}
      <section className="max-w-6xl mx-auto w-full px-4 sm:px-6 pt-12 sm:pt-20 pb-8 text-center">
        <p className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-sm font-medium mb-6">
          <ShoppingBag className="w-4 h-4 shrink-0" aria-hidden />
          {t('forShopify')}
        </p>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground tracking-tight max-w-3xl mx-auto leading-tight mb-4">
          {t('heroLine')}
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          {t('subtitle')}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-3">
          <Link
            href="/signup"
            className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 px-8 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 text-base"
          >
            {t('signup')}
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center px-8 py-3 border border-border bg-card text-foreground font-medium rounded-lg hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-base"
          >
            {t('login')}
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">{t('signupSmall')}</p>
      </section>

      {/* Dashboard Preview */}
      <section className="max-w-4xl mx-auto w-full px-4 sm:px-6 pb-12">
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <Image
            src="/dashboard-preview.png"
            alt={t('dashboardAlt')}
            width={1024}
            height={640}
            className="w-full h-auto"
            priority
          />
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-border bg-card py-8" aria-label="Key metrics">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-foreground">{t('stats.merchants')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('stats.merchantsLabel')}</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-green-600">{t('stats.returns')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('stats.returnsLabel')}</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-foreground">{t('stats.messages')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('stats.messagesLabel')}</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-foreground">{t('stats.satisfaction')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('stats.satisfactionLabel')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 sm:py-20" aria-label="Features">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-12">
            {t('features.title')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <article className="rounded-xl border border-border bg-card p-6 sm:p-8 shadow-sm">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 text-primary">
                <MessageCircle className="w-6 h-6" aria-hidden />
              </div>
              <h3 className="font-semibold text-foreground text-lg mb-2">{t('features.automated')}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">{t('features.automatedDesc')}</p>
              <p className="text-xs text-muted-foreground/70 font-medium">{t('features.automatedBullets')}</p>
            </article>
            <article className="rounded-xl border border-border bg-card p-6 sm:p-8 shadow-sm">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 text-primary">
                <Package className="w-6 h-6" aria-hidden />
              </div>
              <h3 className="font-semibold text-foreground text-lg mb-2">{t('features.aiPowered')}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">{t('features.aiPoweredDesc')}</p>
              <p className="text-xs text-muted-foreground/70 font-medium">{t('features.aiPoweredBullets')}</p>
            </article>
            <article className="rounded-xl border border-border bg-card p-6 sm:p-8 shadow-sm">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 text-primary">
                <BarChart3 className="w-6 h-6" aria-hidden />
              </div>
              <h3 className="font-semibold text-foreground text-lg mb-2">{t('features.analytics')}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">{t('features.analyticsDesc')}</p>
              <p className="text-xs text-muted-foreground/70 font-medium">{t('features.analyticsBullets')}</p>
            </article>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-y border-border bg-card py-16 sm:py-20" aria-label="How it works">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            {t('howItWorks.title')}
          </h2>
          <p className="text-muted-foreground mb-12">{t('howItWorks.subtitle')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12">
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
                <Store className="w-7 h-7" aria-hidden />
              </div>
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold mb-3">
                1
              </div>
              <h3 className="font-semibold text-foreground mb-1.5">{t('howItWorks.step1Title')}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t('howItWorks.step1Desc')}</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
                <Bot className="w-7 h-7" aria-hidden />
              </div>
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold mb-3">
                2
              </div>
              <h3 className="font-semibold text-foreground mb-1.5">{t('howItWorks.step2Title')}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t('howItWorks.step2Desc')}</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
                <LineChart className="w-7 h-7" aria-hidden />
              </div>
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold mb-3">
                3
              </div>
              <h3 className="font-semibold text-foreground mb-1.5">{t('howItWorks.step3Title')}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t('howItWorks.step3Desc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-16 sm:py-20" aria-label="Call to action">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
            {t('cta.title')}
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            {t('cta.subtitle')}
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 min-h-[48px] px-8 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 text-base"
          >
            {t('cta.button')}
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6 bg-card" role="contentinfo">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>{t('footer.copyright')}</p>
            <div className="flex items-center gap-4 sm:gap-6">
              <a href={`mailto:${t('footer.contact')}`} className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
                <Mail className="w-3.5 h-3.5" aria-hidden />
                {t('footer.contact')}
              </a>
              <Link href="/privacy-policy" className="hover:text-foreground transition-colors">
                {t('privacy')}
              </Link>
              <Link href="/terms-of-service" className="hover:text-foreground transition-colors">
                {t('terms')}
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
