/**
 * CSV Parser for order/event imports
 * Parses CSV files and converts them to normalized events
 */

import type { NormalizedEvent } from './events';
import { normalizePhone } from './events';

export interface CSVRow {
  external_order_id: string;
  created_at?: string;
  delivered_at?: string;
  status?: string;
  customer_phone: string;
  customer_name?: string;
  product_name?: string;
  product_url?: string;
  product_external_id?: string;
}

export interface CSVParseResult {
  success: boolean;
  events: NormalizedEvent[];
  errors: Array<{ row: number; error: string }>;
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    uniqueOrders: number;
  };
}

/**
 * Parse CSV content and convert to normalized events
 */
export function parseCSV(
  csvContent: string,
  merchantId: string,
  integrationId?: string
): CSVParseResult {
  const lines = csvContent.trim().split('\n');
  
  if (lines.length < 2) {
    return {
      success: false,
      events: [],
      errors: [{ row: 0, error: 'CSV file is empty or has no data rows' }],
      summary: { totalRows: 0, validRows: 0, invalidRows: 0, uniqueOrders: 0 },
    };
  }

  // Parse header
  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  
  // Validate required columns
  const requiredColumns = ['external_order_id', 'customer_phone'];
  const missingColumns = requiredColumns.filter(col => !header.includes(col));
  
  if (missingColumns.length > 0) {
    return {
      success: false,
      events: [],
      errors: [{ row: 0, error: `Missing required columns: ${missingColumns.join(', ')}` }],
      summary: { totalRows: 0, validRows: 0, invalidRows: 0, uniqueOrders: 0 },
    };
  }

  // Parse data rows
  const rows: CSVRow[] = [];
  const errors: Array<{ row: number; error: string }> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    const values = parseCSVLine(line);
    
    if (values.length !== header.length) {
      errors.push({ row: i + 1, error: `Column count mismatch (expected ${header.length}, got ${values.length})` });
      continue;
    }

    const row: any = {};
    header.forEach((col, idx) => {
      row[col] = values[idx]?.trim() || '';
    });

    // Validate required fields
    if (!row.external_order_id || !row.customer_phone) {
      errors.push({ row: i + 1, error: 'Missing external_order_id or customer_phone' });
      continue;
    }

    rows.push(row as CSVRow);
  }

  // Group rows by external_order_id (multiple items per order)
  const orderGroups = new Map<string, CSVRow[]>();
  
  for (const row of rows) {
    const orderId = row.external_order_id;
    if (!orderGroups.has(orderId)) {
      orderGroups.set(orderId, []);
    }
    orderGroups.get(orderId)!.push(row);
  }

  // Convert to normalized events
  const events: NormalizedEvent[] = [];

  for (const [orderId, orderRows] of orderGroups) {
    const firstRow = orderRows[0];

    // Determine event type based on status and delivered_at
    let eventType: NormalizedEvent['event_type'] = 'order_created';
    
    if (firstRow.status) {
      const status = firstRow.status.toLowerCase();
      if (status.includes('delivered') || status.includes('teslim')) {
        eventType = 'order_delivered';
      } else if (status.includes('cancelled') || status.includes('iptal')) {
        eventType = 'order_cancelled';
      } else if (status.includes('returned') || status.includes('iade')) {
        eventType = 'order_returned';
      }
    } else if (firstRow.delivered_at) {
      eventType = 'order_delivered';
    }

    // Normalize phone
    let normalizedPhoneNumber: string;
    try {
      normalizedPhoneNumber = normalizePhone(firstRow.customer_phone);
    } catch (error) {
      errors.push({ 
        row: 0, 
        error: `Invalid phone number for order ${orderId}: ${firstRow.customer_phone}` 
      });
      continue;
    }

    // Build normalized event
    const event: NormalizedEvent = {
      merchant_id: merchantId,
      integration_id: integrationId,
      source: 'manual',
      event_type: eventType,
      occurred_at: firstRow.delivered_at || firstRow.created_at || new Date().toISOString(),
      external_order_id: orderId,
      customer: {
        phone: normalizedPhoneNumber,
        name: firstRow.customer_name || undefined,
      },
      order: {
        status: firstRow.status || 'created',
        created_at: firstRow.created_at || new Date().toISOString(),
        delivered_at: firstRow.delivered_at || undefined,
      },
      items: orderRows
        .filter(row => row.product_name) // Only include rows with product info
        .map(row => ({
          external_product_id: row.product_external_id || undefined,
          name: row.product_name!,
          url: row.product_url || undefined,
        })),
    };

    events.push(event);
  }

  return {
    success: errors.length === 0 || events.length > 0,
    events,
    errors,
    summary: {
      totalRows: lines.length - 1, // Exclude header
      validRows: rows.length,
      invalidRows: errors.length,
      uniqueOrders: events.length,
    },
  };
}

/**
 * Parse a CSV line, handling quoted values with commas
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current); // Add last value
  return values;
}
