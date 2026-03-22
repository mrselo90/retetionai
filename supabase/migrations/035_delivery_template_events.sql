-- Delivery template events: tracks WhatsApp template sends and reply state
-- for the post-purchase support flow (Twilio Content API templates).

CREATE TABLE IF NOT EXISTS delivery_template_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  to_phone TEXT NOT NULL,
  template_name TEXT NOT NULL,
  template_language TEXT NOT NULL DEFAULT 'en',
  template_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  conversation_window_open_until TIMESTAMPTZ,
  provider_message_id TEXT,
  reply_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (reply_status IN ('pending', 'positive', 'negative', 'expired', 'error')),
  reply_received_at TIMESTAMPTZ,
  selected_product_id TEXT,
  support_status TEXT NOT NULL DEFAULT 'template_sent'
    CHECK (support_status IN (
      'template_sent', 'awaiting_reply', 'product_list_sent',
      'product_selected', 'ai_support', 'closed'
    )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(merchant_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_template_events_user
  ON delivery_template_events(user_id, merchant_id, reply_status);

CREATE INDEX IF NOT EXISTS idx_delivery_template_events_phone
  ON delivery_template_events(to_phone, reply_status);
