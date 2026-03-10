/**
 * PM2 ecosystem config for production.
 * Run from repo root: pm2 start ecosystem.config.cjs
 * Nginx:
 * - recete.co.uk -> Web (3001)
 * - api.recete.co.uk -> API (3002)
 * - shop.recete.co.uk -> Shopify shell (3003)
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
      exec_mode: 'fork',
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
        INTERNAL_API_URL: 'http://127.0.0.1:3002'
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
    },
    {
      name: 'shopify-shell',
      cwd: './packages/shopify-app',
      script: '/usr/bin/pnpm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3003,
        SHOPIFY_APP_URL: 'https://shop.recete.co.uk',
        PLATFORM_API_URL: 'https://api.recete.co.uk',
        LEGACY_DASHBOARD_URL: 'https://recete.co.uk',
      },
      instances: 1,
      exec_mode: 'fork',
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
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
    },
  ],
};
