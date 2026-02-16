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
      script: '/usr/bin/pnpm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        INTERNAL_API_URL: 'http://localhost:3002'
      },
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
