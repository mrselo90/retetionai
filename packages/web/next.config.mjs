import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    
    // Performance optimizations
    compress: true, // Enable gzip compression
    poweredByHeader: false, // Remove X-Powered-By header for security
    
    // Compiler optimizations
    compiler: {
        removeConsole: process.env.NODE_ENV === 'production' ? {
            exclude: ['error', 'warn'],
        } : false,
    },
    
    // Experimental features for better performance
    experimental: {
        optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
    },
    
    // Image optimization
    images: {
        formats: ['image/avif', 'image/webp'],
        minimumCacheTTL: 60,
    },
    
    async rewrites() {
        const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
    
    // Cache headers for static assets
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY',
                    },
                    {
                        key: 'X-XSS-Protection',
                        value: '1; mode=block',
                    },
                ],
            },
            {
                source: '/static/(.*)',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=31536000, immutable',
                    },
                ],
            },
        ];
    },
};

export default withNextIntl(nextConfig);
