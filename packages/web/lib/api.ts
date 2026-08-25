/**
 * API client for backend communication
 */

import { reportClientError } from './analytics/reportClientError';

function getApiBaseUrl(): string {
  // In the browser always use same-origin (/api-backend) so requests go through current host
  // (ingress or Next.js proxy). Avoids "Could not reach the API" when NEXT_PUBLIC_API_URL
  // points to api:3001 or localhost:3001 which the browser cannot reach.
  if (typeof window !== 'undefined') return '';
  // Server-side (SSR, rewrites): use env or default
  return process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
}

/** Full URL for an API endpoint (uses proxy in dev when NEXT_PUBLIC_API_URL is unset). */
export function getApiUrl(endpoint: string): string {
  const base = getApiBaseUrl();
  if (base) return `${base.replace(/\/$/, '')}${endpoint}`;
  return `/api-backend${endpoint}`;
}

/** Base URL for display (e.g. webhook URL); in dev when unset returns localhost:3001. */
export function getApiBaseUrlForDisplay(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
}

export interface ApiError {
  error: string;
  message?: string;
  details?: string;
  code?: string;
  hint?: string;
}

/**
 * API client with error handling
 */
/** Default client-side request timeout. */
const REQUEST_TIMEOUT_MS = 30_000;

export async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = getApiUrl(endpoint);

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      // Without a timeout a hung API left every dashboard page pinned on its
      // skeleton forever with no way out. Callers that legitimately take longer
      // (scrape + LLM enrichment) pass their own signal, which wins.
      signal: options?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new Error(
        `The request took longer than ${Math.round(REQUEST_TIMEOUT_MS / 1000)}s and was cancelled. Please try again.`
      );
    }

    // Network error: API unreachable, CORS, or connection refused
    const message =
      err instanceof TypeError && err.message === 'Failed to fetch'
        ? 'Could not reach the API. Make sure the backend is running (e.g. run `pnpm dev:all` from the project root).'
        : err instanceof Error
          ? err.message
          : 'Network error';
    throw new Error(message);
  }

  const text = await response.text();

  if (!response.ok) {
    let error: ApiError;
    try {
      error = text
        ? (JSON.parse(text) as ApiError)
        : {
            error: 'Request failed',
            message:
              response.status === 404
                ? 'API not found. Is the backend running on the correct port?'
                : `Request failed (${response.status})`,
          };
    } catch {
      // Response was HTML or non-JSON (e.g. 404 page, proxy error)
      error = {
        error: 'Request failed',
        message:
          response.status === 404
            ? 'API not found. Is the backend running on the correct port?'
            : `Request failed (${response.status})`,
      };
    }
    const errorMessage = error.message || error.error || 'Request failed';
    const apiError: Error & { status?: number; details?: string; code?: string; hint?: string } =
      Object.assign(new Error(errorMessage), {
        status: response.status,
        details: error.details,
        code: error.code,
        hint: error.hint,
      });

    // Reported explicitly rather than left to autocapture: this error is thrown
    // and handled by the caller (toast, retry), so it never becomes an unhandled
    // exception that PostHog would see on its own.
    if (response.status >= 500) {
      reportClientError(apiError, {
        source: 'apiRequest',
        endpoint,
        status: response.status,
        details: error.details,
      });
    }

    throw apiError;
  }

  try {
    return text ? (JSON.parse(text) as T) : (null as T);
  } catch {
    throw new Error('Invalid JSON response from server');
  }
}

/**
 * Authenticated API request (with JWT token)
 */
export async function authenticatedRequest<T>(
  endpoint: string,
  token: string,
  options?: RequestInit
): Promise<T> {
  return apiRequest<T>(endpoint, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
}

/**
 * Authenticated request for a file download (CSV export and anything like it).
 *
 * Separate from apiRequest because that one always JSON-parses the body, so a
 * text/csv response would fail with "Invalid JSON response from server". Errors
 * still arrive as JSON, so those are surfaced the same way.
 *
 * Exports can take longer than an ordinary read, hence the wider timeout.
 */
const DOWNLOAD_TIMEOUT_MS = 120_000;

export async function authenticatedFileRequest(
  endpoint: string,
  token: string
): Promise<{ text: string; filename: string; headers: Headers }> {
  const url = getApiUrl(endpoint);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new Error(
        `The download took longer than ${Math.round(DOWNLOAD_TIMEOUT_MS / 1000)}s and was cancelled. Please try again.`
      );
    }
    throw new Error(err instanceof Error ? err.message : 'Network error');
  }

  const text = await response.text();

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const parsed = JSON.parse(text) as ApiError;
      message = parsed.message || parsed.error || message;
    } catch {
      // Non-JSON error body (proxy page, gateway error) — keep the status message.
    }
    throw Object.assign(new Error(message), { status: response.status });
  }

  // filename="…" from Content-Disposition, so the saved file keeps the server's
  // name rather than the endpoint path.
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = /filename="([^"]+)"/.exec(disposition);

  return { text, filename: match?.[1] || 'download.csv', headers: response.headers };
}

/**
 * Hand a fetched file to the browser's download flow.
 * Revokes the object URL so repeated exports do not leak blobs.
 */
export function triggerBrowserDownload(
  text: string,
  filename: string,
  mimeType = 'text/csv;charset=utf-8'
) {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
