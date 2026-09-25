package main

import (
	"context"
	"log/slog"
	"math/rand"
	"sync"
	"time"
	"unicode/utf8"

	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
)

// Human pacing for automated sends.
//
// The assistant produced a reply and it went out in milliseconds: measured over
// 171 production replies the median gap between a customer's message and ours
// was 2.2 seconds and the fastest was 0.2. Nothing showed "yazıyor…" either,
// because the worker never sent presence at all — the line appeared permanently
// offline and then a message simply materialised.
//
// This is pacing, not concealment. The line belongs to the business, it answers
// its own customers, and the connect screen says in plain Turkish that the
// integration is unofficial. What it avoids is a linked-device session behaving
// in a way no phone ever does.
//
// Deliberately NOT applied to an operator's own replies: those are already typed
// by a person, and adding a delay to them would make the product feel broken.

const (
	msPerRune      = 38
	minTypingMs    = 1200
	maxTypingMs    = 6000
	jitterFraction = 0.15
)

// typingBase is the un-jittered time to "type" a message of n runes.
func typingBase(runes int) time.Duration {
	ms := runes * msPerRune
	if ms < minTypingMs {
		ms = minTypingMs
	}
	if ms > maxTypingMs {
		ms = maxTypingMs
	}
	return time.Duration(ms) * time.Millisecond
}

// typingDuration is typingBase with ±15% noise. A constant interval is a
// pattern of its own, which is the thing being avoided.
func typingDuration(runes int) time.Duration {
	base := float64(typingBase(runes))
	return time.Duration(base * (1 + (rand.Float64()*2-1)*jitterFraction))
}

// sendMu serialises humanized sends per session: two messages leaving the same
// line at the same instant is the pattern this exists to prevent, and the
// presence toggling below would interleave nonsensically otherwise.
var sendMu sync.Map // merchantID -> *sync.Mutex

func lockFor(merchantID string) *sync.Mutex {
	v, _ := sendMu.LoadOrStore(merchantID, &sync.Mutex{})
	return v.(*sync.Mutex)
}

// sendHumanized goes online, types for a while, sends, and goes back offline —
// the shape of a person picking up their phone rather than a server.
//
// Every presence call is best effort. A message that fails to send is a
// customer left without an answer; a presence hint that fails to send is
// nothing. They must never be allowed to trade places, so presence errors are
// logged and ignored.
func (s *session) sendHumanized(ctx context.Context, jid types.JID, body string) (string, error) {
	mu := lockFor(s.merchantID)
	mu.Lock()
	defer mu.Unlock()

	if err := s.client.SendPresence(ctx, types.PresenceAvailable); err != nil {
		slog.Debug("presence available failed", "tenant", s.merchantID, "err", err)
	} else {
		// WithoutCancel: going back offline should still happen even if the
		// caller's request context has been cancelled by then.
		defer func() {
			if err := s.client.SendPresence(context.WithoutCancel(ctx), types.PresenceUnavailable); err != nil {
				slog.Debug("presence unavailable failed", "tenant", s.merchantID, "err", err)
			}
		}()
	}

	if err := s.client.SendChatPresence(ctx, jid, types.ChatPresenceComposing, types.ChatPresenceMediaText); err != nil {
		slog.Debug("composing failed", "tenant", s.merchantID, "err", err)
	}

	select {
	case <-time.After(typingDuration(utf8.RuneCountInString(body))):
	case <-ctx.Done():
		return "", ctx.Err()
	}

	if err := s.client.SendChatPresence(ctx, jid, types.ChatPresencePaused, types.ChatPresenceMediaText); err != nil {
		slog.Debug("paused failed", "tenant", s.merchantID, "err", err)
	}

	resp, err := s.client.SendMessage(ctx, jid, &waE2E.Message{Conversation: &body})
	if err != nil {
		return "", err
	}
	return resp.ID, nil
}
