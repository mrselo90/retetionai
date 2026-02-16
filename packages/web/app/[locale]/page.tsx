import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

export default function Home() {
  const t = useTranslations('Landing');

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center px-4 py-12 sm:py-16">
      <div className="w-full max-w-2xl text-center animate-fade-in">
        <h1 className="text-4xl sm:text-5xl font-bold text-zinc-900 tracking-tight mb-4">
          {t('title')}
        </h1>
        <p className="text-lg sm:text-xl text-zinc-600 mb-2 max-w-xl mx-auto">
          {t('subtitle')}
        </p>
        <p className="text-sm text-zinc-600 mb-10">
          {t('description')}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
          >
            {t('login')}
          </Link>
          <Link
            href="/signup"
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 bg-white border border-zinc-200 text-zinc-800 font-medium rounded-lg hover:bg-zinc-50 hover:border-zinc-300 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:ring-offset-2"
          >
            {t('signup')}
          </Link>
        </div>
        <p className="mt-8 text-xs text-zinc-600">
          <Link href="/privacy-policy" className="hover:text-zinc-600 underline">{t('privacy')}</Link>
          {' · '}
          <Link href="/terms-of-service" className="hover:text-zinc-600 underline">{t('terms')}</Link>
        </p>
      </div>
    </div>
  );
}
