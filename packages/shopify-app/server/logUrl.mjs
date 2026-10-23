// Query parameters that carry credentials or one-time secrets on requests to
// this app: the admin's session token (id_token), its HMAC and session id on
// every embedded load, OAuth's code/state on /auth/callback, and the checkout
// token the Thank you extension sends. Request logs keep the names, not values.
const SENSITIVE_PARAMS = new Set([
  'id_token',
  'hmac',
  'session',
  'code',
  'state',
  'signature',
  'token',
  'checkoutToken',
]);

/**
 * The request URL as it may appear in a log line: path and query, with the
 * values of sensitive parameters replaced. Other parameters are kept so logs
 * stay useful (shop, host, locale, embedded, ...).
 */
export function redactUrlForLog(url) {
  const raw = String(url || '');
  const queryStart = raw.indexOf('?');
  if (queryStart === -1) return raw;

  const path = raw.slice(0, queryStart);
  const query = raw.slice(queryStart + 1);
  const parts = query.split('&').map((part) => {
    const eq = part.indexOf('=');
    const name = eq === -1 ? part : part.slice(0, eq);
    let decoded = name;
    try {
      decoded = decodeURIComponent(name);
    } catch {
      // Malformed escapes: match on the raw name.
    }
    return SENSITIVE_PARAMS.has(decoded) && eq !== -1 ? `${name}=[redacted]` : part;
  });
  return `${path}?${parts.join('&')}`;
}
