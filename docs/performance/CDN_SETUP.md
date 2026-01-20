# CDN Setup Guide

## Overview

Content Delivery Network (CDN) setup for GlowGuide Retention Agent to improve global performance and reduce server load.

## Recommended CDN Providers

### 1. Cloudflare (Recommended)

**Pros:**
- Free tier available
- Easy setup
- DDoS protection
- SSL/TLS included
- Analytics

**Setup:**
1. Sign up at cloudflare.com
2. Add your domain
3. Update DNS records
4. Enable CDN caching
5. Configure cache rules

### 2. Vercel (For Next.js)

**Pros:**
- Built-in for Next.js
- Edge network
- Automatic optimization
- Zero configuration

**Setup:**
1. Deploy to Vercel
2. CDN is automatically enabled
3. Configure caching headers in `next.config.ts`

### 3. AWS CloudFront

**Pros:**
- Enterprise-grade
- Global edge locations
- Custom cache policies
- Integration with S3

**Setup:**
1. Create CloudFront distribution
2. Configure origin (API/Web)
3. Set up cache behaviors
4. Configure SSL certificate

## What to Cache

### Static Assets (Long TTL)

- **Images**: 1 year
- **Fonts**: 1 year
- **CSS/JS bundles**: 1 year (with versioning)
- **Favicons**: 1 month

### API Responses (Short TTL)

- **Public endpoints**: 5 minutes
- **Authenticated endpoints**: 1 minute
- **Dynamic content**: No cache

### Next.js Assets

- **Static pages**: 1 year
- **API routes**: No cache (or 1 minute)
- **Images**: 1 year

## Configuration

### Next.js CDN Configuration

```typescript
// next.config.ts
export default {
  // Enable CDN for static assets
  assetPrefix: process.env.CDN_URL || '',
  
  // Cache headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};
```

### Cloudflare Cache Rules

```javascript
// Cache static assets
if (request.url.pathname.startsWith('/_next/static/')) {
  return {
    cacheTtl: 31536000, // 1 year
    cacheEverything: true,
  };
}

// Cache images
if (request.url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
  return {
    cacheTtl: 31536000, // 1 year
    cacheEverything: true,
  };
}

// Don't cache API routes
if (request.url.pathname.startsWith('/api/')) {
  return {
    cacheTtl: 0,
    cacheEverything: false,
  };
}
```

### API Cache Headers

```typescript
// In Hono middleware
app.use('/*', async (c, next) => {
  await next();
  
  const path = c.req.path;
  
  // Static assets
  if (path.startsWith('/static/') || path.match(/\.(jpg|png|css|js)$/)) {
    c.header('Cache-Control', 'public, max-age=31536000, immutable');
  }
  
  // API responses
  else if (path.startsWith('/api/')) {
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  
  // HTML pages
  else {
    c.header('Cache-Control', 'public, max-age=3600, must-revalidate');
  }
});
```

## Cache Invalidation

### Manual Invalidation

**Cloudflare:**
```bash
# Purge all cache
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'

# Purge specific URLs
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://app.glowguide.ai/api/products/123"]}'
```

**Vercel:**
```bash
vercel --prod --force
```

### Automatic Invalidation

- **On deployment**: Clear cache automatically
- **On content update**: Invalidate specific paths
- **On API update**: Clear API route cache

## Performance Benefits

### Before CDN
- **Global latency**: 200-500ms
- **Server load**: High
- **Bandwidth costs**: High

### After CDN
- **Global latency**: 20-50ms
- **Server load**: Reduced by 60-80%
- **Bandwidth costs**: Reduced by 70-90%

## Monitoring

### Key Metrics

1. **Cache Hit Rate**: Target > 90%
2. **Response Time**: p95 < 50ms
3. **Bandwidth Savings**: > 70%
4. **Origin Requests**: Reduced by > 80%

### Tools

- **Cloudflare Analytics**: Cache performance
- **Vercel Analytics**: Edge performance
- **Google PageSpeed**: Performance score
- **WebPageTest**: Global performance

## Best Practices

1. **Version Static Assets**: Use content hashes in filenames
2. **Cache Busting**: For updated content
3. **Compression**: Enable gzip/brotli
4. **HTTP/2**: Use HTTP/2 for multiplexing
5. **Preconnect**: Preconnect to CDN domains
6. **Lazy Loading**: Load images on demand

## Implementation Checklist

- [ ] Choose CDN provider
- [ ] Configure DNS
- [ ] Set up SSL/TLS
- [ ] Configure cache rules
- [ ] Set cache headers
- [ ] Test cache behavior
- [ ] Monitor performance
- [ ] Set up cache invalidation
- [ ] Document cache strategy

## Troubleshooting

### Cache Not Working

1. Check cache headers
2. Verify CDN configuration
3. Check cache rules
4. Test with curl (check headers)

### Stale Content

1. Purge cache manually
2. Check cache TTL settings
3. Verify cache invalidation
4. Check if content is cacheable

### Performance Issues

1. Check cache hit rate
2. Verify CDN edge locations
3. Check origin server performance
4. Review cache rules
