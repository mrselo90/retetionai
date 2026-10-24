import type { LoaderFunctionArgs } from 'react-router';

import { getBulkDraftStatus } from '../lib/bulkDraft.server';
import { authenticateEmbeddedAdmin } from '../lib/embeddedAuth.server';

/**
 * The shop's "Draft all with AI" job, polled by the Products page while it
 * runs. Light on purpose: one database read, no Shopify or platform calls.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticateEmbeddedAdmin(request);
  return { bulkDraft: await getBulkDraftStatus(session.shop) };
};
