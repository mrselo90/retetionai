import type { Session } from '@supabase/supabase-js';

export function getSessionExpiryMs(session: Pick<Session, 'expires_at'> | null): number | null {
  if (!session?.expires_at) return null;
  return session.expires_at * 1000 - Date.now();
}

export function isSessionExpired(session: Pick<Session, 'expires_at'> | null): boolean {
  const msUntilExpiry = getSessionExpiryMs(session);
  return msUntilExpiry !== null && msUntilExpiry <= 0;
}
