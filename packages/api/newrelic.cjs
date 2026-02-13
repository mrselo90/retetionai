'use strict';

/**
 * New Relic agent configuration (API).
 * License key and app name should be set via env: NEW_RELIC_LICENSE_KEY, NEW_RELIC_APP_NAME.
 * Set NEW_RELIC_ENABLED=false to disable (e.g. local dev).
 */
const enabled = process.env.NEW_RELIC_ENABLED !== 'false' && !!process.env.NEW_RELIC_LICENSE_KEY;
exports.config = {
  agent_enabled: enabled,
  app_name: [process.env.NEW_RELIC_APP_NAME || 'glowguide-api'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY || '',
  distributed_tracing: { enabled: true },
  logging: {
    level: process.env.NEW_RELIC_LOG_LEVEL || 'info',
  },
  allow_all_headers: true,
  attributes: {
    exclude: [
      'request.headers.authorization',
      'request.headers.cookie',
    ],
  },
};
