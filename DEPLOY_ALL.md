# Deploy: All Steps and Commands

Use this when you want to deploy the latest code (e.g. after pushing to `main`) to your server.

---

## 1. From your machine: push code (if not already done)

```bash
cd /Users/sboyuk/Desktop/retention-agent-ai
git add -A
git status
git commit -m "Your message"
git push origin main
```

---

## 2. On the server: run deploy

**SSH in:**

```bash
ssh root@209.97.134.215
```

**Go to project and run deploy script:**

```bash
cd /root/retetionai
./deploy.sh
```

If the project folder has a different name (e.g. `retention-agent-ai`), use that path instead of `/root/retetionai`.

---

## 3. What `deploy.sh` does

| Step | Action |
|------|--------|
| 1 | `git pull origin main` |
| 2 | `pnpm install` |
| 3 | Run DB migration: `psql $DATABASE_URL -f supabase/migrations/010_performance_indexes.sql` (skipped if `DATABASE_URL` not set) |
| 4 | `pnpm build` (shared → api, web, workers) |
| 5 | `pm2 restart all --update-env` |
| 6 | List PM2 processes |
| 7 | Curl API (3002) and Web (3001), Redis ping |

---

## 4. Manual deploy (if you don’t use the script)

Run these on the server **from the project root** (e.g. `/root/retetionai`):

```bash
cd /root/retetionai
git pull origin main
pnpm install
# Optional: run migration if you have DATABASE_URL in .env
# psql "$DATABASE_URL" -f supabase/migrations/010_performance_indexes.sql
pnpm build
pm2 restart all --update-env
pm2 list
```

---

## 5. First-time server setup (PM2 not running yet)

From project root on the server:

```bash
cd /root/retetionai
pnpm install
pnpm build
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # follow the command it prints to enable on reboot
```

---

## 6. Required on the server

- **Node** (v18+)
- **pnpm** (`npm install -g pnpm`)
- **PM2** (`npm install -g pm2`)
- **`.env`** in project root with at least:
  - `DATABASE_URL` (for API and optional migration in deploy script)
  - Other vars your app needs (e.g. `NEXT_PUBLIC_*`, API keys)

---

## 7. After deploy: check

```bash
pm2 list
pm2 logs --lines 50
curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/api/health
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/
```

In the browser: open your site and do a **hard refresh** (Ctrl+Shift+R or Cmd+Shift+R) so you don’t see old cached assets.

---

## 8. Ports and Nginx

- **Web**: 3001 (PM2 app `web`)
- **API**: 3002 (PM2 app `api`)
- **Workers**: PM2 app `workers` (no HTTP port)

Nginx should proxy your domain to 3001 (and e.g. `/api` to 3002). See `docs/deployment/NGINX_EXAMPLE.conf` and `docs/deployment/PORTS_AND_ROUTING.md` if needed.

---

## 9. Troubleshooting

| Issue | What to do |
|-------|------------|
| `./deploy.sh` not found | Ensure you’re in the repo that contains `deploy.sh` (e.g. `cd /root/retetionai`). |
| `DATABASE_URL` not set | Migration step is skipped. Set it in `.env` or run the `psql ... 010_performance_indexes.sql` command manually. |
| Build fails | Run `pnpm build` in the project root and read the error; fix deps or code, then redeploy. |
| PM2 app not online | `pm2 logs api` or `pm2 logs web`; fix env or code, then `pm2 restart all --update-env`. |
| Site still old after deploy | Hard refresh (Ctrl+Shift+R). If using a CDN/cache, purge cache. |

---

**Summary:** Push to `main` → SSH to server → `cd /root/retetionai` → `./deploy.sh` → hard refresh browser.
