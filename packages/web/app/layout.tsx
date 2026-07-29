import "../app/globals.css";
import "./design-tokens.css";
import { Geist, Geist_Mono, IBM_Plex_Sans, Instrument_Serif } from 'next/font/google';

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

// The dashboard's typeface (design direction 1b). Loaded through next/font rather
// than the prototype's <link> to Google Fonts so it is self-hosted — no extra
// connection on first paint and no swap-in layout shift.
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin', 'latin-ext'], // latin-ext carries the Turkish ş/ğ/İ/ı glyphs
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex',
  display: 'swap',
});

// Root layout: minimal shell — locale and providers live in [locale]/layout.tsx
// suppressHydrationWarning on <html> is needed because next-intl sets lang dynamically
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} ${ibmPlexSans.variable}`}
    >
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
