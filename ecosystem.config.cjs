/**
 * PM2 ecosystem config for production.
 * Run from repo root: pm2 start ecosystem.config.cjs
 * Nginx: /api/ and /health -> API (3002), / -> Web (3001)
 */
module.exports = {
  apps: [
    {
      name: 'api',
      cwd: './packages/api',
      script: 'dist/index.js',
      interpreter: 'node',
      env: { PORT: 3002, NODE_ENV: 'production' },
      instances: 1,
      autorestart: true,
      watch: false,
    },
    {
      name: 'web',
      cwd: './packages/web',
      script: 'node_modules/.bin/next',
      args: ['start', '-p', '3001'],
      env: { NODE_ENV: 'production' },
      instances: 1,
      autorestart: true,
      watch: false,
    },
    {
      name: 'workers',
      cwd: './packages/workers',
      script: 'dist/index.js',
      interpreter: 'node',
      env: { NODE_ENV: 'production' },
      instances: 1,
      autorestart: true,
      watch: false,
    },
  ],
};
