# Troubleshooting Guide

Common issues and solutions for GlowGuide setup and usage.

## Account & Authentication

### "Email Not Confirmed"

**Problem**: Can't login, email confirmation required.

**Solutions:**
1. Check your email inbox (and spam folder)
2. Click the confirmation link
3. If link expired, request new confirmation email
4. Contact support if still not working

### "Invalid Login Credentials"

**Problem**: Login fails with "Invalid credentials".

**Solutions:**
1. Verify email and password are correct
2. Check for typos
3. Try password reset
4. Ensure email is confirmed

### "API Key Not Working"

**Problem**: API calls fail with 401 Unauthorized.

**Solutions:**
1. Verify API key is correct (starts with `gg_live_`)
2. Check API key hasn't expired
3. Verify API key is in `X-Api-Key` header
4. Rotate API key if needed

---

## Integration Issues

### "Shopify Integration Not Syncing"

**Problem**: Orders not appearing in GlowGuide.

**Checklist:**
- ✅ Integration status is "Active"
- ✅ Webhooks are configured in Shopify
- ✅ OAuth token hasn't expired
- ✅ Webhook URL is correct

**Solutions:**
1. Go to "Integrations" → "Shopify"
2. Check integration status
3. Click "Reconnect" if needed
4. Verify webhooks in Shopify Admin → Settings → Notifications
5. Check webhook delivery logs

### "CSV Import Failed"

**Problem**: CSV upload fails or shows errors.

**Common Issues:**
- **Invalid format**: Check CSV has required columns
- **Phone number format**: Must be E.164 (+905551234567)
- **Date format**: Must be ISO (YYYY-MM-DD)
- **File too large**: Max 10,000 rows

**Solutions:**
1. Verify CSV format matches template
2. Check phone numbers are in E.164 format
3. Verify dates are correct format
4. Split large files into smaller batches

### "API Events Not Processing"

**Problem**: Events sent via API aren't being processed.

**Checklist:**
- ✅ API key is valid
- ✅ Request format is correct
- ✅ Rate limits not exceeded
- ✅ Server is responding

**Solutions:**
1. Verify API key in request header
2. Check request body format
3. Check rate limit headers in response
4. Verify endpoint URL is correct
5. Check server logs for errors

---

## Product Issues

### "Scraping Failed"

**Problem**: Product scraping returns error.

**Common Causes:**
- Product page not accessible
- Page requires authentication
- Page is blocked
- Network timeout

**Solutions:**
1. **Verify URL is accessible**: Open in browser
2. **Check authentication**: Ensure page is public
3. **Check robots.txt**: Verify page isn't blocked
4. **Try again**: Wait a few minutes and retry
5. **Manual entry**: Enter product info manually if scraping fails

### "Embeddings Generation Failed"

**Problem**: Can't generate embeddings for product.

**Common Causes:**
- No scraped content available
- Content is too short
- OpenAI API error
- Rate limit exceeded

**Solutions:**
1. **Scrape first**: Ensure product has scraped content
2. **Check content**: Verify content is meaningful
3. **Check API key**: Verify OpenAI key is valid
4. **Wait and retry**: If rate limited, wait and try again
5. **Contact support**: If issue persists

### "Product Not in AI Responses"

**Problem**: AI doesn't mention product when asked.

**Possible Causes:**
- Embeddings not generated
- Product not linked to order
- Similarity threshold too high
- Product info incomplete

**Solutions:**
1. **Generate embeddings**: Ensure embeddings are created
2. **Link to order**: Verify product is in customer's order
3. **Check product info**: Ensure product has complete information
4. **Lower threshold**: Adjust RAG similarity threshold (if configurable)

---

## WhatsApp Issues

### "Messages Not Received"

**Problem**: Customer messages not appearing in GlowGuide.

**Checklist:**
- ✅ Webhook is configured in Meta
- ✅ Webhook is verified
- ✅ Credentials are correct
- ✅ Webhook URL is accessible

**Solutions:**
1. **Check webhook status**: Meta Developers → Webhooks
2. **Verify webhook URL**: Should be `https://api.glowguide.ai/webhooks/whatsapp`
3. **Check credentials**: Verify access token and phone number ID
4. **Test webhook**: Send test message and check delivery
5. **Check server logs**: Review error logs for issues

### "AI Not Responding"

**Problem**: AI doesn't respond to customer messages.

**Checklist:**
- ✅ WhatsApp credentials are set
- ✅ Product embeddings are generated
- ✅ API status is healthy
- ✅ Rate limits not exceeded

