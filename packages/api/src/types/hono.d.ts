/**
 * Hono type extensions for auth context and validation
 */
import 'hono';

import { Logger } from 'pino';

declare module 'hono' {
  interface ContextVariableMap {
    merchantId: string;
    authMethod: 'jwt' | 'api_key';
    /** Set when request is authenticated via X-Internal-Key (e.g. worker calling enrich/generate-embeddings) */
    internalCall?: boolean;
    validatedBody?: unknown;
    validatedQuery?: unknown;
    validatedParams?: unknown;
    logger: Logger; // Added for structured logging
  }
}
