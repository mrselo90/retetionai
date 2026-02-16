/**
 * API client for backend communication
 */

import { captureException } from './sentry';

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
export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = getApiUrl(endpoint);

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  } catch (err) {
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
    const apiError = new Error(errorMessage) as any;
    apiError.status = response.status;
    apiError.details = error.details;
    apiError.code = error.code;
    apiError.hint = error.hint;

    if (response.status >= 500) {
      captureException(apiError, {
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
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
}
