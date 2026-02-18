/**
 * CSV Import routes
 * Handles CSV file uploads for bulk order/event imports
 */

import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { getSupabaseServiceClient } from '@recete/shared';
import { parseCSV } from '../lib/csvParser.js';
import { generateIdempotencyKey } from '../lib/events.js';
import { processNormalizedEvent } from '../lib/orderProcessor.js';

const csv = new Hono();

// All routes require authentication
// csv.use('/*', authMiddleware); // Removed global middleware to avoid affecting nested routes

/**
 * CSV Import endpoint
 * POST /api/integrations/:integrationId/import/csv
 * Uploads CSV file and imports orders/events
 */
csv.post('/:integrationId/import/csv', authMiddleware, async (c) => {
  const merchantId = c.get('merchantId');
  const integrationId = c.req.param('integrationId');

  // Verify integration belongs to merchant
  const serviceClient = getSupabaseServiceClient();
  const { data: integration, error: integrationError } = await serviceClient
    .from('integrations')
    .select('id, merchant_id, provider')
    .eq('id', integrationId)
    .eq('merchant_id', merchantId)
    .single();

  if (integrationError || !integration) {
    return c.json({ error: 'Integration not found' }, 404);
  }

  // Get file from form data
  const body = await c.req.parseBody();
  const file = body['file'];

  if (!file || typeof file === 'string') {
    return c.json({ error: 'No file uploaded' }, 400);
  }

  // Read file content
  let csvContent: string;
  try {
    if (file instanceof File) {
      csvContent = await file.text();
    } else {
      return c.json({ error: 'Invalid file format' }, 400);
    }
  } catch (error) {
    return c.json({ error: 'Failed to read file' }, 400);
  }

  // Parse CSV
  const parseResult = parseCSV(csvContent, merchantId, integrationId);

  if (!parseResult.success && parseResult.events.length === 0) {
    return c.json({
      error: 'CSV parsing failed',
      details: parseResult.errors,
      summary: parseResult.summary,
    }, 400);
  }

  // Insert events into external_events table
  const insertResults = {
    inserted: 0,
    duplicates: 0,
    failed: 0,
    processed: 0,
    processingErrors: 0,
  };

  for (const event of parseResult.events) {
    const idempotencyKey = generateIdempotencyKey(
      event.source,
      event.event_type,
      event.external_order_id,
      event.occurred_at
    );

    // Insert into external_events
    const { error: insertError } = await serviceClient
      .from('external_events')
      .insert({
        merchant_id: event.merchant_id,
        integration_id: event.integration_id,
        source: event.source,
        event_type: event.event_type,
        payload: event as any,
        idempotency_key: idempotencyKey,
      });

    if (insertError) {
      if (insertError.code === '23505') {
        // Duplicate (idempotency key conflict)
        insertResults.duplicates++;
      } else {
        insertResults.failed++;
        console.error('Failed to insert event:', insertError);
      }
      continue;
    }

    insertResults.inserted++;

    // Process event immediately (upsert order/user)
    try {
      await processNormalizedEvent(event);
      insertResults.processed++;
    } catch (processError) {
      insertResults.processingErrors++;
      console.error('Error processing event:', processError);
      // Continue - event is stored, can be retried
    }
  }

  return c.json({
    message: 'CSV import completed',
    parse: {
      totalRows: parseResult.summary.totalRows,
      validRows: parseResult.summary.validRows,
      invalidRows: parseResult.summary.invalidRows,
      uniqueOrders: parseResult.summary.uniqueOrders,
      errors: parseResult.errors,
    },
    import: {
      inserted: insertResults.inserted,
      duplicates: insertResults.duplicates,
      failed: insertResults.failed,
      processed: insertResults.processed,
      processingErrors: insertResults.processingErrors,
    },
  });
});

/**
 * Get CSV template
 * GET /api/integrations/csv/template
 * Returns a sample CSV template for download
 */
csv.get('/csv/template', authMiddleware, async (c) => {
  const template = `external_order_id,created_at,delivered_at,status,customer_phone,customer_name,product_name,product_url,product_external_id
ORD-12345,2024-01-15T10:30:00Z,2024-01-18T14:20:00Z,delivered,+905551234567,Ahmet Yılmaz,Recete Serum,https://example.com/glow-serum,PROD-001
ORD-12345,2024-01-15T10:30:00Z,2024-01-18T14:20:00Z,delivered,+905551234567,Ahmet Yılmaz,Night Cream,https://example.com/night-cream,PROD-002
ORD-12346,2024-01-16T11:00:00Z,,created,+905559876543,Ayşe Demir,Face Mask,https://example.com/face-mask,PROD-003`;

  return c.text(template, 200, {
    'Content-Type': 'text/csv',
    'Content-Disposition': 'attachment; filename="recete-import-template.csv"',
  });
});

export default csv;
