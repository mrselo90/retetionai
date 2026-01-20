/**
 * GlowGuide Workers
 * Background job processors for scheduled messages, scrape jobs, and analytics
 */

import 'dotenv/config';
import { getAllWorkers, closeAllWorkers } from './workers';
import { closeAllQueues } from './queues';
import { closeRedisConnection, logger } from '@glowguide/shared';

logger.info('🚀 GlowGuide Workers starting...');

// Start all workers
const workers = getAllWorkers();
logger.info({ workerCount: workers.length }, 'Workers started');

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await closeAllWorkers();
  await closeAllQueues();
  await closeRedisConnection();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  await closeAllWorkers();
  await closeAllQueues();
  await closeRedisConnection();
  process.exit(0);
});
