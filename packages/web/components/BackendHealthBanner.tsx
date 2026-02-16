'use client';

import { useState, useEffect } from 'react';
import { getApiUrl } from '@/lib/api';

/**
 * In development, pings the backend health endpoint. If unreachable (e.g. "Failed to fetch"),
 * shows a dismissible banner so the user knows to start the API (pnpm dev:all).
 */
export default function BackendHealthBanner() {
  const [unreachable, setUnreachable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') return;

    const check = async () => {
      try {
        const res = await fetch(getApiUrl('/health'), { method: 'GET' });
        if (!res.ok) setUnreachable(true);
      } catch {
        setUnreachable(true);
      }
    };

    check();
  }, []);

  if (!unreachable || dismissed) return null;

  return (
    <div
      role="alert"
      className="sticky top-0 z-50 flex items-center justify-between gap-4 bg-amber-600 px-4 py-2.5 text-sm font-medium text-white shadow-md"
    >
      <span>
        Backend not reachable. Start the API with:{' '}
        <code className="rounded bg-amber-700 px-1.5 py-0.5 font-mono text-xs">pnpm dev:all</code>
        {' '}(or <code className="rounded bg-amber-700 px-1.5 py-0.5 font-mono text-xs">pnpm --filter api dev</code> in another terminal).
      </span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded p-1 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-white"
        aria-label="Dismiss"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
