# Conversations

Conversations are the heart of Recete. View and manage all customer interactions via WhatsApp.

## Viewing Conversations

### Conversation List

Go to "Conversations" to see:
- **Customer Name**: From user database
- **Phone Number**: (masked for privacy)
- **Last Message**: Preview of most recent message
- **Status**: Active, Completed, Escalated
- **Last Updated**: Timestamp of last activity
- **Order Info**: Associated order (if any)

### Conversation Detail

Click on a conversation to see:
- **Full Chat History**: All messages (user and AI)
- **Customer Info**: Name, phone, order details
- **Conversation Metadata**: Started date, message count
- **AI Context**: Intent classification, RAG results (if applicable)

## Understanding Conversation Flow

### 1. Customer Sends Message

When a customer sends a WhatsApp message:
1. Message is received via webhook
2. Customer is identified (by phone number)
3. Conversation is created or retrieved
4. Message is added to conversation

### 2. AI Processing

The AI processes the message:
1. **Intent Classification**: Question, Complaint, Chat, Opt-out
2. **Guardrail Check**: Safety and content filtering
3. **RAG Retrieval**: If it's a question, search product knowledge base
4. **Response Generation**: Generate contextual response
5. **Guardrail Check**: Verify response is safe

### 3. Response Sent

AI response is sent via WhatsApp:
- Response is added to conversation
- Conversation state is updated
- Analytics are recorded

## Conversation States

### Active
- Recent activity (within 24 hours)
- Customer is engaged
- AI is responding

### Completed
- No activity for 7+ days
- Customer issue resolved
- Conversation archived

### Escalated
- Requires human intervention
- Crisis keywords detected
- Medical advice requested
- Unsafe content detected

## Message Types

### User Messages
- Customer questions
- Complaints
- General chat
- Opt-out requests

### AI Messages
- Product information
- Usage instructions
- Support responses
- Upsell suggestions

### System Messages
- Welcome messages
- Check-in messages (T+3, T+14)
- Scheduled messages

## Managing Conversations

### Search Conversations

Use the search bar to find:
- Customer name
- Phone number (partial)
- Order ID
- Message content

### Filter Conversations

Filter by:
- **Status**: Active, Completed, Escalated
- **Date Range**: Last 7 days, 30 days, All
- **Order**: Has order, No order

### Export Conversations

1. Go to "Conversations"
2. Apply filters (optional)
3. Click "Export"
4. Download CSV file

**Exported Data:**
- Conversation ID
- Customer info
- All messages
- Timestamps
- Order info

## Conversation Analytics

### Per Conversation

View metrics for each conversation:
- **Message Count**: Total messages
- **Response Time**: Average AI response time
- **Sentiment**: Positive, Neutral, Negative
- **Intent Distribution**: Questions vs complaints

### Aggregate Analytics

See overall metrics in "Analytics" dashboard:
- Total conversations
- Active conversations
- Average response time
- Customer satisfaction

## Escalation Handling

### When Conversations Escalate

Conversations escalate when:
- Crisis keywords detected (suicide, emergency, etc.)
- Medical advice requested
- Unsafe content in user message
- AI response blocked by guardrails

### Handling Escalated Conversations

1. **Review Conversation**: Read full chat history
2. **Contact Customer**: Reach out via WhatsApp or phone
3. **Resolve Issue**: Provide human support
4. **Mark as Resolved**: Update conversation status

### Escalation Alerts

You'll be notified when:
- New escalation occurs
- Escalation is unresolved for 24+ hours
- Multiple escalations from same customer

## Best Practices

### 1. Monitor Regularly

- Check conversations daily
- Review escalated conversations immediately
- Respond to human escalations promptly

### 2. Review AI Responses

- Spot-check AI responses for accuracy
- Provide feedback on incorrect responses
- Update product info if AI gives wrong answers

### 3. Handle Escalations

- Prioritize crisis escalations
- Respond within 1 hour
- Document resolution

### 4. Use Analytics

- Identify common questions
- Update product info based on questions
- Improve bot persona based on feedback

## Troubleshooting

### "Conversation Not Showing"

**Possible Causes:**
- Customer hasn't sent a message yet
- Phone number not in database
- Filter applied

**Solutions:**
- Check if customer exists in users table
- Verify phone number format
- Clear filters

### "Messages Not Appearing"

**Possible Causes:**
- Webhook not configured
- WhatsApp credentials invalid
- Message processing error

**Solutions:**
- Check WhatsApp webhook status
- Verify credentials in Settings
- Check error logs

### "AI Not Responding"

**Possible Causes:**
- WhatsApp credentials not configured
- AI service error
- Rate limit exceeded

**Solutions:**
- Verify WhatsApp setup
- Check API status
- Review rate limits

---

## Need Help?

- **API Documentation**: `/api/docs`
- **Support**: support@recete.co.uk
