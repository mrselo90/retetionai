import "../app/globals.css";
import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google';

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  weight: '400',
});

// Root layout: minimal shell — locale and providers live in [locale]/layout.tsx
// suppressHydrationWarning on <html> is needed because next-intl sets lang dynamically
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable}`}>
      <body
        className="antialiased min-h-screen overflow-x-hidden"
        style={{
          paddingTop: 0,
          fontFamily:
            '"Avenir Next", "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif',
        }}
      >
        {children}
      </body>
    </html>
  );
}
