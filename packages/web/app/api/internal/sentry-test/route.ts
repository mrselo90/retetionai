import { timingSafeEqual } from 'crypto';

/**
 * Deliberately throws, to check that server errors reach Sentry after a deploy
 * (through onRequestError in instrumentation.ts). Needs the internal service
 * secret; without it the route answers 404 like any unknown path.
 */
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const expected = process.env.INTERNAL_SERVICE_SECRET?.trim() || '';
  const provided = request.headers.get('x-internal-secret')?.trim() || '';
  const matches =
    expected.length > 0 &&
    provided.length === expected.length &&
    timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (!matches) return new Response('Not Found', { status: 404 });
  throw new Error(`Sentry test error from web (${new Date().toISOString()})`);
}
