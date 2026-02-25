-- Additive global AI settings table for super admin runtime model selection
create table if not exists public.platform_ai_settings (
  id text primary key,
  default_llm_model text not null default 'gpt-4o-mini',
  allowed_llm_models jsonb not null default '["gpt-4o-mini","gpt-4o"]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.platform_ai_settings (id, default_llm_model)
values ('default', 'gpt-4o-mini')
on conflict (id) do nothing;

alter table public.platform_ai_settings enable row level security;

drop policy if exists "platform_ai_settings_no_client_access" on public.platform_ai_settings;
create policy "platform_ai_settings_no_client_access"
on public.platform_ai_settings
for all
using (false)
with check (false);

