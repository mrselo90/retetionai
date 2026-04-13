# Recete Assistant Pilot Rollout Monitoring

## New Pilot Metrics

Track these counters from Prometheus:

- `routine_intent_detected_count`
- `contextual_continuation_resolved_count`
- `clarification_asked_count`
- `best_effort_routine_used_count`
- `routine_quality_regenerated_count`
- `fallback_triggered_count{reason=...}`
- `crisis_precheck_count`
- `crisis_confirmed_count`
- `crisis_rejected_count`
- `human_handoff_requested_count`

## Pilot Diagnostics Capture

Each assistant response now emits a sanitized pilot diagnostic event (`feature = assistant_pilot_diagnostic`) including:

- inferred goal
- selected products
- excluded products
- merchant settings snapshot (`bot_name`, `tone`, `response_length`, `emoji`, supported languages)
- memory mode/count
- generation mode (`generated`, `regenerated`, `fallback`)
- fallback reason (if any)
- escalation decision (if any)
- routine/context/clarification flags
- sanitized previews + hashes for user message and assistant response

Access:

- `GET /api/admin/pilot/diagnostics?merchant_id=<id>&limit=50`
- `GET /api/admin/pilot/review-template`

## First Pilot Watchlist

### 1) Conversation quality drift

- Rising `clarification_asked_count` with stable volume may indicate weak context interpretation.
- Rising `fallback_triggered_count{reason="routine_best_effort"}` may indicate weaker grounding quality.

### 2) Escalation quality

- `crisis_precheck_count` should be higher than `crisis_confirmed_count`.
- Sudden rise in `crisis_confirmed_count` with no incident context needs immediate audit.
- `crisis_rejected_count` should exist; zero may indicate over-escalation.

### 3) Routine flow quality

- Compare:
  - `routine_intent_detected_count`
  - `contextual_continuation_resolved_count`
  - `best_effort_routine_used_count`
  - `routine_quality_regenerated_count`

Healthy signal:
- continuation resolved and routine detected increase together
- regeneration and fallback stay moderate

### 4) Human handoff behavior

- `human_handoff_requested_count` should correlate with explicit human asks in sampled transcripts.

## Lightweight Weekly Review Process

1. Pull last 100 pilot diagnostics per active pilot merchant.
2. Sample at least 20 conversations.
3. Score with `/api/admin/pilot/review-template` rubric:
   - goal understanding
   - context usage
   - naturalness
   - merchant setting adherence
   - unnecessary clarification
   - false escalation
4. File top 3 recurring failure patterns and patch only those.
5. Re-check counters one week after patch.

