'use strict';

/**
 * New Relic agent configuration (Workers).
 * License key and app name via env: NEW_RELIC_LICENSE_KEY, NEW_RELIC_APP_NAME.
 * Set NEW_RELIC_ENABLED=false to disable.
 */
const enabled = process.env.NEW_RELIC_ENABLED !== 'false' && !!process.env.NEW_RELIC_LICENSE_KEY;
exports.config = {
  agent_enabled: enabled,
  app_name: [process.env.NEW_RELIC_APP_NAME || 'recete-workers'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY || '',
  distributed_tracing: { enabled: true },
  logging: {
    level: process.env.NEW_RELIC_LOG_LEVEL || 'info',
  },
};
