import { useCallback, useEffect, useRef } from 'react';
import { useFetcher, useLocation, useNavigate } from 'react-router';
import { useAppBridge } from '@shopify/app-bridge-react';
import type { BulkDraftStatus } from './bulkDraft.server';

const POLL_MS = 3_000;

/**
 * Follows the shop's "Draft all with AI" job from the app shell, so the
 * merchant can move around the app while it runs and still hears when it is
 * done: a toast with a Review action on whatever page they are on. Polls only
 * while a job runs; otherwise it reads once per navigation and on focus.
 */
export function useBulkDraftWatcher() {
  const fetcher = useFetcher<{ bulkDraft: BulkDraftStatus | null }>();
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const location = useLocation();

  // Listeners outlive the render that created them; read the fetcher via a ref.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });
  const refresh = useCallback(() => {
    if (fetcherRef.current.state === 'idle') fetcherRef.current.load('/app/products/bulk-draft-status');
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, location.pathname]);

  useEffect(() => {
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refresh]);

  const status = fetcher.data?.bulkDraft ?? null;
  const running = Boolean(status?.running);
  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(refresh, POLL_MS);
    return () => window.clearInterval(interval);
  }, [running, refresh]);

  // Toast once when a job this tab watched running has finished.
  const watchedRunning = useRef<string | null>(null);
  useEffect(() => {
    if (!status) return;
    if (status.running) {
      watchedRunning.current = status.jobId;
      return;
    }
    if (watchedRunning.current !== status.jobId) return;
    watchedRunning.current = null;
    const failed = status.failed.length + status.skipped;
    shopify.toast.show(
      status.saved
        ? `Drafts ready for ${status.saved} product${status.saved === 1 ? '' : 's'}${failed ? ` · ${failed} need a look` : ''}`
        : 'Drafting finished, but no instructions could be drafted',
      {
        isError: !status.saved,
        duration: 8_000,
        action: 'Review',
        onAction: () => navigate('/app/products'),
      }
    );
  }, [status, shopify, navigate]);

  return { bulkDraft: status, refreshBulkDraft: refresh };
}
