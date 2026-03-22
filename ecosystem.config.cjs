const fs = require('fs');
const path = require('path');

function loadRootEnv() {
  const envPath = path.join(__dirname, '.env');
  const values = {};

  if (!fs.existsSync(envPath)) return values;

  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    values[key] = value;
  }

  return values;
}

const rootEnv = loadRootEnv();
const internalServiceSecret =
  process.env.INTERNAL_SERVICE_SECRET ||
  process.env.PLATFORM_INTERNAL_SECRET ||
  rootEnv.INTERNAL_SERVICE_SECRET ||
  rootEnv.PLATFORM_INTERNAL_SECRET ||
  '';

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
      env: {
        PORT: 3002,
        NODE_ENV: 'production',
        INTERNAL_SERVICE_SECRET: internalServiceSecret,
        API_URL: 'https://api.recete.co.uk',
        FRONTEND_URL: 'https://recete.co.uk',
        ALLOWED_ORIGINS: 'https://recete.co.uk,https://shop.recete.co.uk,https://admin.shopify.com',
      },
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
        INTERNAL_API_URL: 'http://127.0.0.1:3002',
        NEXT_PUBLIC_API_URL: 'https://recete.co.uk',
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
        DATABASE_URL: process.env.DATABASE_URL || rootEnv.DATABASE_URL || '',
        PLATFORM_API_URL: 'http://127.0.0.1:3002',  // internal loopback, no TLS needed
        PLATFORM_INTERNAL_SECRET: internalServiceSecret,
        LEGACY_DASHBOARD_URL: 'https://recete.co.uk',
        API_URL: 'https://api.recete.co.uk',
        FRONTEND_URL: 'https://recete.co.uk',
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
