package main

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"sync"
	"time"

	qrcode "github.com/skip2/go-qrcode"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"
)

// Session lifecycle, carried over from Suyla's worker with tenants renamed to
// merchants. What changed is where events go: Suyla wrote customers and
// messages straight into its own tables; here every message is forwarded to the
// Recete API (forward.go), which owns customers, orders and the assistant.

type session struct {
	client     *whatsmeow.Client
	merchantID string
	cancelQR   context.CancelFunc
}

type manager struct {
	mu        sync.Mutex
	container *sqlstore.Container
	sessions  map[string]*session
	// Reconnect attempts since the last successful connect, per merchant.
	attempts map[string]int
	// Pending backoff timers, so a connect the merchant asked for pre-empts one.
	timers map[string]*time.Timer
	log    waLog.Logger
}

const (
	maxRetries   = 8
	baseRetry    = 2 * time.Second
	maxRetryWait = 60 * time.Second
)

func newManager(container *sqlstore.Container, log waLog.Logger) *manager {
	return &manager{
		container: container,
		sessions:  map[string]*session{},
		attempts:  map[string]int{},
		timers:    map[string]*time.Timer{},
		log:       log,
	}
}

// setStatus writes connection state and logs a failure instead of dropping it:
// a row stuck on "qr" after the phone paired is exactly the kind of thing that
// is otherwise impossible to explain later.
func setStatus(ctx context.Context, merchantID string, p connPatch) {
	if err := setConnectionStatus(ctx, merchantID, p); err != nil {
		slog.Error("write connection status", "merchant", merchantID, "err", err)
	}
}

func (m *manager) isConnected(merchantID string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	s := m.sessions[merchantID]
	return s != nil && s.client.IsConnected() && s.client.IsLoggedIn()
}

func (m *manager) get(merchantID string) *session {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.sessions[merchantID]
}

func (m *manager) cancelRetry(merchantID string) {
	if t := m.timers[merchantID]; t != nil {
		t.Stop()
		delete(m.timers, merchantID)
	}
}

// Start brings a merchant's session up. Idempotent.
//
// `retry` marks an automatic reconnect: those must not reset the attempt counter,
// or the backoff never escalates and the give-up ceiling is never reached. A
// connect the merchant asked for does reset it, and cancels any pending backoff
// so the button responds instead of waiting out a 60s timer.
//
// Suyla's first worker retried every close every 2 seconds forever; with
// credentials WhatsApp had rejected, two tenants looped for days and pinned a
// 1-vCPU box. This shape is what fixed it.
func (m *manager) Start(ctx context.Context, merchantID string, retry bool) error {
	m.mu.Lock()
	if !retry {
		m.cancelRetry(merchantID)
		delete(m.attempts, merchantID)
	}
	if existing := m.sessions[merchantID]; existing != nil {
		m.mu.Unlock()
		// Already up, or mid-pairing: nothing to do.
		if existing.client.IsConnected() {
			return nil
		}
		m.stop(merchantID)
	} else {
		m.mu.Unlock()
	}

	device, err := m.deviceFor(ctx, merchantID)
	if err != nil {
		return fmt.Errorf("device for merchant: %w", err)
	}

	client := whatsmeow.NewClient(device, m.log)
	sess := &session{client: client, merchantID: merchantID}

	m.mu.Lock()
	m.sessions[merchantID] = sess
	m.mu.Unlock()

	client.AddEventHandler(func(evt any) { m.handleEvent(merchantID, evt) })

	// No stored identity means this is a pairing: take the QR channel BEFORE
	// connecting, or the code is emitted with nobody listening.
	if client.Store.ID == nil {
		qrCtx, cancel := context.WithCancel(context.Background())
		sess.cancelQR = cancel
		qrChan, err := client.GetQRChannel(qrCtx)
		if err != nil {
			cancel()
			return fmt.Errorf("qr channel: %w", err)
		}
		go m.pumpQR(merchantID, qrChan)
	}

	setStatus(ctx, merchantID, connPatch{Status: strp("connecting"), LastError: ptrptr(nil)})
	if err := client.Connect(); err != nil {
		m.scheduleRetry(merchantID, err)
		return fmt.Errorf("connect: %w", err)
	}
	return nil
}

