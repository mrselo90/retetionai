import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css"; // Adjusted path
import { ShopifyProvider } from '../../components/ShopifyProvider'; // Adjusted path
import BackendHealthBanner from '../../components/BackendHealthBanner'; // Adjusted path
import { cn } from '@/lib/utils';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Recete — Retention Agent",
  description: "AI-powered post-purchase customer retention platform for Shopify. Reduce returns, boost LTV via WhatsApp.",
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
    <html lang={locale}>
      <body className={cn(geistSans.variable, geistMono.variable, "antialiased min-h-screen overflow-x-hidden")} style={{ paddingTop: 0 }}>
        <NextIntlClientProvider messages={messages}>
          <BackendHealthBanner />
          <ShopifyProvider>
            {children}
          </ShopifyProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
