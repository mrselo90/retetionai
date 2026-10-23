/**
 * The DSN the server-side Sentry configs use, or undefined (Sentry stays off).
 *
 * A real DSN is a URL with the project's public key and id
 * (https://<key>@<host>/<project>). A placeholder left in .env would make the
 * SDK log "Invalid Sentry Dsn" on every event, so it counts as not set.
 * Same check as packages/api/src/lib/sentry.ts.
 */
export function sentryDsn(): string | undefined {
  const raw = (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || '').trim();
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return /^https?:$/.test(url.protocol) && url.username && /^\/\d+$/.test(url.pathname) ? raw : undefined;
  } catch {
    return undefined;
  }
}

export function sentryEnvironment(): string {
  return process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
}
