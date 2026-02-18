# OpenAPI/Swagger Documentation

## Overview

The Recete API uses OpenAPI 3.1.0 specification for documentation. Swagger UI is available at `/api/docs`.

## Accessing Documentation

### Development
- **Swagger UI**: http://localhost:3001/api/docs
- **OpenAPI JSON**: http://localhost:3001/api/docs/openapi.json

### Production
- **Swagger UI**: https://api.glowguide.ai/api/docs
- **OpenAPI JSON**: https://api.glowguide.ai/api/docs/openapi.json

## Authentication

The API supports two authentication methods:

1. **JWT Bearer Token** (for web app users)
   - Header: `Authorization: Bearer <token>`
   - Token obtained from `/api/auth/login`

2. **API Key** (for programmatic access)
   - Header: `X-Api-Key: gg_live_<key>`
   - Key obtained from `/api/auth/signup` or `/api/merchants/me/api-keys`

## Endpoint Categories

### Authentication (`/api/auth`)
- `POST /api/auth/signup` - Merchant signup
- `POST /api/auth/login` - Merchant login
- `GET /api/auth/me` - Get current merchant
- `POST /api/auth/api-keys` - Create API key
- `DELETE /api/auth/api-keys/:keyId` - Revoke API key
- `POST /api/auth/api-keys/:keyId/rotate` - Rotate API key

### Merchants (`/api/merchants`)
- `GET /api/merchants/me` - Get merchant profile
- `PUT /api/merchants/me` - Update merchant profile
- `GET /api/merchants/me/dashboard` - Get dashboard statistics
- `GET /api/merchants/me/api-keys` - List API keys

### Products (`/api/products`)
- `GET /api/products` - List products
- `POST /api/products` - Create product
- `GET /api/products/:id` - Get product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `POST /api/products/:id/scrape` - Scrape product page
- `POST /api/products/:id/generate-embeddings` - Generate embeddings

### Integrations (`/api/integrations`)
- `GET /api/integrations` - List integrations
- `POST /api/integrations` - Create integration
- `GET /api/integrations/:id` - Get integration
- `PUT /api/integrations/:id` - Update integration
- `DELETE /api/integrations/:id` - Delete integration

### Shopify (`/api/integrations/shopify`)
- `GET /api/integrations/shopify/auth` - Start OAuth flow
- `GET /api/integrations/shopify/callback` - OAuth callback
- `POST /api/integrations/shopify/webhooks` - Create webhooks

### Conversations (`/api/conversations`)
- `GET /api/conversations` - List conversations
- `GET /api/conversations/:id` - Get conversation details

### Analytics (`/api/analytics`)
- `GET /api/analytics/dashboard` - Get dashboard analytics

### Webhooks (`/webhooks`)
- `POST /webhooks/commerce/shopify` - Shopify webhook receiver
- `POST /webhooks/commerce/event` - Generic event webhook

### GDPR (`/api/gdpr`)
- `GET /api/gdpr/export` - Export merchant data
- `GET /api/gdpr/users/:userId/export` - Export user data
- `POST /api/gdpr/delete` - Delete merchant data
- `POST /api/gdpr/users/:userId/delete` - Delete user data

## Response Formats

### Success Response
```json
{
  "message": "Success message",
  "data": { ... }
}
```

### Error Response
```json
{
  "error": "Error type",
  "message": "Error message",
  "details": "Additional details",
  "code": "ERROR_CODE",
  "hint": "Helpful hint"
}
```

## Rate Limiting

- **IP-based**: 100 requests/minute
- **API Key**: 1000 requests/hour
- **Merchant**: 5000 requests/hour

Rate limit headers:
- `X-RateLimit-Limit`: Maximum requests
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error
- `503` - Service Unavailable

## Examples

### Signup
```bash
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "merchant@example.com",
    "password": "securepassword",
    "name": "My Store"
  }'
```

### Create Product
```bash
curl -X POST http://localhost:3001/api/products \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Product Name",
    "url": "https://example.com/product"
  }'
```

### List Conversations
```bash
curl -X GET http://localhost:3001/api/conversations \
  -H "Authorization: Bearer <token>"
```

## Notes

- All timestamps are in ISO 8601 format
- All IDs are UUIDs
- Phone numbers must be in E.164 format (+905551234567)
- API keys expire after 90 days (configurable)
