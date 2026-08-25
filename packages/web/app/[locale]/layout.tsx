import type { Metadata } from 'next';
import { ShopifyProvider } from '@/components/ShopifyProvider';
import BackendHealthBanner from '@/components/BackendHealthBanner';
import ToastContainer from '@/components/ui/Toast';
import PostHogProvider from '@/components/analytics/PostHogProvider';
import CookieConsentBanner from '@/components/analytics/CookieConsentBanner';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';

export const metadata: Metadata = {
  title: 'Recete — AI-Powered WhatsApp Retention for E-Commerce',
  description:
    'Recete helps e-commerce merchants reduce returns and increase LTV with AI-driven WhatsApp messages. Post-purchase automation that actually works.',
  icons: {
    icon: '/icon.png?v=2',
    apple: '/apple-icon.png?v=2',
  },
  openGraph: {
    title: 'Recete — AI WhatsApp Retention',
    description:
      'Reduce returns. Increase LTV. AI-powered post-purchase WhatsApp automation for e-commerce merchants.',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Recete — AI WhatsApp Retention',
    description:
      'Reduce returns. Increase LTV. AI-powered post-purchase WhatsApp automation for e-commerce merchants.',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
};

// Pre-generate locale routes at build time
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  // Validate that the incoming `locale` is valid
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  // Providing all messages to the client
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <BackendHealthBanner />
      {/*
        PostHog sits inside NextIntlClientProvider because the consent banner
        needs translations, and wraps ShopifyProvider so pageviews are captured
        for every route under [locale] — marketing pages and dashboard alike.
        Nothing is captured until the banner is accepted.
      */}
      <PostHogProvider>
        <ShopifyProvider>{children}</ShopifyProvider>
        <CookieConsentBanner />
      </PostHogProvider>
      {/*
        lib/toast.ts dispatches a `show-toast` event on window; this is the only
        listener for it. Without it mounted, all 80 toast.*() call sites across
        17 pages were silent no-ops — including "session expired" before a
        redirect, every load failure, and every save confirmation.
      */}
      <ToastContainer />
    </NextIntlClientProvider>
  );
}
