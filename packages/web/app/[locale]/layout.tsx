import type { Metadata } from "next";
import { ShopifyProvider } from '@/components/ShopifyProvider';
import BackendHealthBanner from '@/components/BackendHealthBanner';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: "RECETE LTD — AI WhatsApp Support for Shopify Merchants",
  description: "RECETE LTD provides AI-powered WhatsApp customer support and post-purchase retention software for Shopify merchants.",
  icons: {
    icon: "/icon.png?v=2",
    apple: "/apple-icon.png?v=2",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default async function LocaleLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  // Validate that the incoming `locale` is valid
  if (!['en', 'tr'].includes(locale)) {
    notFound();
  }

  // Providing all messages to the client
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <BackendHealthBanner />
      <ShopifyProvider>
        {children}
      </ShopifyProvider>
    </NextIntlClientProvider>
  );
}
