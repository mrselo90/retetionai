import { Links, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData } from "react-router";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

export const loader = async () => {
  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
  };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        {apiKey ? <meta name="shopify-api-key" content={apiKey} /> : null}
        {apiKey ? (
          <script
            src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
            data-api-key={apiKey}
          />
        ) : null}
        {/* Polaris web components (s-page, s-section, ...), stable 1.x channel. Keep
            @shopify/polaris-types on ^1.1 with it. Coexists with Polaris React while
            routes migrate (docs/ux/shopify-embedded-ui-analysis-2026-10.md). */}
        <script src="https://cdn.shopify.com/shopifycloud/polaris-1.js" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <link rel="stylesheet" href={polarisStyles} />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
