/**
 * Helpers for reading values caught in a `catch` block.
 *
 * Catch variables are `unknown`, not `any`. These pages previously annotated
 * them `catch (err: any)` and read `err.message` / `err.status` directly, which
 * silently trusted a shape nothing guarantees — a thrown string or a rejected
 * non-Error would have produced `undefined` in the UI.
 */

/** Returns a displayable message, falling back when the value carries none. */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.trim()) return err;
  return fallback;
}

/**
 * Returns the HTTP status carried by API client errors, when present.
 * Used to distinguish 401s so the UI can send the user back to login.
 */
export function getErrorStatus(err: unknown): number | undefined {
  if (typeof err === 'object' && err !== null && 'status' in err) {
    const { status } = err as { status?: unknown };
    if (typeof status === 'number') return status;
  }
  return undefined;
}
