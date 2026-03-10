import "../app/globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
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
