-- Persist structured conversation state used by AI orchestration.
-- This allows reliable contextual continuation and sticky order-product memory
-- even when message history windows are limited.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS conversation_context JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN conversations.conversation_context IS
  'Structured assistant state: known_order_products, selected_products, current_intent, last_question_type, language_preference, and user constraints.';
