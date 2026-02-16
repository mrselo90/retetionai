import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    async rewrites() {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

        // Always proxy the OAuth callback to the backend
        const oauthRewrite = {
            source: "/api/integrations/shopify/oauth/callback",
            destination: `${apiUrl.replace(/\/$/, '')}/api/integrations/shopify/oauth/callback`,
        };

        const monitoringRewrite = {
            source: "/monitoring/:path*",
            destination: `${apiUrl.replace(/\/$/, '')}/monitoring/:path*`,
        };

        // Always proxy /api-backend/* to API so browser requests (dev uses this path) get through
        const apiBackendRewrite = {
            source: "/api-backend/:path*",
            destination: `${apiUrl.replace(/\/$/, '')}/:path*`,
        };

        return [oauthRewrite, monitoringRewrite, apiBackendRewrite];
    },
};

export default withNextIntl(nextConfig);
