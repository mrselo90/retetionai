import { Links, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData } from "react-router";

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
        {/* Polaris web components (s-*) come from the AppProvider in each route,
            which loads https://cdn.shopify.com/shopifycloud/polaris.js; loading it
            here too would register every element twice. Unversioned polaris.js
            follows Polaris 1.x and never serves 2.x, matching
            @shopify/polaris-types ^1.1. Polaris 2 needs polaris-2.js via polarisUrl
            in AppProvider and shopify.server.ts (shopify-app-react-router >= 2.1). */}
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
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
