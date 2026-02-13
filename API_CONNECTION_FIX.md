# Quick Fix: API Connection Issue

## Problem
Browser was caching old environment variables before `.env.local` was created.

## Solution Applied

1. **Stopped web server**
2. **Cleared Next.js cache**: `rm -rf .next`
3. **Restarted web server**

## Now Try Again

1. **Hard refresh your browser**: 
   - Mac: `Cmd + Shift + R`
   - Windows/Linux: `Ctrl + Shift + R`

2. **Or clear browser cache**:
   - Open DevTools (F12)
   - Right-click refresh button → "Empty Cache and Hard Reload"

3. **Test Shopify connection**:
   - Go to: http://localhost:3000
   - Navigate to Integrations
   - Click "Connect Shopify"
   - Enter: `blackeagletest.myshopify.com`

## Verify API is Running

```bash
curl http://localhost:3001/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "...",
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

## If Still Not Working

The frontend should now be using `http://localhost:3001` for API calls.

Check browser console (F12) to see the actual URL being used.
