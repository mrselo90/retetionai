# Integration Guide

GlowGuide supports three ways to connect your store and sync order data.

## Shopify Integration (Recommended)

### Prerequisites
- Shopify store (any plan)
- Admin access to your store

### Setup Steps

1. **Start OAuth Flow**
   - Go to "Integrations" → "Shopify"
   - Click "Connect Shopify"
   - Enter your Shopify store domain (e.g., `mystore.myshopify.com`)

2. **Authorize GlowGuide**
   - You'll be redirected to Shopify
   - Review the permissions GlowGuide needs:
     - Read orders
     - Read products
     - Read customers
   - Click "Install app"

3. **Complete Setup**
   - You'll be redirected back to GlowGuide
   - Integration status will show "Active"
   - Orders will start syncing automatically

### What Gets Synced

- **Orders**: All new orders, deliveries, cancellations
- **Customers**: Customer phone numbers and names
- **Products**: Product information (if you enable product sync)

### Webhooks

GlowGuide automatically creates webhooks in your Shopify store:
- `orders/create` - New order placed
- `orders/fulfilled` - Order delivered
- `orders/cancelled` - Order cancelled
- `orders/updated` - Order status changed

### Troubleshooting

**Integration not working?**
- Check that webhooks are active in Shopify Admin → Settings → Notifications
- Verify OAuth token hasn't expired
- Reconnect if needed

**Orders not syncing?**
- Check integration status in GlowGuide dashboard
- Verify webhook URL is correct in Shopify
- Check webhook delivery logs in Shopify Admin

---

## CSV Import

### When to Use
- One-time bulk import
- Non-Shopify stores
- Historical data migration

### CSV Format

Your CSV file should have these columns:

```csv
order_id,customer_phone,customer_name,order_date,delivery_date,order_status
ORD-001,+905551234567,John Doe,2024-01-15,2024-01-20,delivered
ORD-002,+905559876543,Jane Smith,2024-01-16,2024-01-21,delivered
```

**Required Columns:**
- `order_id` - Unique order identifier
- `customer_phone` - Phone in E.164 format (+905551234567)
- `order_date` - ISO 8601 date (YYYY-MM-DD)

**Optional Columns:**
- `customer_name` - Customer full name
- `delivery_date` - When order was delivered
- `order_status` - created, delivered, cancelled, returned

### Import Steps

1. Go to "Integrations" → "CSV Import"
2. Click "Choose File" and select your CSV
3. Click "Upload and Import"
4. Wait for processing (you'll see progress)
5. Review imported orders in "Conversations"

### Limitations

- CSV import is one-time (not continuous)
- Maximum 10,000 rows per import
- Phone numbers must be in E.164 format

---

## Manual Integration (API)

### When to Use
- Custom e-commerce platforms
- Programmatic control
- Real-time event pushing

### Setup

1. **Get Your API Key**
   - Go to "Settings" → "API Keys"
   - Copy your API key (starts with `gg_live_`)

2. **Send Events**

Send POST requests to `/webhooks/commerce/event`:

```bash
curl -X POST https://api.glowguide.ai/webhooks/commerce/event \
  -H "X-Api-Key: gg_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "order_delivered",
    "external_order_id": "ORD-001",
    "occurred_at": "2024-01-20T10:00:00Z",
    "customer": {
      "phone": "+905551234567",
      "name": "John Doe"
    },
    "order": {
      "status": "delivered",
      "delivered_at": "2024-01-20T10:00:00Z"
    }
  }'
```

### Event Types

- `order_created` - New order placed
- `order_delivered` - Order delivered
- `order_cancelled` - Order cancelled
- `order_returned` - Order returned
- `order_updated` - Order status changed

### Authentication

Use your API key in the `X-Api-Key` header:

```
X-Api-Key: gg_live_YOUR_API_KEY
```

### Rate Limits

- **API Key**: 1000 requests/hour
- **Merchant**: 5000 requests/hour

### Best Practices

1. **Idempotency**: Events are automatically deduplicated by `external_order_id` + `event_type` + `occurred_at`
2. **Timestamps**: Use ISO 8601 format (UTC)
3. **Phone Numbers**: Always use E.164 format (+905551234567)
4. **Error Handling**: Check response status and retry on 5xx errors

### Example: Order Delivered Event

```json
{
  "event_type": "order_delivered",
  "external_order_id": "ORD-12345",
  "occurred_at": "2024-01-20T14:30:00Z",
  "customer": {
    "phone": "+905551234567",
    "name": "Ahmet Yılmaz"
  },
  "order": {
    "status": "delivered",
    "delivered_at": "2024-01-20T14:30:00Z"
  }
}
```

After this event, GlowGuide will:
1. Create/update customer record
2. Create/update order record
3. Schedule post-delivery messages (T+3, T+14)

---

## Managing Integrations

### View All Integrations

Go to "Integrations" to see:
- Integration type (Shopify, CSV, Manual)
- Status (Active, Inactive, Error)
- Last sync time
- Actions (Edit, Delete, Reconnect)

### Disconnect Integration

1. Go to "Integrations"
2. Find your integration
3. Click "Disconnect"
4. Confirm deletion

**Note**: Disconnecting won't delete historical data, but new events won't be processed.

### Reconnect Shopify

If your Shopify integration stops working:

1. Go to "Integrations" → "Shopify"
2. Click "Reconnect"
3. Follow the OAuth flow again

---

## Troubleshooting

### Common Issues

**"Integration not found"**
- Check that integration exists in dashboard
- Verify integration status is "Active"

**"Webhook verification failed"**
- Check webhook URL in Shopify/Meta
- Verify HMAC secret matches

**"Events not processing"**
- Check integration status
- Verify API key is valid
- Check rate limits

**"Phone number invalid"**
- Must be in E.164 format (+905551234567)
- Include country code
- No spaces or dashes

---

## Need Help?

- **API Documentation**: `/api/docs`
- **Support**: support@glowguide.ai
- **Status Page**: status.glowguide.ai
