import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import { MessageCircle, Package, BarChart3, ShoppingBag } from 'lucide-react';

export default function Home() {
  const t = useTranslations('Landing');
  const locale = useLocale();
  const isEn = locale === 'en';

  return (
    <main
      className="min-h-screen bg-white flex flex-col"
      role="main"
      aria-label={t('title')}
    >
      {/* Header: Shopify-style clean bar */}
      <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-zinc-900 tracking-tight">
            <div
              className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center"
              aria-hidden
            >
              <span className="text-lg font-extrabold">R</span>
            </div>
            <span className="text-lg">{t('title')}</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3" aria-label="Language and account">
            <div className="flex rounded-lg border border-zinc-200 p-0.5" role="group" aria-label="Language">
              <Link
                href="/"
                locale="en"
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isEn ? 'bg-primary text-primary-foreground' : 'text-zinc-600 hover:bg-zinc-100'}`}
                aria-current={isEn ? 'page' : undefined}
              >
                EN
              </Link>
              <Link
                href="/"
                locale="tr"
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${!isEn ? 'bg-primary text-primary-foreground' : 'text-zinc-600 hover:bg-zinc-100'}`}
                aria-current={!isEn ? 'page' : undefined}
              >
                TR
              </Link>
            </div>
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-semibold text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-colors"
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

      {/* Hero: clear value prop, Shopify-app style */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
        <p className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 text-zinc-600 text-sm font-medium mb-8">
          <ShoppingBag className="w-4 h-4" aria-hidden />
          {t('forShopify')}
        </p>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-zinc-900 tracking-tight max-w-3xl mx-auto leading-tight mb-6">
          {t('heroLine')}
        </h1>
        <p className="text-lg sm:text-xl text-zinc-600 max-w-2xl mx-auto mb-10">
          {t('subtitle')}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/signup"
            className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center px-8 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {t('signup')}
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center px-8 py-3 border border-zinc-300 text-zinc-800 font-semibold rounded-lg hover:bg-zinc-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2"
          >
            {t('login')}
          </Link>
        </div>
      </section>

      {/* Features: simple 3-column, Polaris-like */}
      <section className="border-t border-zinc-100 bg-zinc-50/50 py-16 sm:py-20" aria-label="Features">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-10">
            <article className="bg-white rounded-xl border border-zinc-200/80 p-6 sm:p-8 shadow-sm text-center sm:text-left">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 mx-auto sm:mx-0 text-primary">
                <MessageCircle className="w-6 h-6" aria-hidden />
              </div>
              <h2 className="font-bold text-zinc-900 text-lg mb-2">{t('features.automated')}</h2>
              <p className="text-zinc-600 text-sm leading-relaxed">{t('features.automatedDesc')}</p>
            </article>
            <article className="bg-white rounded-xl border border-zinc-200/80 p-6 sm:p-8 shadow-sm text-center sm:text-left">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 mx-auto sm:mx-0 text-primary">
                <Package className="w-6 h-6" aria-hidden />
              </div>
              <h2 className="font-bold text-zinc-900 text-lg mb-2">{t('features.aiPowered')}</h2>
              <p className="text-zinc-600 text-sm leading-relaxed">{t('features.aiPoweredDesc')}</p>
            </article>
            <article className="bg-white rounded-xl border border-zinc-200/80 p-6 sm:p-8 shadow-sm text-center sm:text-left">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 mx-auto sm:mx-0 text-primary">
                <BarChart3 className="w-6 h-6" aria-hidden />
              </div>
              <h2 className="font-bold text-zinc-900 text-lg mb-2">{t('features.analytics')}</h2>
              <p className="text-zinc-600 text-sm leading-relaxed">{t('features.analyticsDesc')}</p>
            </article>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-100 py-6" role="contentinfo">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 text-sm text-zinc-500">
          <Link href="/privacy-policy" className="hover:text-primary hover:underline transition-colors">
            {t('privacy')}
          </Link>
          <Link href="/terms-of-service" className="hover:text-primary hover:underline transition-colors">
            {t('terms')}
          </Link>
        </div>
      </footer>
    </main>
  );
}
