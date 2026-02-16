import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default async function middleware(request: any) {
  console.log('Middleware routing:', request.nextUrl.pathname);
  const handleI18nRouting = createMiddleware(routing);
  const response = await handleI18nRouting(request);
  return response;
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)']
};
