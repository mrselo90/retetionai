# Uptime Monitoring Setup Guide

## Overview

Uptime monitoring ensures that your application is available and responding correctly. This guide covers setting up external uptime monitoring services.

## Recommended Services

### Option 1: UptimeRobot (Free Tier Available)
- **URL**: https://uptimerobot.com
- **Free Tier**: 50 monitors, 5-minute intervals
- **Features**: Email/SMS alerts, status pages

### Option 2: Pingdom (Paid)
- **URL**: https://www.pingdom.com
- **Features**: Advanced monitoring, detailed reports

### Option 3: Better Uptime (Open Source)
- **URL**: https://betteruptime.com
- **Free Tier**: 10 monitors, 1-minute intervals

## Setup Instructions

### 1. Monitor Endpoints

Set up monitors for the following endpoints:

#### API Health Check
- **URL**: `https://api.glowguide.ai/health`
- **Method**: GET
- **Expected Status**: 200
- **Expected Response**: `{"status":"ok","services":{"database":"connected","redis":"connected"}}`
- **Check Interval**: 1 minute

#### API Root
- **URL**: `https://api.glowguide.ai/`
- **Method**: GET
- **Expected Status**: 200
- **Check Interval**: 1 minute

#### Frontend Root
- **URL**: `https://app.glowguide.ai/`
- **Method**: GET
- **Expected Status**: 200
- **Check Interval**: 1 minute

### 2. Configure Alerts

#### Email Alerts
- **Trigger**: When endpoint is down
- **Recipients**: 
  - DevOps team
  - On-call engineer
  - Product manager

#### Slack Notifications
- **Webhook URL**: Configure in UptimeRobot/Pingdom
- **Channel**: #alerts or #devops
- **Format**: Include endpoint, status, timestamp

#### SMS Alerts (Critical Only)
- **Trigger**: When endpoint is down for > 5 minutes
- **Recipients**: On-call engineer phone number
- **Note**: Use sparingly to avoid alert fatigue

### 3. Status Page (Optional)

Create a public status page:
- **Service**: UptimeRobot Status Page, Better Uptime Status Page, or custom
- **URL**: `https://status.glowguide.ai`
- **Display**: 
  - API status
  - Frontend status
  - Historical uptime (99.9% target)
  - Incident history

### 4. Monitoring Best Practices

1. **Multiple Regions**: Monitor from different geographic locations
2. **Check Frequency**: 1 minute for critical endpoints
3. **Timeout**: 10 seconds
4. **Retry Logic**: 3 retries before alerting
5. **Maintenance Windows**: Schedule maintenance windows to avoid false alerts

### 5. Integration with Metrics

Combine uptime monitoring with:
- **Prometheus Metrics**: Track uptime percentage
- **Grafana Dashboards**: Visualize uptime trends
- **Alerting Rules**: Set up alerts based on metrics

## Example UptimeRobot Configuration

```
Monitor Name: GlowGuide API Health
Monitor Type: HTTP(s)
URL: https://api.glowguide.ai/health
Monitoring Interval: 5 minutes
Alert Contacts: 
  - Email: devops@glowguide.ai
  - SMS: +1234567890 (critical only)
```

## Testing

1. **Test Alerting**: Temporarily stop the API to verify alerts work
2. **Test Recovery**: Restart API and verify recovery notifications
3. **Test Maintenance Mode**: Use maintenance windows to avoid false alerts

## Notes

- Uptime monitoring is **external** to the application
- No code changes required (except health check endpoint, which already exists)
- Setup is done via external service dashboard
- This task is marked as "manual setup" in the task list
