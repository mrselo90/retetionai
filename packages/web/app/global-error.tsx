'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/analytics/reportClientError';

/**
 * Next.js global error boundary — catches errors in root layout and above.
 * Must include <html> and <body> tags.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Root-layout failures land here. `digest` is Next's server-side error id,
    // which is the only handle on the original when the message is redacted in
    // production.
    reportClientError(error, { source: 'GlobalError', digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{ fontFamily: '"Avenir Next", "Segoe UI", Helvetica, Arial, sans-serif', margin: 0 }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
            textAlign: 'center',
            background: '#fafafa',
          }}
        >
          <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>⚠️</div>
          <h1
            style={{ fontSize: '1.75rem', fontWeight: 600, color: '#111', marginBottom: '0.75rem' }}
          >
            Application error
          </h1>
          <p style={{ color: '#666', marginBottom: '2rem', maxWidth: '400px' }}>
            A critical error occurred. Please try again — your data is safe.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={reset}
              style={{
                padding: '0.5rem 1.25rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                background: 'white',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Try again
            </button>
            <button
              onClick={() => (window.location.href = '/dashboard')}
              style={{
                padding: '0.5rem 1.25rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                background: 'white',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Go to dashboard
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