// deviceFor loads the merchant's stored device, or makes a fresh one to pair.
func (m *manager) deviceFor(ctx context.Context, merchantID string) (*store.Device, error) {
	row, err := getConnection(ctx, merchantID)
	if err != nil {
		return nil, err
	}
	if row != nil && row.WMJid != nil && *row.WMJid != "" {
		jid, err := types.ParseJID(*row.WMJid)
		if err == nil {
			device, err := m.container.GetDevice(ctx, jid)
			if err != nil {
				return nil, err
			}
			if device != nil {
				return device, nil
			}
		}
		// Mapped to a device the store no longer has: fall through to a fresh
		// pairing rather than failing forever on a dangling reference.
		slog.Warn("mapped device missing from store, pairing fresh", "merchant", merchantID)
	}
	return m.container.NewDevice(), nil
}

func (m *manager) pumpQR(merchantID string, ch <-chan whatsmeow.QRChannelItem) {
	ctx := context.Background()
	for item := range ch {
		switch item.Event {
		case "code":
			png, err := qrcode.Encode(item.Code, qrcode.Medium, 512)
			if err != nil {
				slog.Error("qr encode", "merchant", merchantID, "err", err)
				continue
			}
			// The dashboards render this straight into an <img src>.
			dataURL := "data:image/png;base64," + base64.StdEncoding.EncodeToString(png)
			setStatus(ctx, merchantID, connPatch{
				Status: strp("qr"),
				QR:     ptrptr(&dataURL),
			})
		case "success":
			// PairSuccess/Connected handle the rest; just clear the stale code.
			setStatus(ctx, merchantID, connPatch{QR: ptrptr(nil)})
		case "timeout", "err-client-outdated", "err-scanned-without-multidevice":
			// The channel only lives a couple of minutes. Naming the reason keeps
			// "nobody scanned it" distinct from "WhatsApp refused it", which look
			// identical from the dashboard otherwise.
			reason := "qr_timeout"
			if item.Event != "timeout" {
				reason = item.Event
			}
			setStatus(ctx, merchantID, connPatch{
				Status:    strp("disconnected"),
				QR:        ptrptr(nil),
				LastError: ptrptr(&reason),
			})
			m.stop(merchantID)
			slog.Info("qr channel closed", "merchant", merchantID, "reason", reason)
		default:
			slog.Info("qr event", "merchant", merchantID, "event", item.Event, "err", item.Error)
		}
	}
}

// reportConnection tells Recete about a state change worth acting on (an
// unlinked number means scheduled messages will fail). Best effort, parked on
// failure like everything else.
func reportConnection(merchantID, status string, lastError *string) {
	go forward(Event{Type: "connection", MerchantID: merchantID, Status: status, LastError: lastError})
}

