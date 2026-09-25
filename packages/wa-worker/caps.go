package main

import (
	"context"
	"database/sql"
	"errors"
	"sync"
	"time"
)

// Daily caps on business-initiated messages, warming up from first pairing.
//
// This is where Recete differs most from Suyla. Suyla's line mostly answers
// people who wrote first. Recete writes first: order confirmations, check-ins,
// re-order nudges — to numbers that have never messaged the store. A freshly
// linked number that suddenly sends hundreds of first-contact messages a day is
// the pattern WhatsApp bans, and the number that gets banned is the merchant's
// own. The cap protects them from a busy sales day on a week-old link.
//
// Replies are not capped: a message to a chat that wrote to us in the last 24
// hours is a conversation, not outreach. That is tracked in memory, so after a
// restart the first reply to each chat counts against the cap — the
// conservative direction.

// capSchedule is the daily cap by days since first pairing. Deliberately
// conservative defaults; raise them only with evidence from real numbers.
var capSchedule = []struct {
	fromDay int
	cap     int
}{
	{0, 40},
	{3, 80},
	{7, 150},
	{14, 300},
}

func dailyCap(firstPaired *time.Time, now time.Time) int {
	days := 0
	if firstPaired != nil {
		days = int(now.Sub(*firstPaired).Hours() / 24)
	}
	cap := capSchedule[0].cap
	for _, step := range capSchedule {
		if days >= step.fromDay {
			cap = step.cap
		}
	}
	return cap
}

func ensureCapsTable(ctx context.Context) error {
	_, err := db.ExecContext(ctx, `
		create table if not exists recete_send_counts (
		  merchant_id text not null,
		  day         date not null,
		  count       int  not null default 0,
		  primary key (merchant_id, day)
		)`)
	return err
}

// errCapReached means today's business-initiated allowance is used up.
var errCapReached = errors.New("daily_cap_reached")

// reserveSend takes one slot from today's allowance, atomically. The insert only
// increments while under the cap, so two concurrent sends cannot both take the
// last slot.
func reserveSend(ctx context.Context, merchantID string) error {
	var firstPaired sql.NullTime
	err := db.QueryRowContext(ctx,
		`select first_paired_at from public.whatsapp_connections where merchant_id = $1`,
		merchantID).Scan(&firstPaired)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	var fp *time.Time
	if firstPaired.Valid {
		fp = &firstPaired.Time
	}
	limit := dailyCap(fp, time.Now().UTC())

	var n int
	err = db.QueryRowContext(ctx,
		`insert into recete_send_counts as c (merchant_id, day, count)
		 values ($1, (now() at time zone 'utc')::date, 1)
		 on conflict (merchant_id, day) do update set count = c.count + 1
		 where c.count < $2
		 returning c.count`, merchantID, limit).Scan(&n)
	if errors.Is(err, sql.ErrNoRows) {
		return errCapReached
	}
	return err
}

// releaseSend gives a slot back when the send it was reserved for failed.
func releaseSend(ctx context.Context, merchantID string) {
	_, _ = db.ExecContext(ctx,
		`update recete_send_counts set count = greatest(count - 1, 0)
		  where merchant_id = $1 and day = (now() at time zone 'utc')::date`, merchantID)
}

// untilUTCMidnight is when the allowance resets.
func untilUTCMidnight(now time.Time) time.Duration {
	next := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, time.UTC)
	return next.Sub(now)
}

// Recent inbound chats, for telling replies from outreach.
var (
	inboundMu   sync.Mutex
	lastInbound = map[string]time.Time{} // merchantID|user -> last message time
)

const replyWindow = 24 * time.Hour

func chatKey(merchantID, user string) string { return merchantID + "|" + user }

func noteInbound(merchantID string, users ...string) {
	now := time.Now()
	inboundMu.Lock()
	defer inboundMu.Unlock()
	for _, u := range users {
		if u != "" {
			lastInbound[chatKey(merchantID, u)] = now
		}
	}
	// Opportunistic sweep so the map cannot grow without bound.
	if len(lastInbound) > 50_000 {
		for k, t := range lastInbound {
			if now.Sub(t) > replyWindow {
				delete(lastInbound, k)
			}
		}
	}
}

func isReply(merchantID, user string) bool {
	inboundMu.Lock()
	defer inboundMu.Unlock()
	t, ok := lastInbound[chatKey(merchantID, user)]
	return ok && time.Since(t) < replyWindow
}
