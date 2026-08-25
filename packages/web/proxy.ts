import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  return intlMiddleware(request);
}

export const config = {
  // rc-relay is the PostHog proxy (see next.config.mjs). Without excluding it,
  // the locale rewrite turns /rc-relay/i/v0/e/ into /en/rc-relay/i/v0/e/, which
  // matches no route — every event 404s instead of reaching PostHog. Static
  // assets under it happen to survive via the `.*\..*` extension escape, so the
  // library loads and only the ingestion silently fails.
  matcher: ['/((?!api|_next|monitoring|api-backend|rc-relay|.*\\..*).*)'],
};
