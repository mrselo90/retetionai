'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Next.js error boundary for the dashboard segment.
 * Automatically catches runtime errors in all /dashboard/* pages.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Dashboard Error]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <div className="text-5xl mb-6">⚠️</div>
      <h2 className="text-2xl font-semibold text-gray-900 mb-3">
        Something went wrong
      </h2>
      <p className="text-gray-500 mb-8 max-w-md">
        An unexpected error occurred on this page. Your data is safe — try again or refresh.
      </p>
      {process.env.NODE_ENV === 'development' && (
        <pre className="text-xs text-left bg-gray-50 border border-red-200 rounded-lg p-4 mb-8 max-w-2xl overflow-auto text-red-600">
          {error.message}
        </pre>
      )}
      <div className="flex gap-3">
        <Button variant="outline" onClick={reset}>
          Try again
        </Button>
        <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}
