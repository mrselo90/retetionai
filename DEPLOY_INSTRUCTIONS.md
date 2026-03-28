# Deployment Instructions (DigitalOcean)

**Target**: DigitalOcean Droplet (167.172.60.234)
**Services**: API, Frontend (Web), Shopify Shell, Workers
**Method**: Manual SSH Deployment

## Deployment Steps

1.  **SSH into your server**:
    ```bash
    ssh root@167.172.60.234
    ```

2.  **Navigate to project**:
    ```bash
    cd /root/retetionai
    ```

3.  **Run Deployment Script**:
    ```bash
    ./deploy.sh
    ```
    This script will:
    -   Pull the latest code from `main`.
    -   Install dependencies (`pnpm install`).
    -   Run database migrations (using `DATABASE_URL` from `.env`).
    -   Build the entire project (including Next.js frontend).
    -   Reload PM2 from `ecosystem.config.cjs` so `api`, `web`, `shopify-shell`, and `workers` get the correct production ports and env.
    -   Persist the PM2 process list with `pm2 save`.
    -   Verify service health.

## Frontend Note
Your Frontend is hosted directly on this DigitalOcean server (Port 3001, PM2 name `web`), proxied via Nginx.
(We removed the Vercel deployment workflow to align with your current architecture.)

## Important
Do not rely on `pm2 restart all` alone after deploys. If PM2 has stale saved process definitions, a plain restart can preserve old ports and env vars and break routing. Always reload from `ecosystem.config.cjs`.
