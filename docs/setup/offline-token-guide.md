# Offline Access Token Guide

## Overview

This guide explains how to generate and use offline access tokens for WhatsApp Business API integration. Offline tokens are long-lived tokens that don't expire and are essential for production deployments.

## Why Offline Tokens?

- **Temporary tokens** expire after 24 hours
- **Offline tokens** never expire (until manually revoked)
- Required for production deployments
- Enables uninterrupted service

## Prerequisites

- Meta Business Account
- WhatsApp Business Account
- System User with appropriate permissions

## Step-by-Step Guide

### 1. Create a System User

1. Go to [Meta Business Settings](https://business.facebook.com/settings)
2. Navigate to **Users** → **System Users**
3. Click **Add** to create a new system user
4. Enter details:
   - **Name**: "Recete Production Bot"
   - **Role**: Admin (or appropriate role)
5. Click **Create System User**

### 2. Assign Assets to System User

1. Click on the newly created system user
2. Click **Add Assets**
3. Select **Apps**
4. Find your WhatsApp app
5. Toggle **Full Control** or **Manage App**
6. Click **Save Changes**

### 3. Generate Access Token

1. Still in the system user page, find **Generate New Token**
2. Click **Generate New Token**
3. Select your WhatsApp app
4. Select permissions:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
   - `business_management` (optional, for analytics)
5. Click **Generate Token**
6. **IMPORTANT**: Copy the token immediately - you won't see it again!

### 4. Verify Token

Test your token with a simple API call:

```bash
curl -X GET "https://graph.facebook.com/v21.0/me" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Expected response:
```json
{
  "id": "your-app-id",
  "name": "Your App Name"
}
```

### 5. Configure Application

Add the token to your `.env` file:

```bash
WHATSAPP_ACCESS_TOKEN=your-offline-access-token-here
```

### 6. Test WhatsApp Integration

Send a test message:

```bash
curl -X POST "https://graph.facebook.com/v21.0/YOUR_PHONE_NUMBER_ID/messages" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "YOUR_TEST_NUMBER",
    "type": "text",
    "text": {
      "body": "Test message from Recete"
    }
  }'
```

## Token Management

### Rotating Tokens

For security, rotate tokens periodically:

1. Generate a new token (steps above)
2. Update your application with the new token
3. Test the new token
4. Revoke the old token

### Revoking Tokens

To revoke a token:

1. Go to **System Users** in Business Settings
2. Click on the system user
3. Find the token in the **Access Tokens** section
4. Click **Remove**

## Security Best Practices

### Storage

- **Never commit tokens to git**
- Store in environment variables
- Use secrets management (AWS Secrets Manager, HashiCorp Vault)
- Encrypt tokens at rest

### Access Control

- Limit system user permissions to minimum required
- Use separate tokens for development and production
- Rotate tokens every 90 days
- Monitor token usage for anomalies

### Monitoring

- Set up alerts for failed API calls
- Monitor rate limits
- Track token usage patterns
- Log all token-related events

## Troubleshooting

### Token Not Working

**Error**: "Invalid OAuth access token"

**Solutions**:
- Verify token hasn't been revoked
- Check token permissions include required scopes
- Ensure app is still assigned to system user
- Regenerate token if necessary

### Permission Errors

**Error**: "Insufficient permissions"

**Solutions**:
- Verify system user has correct app permissions
- Check token scopes include required permissions
- Ensure WhatsApp Business Account is verified

### Rate Limiting

**Error**: "Rate limit exceeded"

**Solutions**:
- Implement exponential backoff
- Monitor API usage
- Request rate limit increase if needed
- Upgrade to higher tier

## Token Scopes Reference

### Required Scopes

- `whatsapp_business_messaging`: Send and receive messages
- `whatsapp_business_management`: Manage WhatsApp Business Account

### Optional Scopes

- `business_management`: Access business analytics
- `pages_messaging`: Manage Facebook Pages (if integrated)
- `pages_read_engagement`: Read page engagement data

## API Version Compatibility

- Current API version: v21.0
- Tokens work across API versions
- Update API version in URLs as needed
- Check [Meta API Changelog](https://developers.facebook.com/docs/graph-api/changelog) for breaking changes

## Resources

- [Meta System Users Documentation](https://www.facebook.com/business/help/503306463479099)
- [WhatsApp Business API Reference](https://developers.facebook.com/docs/whatsapp/business-management-api)
- [Access Token Best Practices](https://developers.facebook.com/docs/facebook-login/security)

## Support

For issues with access tokens:
- [Meta Business Help Center](https://www.facebook.com/business/help)
- [Developer Community](https://developers.facebook.com/community/)
- [WhatsApp Business API Support](https://business.whatsapp.com/support)
