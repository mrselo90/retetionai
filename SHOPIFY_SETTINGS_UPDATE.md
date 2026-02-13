# ⚠️ ACTION REQUIRED: Update Shopify App Settings

The error "redirect_uri and application url must have matching hosts" happens because:

1. Your App URL is `http://localhost:3000` (Frontend)
2. We updated the code to use `http://localhost:3000/...` for the redirect
3. **BUT** Shopify Partner Dashboard probably still sends to `http://localhost:3001/...`

## Steps to Fix

1. Go to **[Shopify Partners Dashboard](https://partners.shopify.com/)**
2. Click **Apps** → Select **GlowGuide Retention Agent**
3. Click **Configuration**
4. Look for **URLS** section:
   - **App URL**: `http://localhost:3000`
   - **Allowed redirection URL(s)**: 
     - ❌ `http://localhost:3001/api/integrations/shopify/oauth/callback` (Delete or keep as backup)
     - ✅ **ADD THIS**: `http://localhost:3000/api/integrations/shopify/oauth/callback`

5. Click **Save**
6. **Try connecting again** in the web app.

## Why this works
Shopify requires the **App URL** and **Redirect URI** to share the same host (domain + port).
- App URL: `http://localhost:3000`
- Redirect URI: `http://localhost:3000/api/...`

By adding the port 3000 URL to the allowed list, Shopify will accept the request.
