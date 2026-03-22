import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

// Paths that should bypass i18n locale handling
const BYPASS_PATHS = ['/privacy-sudokuworld'];

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let these pages be served directly without locale prefix
  if (BYPASS_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return;
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|monitoring|api-backend|.*\\..*).*)'],
};