func (m *manager) handleEvent(merchantID string, evt any) {
	ctx := context.Background()
	switch v := evt.(type) {

	case *events.PairSuccess:
		// First moment the number is known, so the first moment a duplicate can
		// be refused.
		jid := v.ID.String()
		if phone := jidToPhone(v.ID); phone != nil {
			owner, err := merchantOwningPhone(ctx, *phone, merchantID)
			if err == nil && owner != "" {
				slog.Warn("number already linked to another store", "merchant", merchantID, "owner", owner)
				m.Logout(ctx, merchantID)
				setStatus(ctx, merchantID, connPatch{LastError: ptrptr(strp("number_taken"))})
				return
			}
		}
		setStatus(ctx, merchantID, connPatch{WMJid: ptrptr(&jid), FirstPaired: true})
		slog.Info("paired", "merchant", merchantID, "jid", jid)

	case *events.PairError:
		// WhatsApp refused the scan. "Can't link new device now" on the phone is
		// an account-level refusal — most often the four-linked-device limit, or
		// a cooldown after many link attempts in a short window.
		slog.Error("pair refused by WhatsApp", "merchant", merchantID, "jid", v.ID.String(), "reason", v.Error.Error())
		setStatus(ctx, merchantID, connPatch{
			Status:    strp("disconnected"),
			QR:        ptrptr(nil),
			LastError: ptrptr(strp("pair_refused")),
		})
		m.stop(merchantID)

	case *events.Connected:
		m.mu.Lock()
		delete(m.attempts, merchantID)
		m.mu.Unlock()
		s := m.get(merchantID)
		var phone, jid *string
		if s != nil && s.client.Store.ID != nil {
			phone = jidToPhone(*s.client.Store.ID)
			j := s.client.Store.ID.String()
			jid = &j
		}
		setStatus(ctx, merchantID, connPatch{
			Status:      strp("connected"),
			PhoneE164:   ptrptr(phone),
			QR:          ptrptr(nil),
			LastError:   ptrptr(nil),
			ConnectedAt: ptrptr(strp(time.Now().UTC().Format(time.RFC3339))),
			WMJid:       ptrptr(jid),
		})
		reportConnection(merchantID, "connected", nil)
		slog.Info("connected", "merchant", merchantID)

	case *events.LoggedOut:
		// The merchant removed us from Linked devices on their phone. Stored
		// credentials are dead; clear them so the next connect pairs cleanly.
		slog.Warn("logged out by phone", "merchant", merchantID, "reason", v.Reason.String())
		m.wipe(ctx, merchantID, nil)
		reportConnection(merchantID, "logged_out", nil)

	case *events.Disconnected:
		m.scheduleRetry(merchantID, errors.New("disconnected"))

	case *events.StreamReplaced:
		// Another client took the session. Retrying would fight it forever.
		slog.Warn("stream replaced elsewhere", "merchant", merchantID)
		reason := "stream_replaced"
		setStatus(ctx, merchantID, connPatch{
			Status:    strp("disconnected"),
			QR:        ptrptr(nil),
			LastError: ptrptr(&reason),
		})
		m.stop(merchantID)
		reportConnection(merchantID, "disconnected", &reason)

	case *events.ClientOutdated:
		// The fix is a whatsmeow bump, not a retry.
		slog.Error("client outdated — whatsmeow needs updating", "merchant", merchantID)
		reason := "client_outdated"
		setStatus(ctx, merchantID, connPatch{
			Status:    strp("disconnected"),
			QR:        ptrptr(nil),
			LastError: ptrptr(&reason),
		})
		m.stop(merchantID)
		reportConnection(merchantID, "disconnected", &reason)

	case *events.Message:
		m.handleMessage(merchantID, v)

	case *events.Receipt:
		var status string
		switch v.Type {
		case types.ReceiptTypeDelivered:
			status = "delivered"
		case types.ReceiptTypeRead, types.ReceiptTypeReadSelf:
			status = "read"
		default:
			return
		}
		ids := make([]string, 0, len(v.MessageIDs))
		for _, id := range v.MessageIDs {
			ids = append(ids, string(id))
		}
		go forward(Event{Type: "receipt", MerchantID: merchantID, MessageIDs: ids, Status: status})
	}
}

// handleMessage forwards customer messages, and messages the merchant typed on
// their own phone, to Recete.
//
// whatsmeow calls event handlers synchronously, so the HTTP round trip runs on
// its own goroutine; a slow Recete must not stall the WhatsApp connection.
func (m *manager) handleMessage(merchantID string, v *events.Message) {
	if !isCustomerChat(v.Info) {
		return
	}
	body := extractText(v)
	ev := Event{
		MerchantID:  merchantID,
		MessageID:   v.Info.ID,
		ChatJID:     v.Info.Chat.String(),
		Body:        body,
		Timestamp:   v.Info.Timestamp.UTC().Format(time.RFC3339),
		MessageType: "text",
	}
	// A customer's photo (a damaged parcel, a product in use) goes to AI vision.
	// Only its download keys travel; the API asks for the bytes when needed.
	if img := imageOf(v); img != nil && !v.Info.IsFromMe {
		// Keys only: drop the inline thumbnail (a small copy of the photo) and
		// the reply context, so no image data ends up in Recete's tables.
		keys := proto.Clone(img).(*waE2E.ImageMessage)
		keys.JPEGThumbnail = nil
		keys.ContextInfo = nil
		raw, err := proto.Marshal(keys)
		if err != nil {
			slog.Error("marshal image", "merchant", merchantID, "err", err)
			return
		}
		ev.MessageType = "image"
		ev.Media = base64.StdEncoding.EncodeToString(raw)
		ev.MimeType = img.GetMimetype()
	} else if body == "" {
		// Voice notes, stickers, reactions, poll votes: nothing the assistant
		// can answer.
		return
	}
	if v.Info.IsFromMe {
		// For our own message the counterparty is the chat, not the sender.
		ev.Type = "own_message"
		ev.Phone = jidToPhone(v.Info.Chat)
		ev.LID = jidToLID(v.Info.Chat)
	} else {
		ev.Type = "inbound"
		ev.Phone, ev.LID = senderIdentity(v.Info)
		ev.PushName = v.Info.PushName
		// Every form the sender goes by, so a reply is recognised whether it is
		// addressed to the phone number or to the @lid (caps.go).
		noteInbound(merchantID, v.Info.Chat.User, v.Info.Sender.User, v.Info.SenderAlt.User)
	}
	if ev.Phone == nil && ev.LID == nil {
		// Nothing we are allowed to identify them by. Storing a placeholder is
		// the mistake that filled Suyla's panel with numbers belonging to nobody.
		return
	}
	go forward(ev)
}

