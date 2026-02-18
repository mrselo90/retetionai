# Current Status — February 16, 2026

## 🟢 Application is LIVE

**URL**: http://209.97.134.215  
**Server**: DigitalOcean Droplet (209.97.134.215)

## Services

| Service | Status | Port | Memory |
|---------|--------|------|--------|
| API | ✅ Online | 3000 | ~110 MB |
| Frontend | ✅ Online | 3001 | ~55 MB |
| Workers | ✅ Online | - | ~68 MB |
| Redis | ✅ Connected | 6379 | - |
| Supabase DB | ✅ Connected | cloud | - |
| Nginx | ✅ Running | 80 | - |

## Quick Commands

```bash
# Connect to server
ssh root@209.97.134.215

# Check services
pm2 list

# View logs
pm2 logs api --lines 50

# Restart
pm2 restart all --update-env

# Deploy update
cd /root/retetionai && git pull && pnpm install && cd packages/web && pnpm build && pm2 restart all
```

## Key Files on Server

| File | Path |
|------|------|
| Backend .env | `/root/retetionai/.env` |
| Frontend .env | `/root/retetionai/packages/web/.env.local` |
| Nginx config | `/etc/nginx/sites-available/recete` |
| PM2 config | `~/.pm2/dump.pm2` |

47: ### Next Steps
48: 1.  **Deployment:** ✅ Push i18n changes to the server (Build fixed & deployed).
49: 2.  **SSL/Domain:** Configure custom domain and Let's Encrypt SSL.
50: 3.  **Localization:** Finish localizing inner dashboard pages.
51: 4.  **Integrations:** Verify Shopify OAuth and WhatsApp API.
