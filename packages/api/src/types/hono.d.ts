/**
 * Hono type extensions for auth context and validation
 */
import 'hono';

import { Logger } from 'pino';

declare module 'hono' {
  interface ContextVariableMap {
    merchantId: string;
    authMethod: 'jwt' | 'shopify' | 'internal';
    user: {
      merchantId: string;
      authMethod: 'jwt' | 'shopify' | 'internal';
    };
    /** Set when request is for internal product routes (enrich / generate-embeddings) with no user auth */
    internalCall?: boolean;
    validatedBody?: unknown;
    validatedQuery?: unknown;
    validatedParams?: unknown;
    whatsappWebhookBody?: unknown;
    whatsappWebhookProvider?: 'meta' | 'twilio';
    logger: Logger; // Added for structured logging
  }
}
