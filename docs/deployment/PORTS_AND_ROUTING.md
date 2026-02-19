# Ports and Routing (Single Source of Truth)

This document defines the **canonical** port and routing convention for Recete. All other docs (memory-bank, README, env examples) should align with this.

---

## Local development

| Service   | Port | Process / script      |
|----------|------|------------------------|
| Frontend | 3000 | `pnpm --filter @recete/web dev` |
| API      | 3001 | `pnpm --filter api dev`        |

- **Browser**: Opens `http://localhost:3000`. API calls use same-origin `/api-backend/*`; Next.js rewrites to `http://localhost:3001`.
- **Env**: No need for `INTERNAL_API_URL`; Next.js default `http://localhost:3001` is used for rewrites.

---

## Production (Nginx on one server)

| Service   | Port | PM2 name | Notes |
|----------|------|----------|--------|
| Frontend | 3001 | web      | Next.js (`next start` with `PORT=3001`) |
| API      | 3002 | api      | Hono API (`PORT=3002`) |

### Nginx routing

- **`/`** and **`/api-backend/*`** → proxy to **Frontend (3001)**.  
  `/api-backend/*` must hit the frontend so Next.js can proxy to the API (see below).
- **`/api/*`** and **`/health`** → proxy to **API (3002)**.

### Why `/api-backend` goes to the frontend

The browser always calls the same origin (e.g. `http://YOUR_HOST/api-backend/health`). Next.js rewrites `/api-backend/*` to the API. So:

1. Nginx sends `/api-backend/*` to the Next.js server (port 3001).
2. Next.js uses `INTERNAL_API_URL` and proxies the request to the API (port 3002).

### Required env on the server

**API process (port 3002):**

- `PORT=3002` — use `pnpm start:prod` in the api package, or set `PORT=3002` in the server env (PM2 or .env). The default `pnpm start` uses 3001 (local).
- `API_URL`, `FRONTEND_URL`, `ALLOWED_ORIGINS` as needed (e.g. public URL for CORS).

**Web (Next.js) process (port 3001):**

- `PORT=3001`.
- **`INTERNAL_API_URL=http://127.0.0.1:3002`** — used by Next.js rewrites to proxy `/api-backend/*` to the API. Without this, "Could not reach the API" can occur.
- `NEXT_PUBLIC_API_URL` — public base URL (e.g. `http://YOUR_IP` or `https://your-domain.com`) for display (e.g. webhook URLs). Can be same as the site URL when Nginx fronts both.

---

## Summary

- **Local**: Frontend 3000, API 3001; browser → same-origin `/api-backend` → Next.js → localhost:3001.
- **Production**: Frontend 3001, API 3002; Nginx → `/` and `/api-backend` to 3001, `/api` and `/health` to 3002; web must have **INTERNAL_API_URL=http://127.0.0.1:3002** so the app can reach the API.

## Nginx config

See **`docs/deployment/NGINX_EXAMPLE.conf`** for a full example (single server, ports 3001/3002, including `/api-backend`).
