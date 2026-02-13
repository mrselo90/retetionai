# Google OAuth (Sign in with Google) Setup

## 1. Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**.
2. Create or select a project, then **Create Credentials** → **OAuth client ID**.
3. Application type: **Web application**.
4. **Authorized redirect URIs**: add this **exact** URL (Supabase callback for OAuth):

   ```
   https://clcqmasqkfdcmznwdrbx.supabase.co/auth/v1/callback
   ```

   *(Replace the host with your Supabase project URL if different: `https://<PROJECT_REF>.supabase.co/auth/v1/callback`.)*

5. Copy the **Client ID** and **Client Secret**.

## 2. Supabase Dashboard

1. **Authentication** → **Providers** → **Google** → enable.
2. Paste **Client ID** and **Client Secret** from Google.
3. **Authentication** → **URL Configuration** → **Redirect URLs**: add your app callback(s), e.g.:
   - Local: `http://localhost:3000/auth/callback`
   - Production: `https://your-domain.com/auth/callback`
4. Save.

## 3. Flow

- User clicks “Google ile giriş yap” → Supabase redirects to Google → Google redirects to **Supabase** (`.../auth/v1/callback`) → Supabase redirects to **your app** (`/auth/callback`) with tokens in the URL hash → app sets session and redirects to dashboard.
