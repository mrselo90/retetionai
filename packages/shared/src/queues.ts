/**
 * Queue type definitions and constants
 * Queue names and job data types for BullMQ
 */

/**
 * Queue names
 */
export const QUEUE_NAMES = {
  SCHEDULED_MESSAGES: 'scheduled-messages',
  SCRAPE_JOBS: 'scrape-jobs',
  ANALYTICS: 'analytics',
  RFM_ANALYSIS: 'rfm-analysis',
  CHURN_PREDICTION: 'churn-prediction',
  PRODUCT_RECOMMENDATIONS: 'product-recommendations',
  ABANDONED_CART: 'abandoned-cart',
  FEEDBACK_REQUEST: 'feedback-request',
} as const;

/**
 * Job types for scheduled messages queue
 */
export type ScheduledMessageJobType =
  | 'welcome' // T+0: Welcome message when order delivered
  | 'checkin_t3' // T+3: First check-in
  | 'checkin_t14' // T+14: Second check-in
  | 'checkin_t25' // T+25: Optional third check-in
  | 'upsell'; // Upsell recommendation

/**
 * Scheduled message job data
 */
export interface ScheduledMessageJobData {
  type: ScheduledMessageJobType;
  userId: string;
  orderId?: string;
  merchantId: string;
  to: string; // Phone number (E.164)
  message?: string; // Message text (optional, can be generated)
  scheduledFor: string; // ISO timestamp
  messageTemplate?: string; // Optional custom message template
  /** T+0 welcome: Shopify product IDs (external_product_id) for beauty-consultant prompt */
  productIds?: string[];
}

/**
 * Scrape job data
 */
export interface ScrapeJobData {
  productId: string;
  merchantId: string;
  url: string;
  retryCount?: number;
}

/**
 * Analytics job data
 */
export interface AnalyticsJobData {
  merchantId: string;
  eventType: string;
  value: Record<string, unknown>;
  sentimentScore?: number;
}
