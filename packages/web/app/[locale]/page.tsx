import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Zap, MessageCircle, BarChart3 } from 'lucide-react';

export default function Home() {
  const t = useTranslations('Landing');
  const locale = useLocale();
  const isEn = locale === 'en';

  return (
    <main
      className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-primary/5 flex flex-col items-center justify-center px-4 py-12 sm:py-16 relative overflow-hidden"
      role="main"
      aria-label={t('title')}
    >
      {/* Background pattern */}
      <div
        className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMxNGI4YTYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bS0yIDJ2LTJoLTJ2Mmgyem0tNCAydi0yaC0ydjJoMnptLTQgMHYtMmgtMnYyaDJ6bS00IDB2LTJoLTJ2Mmgyem0tNCAwdi0yaC0ydjJoMnptLTQgMHYtMmgtMnYyaDJ6bS00IDB2LTJoLTJ2Mmgyem0tNCAwdi0yaC0ydjJoMnptLTQgMHYtMmgtMnYyaDJ6bTI4IDMydi0yaC0ydjJoMnptMCAydi0yaC0ydjJoMnptMCAydi0yaC0ydjJoMnptMCAydi0yaC0ydjJoMnptMCAydi0yaC0ydjJoMnptMCAydi0yaC0ydjJoMnptMCAydi0yaC0ydjJoMnptMCAydi0yaC0ydjJoMnptLTIgMnYtMmgtMnYyaDJ6bS00IDB2LTJoLTJ2Mmgyem0tNCAwdi0yaC0ydjJoMnptLTQgMHYtMmgtMnYyaDJ6bS00IDB2LTJoLTJ2Mmgyem0tNCAwdi0yaC0ydjJoMnptLTQgMHYtMmgtMnYyaDJ6bS00IDB2LTJoLTJ2Mmgyem0tNCAwdi0yaC0ydjJoMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-50"
        aria-hidden
      />

      <div className="w-full max-w-3xl text-center relative z-10 flex flex-col items-center">
        {/* Locale switcher */}
        <nav className="absolute top-0 right-0 sm:top-2 sm:right-4 flex gap-1" aria-label="Language">
          <Link
            href="/"
            locale="en"
            className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${isEn ? 'bg-primary text-primary-foreground' : 'text-zinc-600 hover:bg-zinc-100'}`}
            aria-current={isEn ? 'page' : undefined}
          >
            EN
          </Link>
          <Link
            href="/"
            locale="tr"
            className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${!isEn ? 'bg-primary text-primary-foreground' : 'text-zinc-600 hover:bg-zinc-100'}`}
            aria-current={!isEn ? 'page' : undefined}
          >
            TR
          </Link>
        </nav>

        {/* Logo / brand */}
        <div className="mb-8 flex justify-center animate-fade-in">
          <div
            className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center shadow-xl hover:shadow-2xl transition-shadow duration-300 animate-scale-in"
            aria-hidden
          >
            <span className="text-4xl font-extrabold" aria-hidden>R</span>
          </div>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-zinc-900 tracking-tight mb-4 leading-tight animate-fade-in">
          {t('title')}
        </h1>
        <p className="text-lg sm:text-xl text-zinc-600 mb-2 max-w-2xl mx-auto font-medium leading-relaxed animate-fade-in">
          {t('subtitle')}
        </p>
        <p className="text-sm sm:text-base text-zinc-500 mb-10 max-w-xl mx-auto animate-fade-in">
          {t('description')}
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-14 w-full sm:w-auto animate-fade-in">
          <Link
            href="/login"
            className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center px-8 py-3.5 bg-gradient-to-r from-primary to-primary/90 text-white font-bold rounded-xl hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 shadow-md"
            aria-label={t('login')}
          >
            {t('login')}
          </Link>
          <Link
            href="/signup"
            className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center px-8 py-3.5 bg-white border-2 border-zinc-200 text-zinc-800 font-bold rounded-xl hover:bg-zinc-50 hover:border-primary/40 hover:shadow-md active:scale-[0.98] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2"
            aria-label={t('signup')}
          >
            {t('signup')}
          </Link>
        </div>

        {/* Features */}
        <section
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-14 w-full max-w-4xl"
          aria-label="Features"
        >
          {[
            { key: 'automated', Icon: Zap, delay: '0ms' },
            { key: 'aiPowered', Icon: MessageCircle, delay: '75ms' },
            { key: 'analytics', Icon: BarChart3, delay: '150ms' },
          ].map(({ key, Icon, delay }) => (
            <article
              key={key}
              className="p-5 sm:p-6 rounded-xl bg-white/80 backdrop-blur-sm border border-zinc-200/60 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300 text-left animate-fade-in"
              style={{ animationDelay: delay, animationFillMode: 'backwards' }}
            >
              <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-3 text-primary">
                <Icon className="w-5 h-5" aria-hidden />
              </div>
              <h2 className="font-bold text-zinc-900 mb-1.5 text-base">
                {t(`features.${key}`)}
              </h2>
              <p className="text-sm text-zinc-600 leading-relaxed">
                {t(`features.${key}Desc`)}
              </p>
            </article>
          ))}
        </section>

        {/* Footer */}
        <footer className="text-center animate-fade-in" role="contentinfo">
          <p className="text-sm text-zinc-500">
            <Link
              href="/privacy-policy"
              className="hover:text-primary underline underline-offset-2 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
            >
              {t('privacy')}
            </Link>
            <span className="mx-2 text-zinc-400" aria-hidden>·</span>
            <Link
              href="/terms-of-service"
              className="hover:text-primary underline underline-offset-2 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
            >
              {t('terms')}
            </Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
