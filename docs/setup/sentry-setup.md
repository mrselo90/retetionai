# Sentry Error Tracking Setup Guide

## Overview

This guide explains how to set up Sentry for error tracking and monitoring in the GlowGuide Retention Agent.

## Why Sentry?

- Real-time error tracking
- Performance monitoring
- Release tracking
- User feedback
- Integration with deployment pipelines

## Setup Steps

### 1. Create a Sentry Account

1. Go to [sentry.io](https://sentry.io/)
2. Sign up for a free account
3. Create a new organization (or use existing)

### 2. Create a Project

1. Click "Projects" → "Create Project"
2. Select platform: **Node.js**
3. Set alert frequency: **On every new issue**
4. Name your project: "glowguide-retention-agent"
5. Click "Create Project"

### 3. Get Your DSN

After creating the project, you'll see your DSN (Data Source Name):

```
https://[key]@[organization].ingest.sentry.io/[project-id]
```

Copy this DSN - you'll need it for configuration.

### 4. Configure Environment Variable

Add to your `.env` file:

```bash
SENTRY_DSN=https://your-dsn-here
```

### 5. Verify Integration

The application is already configured to use Sentry. To verify:

1. Start the application
2. Trigger an error (e.g., invalid API request)
3. Check Sentry dashboard for the error

## Features Enabled

### Error Tracking

All unhandled errors are automatically sent to Sentry with:
- Stack traces
- Request context
- User information (if available)
- Environment details

### Performance Monitoring

Transaction tracking for:
- API requests
- Database queries
- External API calls
- Background jobs

### Release Tracking

Errors are tagged with:
- Release version
- Environment (development, staging, production)
- Git commit SHA

## Configuration

### Environment-Specific Settings

**Development**:
- Sample rate: 100% (all errors)
- Traces sample rate: 10% (performance)
- Debug mode: enabled

**Production**:
- Sample rate: 100% (all errors)
- Traces sample rate: 10% (performance)
- Debug mode: disabled

### Custom Tags

Errors are tagged with:
- `merchant_id`: Merchant identifier
- `user_id`: User identifier (if available)
- `conversation_id`: Conversation identifier (if available)
- `environment`: deployment environment

## Best Practices

### 1. Set Up Alerts

Configure alerts for:
- New issues
- Regression (previously resolved issues)
- High error rate
- Performance degradation

### 2. Create Releases

Tag errors with releases:

```bash
# Create a release
sentry-cli releases new "v1.0.0"

# Associate commits
sentry-cli releases set-commits "v1.0.0" --auto

# Finalize release
sentry-cli releases finalize "v1.0.0"
```

### 3. Source Maps

For better stack traces, upload source maps:

```bash
sentry-cli sourcemaps upload --release "v1.0.0" ./dist
```

### 4. User Feedback

Enable user feedback widget for production:

```typescript
Sentry.showReportDialog({
  eventId: event.event_id,
  user: {
    email: user.email,
    name: user.name,
  },
});
```

## Monitoring Dashboard

### Key Metrics to Monitor

1. **Error Rate**: Errors per minute/hour
2. **Affected Users**: Number of users experiencing errors
3. **Crash-Free Sessions**: Percentage of sessions without crashes
4. **Response Time**: API response time percentiles

### Setting Up Dashboards

1. Go to Dashboards → Create Dashboard
2. Add widgets for:
   - Error frequency
   - Most common errors
   - Errors by endpoint
   - Performance metrics

## Troubleshooting

### Errors Not Appearing

- Verify DSN is correct
- Check network connectivity
- Ensure Sentry is initialized before errors occur
- Check sample rate configuration

### Too Many Errors

- Adjust sample rate
- Set up error filtering
- Use `beforeSend` hook to filter errors

### Performance Issues

- Reduce traces sample rate
- Disable performance monitoring in development
- Use selective instrumentation

## Integration with CI/CD

### GitHub Actions

```yaml
- name: Create Sentry Release
  uses: getsentry/action-release@v1
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    SENTRY_ORG: your-org
    SENTRY_PROJECT: glowguide-retention-agent
  with:
    environment: production
```

### Deployment Notifications

Notify Sentry of deployments:

```bash
sentry-cli releases deploys "v1.0.0" new -e production
```

## Resources

- [Sentry Documentation](https://docs.sentry.io/)
- [Node.js SDK](https://docs.sentry.io/platforms/node/)
- [Performance Monitoring](https://docs.sentry.io/product/performance/)
- [Releases](https://docs.sentry.io/product/releases/)

## Support

For issues with Sentry:
- [Sentry Support](https://sentry.io/support/)
- [Community Forum](https://forum.sentry.io/)
- [GitHub Issues](https://github.com/getsentry/sentry)
