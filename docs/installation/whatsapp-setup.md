# WhatsApp Business API Setup

Complete guide for setting up WhatsApp Business API with Recete.

## Prerequisites

- Meta Business Account
- WhatsApp Business Account (or access to create one)
- Admin access to Meta Business Manager

## Step 1: Create Meta Business Account

### 1.1 Sign Up

1. Go to [Meta Business Manager](https://business.facebook.com)
2. Click "Create Account"
3. Enter business information
4. Verify your email

### 1.2 Add WhatsApp Business

1. Go to Business Settings
2. Click "WhatsApp Accounts"
3. Click "Add" → "Create WhatsApp Business Account"
4. Follow the setup wizard

---

## Step 2: Create WhatsApp Business App

### 2.1 Create App

1. Go to [Meta Developers](https://developers.facebook.com)
2. Click "My Apps" → "Create App"
3. Select "Business" type
4. Enter app name: "Recete Integration"
5. Click "Create App"

### 2.2 Add WhatsApp Product

1. In your app dashboard, find "WhatsApp"
2. Click "Set Up"
3. Follow the setup wizard
4. Select your WhatsApp Business Account

---

## Step 3: Get API Credentials

### 3.1 Access Token

1. Go to App Dashboard → WhatsApp → API Setup
2. Find "Temporary access token"
3. Click "Generate Token"
4. **Copy and save** the token (starts with `EAAB...`)

**Note**: Temporary tokens expire in 24 hours. For production, use a permanent token (see Step 4).

### 3.2 Phone Number ID

1. In the same page, find "Phone number ID"
2. **Copy and save** the ID (numeric string)

### 3.3 Verify Token

1. Create a secure random string (e.g., `recete_verify_2024`)
2. **Save this token** - you'll need it for webhook setup

---

## Step 4: Generate Permanent Access Token

### 4.1 Create System User

1. Go to Business Settings → Users → System Users
2. Click "Add" → "Create New System User"
3. Enter name: "Recete Integration"
4. Select "Admin" role
5. Click "Create System User"

### 4.2 Assign Assets

1. Click on the system user
2. Click "Assign Assets"
3. Select:
   - Your WhatsApp Business App
   - WhatsApp Business Account
4. Grant permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
5. Click "Save Changes"

### 4.3 Generate Token

1. Click "Generate New Token"
2. Select your app
3. Select permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
4. Click "Generate Token"
5. **Copy and save** the token (this is permanent!)

**Important**: Save this token securely. It won't be shown again.

---

## Step 5: Configure Webhook in Recete

### 5.1 Add Credentials

1. Go to Recete → "Settings" → "Integrations"
2. Scroll to "WhatsApp Configuration"
3. Enter:
   - **Access Token**: Your permanent token from Step 4
   - **Phone Number ID**: From Step 3.2
   - **Verify Token**: The token you created in Step 3.3
4. Click "Save"

### 5.2 Test Connection

1. Click "Test Connection"
2. You should see "Connected" status
3. If error, verify credentials are correct

---

## Step 6: Configure Webhook in Meta

### 6.1 Set Webhook URL

1. Go to Meta Developers → Your App → WhatsApp → Configuration
2. Find "Webhook" section
3. Click "Edit"
4. Enter:
   - **Callback URL**: `https://api.recete.ai/webhooks/whatsapp`
   - **Verify Token**: Same as in Recete (Step 3.3)
5. Click "Verify and Save"

### 6.2 Subscribe to Events

1. In the same page, find "Webhook fields"
2. Subscribe to:
   - ✅ `messages` - Incoming messages
   - ✅ `message_status` - Message delivery status
3. Click "Save"

### 6.3 Verify Webhook

1. Meta will send a GET request to verify
2. Recete will respond with challenge
3. Webhook status should show "Verified" ✅

---

## Step 7: Test Webhook

### 7.1 Send Test Message

1. Send a WhatsApp message to your Business number
2. Go to Meta Developers → Webhooks → View Events
3. You should see:
   - Incoming message event
   - Webhook delivery status

### 7.2 Check Recete

1. Go to Recete → "Conversations"
2. You should see the message appear
3. AI should respond automatically

### 7.3 Verify Response

1. Check WhatsApp for AI response
2. Response should arrive within 3 seconds
3. If not, check:
   - Webhook is verified
   - Credentials are correct
   - API status is healthy

---

## Troubleshooting

### "Webhook Verification Failed"

**Possible Causes:**
- Verify token doesn't match
- Webhook URL is incorrect
- Server is not accessible

**Solutions:**
1. Verify token matches in both places
2. Check webhook URL is correct
3. Ensure server is running and accessible
4. Check firewall/security settings

### "Messages Not Received"

**Possible Causes:**
- Webhook not subscribed to events
- Webhook URL is wrong
- Server error

**Solutions:**
1. Check webhook subscriptions in Meta
2. Verify webhook URL
3. Check server logs
4. Test webhook manually

### "Access Token Expired"

**Possible Causes:**
- Using temporary token
- Token was revoked
- Token expired

**Solutions:**
1. Generate new permanent token (Step 4)
2. Update credentials in Recete
3. Verify token permissions

### "Phone Number Not Verified"

**Possible Causes:**
- Phone number not added to WhatsApp Business
- Verification not completed

**Solutions:**
1. Complete phone number verification in Meta
2. Wait for verification to complete
3. Try again

---

## Best Practices

### 1. Use Permanent Tokens

- Temporary tokens expire in 24 hours
- Always use permanent tokens for production
- Rotate tokens periodically (every 90 days)

### 2. Secure Your Credentials

- Never share access tokens
- Store tokens securely
- Use environment variables
- Rotate if compromised

### 3. Monitor Webhook Health

- Check webhook status regularly
- Monitor delivery success rate
- Set up alerts for failures

### 4. Test Regularly

- Send test messages weekly
- Verify responses are working
- Check webhook delivery logs

---

## Advanced: Multiple Phone Numbers

If you have multiple WhatsApp Business numbers:

1. Create separate apps for each number
2. Get credentials for each
3. Configure in Recete (future: multi-number support)

---

## Need Help?

- **Meta Documentation**: [WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp)
- **Recete Support**: support@recete.ai
- **Status**: status.recete.ai

---

**Your WhatsApp integration is now complete!** 🎉
