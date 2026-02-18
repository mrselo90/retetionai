# How to Find Your Shopify API Key

## Quick Answer

Your Shopify API key is found in your **Shopify Partners Dashboard**.

## Step-by-Step Guide

### Step 1: Go to Shopify Partners

Visit: **https://partners.shopify.com/**

- If you don't have an account, click "Join now" (it's free)
- If you have an account, log in

### Step 2: Navigate to Apps

1. In the left sidebar, click **"Apps"**
2. You'll see a list of your apps (or empty if you haven't created one yet)

### Step 3: Create or Select Your App

**If you already have an app:**
- Click on your app name

**If you need to create a new app:**
1. Click **"Create app"** button
2. Select **"Public app"** (for App Store distribution)
3. Fill in:
   - **App name**: Recete Retention Agent
   - Click **"Create app"**

### Step 4: Get API Credentials

1. Once in your app, click **"Configuration"** in the left sidebar
2. Scroll down to **"App credentials"** section
3. You'll see:
   - **Client ID** (this is your `SHOPIFY_API_KEY`)
   - **Client secret** (this is your `SHOPIFY_API_SECRET`)

### Step 5: Configure App URLs

Before you can use OAuth, you need to set the redirect URL. **The app sends the frontend URL (port 3000), not the API (3001).**

1. In the same Configuration page, find **"App URL"**
2. Set to: `http://localhost:3000` (for local testing)

3. Find **"Allowed redirection URL(s)"**
4. Add **exactly** (copy-paste):  
   **`http://localhost:3000/api/integrations/shopify/oauth/callback`**  
   (Use port **3000**, not 3001. No trailing slash.)

5. Click **"Save"**

### Step 6: Copy Credentials to .env

Update your `.env` file:

```bash
# Replace these placeholders with your actual credentials
SHOPIFY_API_KEY=your_client_id_from_step_4
SHOPIFY_API_SECRET=your_client_secret_from_step_4
```

### Step 7: Restart Your Server

```bash
# Stop the current server (Ctrl+C in terminal)
# Then restart:
pnpm --filter api dev
```

## Visual Reference

```
Shopify Partners Dashboard
└── Apps
    └── [Your App Name]
        └── Configuration
            └── App credentials
                ├── Client ID ← This is SHOPIFY_API_KEY
                └── Client secret ← This is SHOPIFY_API_SECRET
```

## Important Notes

### About the Token You Provided

The token `4198a87627e8edafd4cffb797f0a074d` you shared appears to be:
- **32 characters** (hexadecimal format)
- This could be a **Shopify API key** or **access token**

**If this is your Shopify API key**, add it to `.env`:
```bash
SHOPIFY_API_KEY=4198a87627e8edafd4cffb797f0a074d
```

**You'll also need the API secret** (different from the key).

### Security Warning

⚠️ **Never share your API credentials publicly!**
- API keys and secrets should be kept private
- Don't commit them to Git
- Use environment variables (`.env` file)

## Testing Your Credentials

After adding credentials to `.env` and restarting the server, test:

```bash
# Run the Shopify integration test
./scripts/test-shopify-integration.sh
```

Or manually test the OAuth flow:

```bash
# Start web app
pnpm --filter web dev

# Open browser: http://localhost:3000
# Go to Integrations → Connect Shopify
# Enter: blackeagletest.myshopify.com
```

## Troubleshooting

### "App credentials not found"
- Make sure you're in the Configuration tab
- Scroll down - credentials are usually near the bottom

### "Can't create app"
- You need a Shopify Partners account (free)
- Verify your email address first

### "Invalid redirect URI"
- The app uses the **frontend** URL. Use exactly:
  **`http://localhost:3000/api/integrations/shopify/oauth/callback`**
- Port must be **3000** (web app), not 3001 (API).
- No trailing slashes. Check for typos in Shopify Partner Dashboard → Configuration → Allowed redirection URL(s).

## Need Help?

If you're stuck:
1. Check the full guide: `docs/installation/shopify-partner-setup.md`
2. Or follow the quick start: `SHOPIFY_QUICK_START.md`

## Next Steps

Once you have both credentials:
1. ✅ Add to `.env` file
2. ✅ Restart API server
3. ✅ Test OAuth flow with blackeagletest.myshopify.com
4. ✅ Subscribe to webhooks
5. ✅ Test end-to-end integration
