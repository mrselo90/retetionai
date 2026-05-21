import "../app/globals.css";

// Root layout: minimal shell — locale and providers live in [locale]/layout.tsx
// suppressHydrationWarning on <html> is needed because next-intl sets lang dynamically
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
