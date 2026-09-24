# WhatsApp: connecting merchant numbers (Meta Embedded Signup)

Every store sends from its **own** WhatsApp Business number. There is no shared
Recete number. A merchant connects their number from **Integrations** (web
dashboard) or **Integrations** in the Shopify app: a Facebook window opens, they
pick or create their WhatsApp Business account and number, and Recete stores the
connection. Numbers already used in the WhatsApp Business app can be moved over
("I already use this number in the WhatsApp Business app"); the merchant confirms
with a QR code in the app and keeps using it.

Until the environment variables below are set, both screens show the connection
as **Coming soon**, the setup checklist leaves the step out, and no WhatsApp
messages can be sent.

## What has to exist on Meta's side (owner)

1. A Meta business portfolio for Recete Ltd, **business-verified**.
2. A Meta app (type _Business_) with the **WhatsApp** product added.
3. Recete registered as a **Tech Provider** for WhatsApp, and App Review approval
   for `whatsapp_business_management` and `whatsapp_business_messaging`.
   Until approved, only accounts with a role on the app can complete signup.
4. **Facebook Login for Business** → _Configurations_ → a configuration of type
   _WhatsApp Embedded Signup_. Its id is `META_EMBEDDED_SIGNUP_CONFIG_ID`.
5. **Allowed domains** for the JavaScript SDK: `recete.co.uk` and
   `shop.recete.co.uk` (the Shopify app runs there).
6. WhatsApp → _Configuration_ → **Webhook**:
   - Callback URL: `https://recete.co.uk/webhooks/whatsapp`
   - Verify token: the value of `META_WEBHOOK_VERIFY_TOKEN`
   - Subscribe to the `messages` field.
7. Coexistence (numbers already in the WhatsApp Business app) must be available
   for the app and the merchant's country.

## Environment (packages/api/.env on the server)

| Variable                         | What it is                                                                       |
| -------------------------------- | -------------------------------------------------------------------------------- |
| `META_APP_ID`                    | The Meta app id (public; sent to the browser).                                   |
| `META_APP_SECRET`                | App secret. Exchanges signup codes and verifies webhook signatures. Server only. |
| `META_EMBEDDED_SIGNUP_CONFIG_ID` | The Embedded Signup configuration id (public).                                   |
| `META_WEBHOOK_VERIFY_TOKEN`      | Any long random string; also entered in the Meta webhook settings.               |
| `META_GRAPH_VERSION`             | Optional, default `v21.0`.                                                       |

`ENCRYPTION_KEY` must be set (it already is): merchant access tokens are stored
encrypted with it. Never change it — stored tokens would become unreadable.

After setting them, restart with the deploy's command:
`pm2 startOrRestart ecosystem.config.cjs --update-env`.

## What happens on connect

`POST /api/integrations/whatsapp/embedded-signup` (packages/api/src/routes/whatsappConnect.ts):

1. Exchange the one-time code for a business token (app secret).
2. Read the phone number with that token (proves access; gets the display number).
3. Subscribe the app to the WhatsApp Business Account's webhooks.
4. Register the number for Cloud API (skipped for numbers moved from the app).
5. Store `auth_data` on the store's `integrations` row (provider `whatsapp`),
   token encrypted. One number can belong to one store only.

Sending and receiving live in `packages/shared/src/whatsappCloud.ts`.

## Known gap: messages outside the 24-hour window

WhatsApp only allows free-form messages within 24 hours of the customer's last
message. The welcome and check-in messages are sent later, so they need
**approved message templates** in each merchant's WhatsApp Business Account.
Template creation and sending are not implemented yet: until they are, those
scheduled messages fail with Meta error 131047 and are not retried. Replies to
customers who write in work normally.
