import './loadEnv.js';
import path from 'path';
import { fileURLToPath } from 'url';


import { Queue } from 'bullmq';
import { getAllWorkers, closeAllWorkers } from './workers.js';
import { closeAllQueues } from './queues.js';
import { closeRedisConnection, logger, getRedisClient, QUEUE_NAMES } from '@glowguide/shared';
import { getAllIntelligenceWorkers, closeAllIntelligenceWorkers } from './intelligenceWorkers.js';

logger.info('Recete Workers starting...');

// Start all workers
const workers = getAllWorkers();
const intelligenceWorkers = getAllIntelligenceWorkers();
logger.info({ workerCount: workers.length + intelligenceWorkers.length }, 'Workers started');

// Schedule recurring intelligence jobs (cron-based)
const connection = getRedisClient();

const rfmQueue = new Queue(QUEUE_NAMES.RFM_ANALYSIS, { connection });
const churnQueue = new Queue(QUEUE_NAMES.CHURN_PREDICTION, { connection });
const recsQueue = new Queue(QUEUE_NAMES.PRODUCT_RECOMMENDATIONS, { connection });

// RFM: daily at 2 AM
rfmQueue.upsertJobScheduler('rfm-daily', { pattern: '0 2 * * *' }, { name: 'rfm-all', data: {} });
// Churn: weekly on Monday at 3 AM
churnQueue.upsertJobScheduler('churn-weekly', { pattern: '0 3 * * 1' }, { name: 'churn-all', data: {} });
// Recommendations: weekly on Tuesday at 4 AM
recsQueue.upsertJobScheduler('recs-weekly', { pattern: '0 4 * * 2' }, { name: 'recs-all', data: {} });

logger.info('Intelligence cron jobs scheduled (RFM daily, Churn weekly, Recommendations weekly)');

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down gracefully...');
  await closeAllWorkers();
  await closeAllIntelligenceWorkers();
  await closeAllQueues();
  await Promise.all([rfmQueue.close(), churnQueue.close(), recsQueue.close()]);
  await closeRedisConnection();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
