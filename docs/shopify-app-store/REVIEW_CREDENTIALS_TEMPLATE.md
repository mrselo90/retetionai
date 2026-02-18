# Shopify App Store — Review Credentials Template

Fill this in and use it when submitting the app for review (paste into the submission form or attach as notes). Do **not** commit real passwords or tokens to the repo; keep a local or secure copy.

---

## Development Store

| Field | Value |
|-------|--------|
| **Store URL** | `https://_______________.myshopify.com` |
| **Admin login** | Email: _______________ |
| **Admin password** | _______________ (or “Use test account instructions below”) |

*(Shopify may provide a standard test store; if so, use that and note it in review notes.)*

---

## App Access (for reviewers)

- [ ] App is installed on the store above
- [ ] App URL (HTTPS): _______________
- [ ] Reviewers can open the app from Shopify Admin → Apps → Recete Retention Agent

---

## WhatsApp / Test Mode

The app can send WhatsApp messages for T+0 and conversations. For review, choose one:

**Option A — Test WhatsApp**
- [ ] Test WhatsApp Business number/credentials provided: _______________
- [ ] Instructions for reviewer: _______________

**Option B — Test mode / no WhatsApp**
- [ ] App supports “test mode” or demo without live WhatsApp; describe in review notes: _______________

---

## Review Notes (short description for reviewers)

Suggested text to paste in submission:

```
Recete Retention Agent provides post-purchase WhatsApp support and AI conversations.

Key flows to test:
1. Install: OAuth completes and app opens in Admin.
2. Product mapping: Go to Products → Shopify map; sync products and add usage instructions to at least one product.
3. Webhook/T+0: Fulfill a test order for a customer with marketing consent; webhook is received and T+0 welcome can be sent (if WhatsApp is configured or in test mode).
4. Billing: Settings → upgrade plan; approve charge in Shopify; confirm plan updates. Optional: enable Return Prevention add-on and approve separate charge.
5. Conversations: View Conversations list and a conversation detail (data may be empty in a fresh store).

Support: support@recete.ai
```

---

## Checklist before submit

- [ ] Dev store URL and admin access filled (or test store noted)
- [ ] WhatsApp option chosen and instructions clear for reviewers
- [ ] Review notes pasted into submission form
- [ ] No real customer data or production credentials in the template
