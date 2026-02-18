# Analytics Dashboard

Monitor your Recete performance with comprehensive analytics and insights.

## Dashboard Overview

The Analytics dashboard provides:
- **Key Performance Indicators (KPIs)**
- **Charts and Graphs**
- **Trend Analysis**
- **Alerts and Notifications**

## Key Metrics

### Daily Active Users (DAU)

Number of unique customers who sent messages in the last 24 hours.

**What it tells you:**
- Customer engagement level
- Growth trends
- Peak activity times

### Message Volume

Total messages sent and received:
- **Incoming**: Customer messages
- **Outgoing**: AI responses
- **Total**: Combined volume

**What it tells you:**
- Conversation activity
- Response rate
- Customer satisfaction (more messages = engaged customers)

### Response Time

Average time for AI to generate and send a response.

**Target**: < 3 seconds

**What it tells you:**
- System performance
- Customer experience quality
- Need for optimization

### Sentiment Analysis

Overall customer sentiment:
- **Positive**: Happy, satisfied customers
- **Neutral**: Standard interactions
- **Negative**: Complaints, issues

**What it tells you:**
- Customer satisfaction
- Product/service issues
- Areas for improvement

### Intent Distribution

Breakdown of message intents:
- **Questions**: Product inquiries
- **Complaints**: Issues, problems
- **Chat**: General conversation
- **Opt-out**: Unsubscribe requests

**What it tells you:**
- Customer needs
- Common questions
- Complaint rate

## Charts and Visualizations

### Message Volume Over Time

Line chart showing:
- Daily message count
- Incoming vs outgoing
- Trends and patterns

**Use Cases:**
- Identify peak days
- Track growth
- Plan capacity

### Response Time Distribution

Histogram showing:
- Response time buckets (0-1s, 1-2s, 2-3s, etc.)
- Frequency of each bucket

**Use Cases:**
- Performance monitoring
- Identify slow responses
- Optimization targets

### Sentiment Trends

Line chart showing:
- Daily sentiment scores
- Positive/negative ratio
- Trend over time

**Use Cases:**
- Track satisfaction
- Identify issues early
- Measure improvements

### Intent Breakdown

Pie chart showing:
- Percentage of each intent type
- Distribution of customer needs

**Use Cases:**
- Understand customer behavior
- Plan content updates
- Improve product info

## Date Range Selection

Filter analytics by:
- **Today**: Last 24 hours
- **Last 7 Days**: Past week
- **Last 30 Days**: Past month
- **Custom Range**: Select start and end dates

## Exporting Data

### Export Analytics

1. Go to "Analytics"
2. Select date range
3. Click "Export"
4. Download CSV file

**Exported Data:**
- Daily metrics
- Message counts
- Response times
- Sentiment scores
- Intent distribution

## Alerts and Notifications

### Performance Alerts

You'll be notified when:
- **High Response Time**: Average > 5 seconds
- **Low Sentiment**: Negative sentiment > 30%
- **High Error Rate**: Errors > 5% of requests
- **Low Engagement**: DAU drops > 20%

### Business Alerts

You'll be notified when:
- **High Complaint Rate**: Complaints > 15% of messages
- **Escalation Spike**: Multiple escalations in short time
- **Opt-out Increase**: Opt-out rate increases significantly

## Using Analytics for Improvement

### 1. Identify Common Questions

**Action**: Review intent distribution
- If "Questions" is high → Update product info
- Add FAQ content
- Improve product descriptions

### 2. Monitor Response Quality

**Action**: Review sentiment trends
- If negative sentiment increases → Check AI responses
- Review escalated conversations
- Update bot persona

### 3. Optimize Performance

**Action**: Monitor response times
- If response time increases → Check system health
- Review RAG query performance
- Optimize embeddings

### 4. Track Growth

**Action**: Monitor DAU and message volume
- Track customer acquisition
- Measure engagement
- Plan scaling

## Best Practices

### 1. Review Daily

- Check dashboard every morning
- Review alerts immediately
- Track key metrics

### 2. Set Goals

- Define target metrics:
  - Response time < 3s
  - Positive sentiment > 70%
  - DAU growth > 10% month-over-month

### 3. Act on Insights

- Update product info based on questions
- Improve bot persona based on sentiment
- Optimize based on performance data

### 4. Share Reports

- Export weekly reports
- Share with team
- Track improvements

## Troubleshooting

### "No Data Showing"

**Possible Causes:**
- No conversations yet
- Date range too narrow
- Data processing delay

**Solutions:**
- Check if conversations exist
- Expand date range
- Wait a few minutes and refresh

### "Metrics Seem Incorrect"

**Possible Causes:**
- Data aggregation delay
- Timezone mismatch
- Filter applied

**Solutions:**
- Wait for data to update
- Check timezone settings
- Clear filters

---

## Need Help?

- **API Documentation**: `/api/docs`
- **Support**: support@recete.ai
