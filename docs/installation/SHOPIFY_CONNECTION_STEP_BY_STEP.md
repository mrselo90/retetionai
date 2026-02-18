# Shopify Connection – Step by Step

Follow these steps **in order** to connect your Shopify store and fix connection/access problems.

---

## Before you start

- You need a **Shopify Partners** account (free): [partners.shopify.com](https://partners.shopify.com)
- Your app (API + Web) must be running: `pnpm dev:all` from the project root
- You need a **.env** file at the project root with at least Supabase and Redis (see [RUN_CHECKLIST.md](../../RUN_CHECKLIST.md))

---

## Step 1: Create or open your app in Shopify Partners

1. Go to **[partners.shopify.com](https://partners.shopify.com)** and log in.
2. In the left sidebar click **Apps**.
3. Either:
   - Click **Create app** → **Create app manually** → name it (e.g. “Recete Retention Agent”), or  
   - Open an existing app.

---

## Step 2: Get the exact redirect URL your app uses

Your app sends a **frontend** URL to Shopify (port **3000**), not the API (3001). To get the exact URL:

1. Start the app: from project root run `pnpm dev:all` (API on 3001, Web on 3000).
2. In a browser open:  
   **http://localhost:3001/api/integrations/shopify/oauth/redirect-uri**  
   (Or if you use the web proxy: **http://localhost:3000/api-backend/api/integrations/shopify/oauth/redirect-uri** – only if that proxy is configured.)
3. You’ll see JSON with **`redirectUri`**. Copy that value.  
   For local dev it will be:  
   **`http://localhost:3000/api/integrations/shopify/oauth/callback`**

---

## Step 3: Configure the app in Shopify Partners

1. In your app, go to **Configuration** (left sidebar).
2. **App URL**  
   Set to: **`http://localhost:3000`** (for local testing).
3. **Allowed redirection URL(s)**  
   - Click **Add URL** (or edit the list).  
   - Paste **exactly** the `redirectUri` from Step 2 (no trailing slash).  
   - For local: **`http://localhost:3000/api/integrations/shopify/oauth/callback`**  
   - Remove any URL that uses port **3001** for this callback; it must be **3000**.
4. **App credentials** (same page, scroll if needed)  
   - Copy **Client ID** and **Client secret**.  
   - You’ll use these in Step 4.
5. Click **Save**.

---

## Step 4: Put credentials in .env (API)

1. In the **project root**, open or create **.env** (do not commit this file).
2. Add or update (use your real values from Step 3):

```env
# Shopify (from Partner Dashboard → Configuration → App credentials)
SHOPIFY_API_KEY=your_client_id_here
SHOPIFY_API_SECRET=your_client_secret_here

# Optional: only if you need a different frontend URL (e.g. tunnel)
# FRONTEND_URL=http://localhost:3000
```

3. If you use a tunnel (e.g. ngrok), set **FRONTEND_URL** to that URL and add the same callback URL (e.g. `https://xxx.ngrok.io/api/integrations/shopify/oauth/callback`) in Shopify **Allowed redirection URL(s)**.

---

## Step 5: Restart the API and Web

1. Stop the running app (Ctrl+C in the terminal where `pnpm dev:all` is running).
2. Start again: **`pnpm dev:all`**.
3. Wait until you see the API and Web “ready” messages.

---

## Step 6: Connect from the dashboard

1. Open **http://localhost:3000** in your browser.
2. Sign up or log in.
3. Go to **Dashboard** → **Integrations** (or **Bağlantılar**).
4. In the Shopify section, enter your store domain: **`yourstore.myshopify.com`** (e.g. `blackeagletest.myshopify.com`).
5. Click the button to connect (e.g. “Connect Shopify” / “Shopify ile Bağlan”).
6. You’ll be redirected to Shopify. Click **Install app** (or **Allow**) and accept the requested permissions (products, orders, customers, webhooks).
7. You should be redirected back to your app (e.g. Integrations page with a success message).

---

## Step 7: Subscribe to webhooks (order events)

1. After Shopify is connected, on the Integrations page use the option to **Subscribe to webhooks** (or similar).
2. This registers your API so Shopify can send **orders/create**, **orders/fulfilled**, **orders/updated** to your backend.

---

## Step 8: Load products

1. Go to **Dashboard** → **Products** (or **Ürünler**) → **Shopify map** (or the link that loads Shopify products).
2. The app will call the Shopify API with the stored token. If you see “Reconnect your Shopify store and accept product access”, disconnect and reconnect Shopify (Step 6) and accept all permissions.

---

## Troubleshooting

| Problem | What to do |
|--------|------------|
| **“Invalid redirect_uri”** or **“redirect_uri and application url must have matching hosts”** | Use the **frontend** URL (port **3000**). In Shopify **Allowed redirection URL(s)** add exactly: `http://localhost:3000/api/integrations/shopify/oauth/callback`. Remove any `http://localhost:3001/.../oauth/callback`. Check **App URL** is `http://localhost:3000`. |
| **“Invalid HMAC signature”** | **SHOPIFY_API_SECRET** in .env must match the **Client secret** in Shopify Partner Dashboard → Configuration → App credentials. Copy the secret again and restart the API. |
| **“Missing required OAuth parameters”** | Don’t open the callback URL in a new tab without the query string. Complete the flow by clicking “Connect” in the app and then “Install” on Shopify. |
| **“Failed to exchange code for token”** | The authorization code is one-time use. Start over: Integrations → Connect Shopify again and go through the flow. |
| **Products: “Reconnect your Shopify store and accept product access”** | Disconnect Shopify in the app, then connect again and **accept all** requested permissions (including “Read products”). |
| **API or Web not starting** | Check .env has SUPABASE_*, REDIS_URL, and (for Shopify) SHOPIFY_API_KEY and SHOPIFY_API_SECRET. See [RUN_CHECKLIST.md](../../RUN_CHECKLIST.md). |

---

## Quick checklist

- [ ] App created in Shopify Partners; Configuration opened  
- [ ] **App URL** = `http://localhost:3000`  
- [ ] **Allowed redirection URL(s)** includes exactly `http://localhost:3000/api/integrations/shopify/oauth/callback` (no 3001)  
- [ ] **Client ID** and **Client secret** copied  
- [ ] `.env` has `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET`  
- [ ] API and Web restarted (`pnpm dev:all`)  
- [ ] Logged in at http://localhost:3000 → Integrations → Connect Shopify with `yourstore.myshopify.com`  
- [ ] Accepted all permissions on Shopify  
- [ ] Subscribed to webhooks  
- [ ] Loaded products from Shopify map page  

If you still see connection or access errors, use the **redirect-uri** endpoint (Step 2) and compare `redirectUri` with what is in Shopify **Allowed redirection URL(s)** character by character.
