package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"
)

// Event is everything the worker reports to Recete. The worker owns the
// WhatsApp session and nothing else: which customer this is, which order, what
// the assistant should say — all of that is Recete's, behind its API.
type Event struct {
	// inbound | own_message | receipt | connection
	Type       string `json:"type"`
	MerchantID string `json:"merchantId"`

	// inbound / own_message
	MessageID string  `json:"messageId,omitempty"`
	Phone     *string `json:"phone,omitempty"`
	LID       *string `json:"lid,omitempty"`
	// The exact JID WhatsApp used for the chat, which may be an @lid. Replies go
	// back to this, not to a reconstructed number.
	ChatJID   string `json:"chatJid,omitempty"`
	PushName  string `json:"pushName,omitempty"`
	Body      string `json:"body,omitempty"`
	Timestamp string `json:"timestamp,omitempty"`

	// inbound: "text" or "image". For an image, Body is the caption (may be
	// empty) and Media is the serialized ImageMessage — the keys to fetch and
	// decrypt it later through POST /media. The image itself is never stored.
	MessageType string `json:"messageType,omitempty"`
	Media       string `json:"media,omitempty"`
	MimeType    string `json:"mimeType,omitempty"`

	// receipt
	MessageIDs []string `json:"messageIds,omitempty"`

	// receipt (delivered/read) or connection (connected/disconnected/logged_out)
	Status    string  `json:"status,omitempty"`
	LastError *string `json:"lastError,omitempty"`
}

var httpClient = &http.Client{Timeout: 10 * time.Second}

func eventsURL() string {
	base := strings.TrimRight(os.Getenv("RECETE_API_URL"), "/")
	return base + "/internal/wa-worker/events"
}

// postEvent delivers one event. Any non-2xx is a failure worth retrying; Recete
// is idempotent on (merchant, messageId), so a retry of something it already
// stored is harmless.
func postEvent(ctx context.Context, payload []byte) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, eventsURL(), bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("content-type", "application/json")
	// One shared secret, both directions (see main.go).
	req.Header.Set("x-wa-worker-secret", os.Getenv("WA_WORKER_SECRET"))
	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return fmt.Errorf("recete answered %d", resp.StatusCode)
	}
	return nil
}

// forward delivers an event now, or parks it to be retried.
//
// whatsmeow has already acknowledged the message to WhatsApp by the time we see
// it, and will not redeliver. If Recete is down at that moment — a deploy, a
// restart — the message exists only in this process. Dropping it would leave a
// customer who wrote to the store without an answer, with nothing anywhere to
// show they ever wrote. So a failed delivery goes to disk, not to the log.
func forward(ev Event) {
	payload, err := json.Marshal(ev)
	if err != nil {
		slog.Error("forward: marshal", "type", ev.Type, "err", err)
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 12*time.Second)
	defer cancel()
	if err := postEvent(ctx, payload); err == nil {
		return
	} else {
		slog.Warn("forward failed, parking for retry", "type", ev.Type, "merchant", ev.MerchantID, "err", err)
	}
	if _, err := db.ExecContext(context.Background(),
		`insert into recete_undelivered_events (merchant_id, event_type, payload)
		 values ($1, $2, $3)`, ev.MerchantID, ev.Type, payload); err != nil {
		// The one case that does lose the event. Loud, with the payload, so it
		// can at least be replayed by hand.
		slog.Error("forward: could not park event", "type", ev.Type, "merchant", ev.MerchantID,
			"err", err, "payload", string(payload))
	}
}

// ensureOutbox creates the retry table in the worker's own schema. It lives
// next to whatsmeow's tables, where this role has rights, and never in public.
func ensureOutbox(ctx context.Context) error {
	_, err := db.ExecContext(ctx, `
		create table if not exists recete_undelivered_events (
		  id              bigserial primary key,
		  merchant_id     text not null,
		  event_type      text not null,
		  payload         jsonb not null,
		  attempts        int not null default 0,
		  next_attempt_at timestamptz not null default now(),
		  last_error      text,
		  created_at      timestamptz not null default now()
		);
		create index if not exists recete_undelivered_events_due
		  on recete_undelivered_events (next_attempt_at);`)
	return err
}

// replayLoop retries parked events until they land.
//
// Never gives up and never deletes an undelivered event: a parked inbound
// message is a customer waiting for an answer. Backoff tops out at ten minutes;
// past a day of attempts it logs at error on every try so it cannot go unseen.
func replayLoop(ctx context.Context) {
	t := time.NewTicker(15 * time.Second)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			replayDue(ctx)
		}
	}
}

func replayDue(ctx context.Context) {
	rows, err := db.QueryContext(ctx,
		`select id, event_type, merchant_id, payload, attempts, created_at
		   from recete_undelivered_events
		  where next_attempt_at <= now()
		  order by id
		  limit 50`)
	if err != nil {
		slog.Error("replay: query", "err", err)
		return
	}
	type parked struct {
		id        int64
		typ, mID  string
		payload   []byte
		attempts  int
		createdAt time.Time
	}
	var due []parked
	for rows.Next() {
		var p parked
		if err := rows.Scan(&p.id, &p.typ, &p.mID, &p.payload, &p.attempts, &p.createdAt); err != nil {
			slog.Error("replay: scan", "err", err)
			continue
		}
		due = append(due, p)
	}
	rows.Close()

	for _, p := range due {
		sendCtx, cancel := context.WithTimeout(ctx, 12*time.Second)
		err := postEvent(sendCtx, p.payload)
		cancel()
		if err == nil {
			_, _ = db.ExecContext(ctx, `delete from recete_undelivered_events where id = $1`, p.id)
			slog.Info("replayed parked event", "type", p.typ, "merchant", p.mID, "attempts", p.attempts+1)
			continue
		}
		n := p.attempts + 1
		wait := time.Duration(1<<min(n, 6)) * 10 * time.Second // 20s .. ~10m
		if wait > 10*time.Minute {
			wait = 10 * time.Minute
		}
		msg := err.Error()
		_, _ = db.ExecContext(ctx,
			`update recete_undelivered_events
			    set attempts = $2, next_attempt_at = now() + $3::interval, last_error = $4
			  where id = $1`, p.id, n, fmt.Sprintf("%d seconds", int(wait.Seconds())), msg)
		if time.Since(p.createdAt) > 24*time.Hour {
			slog.Error("parked event still undelivered after a day", "type", p.typ, "merchant", p.mID,
				"attempts", n, "err", msg)
		}
	}
}
