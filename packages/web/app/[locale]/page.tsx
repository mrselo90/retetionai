import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

export default function Home() {
  const t = useTranslations('Landing');

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-primary/5 flex flex-col items-center justify-center px-4 py-12 sm:py-16 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMxNGI4YTYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bTAtNHYyaDJ2LTJoLTJ6bS0yIDJ2LTJoLTJ2Mmgyem0tNCAydi0yaC0ydjJoMnptLTQgMHYtMmgtMnYyaDJ6bS00IDB2LTJoLTJ2Mmgyem0tNCAwdi0yaC0ydjJoMnptLTQgMHYtMmgtMnYyaDJ6bS00IDB2LTJoLTJ2Mmgyem0tNCAwdi0yaC0ydjJoMnptLTQgMHYtMmgtMnYyaDJ6bTI4IDMydi0yaC0ydjJoMnptMCAydi0yaC0ydjJoMnptMCAydi0yaC0ydjJoMnptMCAydi0yaC0ydjJoMnptMCAydi0yaC0ydjJoMnptMCAydi0yaC0ydjJoMnptMCAydi0yaC0ydjJoMnptMCAydi0yaC0ydjJoMnptLTIgMnYtMmgtMnYyaDJ6bS00IDB2LTJoLTJ2Mmgyem0tNCAwdi0yaC0ydjJoMnptLTQgMHYtMmgtMnYyaDJ6bS00IDB2LTJoLTJ2Mmgyem0tNCAwdi0yaC0ydjJoMnptLTQgMHYtMmgtMnYyaDJ6bS00IDB2LTJoLTJ2Mmgyem0tNCAwdi0yaC0ydjJoMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-50"></div>
      
      <div className="w-full max-w-3xl text-center animate-fade-in relative z-10">
        {/* Logo / Brand */}
        <div className="mb-8 flex justify-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center shadow-2xl animate-scale-in">
            <span className="text-4xl font-extrabold">G</span>
          </div>
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-zinc-900 tracking-tight mb-6 leading-tight">
          {t('title')}
        </h1>
        <p className="text-xl sm:text-2xl text-zinc-600 mb-3 max-w-2xl mx-auto font-medium leading-relaxed">
          {t('subtitle')}
        </p>
        <p className="text-base text-zinc-500 mb-12 max-w-xl mx-auto">
          {t('description')}
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-primary to-primary/90 text-white font-bold rounded-xl hover:shadow-xl hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 shadow-lg"
          >
            {t('login')}
          </Link>
          <Link
            href="/signup"
            className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 bg-white border-2 border-zinc-200 text-zinc-800 font-bold rounded-xl hover:bg-zinc-50 hover:border-primary/30 hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:ring-offset-2 shadow-sm"
          >
            {t('signup')}
          </Link>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
          <div className="p-6 rounded-xl bg-white/60 backdrop-blur-sm border border-zinc-200/50 shadow-sm hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="font-bold text-zinc-900 mb-1">Automated</h3>
            <p className="text-sm text-zinc-600">WhatsApp engagement on autopilot</p>
          </div>
          <div className="p-6 rounded-xl bg-white/60 backdrop-blur-sm border border-zinc-200/50 shadow-sm hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-bold text-zinc-900 mb-1">AI-Powered</h3>
            <p className="text-sm text-zinc-600">Smart conversations that convert</p>
          </div>
          <div className="p-6 rounded-xl bg-white/60 backdrop-blur-sm border border-zinc-200/50 shadow-sm hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-lg bg-info/10 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-info" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <h3 className="font-bold text-zinc-900 mb-1">Analytics</h3>
            <p className="text-sm text-zinc-600">Track ROI and engagement metrics</p>
          </div>
        </div>
        
        <p className="text-xs text-zinc-500">
          <Link href="/privacy-policy" className="hover:text-primary underline font-medium transition-colors">{t('privacy')}</Link>
          {' · '}
          <Link href="/terms-of-service" className="hover:text-primary underline font-medium transition-colors">{t('terms')}</Link>
        </p>
      </div>
    </div>
  );
}
