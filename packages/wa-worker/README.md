# wa-worker

Holds every store's linked WhatsApp session. A merchant links their own number
by scanning a QR code (WhatsApp → Settings → Linked devices), the way WhatsApp
Web is linked; this process keeps that session and sends and receives for them.

Built on [whatsmeow](https://github.com/tulir/whatsmeow), carried over from
Suyla's `wa-worker-go`. **This is not the official WhatsApp Business
Platform.** WhatsApp can restrict numbers that send automated messages; the
connect screens say so, and the worker's pacing and daily caps exist to keep a
merchant's number looking like a person uses it.

## How it fits

```
dashboard / Shopify app ──> API /api/integrations/whatsapp/{status,connect,disconnect}
                               │  (reads public.whatsapp_connections)
API + workers ──── /send ────> wa-worker ──── WhatsApp
                               │
API /internal/wa-worker/events <── inbound, own_message, receipt, connection
    └─> whatsapp_inbound_events -> inbound queue -> assistant (unchanged path)
```

- The worker never touches customers, orders or messages. It forwards events to
  the API, which owns them (and phone encryption — this process has no
  `ENCRYPTION_KEY`).
- An event the API cannot take (deploy, restart) is parked in
  `wa_session.recete_undelivered_events` and retried until it lands. whatsmeow
  has already acknowledged the message to WhatsApp, so dropping it would lose it.

## Differences from Suyla's worker

|                 | Suyla                                         | Recete                                                                   |
| --------------- | --------------------------------------------- | ------------------------------------------------------------------------ |
| Key             | `tenantId`                                    | `merchantId`                                                             |
| Writes          | customers / conversations / messages directly | only `whatsapp_connections`; everything else via the API                 |
| Events          | Inngest                                       | `POST /internal/wa-worker/events`, parked on failure                     |
| DB access       | service-level DSN                             | restricted role `recete_wa_worker`, session store in schema `wa_session` |
| Daily cap       | none                                          | business-initiated sends capped, warming up from first pairing (caps.go) |
| Recipient check | none                                          | phone numbers checked with `IsOnWhatsApp` before sending                 |
| Polls           | slot picker                                   | not used                                                                 |

Unchanged: QR pairing, reconnect backoff with a give-up ceiling, duplicate
number refusal, LID vs phone handling, humanized sending, own-phone replies,
delivery receipts.

## API

Loopback only. Every route but `/health` needs `x-wa-worker-secret`.

    GET  /health
    POST /connect     {merchantId}                      begin pairing / restore
    GET  /status      ?merchantId=
    POST /send        {merchantId, to, body, humanize}  -> {id, to}
    POST /disconnect  {merchantId}                      unlink on WhatsApp's side

`/send` answers 409 `not_connected`, 422 `not_on_whatsapp`, 429
`daily_cap_reached` with `retryAfterMs` (scheduled messages are deferred to the
reset, not failed), 502 `send_failed`.

## Daily caps

Business-initiated messages per UTC day, by days since the number was first
linked: 40 (day 0–2), 80 (3–6), 150 (7–13), 300 (14+). A message to a chat that
wrote in the last 24 hours is a reply and is not counted. A merchant's own
reply typed in the dashboard is neither paced nor counted.

## Setup (once)

1. Apply `supabase/migrations/046_whatsapp_linked_device.sql`.
2. Give the worker role a password (keep it out of the repo):

   ```sql
   alter role recete_wa_worker with login password '...';
   ```

3. Install Go on the server (`/usr/local/go`). The deploy workflow builds the
   binary when `go` is present and never fails a deploy on a Go build error.
4. Root `.env` on the server:

   ```
   WA_WORKER_SECRET=<random, 32+ bytes>
   WA_WORKER_URL=http://127.0.0.1:3005
   WA_LISTEN_ADDR=127.0.0.1:3005
   WA_PG_DSN=postgres://recete_wa_worker:<password>@<host>:5432/postgres?sslmode=require
   ```

   Use a direct or session-mode connection, not the transaction pooler. The
   role's `search_path` is `wa_session`, so whatsmeow's tables land there.
   Check the port is free first — this server also runs other projects.

5. Deploy. `ecosystem.config.cjs` adds the `wa-worker` PM2 app only once the
   binary exists and `WA_PG_DSN` / `WA_WORKER_SECRET` are set, then restart the
   API and workers so they pick up `WA_WORKER_URL`.

## Build and test locally

    go test ./...
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o wa-worker .

`WA_DEBUG=1` turns on whatsmeow's protocol log — the pairing handshake detail
all sits below INFO.
