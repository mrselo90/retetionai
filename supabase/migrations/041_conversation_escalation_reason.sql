-- Record WHY a conversation was escalated to a human.
--
-- escalateToHuman() already receives a precise reason (crisis_keyword,
-- human_request, medical_advice, return_intent_insistence, custom) but only
-- wrote it to console.log and the merchant notification. Nothing persisted it,
-- so "how many escalations were caused by weak retrieval vs. a genuine crisis"
-- was unanswerable — escalation was a count, not a diagnosis.

alter table conversations
  add column if not exists escalation_reason text;

comment on column conversations.escalation_reason is
  'Why this conversation was handed to a human: crisis_keyword | human_request | medical_advice | return_intent_insistence | custom | grounding_failure.';

-- Escalation analysis always filters on the reason and orders by recency.
create index if not exists idx_conversations_escalation_reason
  on conversations (escalation_reason, escalated_at desc)
  where escalation_reason is not null;
