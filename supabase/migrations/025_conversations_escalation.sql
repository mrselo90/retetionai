-- Add escalation tracking columns to conversations table
-- P1-1: Escalations were previously only logged to console; now tracked in DB for dashboard visibility

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS escalation_status TEXT DEFAULT 'none'
    CHECK (escalation_status IN ('none', 'pending', 'resolved')),
  ADD COLUMN IF NOT EXISTS escalation_requested_at TIMESTAMPTZ DEFAULT NULL;

-- Add merchant_id to conversations for multi-tenant isolation (P0-1)
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE DEFAULT NULL;

-- Index for dashboard queries filtering by escalation status
CREATE INDEX IF NOT EXISTS idx_conversations_escalation_status
  ON conversations(escalation_status) WHERE escalation_status != 'none';

-- Index for merchant-scoped conversation lookups
CREATE INDEX IF NOT EXISTS idx_conversations_merchant_id
  ON conversations(merchant_id);
