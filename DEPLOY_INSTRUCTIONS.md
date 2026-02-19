# Deployment Instructions (DigitalOcean)

**Target**: DigitalOcean Droplet (209.97.134.215)
**Services**: API, Frontend (Web), Workers
**Method**: Manual SSH Deployment

## Deployment Steps

1.  **SSH into your server**:
    ```bash
    ssh root@209.97.134.215
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
    -   Restart all PM2 services (`api`, `web`, `workers`).
    -   Verify service health.

## Frontend Note
Your Frontend is hosted directly on this DigitalOcean server (Port 3001, PM2 name `web`), proxied via Nginx.
(We removed the Vercel deployment workflow to align with your current architecture.)
