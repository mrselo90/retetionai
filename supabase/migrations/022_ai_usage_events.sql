-- Additive AI usage event tracking for merchant cost visibility
create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  provider text not null default 'openai',
  feature text not null,
  model text not null,
  request_kind text not null default 'chat_completion', -- chat_completion | embedding | translation | enrich | other
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  estimated_cost_usd numeric(18,8) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_usage_events_merchant_created_at
  on public.ai_usage_events (merchant_id, created_at desc);

create index if not exists idx_ai_usage_events_merchant_model_created_at
  on public.ai_usage_events (merchant_id, model, created_at desc);

alter table public.ai_usage_events enable row level security;

drop policy if exists "ai_usage_events_no_client_access" on public.ai_usage_events;
create policy "ai_usage_events_no_client_access"
on public.ai_usage_events
for all
using (false)
with check (false);

