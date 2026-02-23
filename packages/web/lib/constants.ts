/**
 * Layout and UX constants — Polaris-aligned, no magic numbers in logic.
 * Spacing in UI uses Tailwind classes; these are for JS/TS (delays, limits, etc.).
 */

/** Session recheck delay (ms) when Supabase may still be hydrating. */
export const SESSION_RECHECK_MS = 400;

/** Content max width (Tailwind max-w-6xl = 72rem). */
export const CONTENT_MAX_WIDTH_REM = 72;
