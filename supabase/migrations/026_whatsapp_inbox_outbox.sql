-- Migration 026: WhatsApp inbox/outbox reliability + phone lookup performance

-- 1) Fast phone lookup key for encrypted phone storage
ALTER TABLE users
ADD COLUMN IF NOT EXISTS phone_lookup_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_users_merchant_phone_lookup_hash
  ON users(merchant_id, phone_lookup_hash)
  WHERE phone_lookup_hash IS NOT NULL;

-- 2) Inbound inbox table (idempotency source of truth)
CREATE TABLE IF NOT EXISTS whatsapp_inbound_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('meta', 'twilio')),
  external_message_id TEXT NOT NULL,
  from_phone TEXT NOT NULL,
  phone_number_id TEXT,
  message_type TEXT NOT NULL,
  message_text TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'queued', 'processing', 'processed', 'failed', 'ignored')),
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  queued_at TIMESTAMPTZ,
  processing_started_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(merchant_id, provider, external_message_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_status
  ON whatsapp_inbound_events(status, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_merchant_status
  ON whatsapp_inbound_events(merchant_id, status, received_at DESC);

-- 3) Outbox table for tracked outbound deliveries
CREATE TABLE IF NOT EXISTS whatsapp_outbound_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  inbound_event_id UUID REFERENCES whatsapp_inbound_events(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('meta', 'twilio')),
  to_phone TEXT NOT NULL,
  message_kind TEXT NOT NULL DEFAULT 'primary',
  message_text TEXT NOT NULL,
  preview_url BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),
  provider_message_id TEXT,
  error_text TEXT,
  attempts INT NOT NULL DEFAULT 0,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_outbound_status
  ON whatsapp_outbound_events(status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_outbound_inbound
  ON whatsapp_outbound_events(inbound_event_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_outbound_conversation
  ON whatsapp_outbound_events(conversation_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_whatsapp_outbound_inbound_kind
  ON whatsapp_outbound_events(inbound_event_id, message_kind)
  WHERE inbound_event_id IS NOT NULL;

-- 4) Atomic conversation history append to avoid read-modify-write races
CREATE OR REPLACE FUNCTION append_conversation_message_atomic(
  conversation_uuid UUID,
  message_role TEXT,
  message_content TEXT,
  message_timestamp TIMESTAMPTZ DEFAULT NOW()
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE conversations
  SET
    history = COALESCE(history, '[]'::jsonb) ||
      jsonb_build_array(
        jsonb_build_object(
          'role', message_role,
          'content', message_content,
          'timestamp', message_timestamp
        )
      ),
    updated_at = NOW()
  WHERE id = conversation_uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;
END;
$$;

-- 5) updated_at triggers for new tables
DROP TRIGGER IF EXISTS update_whatsapp_inbound_events_updated_at ON whatsapp_inbound_events;
CREATE TRIGGER update_whatsapp_inbound_events_updated_at
BEFORE UPDATE ON whatsapp_inbound_events
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_whatsapp_outbound_events_updated_at ON whatsapp_outbound_events;
CREATE TRIGGER update_whatsapp_outbound_events_updated_at
BEFORE UPDATE ON whatsapp_outbound_events
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 6) Keep internal by default (no public direct access)
ALTER TABLE whatsapp_inbound_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_outbound_events ENABLE ROW LEVEL SECURITY;
