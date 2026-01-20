# Supabase Email Confirmation Setup

## Problem
If you're seeing "Email not confirmed" errors, it means email confirmation is enabled in your Supabase project.

## Solution: Disable Email Confirmation (Recommended for MVP)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to: **Authentication** > **Settings** > **Email Auth**
4. Find the setting: **"Enable email confirmations"**
5. **Turn it OFF**
6. Click **Save**

## Alternative: Keep Email Confirmation Enabled

If you want to keep email confirmation enabled:

1. Users will receive a confirmation email after signup
2. They must click the link in the email before they can login
3. The confirmation link will redirect to: `http://localhost:3000/dashboard` (or your FRONTEND_URL)

### Email Template Customization

You can customize the confirmation email:
1. Go to: **Authentication** > **Email Templates**
2. Select **"Confirm signup"** template
3. Customize the email content
4. Make sure the confirmation link points to your frontend

## Testing

After disabling email confirmation:
1. Try signing up a new account
2. You should be able to login immediately without email confirmation

## Production Considerations

For production:
- **Keep email confirmation ON** for security
- Set up proper email templates
- Configure email redirect URLs
- Use environment-specific FRONTEND_URL