// scheduleRetry backs off instead of hammering, and gives up rather than looping.
func (m *manager) scheduleRetry(merchantID string, cause error) {
	ctx := context.Background()
	m.mu.Lock()
	n := m.attempts[merchantID] + 1
	m.attempts[merchantID] = n
	m.cancelRetry(merchantID)

	if n > maxRetries {
		delete(m.attempts, merchantID)
		m.mu.Unlock()
		reason := "unreachable"
		setStatus(ctx, merchantID, connPatch{
			Status:    strp("disconnected"),
			QR:        ptrptr(nil),
			LastError: ptrptr(&reason),
		})
		reportConnection(merchantID, "disconnected", &reason)
		slog.Error("giving up reconnecting", "merchant", merchantID, "attempts", n)
		return
	}

	wait := time.Duration(math.Min(
		float64(maxRetryWait),
		float64(baseRetry)*math.Pow(2, float64(n-1))))
	msg := cause.Error()
	m.timers[merchantID] = time.AfterFunc(wait, func() {
		_ = m.Start(context.Background(), merchantID, true)
	})
	m.mu.Unlock()

	setStatus(ctx, merchantID, connPatch{
		Status:    strp("connecting"),
		LastError: ptrptr(&msg),
	})
	slog.Warn("reconnecting with backoff", "merchant", merchantID, "attempt", n, "wait", wait)
}

// stop drops the in-memory session without touching stored credentials.
func (m *manager) stop(merchantID string) {
	m.mu.Lock()
	s := m.sessions[merchantID]
	delete(m.sessions, merchantID)
	m.cancelRetry(merchantID)
	m.mu.Unlock()
	if s == nil {
		return
	}
	if s.cancelQR != nil {
		s.cancelQR()
	}
	s.client.RemoveEventHandlers()
	s.client.Disconnect()
}

// wipe clears stored credentials and marks the merchant logged out.
func (m *manager) wipe(ctx context.Context, merchantID string, lastErr *string) {
	s := m.get(merchantID)
	// Only a paired device has anything stored; deleting an unpaired one fails
	// with "device JID must be known", which is noise, not a problem.
	if s != nil && s.client.Store != nil && s.client.Store.ID != nil {
		if err := s.client.Store.Delete(ctx); err != nil {
			slog.Warn("store delete", "merchant", merchantID, "err", err)
		}
	}
	m.stop(merchantID)
	m.mu.Lock()
	delete(m.attempts, merchantID)
	m.mu.Unlock()
	setStatus(ctx, merchantID, connPatch{
		Status:      strp("logged_out"),
		PhoneE164:   ptrptr(nil),
		QR:          ptrptr(nil),
		ConnectedAt: ptrptr(nil),
		WMJid:       ptrptr(nil),
		LastError:   ptrptr(lastErr),
	})
}

// Logout unlinks the device on WhatsApp's side too, so a restart cannot silently
// re-attach a session the merchant disconnected.
func (m *manager) Logout(ctx context.Context, merchantID string) {
	s := m.get(merchantID)
	if s != nil && s.client.IsLoggedIn() {
		if err := s.client.Logout(ctx); err != nil {
			slog.Warn("logout", "merchant", merchantID, "err", err)
		}
	}
	m.wipe(ctx, merchantID, nil)
	// A disconnect the merchant asked for reads as "disconnected", not "logged
	// out by the phone" — the dashboards word those differently.
	setStatus(ctx, merchantID, connPatch{Status: strp("disconnected")})
}

// Restore brings paired sessions back after a restart.
func (m *manager) Restore(ctx context.Context) {
	merchants, err := merchantsWithDevice(ctx)
	if err != nil {
		slog.Error("restore: list devices", "err", err)
		return
	}
	for _, merchantID := range merchants {
		if err := m.Start(ctx, merchantID, false); err != nil {
			slog.Warn("restore failed", "merchant", merchantID, "err", err)
			continue
		}
		slog.Info("restored", "merchant", merchantID)
	}
}
