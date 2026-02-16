/**
 * Authentication check utility
 * Redirects to login if not authenticated.
 * On invalid refresh token (AuthApiError), signs out locally and redirects.
 */

import { supabase } from './supabase';

export async function checkAuth(): Promise<string | null> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!session) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return null;
    }
    return session.access_token;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isInvalidRefresh =
      message.includes('Refresh Token') ||
      message.includes('refresh_token') ||
      (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AuthApiError');
    if (typeof window !== 'undefined' && isInvalidRefresh) {
      await supabase.auth.signOut({ scope: 'local' });
    }
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return null;
  }
}

export async function requireAuth(): Promise<string> {
  const token = await checkAuth();
  if (!token) {
    throw new Error('Authentication required');
  }
  return token;
}