**Solutions:**
1. **Check credentials**: Verify WhatsApp setup in Settings
2. **Check products**: Ensure products have embeddings
3. **Check API status**: Visit `/health` endpoint
4. **Check rate limits**: Verify not exceeding limits
5. **Review logs**: Check error logs for details

### "Webhook Verification Failed"

**Problem**: Can't verify webhook in Meta.

**Solutions:**
1. **Verify token matches**: Check token in both places
2. **Check webhook URL**: Ensure URL is correct
3. **Check server**: Ensure server is running
4. **Check firewall**: Verify server is accessible
5. **Try again**: Sometimes Meta needs a few attempts

---

## Performance Issues

### "Slow Response Times"

**Problem**: AI responses take too long (> 5 seconds).

**Possible Causes:**
- High load
- Database slow
- RAG query taking time
- Network issues

**Solutions:**
1. **Check system load**: Monitor server resources
2. **Check database**: Verify database performance
3. **Optimize RAG**: Reduce similarity threshold or limit results
4. **Check network**: Verify network connectivity
5. **Scale up**: Consider scaling if consistently slow

### "High Error Rate"

**Problem**: Many requests failing.

**Checklist:**
- ✅ API status is healthy
- ✅ Database is connected
- ✅ Redis is connected
- ✅ External APIs are working

**Solutions:**
1. **Check health**: Visit `/health` endpoint
2. **Check logs**: Review error logs
3. **Check dependencies**: Verify external services
4. **Restart services**: If needed, restart API/workers
5. **Contact support**: If issue persists

---

## Data Issues

### "Conversations Not Showing"

**Problem**: Can't see conversations in dashboard.

**Possible Causes:**
- No messages received yet
- Phone number not in database
- Filter applied
- Data processing delay

**Solutions:**
1. **Check if messages exist**: Verify messages were received
2. **Check phone number**: Ensure customer exists
3. **Clear filters**: Remove any applied filters
4. **Wait a moment**: Data may be processing
5. **Refresh page**: Try refreshing the dashboard

### "Orders Not Syncing"

**Problem**: Orders from store not appearing.

**Checklist:**
- ✅ Integration is active
- ✅ Webhooks are configured
- ✅ Events are being sent
- ✅ Data format is correct

**Solutions:**
1. **Check integration**: Verify integration status
2. **Check webhooks**: Verify webhooks are active
3. **Check events**: Verify events are being sent
4. **Check format**: Verify event format is correct
5. **Check logs**: Review processing logs

---

## Billing & Limits

### "Rate Limit Exceeded"

**Problem**: Getting 429 Too Many Requests errors.

**Limits:**
- IP: 100 requests/minute
- API Key: 1000 requests/hour
- Merchant: 5000 requests/hour

**Solutions:**
1. **Wait**: Rate limits reset automatically
2. **Check headers**: Review `X-RateLimit-Reset` header
3. **Optimize requests**: Reduce request frequency
4. **Upgrade plan**: Higher plans have higher limits

### "Usage Limit Reached"

**Problem**: Hit monthly usage limit.

**Solutions:**
1. **Check usage**: View usage in Settings → Billing
2. **Upgrade plan**: Move to higher tier
3. **Wait for reset**: Limits reset monthly
4. **Contact sales**: For custom limits

---

## General Issues

### "Page Not Loading"

**Problem**: Dashboard or pages not loading.

**Solutions:**
1. **Refresh page**: Try hard refresh (Cmd+Shift+R)
2. **Clear cache**: Clear browser cache
3. **Check internet**: Verify internet connection
4. **Try different browser**: Test in another browser
5. **Check status**: Visit status page

### "Feature Not Working"

**Problem**: Specific feature not functioning.

**Solutions:**
1. **Check documentation**: Review relevant guide
2. **Check prerequisites**: Ensure all requirements met
3. **Check browser console**: Look for JavaScript errors
4. **Try again**: Sometimes temporary issues
5. **Contact support**: If issue persists

---

## Getting Help

### Self-Service Resources

1. **Documentation**: Browse guides in docs/
2. **API Docs**: Visit `/api/docs`
3. **FAQ**: See docs/user-guide/faq.md

### Contact Support

- **Email**: support@glowguide.ai
- **Response Time**: 
  - Free: 48 hours
  - Pro: 24 hours
  - Enterprise: 4 hours

### Provide Information

When contacting support, include:
- **Error message**: Exact error text
- **Steps to reproduce**: What you did
- **Expected behavior**: What should happen
- **Screenshots**: If applicable
- **Account info**: Email (not password!)

---

## Still Need Help?

- **Status Page**: status.glowguide.ai
- **Support**: support@glowguide.ai
- **Documentation**: Browse all guides
