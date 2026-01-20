/**
 * Application Metrics
 * Prometheus metrics for monitoring API performance
 */

import { Registry, Counter, Histogram, Gauge } from 'prom-client';

// Create a registry for metrics
export const register = new Registry();

// Default metrics (CPU, memory, etc.)
// Note: prom-client doesn't have built-in default metrics, we'll create custom ones

/**
 * HTTP Request Metrics
 */
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10], // Response time buckets
  registers: [register],
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestErrors = new Counter({
  name: 'http_request_errors_total',
  help: 'Total number of HTTP request errors',
  labelNames: ['method', 'route', 'error_type'],
  registers: [register],
});

/**
 * Database Metrics
 */
export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['table', 'operation'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const dbQueryErrors = new Counter({
  name: 'db_query_errors_total',
  help: 'Total number of database query errors',
  labelNames: ['table', 'operation', 'error_type'],
  registers: [register],
});

/**
 * Queue Metrics
 */
export const queueJobDuration = new Histogram({
  name: 'queue_job_duration_seconds',
  help: 'Duration of queue job processing in seconds',
  labelNames: ['queue_name', 'job_type'],
  buckets: [1, 5, 10, 30, 60, 120],
  registers: [register],
});

export const queueJobTotal = new Counter({
  name: 'queue_jobs_total',
  help: 'Total number of queue jobs processed',
  labelNames: ['queue_name', 'job_type', 'status'],
  registers: [register],
});

export const queueJobErrors = new Counter({
  name: 'queue_job_errors_total',
  help: 'Total number of queue job errors',
  labelNames: ['queue_name', 'job_type', 'error_type'],
  registers: [register],
});

/**
 * System Metrics
 */
export const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  registers: [register],
});

export const memoryUsage = new Gauge({
  name: 'memory_usage_bytes',
  help: 'Memory usage in bytes',
  labelNames: ['type'], // heap, external, rss
  registers: [register],
});

export const cpuUsage = new Gauge({
  name: 'cpu_usage_percent',
  help: 'CPU usage percentage',
  registers: [register],
});

/**
 * Business Metrics
 */
export const messagesSent = new Counter({
  name: 'messages_sent_total',
  help: 'Total number of messages sent',
  labelNames: ['channel', 'status'], // channel: whatsapp, status: success, failed
  registers: [register],
});

export const conversationsTotal = new Counter({
  name: 'conversations_total',
  help: 'Total number of conversations',
  labelNames: ['status'], // status: active, completed
  registers: [register],
});

export const productsScraped = new Counter({
  name: 'products_scraped_total',
  help: 'Total number of products scraped',
  labelNames: ['status'], // status: success, failed
  registers: [register],
});

/**
 * Update system metrics periodically
 */
export function updateSystemMetrics() {
  const memUsage = process.memoryUsage();
  
  memoryUsage.set({ type: 'heap' }, memUsage.heapUsed);
  memoryUsage.set({ type: 'heap_total' }, memUsage.heapTotal);
  memoryUsage.set({ type: 'external' }, memUsage.external);
  memoryUsage.set({ type: 'rss' }, memUsage.rss);
  
  // CPU usage (simplified - in production use os.cpus())
  const cpuUsagePercent = process.cpuUsage();
  // Note: CPU usage calculation requires more complex logic
  // For now, we'll track it differently if needed
}

// Update system metrics every 10 seconds
if (typeof setInterval !== 'undefined') {
  setInterval(updateSystemMetrics, 10000);
}
