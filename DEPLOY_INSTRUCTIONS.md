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
    - Pull the latest code from `main`.
    - Install dependencies (`pnpm install`).
    - Run database migrations (using `DATABASE_URL` from `.env`).
    - Build the entire project (including Next.js frontend).
    - Reload PM2 from `ecosystem.config.cjs` so `api`, `web`, `shopify-shell`, and `workers` get the correct production ports and env.
    - Persist the PM2 process list with `pm2 save`.
    - Verify service health.

## Frontend Note

Your Frontend is hosted directly on this DigitalOcean server (Port 3001, PM2 name `web`), proxied via Nginx.
(We removed the Vercel deployment workflow to align with your current architecture.)

## Important: never `pm2 restart all`

Always reload from `ecosystem.config.cjs`, from the repository root:

```bash
pm2 startOrRestart ecosystem.config.cjs --update-env
```

Two reasons, both of which have bitten us:

1. **`all` is not scoped to this project.** This droplet's PM2 instance also runs
   unrelated projects (`matchcountdown`, `eralp-*`). Every deploy bounced them,
   and on 2026-08-25 a deploy started `matchcountdown-worker` — which has Twitter
   posting jobs on its schedule — after someone had deliberately stopped it.
   `ecosystem.config.cjs` names exactly Recete's four services (`api`, `web`,
   `workers`, `shopify-shell`), so the scope stays right without a list to keep
   in sync.
2. **A plain restart reuses PM2's saved process definitions.** If those are
   stale, old ports and env vars survive the deploy and break routing.

The deploy workflow and `rollback.sh` already use the correct form. If you are
running commands by hand, use it too.
