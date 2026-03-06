import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextRequest } from 'next/server';

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Bypass i18n for standalone pages that should not have locale prefix
    const bypassPaths = ['/privacy-sudokuworld'];
    if (bypassPaths.some((p) => pathname.startsWith(p))) {
        return; // let Next.js handle it directly
    }

    return intlMiddleware(request);
}

export const config = {
    // Match all paths except static files, API routes, and Next.js internals
    matcher: ['/((?!_next|_vercel|.*\\..*).*)'],
};
