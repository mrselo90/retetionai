/**
 * Supabase client for frontend
 * Uses anon key, respects RLS policies
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required'
  );
}

/**
 * Supabase client for browser/client-side usage
 * Uses anon key, respects RLS policies
 */
// Create client with standard config
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Monkey-patch getSession to support Shopify Embedded App
const originalGetSession = supabaseClient.auth.getSession.bind(supabaseClient.auth);

supabaseClient.auth.getSession = async () => {
  // 1. Try Original Supabase Session (e.g. from LocalStorage)
  const { data, error } = await originalGetSession();
  if (data.session) {
    return { data, error };
  }

  // 2. If no session, try Shopify App Bridge
  // Only runs in browser
  if (typeof window !== 'undefined') {
    const w = window as any;
    if (w.shopify?.id?.getSessionToken) {
      try {
        const token = await w.shopify.id.getSessionToken();
        // Construct a fake session object compatible with Session type
        const fakeSession = {
          access_token: token,
          token_type: 'bearer',
          expires_in: 3600, // 1 hour
          refresh_token: '',
          user: {
            id: 'shopify-user',
            aud: 'authenticated',
            role: 'authenticated',
            email: '',
            app_metadata: {},
            user_metadata: {},
            created_at: new Date().toISOString()
          },
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        };
        // @ts-ignore - Partial compliance is enough for our usage
        return { data: { session: fakeSession }, error: null } as any;
      } catch (e) {
        // Not in Shopify or error
        console.debug('Shopify token retrieval failed:', e);
      }
    }
  }

  return { data, error };
};

export const supabase = supabaseClient;
