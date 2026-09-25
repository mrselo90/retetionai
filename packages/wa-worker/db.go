package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

// The worker's database access is deliberately narrow.
//
// It connects as its own role (see packages/wa-worker/README.md), whose grants
// cover exactly two things: the whatsmeow session store in the `wa_session`
// schema, and the merchant-level `public.whatsapp_connections` row. It cannot
// read Recete's users, orders or messages. Everything about customers goes to
// the Recete API instead (forward.go), which is also where phone numbers get
// encrypted — this process never needs ENCRYPTION_KEY.
//
// Keeping the session store out of `public` is a security requirement, not
// tidiness: Supabase exposes `public` over its REST API with the anon key, which
// ships in the web bundle. whatsmeow's tables hold the keys to every linked
// WhatsApp account; one missed RLS policy would publish them.
var db *sql.DB

func openDB(dsn string) error {
	var err error
	db, err = sql.Open("postgres", dsn)
	if err != nil {
		return err
	}
	db.SetMaxOpenConns(8)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(30 * time.Minute)
	return db.PingContext(context.Background())
}

// ── whatsapp_connections ────────────────────────────────────────────────────

type connPatch struct {
	Status      *string
	PhoneE164   **string // pointer-to-pointer: distinguishes "leave alone" from "set NULL"
	QR          **string
	LastError   **string
	ConnectedAt **string
	WMJid       **string
	// Set only on a real pairing. Written with coalesce, so re-pairing the same
	// merchant never resets the warm-up clock the send caps are measured from.
	FirstPaired bool
}

func strp(s string) *string { return &s }

func ptrptr(s *string) **string { return &s }

// setConnectionStatus upserts the merchant-facing connection state. Only the
// fields actually passed are written.
func setConnectionStatus(ctx context.Context, merchantID string, p connPatch) error {
	cols := []string{"merchant_id"}
	vals := []any{merchantID}
	sets := []string{}
	add := func(col string, v any) {
		cols = append(cols, col)
		vals = append(vals, v)
		sets = append(sets, fmt.Sprintf("%s = excluded.%s", col, col))
	}
	if p.Status != nil {
		add("status", *p.Status)
	}
	if p.PhoneE164 != nil {
		add("phone_e164", *p.PhoneE164)
	}
	if p.QR != nil {
		add("qr", *p.QR)
	}
	if p.LastError != nil {
		add("last_error", *p.LastError)
	}
	if p.ConnectedAt != nil {
		add("connected_at", *p.ConnectedAt)
	}
	if p.WMJid != nil {
		add("wm_jid", *p.WMJid)
	}
	now := time.Now().UTC().Format(time.RFC3339)
	add("updated_at", now)

	if p.FirstPaired {
		cols = append(cols, "first_paired_at")
		vals = append(vals, now)
		sets = append(sets, "first_paired_at = coalesce(public.whatsapp_connections.first_paired_at, excluded.first_paired_at)")
	}

	placeholders := make([]string, len(vals))
	for i := range vals {
		placeholders[i] = fmt.Sprintf("$%d", i+1)
	}
	q := fmt.Sprintf(
		`insert into public.whatsapp_connections (%s) values (%s)
		 on conflict (merchant_id) do update set %s`,
		strings.Join(cols, ", "), strings.Join(placeholders, ", "), strings.Join(sets, ", "))
	_, err := db.ExecContext(ctx, q, vals...)
	return err
}

type connRow struct {
	Status      string
	PhoneE164   *string
	QR          *string
	ConnectedAt *string
	LastError   *string
	WMJid       *string
}

func getConnection(ctx context.Context, merchantID string) (*connRow, error) {
	var r connRow
	err := db.QueryRowContext(ctx,
		`select status, phone_e164, qr, connected_at, last_error, wm_jid
		   from public.whatsapp_connections where merchant_id = $1`, merchantID).
		Scan(&r.Status, &r.PhoneE164, &r.QR, &r.ConnectedAt, &r.LastError, &r.WMJid)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &r, nil
}

// merchantOwningPhone returns another merchant already linked to this number, or
// "". One WhatsApp number answering for two stores would route one store's
// customers into the other's inbox.
func merchantOwningPhone(ctx context.Context, phone, exceptMerchantID string) (string, error) {
	var id string
	err := db.QueryRowContext(ctx,
		`select merchant_id from public.whatsapp_connections
		  where phone_e164 = $1 and merchant_id <> $2
		    and status in ('connecting', 'qr', 'connected')
		  limit 1`, phone, exceptMerchantID).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return id, err
}

// merchantsWithDevice lists the sessions to restore at boot: only merchants
// that have finished pairing have anything to restore.
func merchantsWithDevice(ctx context.Context) ([]string, error) {
	rows, err := db.QueryContext(ctx,
		`select merchant_id from public.whatsapp_connections
		  where wm_jid is not null and wm_jid <> ''
		    and status <> 'logged_out'`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}
