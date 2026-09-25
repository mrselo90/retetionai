package main

import (
	"regexp"
	"strings"

	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

// Identity helpers, carried over unchanged from Suyla's worker. The rules here
// were learned the hard way and are the part most worth not re-deriving.

var phoneShape = regexp.MustCompile(`^[0-9]{7,15}$`)

// jidToPhone returns an E.164 number, but ONLY for the real user server.
//
// A LID (`123456789012345@lid`) is a privacy identifier, not a number. Suyla's
// first worker stripped any suffix and prefixed "+", and 19 of 26 customers ended
// up stored with a number belonging to nobody. Refusing every server except
// s.whatsapp.net is what prevents that.
func jidToPhone(jid types.JID) *string {
	if jid.Server != types.DefaultUserServer {
		return nil
	}
	user := jid.User
	if i := strings.IndexByte(user, ':'); i >= 0 {
		user = user[:i]
	}
	if !phoneShape.MatchString(user) {
		return nil
	}
	p := "+" + user
	return &p
}

// jidToLID returns the privacy id, or nil when the JID is not one.
func jidToLID(jid types.JID) *string {
	if jid.Server != types.HiddenUserServer {
		return nil
	}
	user := jid.User
	if i := strings.IndexByte(user, ':'); i >= 0 {
		user = user[:i]
	}
	if !phoneShape.MatchString(user) {
		return nil
	}
	return &user
}

// senderIdentity resolves who sent a message into (phone, lid).
//
// whatsmeow gives the sender as a LID when the contact runs in privacy mode, and
// carries the real number in SenderAlt when WhatsApp discloses it. Recete is in a
// better position than Suyla here: it messages the customer's phone FIRST (the
// order confirmation), which is exactly what teaches whatsmeow_lid_map the pair,
// so replies should nearly always resolve to a phone the order already knows.
func senderIdentity(info types.MessageInfo) (phone *string, lid *string) {
	if p := jidToPhone(info.Sender); p != nil {
		phone = p
	}
	if l := jidToLID(info.Sender); l != nil {
		lid = l
	}
	if phone == nil {
		if p := jidToPhone(info.SenderAlt); p != nil {
			phone = p
		}
	}
	if lid == nil {
		if l := jidToLID(info.SenderAlt); l != nil {
			lid = l
		}
	}
	return phone, lid
}

// extractText pulls the readable body out of a message.
func extractText(evt *events.Message) string {
	msg := evt.Message
	if msg == nil {
		return ""
	}
	if s := msg.GetConversation(); s != "" {
		return s
	}
	if ext := msg.GetExtendedTextMessage(); ext != nil {
		if s := ext.GetText(); s != "" {
			return s
		}
	}
	if img := msg.GetImageMessage(); img != nil {
		if s := img.GetCaption(); s != "" {
			return s
		}
	}
	if vid := msg.GetVideoMessage(); vid != nil {
		if s := vid.GetCaption(); s != "" {
			return s
		}
	}
	return ""
}

// isCustomerChat is false for the chats that are never a customer conversation.
func isCustomerChat(info types.MessageInfo) bool {
	if info.IsGroup {
		return false
	}
	switch info.Chat.Server {
	case types.BroadcastServer, types.NewsletterServer:
		return false
	}
	return true
}

// imageOf returns the image in a message, or nil.
func imageOf(evt *events.Message) *waE2E.ImageMessage {
	if evt.Message == nil {
		return nil
	}
	return evt.Message.GetImageMessage()
}
