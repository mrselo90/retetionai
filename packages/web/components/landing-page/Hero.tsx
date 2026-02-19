'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import Image from 'next/image';
import { ArrowRight, ShoppingBag } from 'lucide-react';

export function Hero() {
  const t = useTranslations('Landing');

  return (
    <section className="relative overflow-hidden pt-12 sm:pt-20 pb-12 lg:pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10 w-full text-center">
        <p className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 animate-fade-in-up">
          <ShoppingBag className="w-4 h-4 shrink-0" aria-hidden />
          {t('forShopify')}
        </p>
        
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground tracking-tight max-w-4xl mx-auto leading-[1.1] mb-6 animate-fade-in-up delay-100">
          {t('heroLine')}
        </h1>
        
        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 animate-fade-in-up delay-200">
          {t('subtitle')}
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4 animate-fade-in-up delay-300">
          <Link
            href="/signup"
            className="w-full sm:w-auto min-h-[52px] inline-flex items-center justify-center gap-2 px-8 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 text-base"
          >
            {t('signup')}
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto min-h-[52px] inline-flex items-center justify-center px-8 py-3 border border-border bg-background/50 backdrop-blur-sm text-foreground font-medium rounded-xl hover:bg-muted/50 transition-all hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-base"
          >
            {t('login')}
          </Link>
        </div>
        
        <p className="text-sm text-muted-foreground animate-fade-in-up delay-400 mb-12">
          {t('signupSmall')}
        </p>

        {/* Dashboard Preview */}
        <div className="relative max-w-5xl mx-auto w-full rounded-xl sm:rounded-2xl border border-border/50 bg-card/50 shadow-2xl overflow-hidden animate-fade-in-up delay-500 group">
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10" />
          <Image
            src="/dashboard-preview.png"
            alt={t('dashboardAlt')}
            width={1200}
            height={750}
            className="w-full h-auto transform transition-transform duration-700 group-hover:scale-[1.02]"
            priority
          />
        </div>
      </div>
      
      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl -z-10 pointer-events-none opacity-50 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px] -translate-y-1/2" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px]" />
      </div>
    </section>
  );
}
