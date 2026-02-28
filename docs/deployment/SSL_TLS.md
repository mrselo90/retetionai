# SSL/TLS Configuration Guide

## Overview

This guide covers SSL/TLS certificate setup and HTTPS configuration for Recete Retention Agent.

### Shopify App Store requirement

**Valid TLS (HTTPS) is required** for Shopify App Store submission. The app URL (and OAuth redirect / webhook URLs) must be served over HTTPS with a valid certificate. Complete the checklist at the end of this document before submitting to the App Store.

## Certificate Options

### 1. Let's Encrypt (Recommended - Free)

**Pros:**
- Free
- Automated renewal
- Widely trusted
- Easy setup with Certbot

**Cons:**
- 90-day validity (auto-renewal handles this)
- Rate limits (50 certs/week per domain)

### 2. Commercial Certificates

**Providers:**
- DigiCert
- GlobalSign
- Sectigo

**Pros:**
- Longer validity (1-2 years)
- Extended validation options
- Support included

**Cons:**
- Cost ($50-$500+/year)
- Manual renewal

## Let's Encrypt Setup

### Prerequisites

- Domain name pointing to your server
- Port 80 and 443 open
- Root or sudo access

### Installation (Certbot)

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install certbot

# macOS
brew install certbot

# CentOS/RHEL
sudo yum install certbot
```

### Certificate Generation

#### Standalone Mode (No Web Server Running)

```bash
# Stop your web server first
sudo systemctl stop nginx  # or apache2

# Generate certificate
sudo certbot certonly --standalone -d api.recete.co.uk -d app.recete.co.uk

# Start web server
sudo systemctl start nginx
```

#### Webroot Mode (Web Server Running)

```bash
# Generate certificate
sudo certbot certonly --webroot \
  -w /var/www/html \
  -d api.recete.co.uk \
  -d app.recete.co.uk
```

### Auto-Renewal

Certbot automatically sets up renewal:

```bash
# Test renewal
sudo certbot renew --dry-run

# Manual renewal
sudo certbot renew
```

Add to crontab for automatic renewal:

```bash
# Edit crontab
sudo crontab -e

# Add line (runs twice daily)
0 0,12 * * * certbot renew --quiet
```

## Nginx Configuration

### Basic HTTPS Configuration

```nginx
server {
    listen 80;
    server_name api.recete.co.uk;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.recete.co.uk;

    # SSL Certificate paths
    ssl_certificate /etc/letsencrypt/live/api.recete.co.uk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.recete.co.uk/privkey.pem;

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;

    # HSTS (HTTP Strict Transport Security)
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy to API
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Application-Level HTTPS Enforcement

### Hono Middleware

```typescript
// packages/api/src/middleware/https.ts
import { Context, Next } from 'hono';

export async function httpsMiddleware(c: Context, next: Next) {
  // In production, enforce HTTPS
  if (process.env.NODE_ENV === 'production') {
    const protocol = c.req.header('X-Forwarded-Proto') || 
                     c.req.url.split('://')[0];
    
    if (protocol !== 'https') {
      const httpsUrl = c.req.url.replace('http://', 'https://');
      return c.redirect(httpsUrl, 301);
    }
  }
  
  await next();
}
```

### Next.js Configuration

```typescript
// next.config.ts
export default {
  // Force HTTPS in production
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};
```

## Docker Setup

### Using Traefik (Recommended)

```yaml
# docker-compose.yml
version: '3.8'

services:
  traefik:
    image: traefik:v2.10
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.tlschallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.email=admin@recete.co.uk"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./letsencrypt:/letsencrypt
    labels:
      - "traefik.enable=true"

  api:
    image: recete-api:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=Host(`api.recete.co.uk`)"
      - "traefik.http.routers.api.entrypoints=websecure"
      - "traefik.http.routers.api.tls.certresolver=letsencrypt"
      - "traefik.http.routers.api.middlewares=api-headers"
      - "traefik.http.middlewares.api-headers.headers.stsSeconds=31536000"
      - "traefik.http.middlewares.api-headers.headers.stsIncludeSubdomains=true"
```

## Platform-Specific

### Vercel

HTTPS is automatically enabled. No configuration needed.



### Render

HTTPS is automatically enabled with Render's domain.

### AWS (CloudFront + ALB)

1. Request certificate in ACM (AWS Certificate Manager)
2. Attach to CloudFront distribution
3. Configure ALB with HTTPS listener

## HSTS Configuration

### Nginx

```nginx
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
```

### Application

```typescript
// Already included in securityHeaders middleware
c.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
```

## Testing SSL

### SSL Labs Test

Visit: https://www.ssllabs.com/ssltest/

Enter your domain and check:
- Grade A or A+
- All protocols supported
- Strong ciphers

### Command Line

```bash
# Check certificate
openssl s_client -connect api.recete.co.uk:443 -servername api.recete.co.uk

# Check expiration
echo | openssl s_client -servername api.recete.co.uk -connect api.recete.co.uk:443 2>/dev/null | openssl x509 -noout -dates
```

## Troubleshooting

### Certificate Not Renewing

```bash
# Check renewal logs
sudo tail -f /var/log/letsencrypt/letsencrypt.log

# Force renewal
sudo certbot renew --force-renewal
```

### Mixed Content Warnings

Ensure all resources (images, scripts, stylesheets) use HTTPS:

```html
<!-- Bad -->
<img src="http://example.com/image.jpg" />

<!-- Good -->
<img src="https://example.com/image.jpg" />
```

### Certificate Chain Issues

Ensure fullchain.pem includes intermediate certificates:

```bash
# Verify chain
openssl verify -CAfile /etc/letsencrypt/live/api.recete.co.uk/chain.pem \
  /etc/letsencrypt/live/api.recete.co.uk/cert.pem
```

## Security Best Practices

1. **Use TLS 1.2+**: Disable TLS 1.0 and 1.1
2. **Strong Ciphers**: Use modern cipher suites
3. **HSTS**: Enable with long max-age
4. **Certificate Pinning**: For mobile apps (optional)
5. **Regular Updates**: Keep certificates renewed
6. **Monitor Expiration**: Set up alerts

## Checklist

- [ ] Domain DNS configured
- [ ] Ports 80 and 443 open
- [ ] Certificate generated
- [ ] Auto-renewal configured
- [ ] HTTPS enforced (HTTP redirect)
- [ ] HSTS headers set
- [ ] SSL Labs test passed (A or A+)
- [ ] Mixed content issues resolved
- [ ] Monitoring for expiration
- [ ] **Shopify App Store:** App URL and OAuth/webhook URLs use HTTPS (required for submission)

## Resources

- [Let's Encrypt](https://letsencrypt.org/)
- [Certbot Documentation](https://certbot.eff.org/)
- [SSL Labs](https://www.ssllabs.com/)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
