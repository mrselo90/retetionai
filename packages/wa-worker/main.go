package main

import (
	"context"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	_ "github.com/lib/pq"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"
)

// wa-worker holds every merchant's linked WhatsApp session and exposes a small
// HTTP API to the Recete API (never to browsers; it listens on loopback):
//
//	GET  /health
//	POST /connect     {merchantId}                    begin pairing / restore
//	GET  /status      ?merchantId=
//	POST /send        {merchantId, to, body, humanize} -> {id}
//	POST /disconnect  {merchantId}
//	POST /media       {merchantId, media}               -> {mimeType, data}
//
// Every route but /health needs x-wa-worker-secret. The same secret signs the
// events the worker posts back to Recete (forward.go).

var mgr *manager

var digits = regexp.MustCompile(`[^0-9]`)

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func fail(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}

func secretGuard(secret string, next http.Handler) http.Handler {
	want := []byte(secret)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/health" {
			next.ServeHTTP(w, r)
			return
		}
		got := []byte(r.Header.Get("x-wa-worker-secret"))
		if subtle.ConstantTimeCompare(got, want) != 1 {
			fail(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Customer photos above this are not worth sending to a vision model.
const maxMediaBytes = 10 << 20

var merchantIDShape = regexp.MustCompile(`^[0-9a-fA-F-]{36}$`)

func decode(r *http.Request, v any) error {
	return json.NewDecoder(http.MaxBytesReader(nil, r.Body, 64<<10)).Decode(v)
}

// resolveRecipient turns `to` into a send target.
//
// A full JID (conversations may reply to an @lid) is used as given. A phone
// number is checked with WhatsApp first: Recete messages numbers taken from
// orders, and sending into numbers that are not on WhatsApp is both wasted and
// one more signal of a line that is not behaving like a person.
func resolveRecipient(ctx context.Context, s *session, to string) (types.JID, error) {
	if strings.Contains(to, "@") {
		jid, err := types.ParseJID(to)
		if err != nil {
			return types.JID{}, errBadRecipient
		}
		return jid, nil
	}
	num := digits.ReplaceAllString(to, "")
	if len(num) < 7 {
		return types.JID{}, errBadRecipient
	}
	res, err := s.client.IsOnWhatsApp(ctx, []string{"+" + num})
	if err != nil {
		return types.JID{}, err
	}
	if len(res) == 0 || !res[0].IsIn {
		return types.JID{}, errNotOnWhatsApp
	}
	return res[0].JID, nil
}

var (
	errBadRecipient  = errors.New("bad_recipient")
	errNotOnWhatsApp = errors.New("not_on_whatsapp")
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})))

	dsn := os.Getenv("WA_PG_DSN")
	secret := os.Getenv("WA_WORKER_SECRET")
	if dsn == "" || secret == "" || os.Getenv("RECETE_API_URL") == "" {
		slog.Error("WA_PG_DSN, WA_WORKER_SECRET and RECETE_API_URL are required")
		os.Exit(1)
	}
	addr := os.Getenv("WA_LISTEN_ADDR")
	if addr == "" {
		addr = "127.0.0.1:3005"
	}

	ctx := context.Background()
	if err := openDB(dsn); err != nil {
		slog.Error("postgres", "err", err)
		os.Exit(1)
	}
	if err := ensureOutbox(ctx); err != nil {
		slog.Error("undelivered-events table", "err", err)
		os.Exit(1)
	}
	if err := ensureCapsTable(ctx); err != nil {
		slog.Error("send-counts table", "err", err)
		os.Exit(1)
	}

	// whatsmeow keeps device state in its own whatsmeow_* tables. The DSN's
	// search_path puts them in wa_session, never in public (see db.go).
	// WA_DEBUG=1 turns on whatsmeow's protocol log: the pairing handshake detail
	// all sits below INFO, which is what you want when a scan fails.
	waLogger := waLog.Noop
	if os.Getenv("WA_DEBUG") == "1" {
		waLogger = waLog.Stdout("whatsmeow", "DEBUG", true)
	}
	container, err := sqlstore.New(ctx, "postgres", dsn, waLogger)
	if err != nil {
		slog.Error("whatsmeow store", "err", err)
		os.Exit(1)
	}

	mgr = newManager(container, waLogger)

	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, map[string]any{"ok": true, "engine": "whatsmeow"})
	})

	// Begin pairing, or bring a stored session back up. Poll /status for the QR.
	mux.HandleFunc("POST /connect", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			MerchantID string `json:"merchantId"`
		}
		if err := decode(r, &body); err != nil || !merchantIDShape.MatchString(body.MerchantID) {
			fail(w, 400, "merchantId required")
			return
		}
		// Detached from the request: pairing outlives this call.
		if err := mgr.Start(context.WithoutCancel(r.Context()), body.MerchantID, false); err != nil {
			slog.Error("connect", "merchant", body.MerchantID, "err", err)
			fail(w, 502, "connect_failed")
			return
		}
		writeJSON(w, 200, map[string]bool{"ok": true})
	})

	mux.HandleFunc("GET /status", func(w http.ResponseWriter, r *http.Request) {
		merchantID := r.URL.Query().Get("merchantId")
		if !merchantIDShape.MatchString(merchantID) {
			fail(w, 400, "merchantId required")
			return
		}
		row, err := getConnection(r.Context(), merchantID)
		if err != nil {
			fail(w, 500, "status_unavailable")
			return
		}
		if row == nil {
			writeJSON(w, 200, map[string]any{"status": "disconnected", "live": false})
			return
		}
		writeJSON(w, 200, map[string]any{
			"status": row.Status, "phone_e164": row.PhoneE164, "qr": row.QR,
			"connected_at": row.ConnectedAt, "last_error": row.LastError,
			// The row can say "connected" while this process is restarting;
			// live is what the send path actually checks.
			"live": mgr.isConnected(merchantID),
		})
	})

	mux.HandleFunc("POST /send", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			MerchantID string `json:"merchantId"`
			To         string `json:"to"`
			Body       string `json:"body"`
			// Automated sends (assistant replies, scheduled messages) pace like a
			// person and count against the daily cap. A merchant's own typed
			// reply from the dashboard does neither.
			Humanize bool `json:"humanize"`
		}
		if err := decode(r, &body); err != nil ||
			!merchantIDShape.MatchString(body.MerchantID) || body.To == "" || strings.TrimSpace(body.Body) == "" {
			fail(w, 400, "merchantId, to, body required")
			return
		}
		if !mgr.isConnected(body.MerchantID) {
			fail(w, 409, "not_connected")
			return
		}
		sess := mgr.get(body.MerchantID)
		if sess == nil {
			fail(w, 409, "not_connected")
			return
		}
		ctx := r.Context()

		jid, err := resolveRecipient(ctx, sess, body.To)
		switch {
		case errors.Is(err, errNotOnWhatsApp):
			fail(w, 422, "not_on_whatsapp")
			return
		case errors.Is(err, errBadRecipient):
			fail(w, 400, "bad_recipient")
			return
		case err != nil:
			slog.Warn("recipient lookup", "merchant", body.MerchantID, "err", err)
			fail(w, 503, "lookup_failed")
			return
		}

		counted := body.Humanize && !isReply(body.MerchantID, jid.User)
		if counted {
			if err := reserveSend(ctx, body.MerchantID); err != nil {
				if errors.Is(err, errCapReached) {
					writeJSON(w, 429, map[string]any{
						"error":        "daily_cap_reached",
						"retryAfterMs": untilUTCMidnight(time.Now().UTC()).Milliseconds(),
					})
					return
				}
				slog.Error("reserve send", "merchant", body.MerchantID, "err", err)
				fail(w, 503, "cap_unavailable")
				return
			}
		}

		var msgID string
		if body.Humanize {
			msgID, err = sess.sendHumanized(ctx, jid, body.Body)
		} else {
			resp, sendErr := sess.client.SendMessage(ctx, jid, &waE2E.Message{Conversation: &body.Body})
			msgID, err = resp.ID, sendErr
		}
		if err != nil {
			if counted {
				releaseSend(context.WithoutCancel(ctx), body.MerchantID)
			}
			slog.Error("send", "merchant", body.MerchantID, "err", err)
			fail(w, 502, "send_failed")
			return
		}
		writeJSON(w, 200, map[string]any{"ok": true, "id": msgID, "to": jid.String()})
	})

	// Fetch and decrypt a customer's image for AI vision. `media` is the
	// serialized ImageMessage from the inbound event; the bytes come straight
	// from WhatsApp's CDN and are returned, never written anywhere.
	mux.HandleFunc("POST /media", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			MerchantID string `json:"merchantId"`
			Media      string `json:"media"`
		}
		if err := decode(r, &body); err != nil || !merchantIDShape.MatchString(body.MerchantID) || body.Media == "" {
			fail(w, 400, "merchantId, media required")
			return
		}
		raw, err := base64.StdEncoding.DecodeString(body.Media)
		img := &waE2E.ImageMessage{}
		if err != nil || proto.Unmarshal(raw, img) != nil || img.GetDirectPath() == "" {
			fail(w, 400, "bad_media")
			return
		}
		if img.GetFileLength() > maxMediaBytes {
			fail(w, 413, "too_large")
			return
		}
		sess := mgr.get(body.MerchantID)
		if sess == nil || !mgr.isConnected(body.MerchantID) {
			fail(w, 409, "not_connected")
			return
		}
		data, err := sess.client.Download(r.Context(), img)
		if err != nil {
			slog.Warn("media download", "merchant", body.MerchantID, "err", err)
			// Expired or deleted on WhatsApp's side: retrying will not help.
			fail(w, 410, "media_unavailable")
			return
		}
		mime := img.GetMimetype()
		if mime == "" {
			mime = "image/jpeg"
		}
		writeJSON(w, 200, map[string]any{"mimeType": mime, "data": base64.StdEncoding.EncodeToString(data)})
	})

	mux.HandleFunc("POST /disconnect", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			MerchantID string `json:"merchantId"`
		}
		if err := decode(r, &body); err != nil || !merchantIDShape.MatchString(body.MerchantID) {
			fail(w, 400, "merchantId required")
			return
		}
		mgr.Logout(context.WithoutCancel(r.Context()), body.MerchantID)
		writeJSON(w, 200, map[string]bool{"ok": true})
	})

	go mgr.Restore(ctx)
	go replayLoop(ctx)

	srv := &http.Server{
		Addr:              addr,
		Handler:           secretGuard(secret, mux),
		ReadHeaderTimeout: 10 * time.Second,
		// No WriteTimeout: humanized sends queue per merchant and "type" for
		// seconds each. Cutting the response after WhatsApp accepted a message
		// would make the caller retry a message that already went out.
	}
	slog.Info("wa-worker listening", "addr", addr)
	if err := srv.ListenAndServe(); err != nil {
		slog.Error("http server", "err", err)
		os.Exit(1)
	}
}
