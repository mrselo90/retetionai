alter table public.platform_ai_settings
  add column if not exists allowed_vision_models jsonb not null default '["gpt-4o","gpt-4o-mini","gpt-4.1","gpt-4.1-mini"]'::jsonb;

update public.platform_ai_settings
set allowed_vision_models = coalesce(
  allowed_vision_models,
  '["gpt-4o","gpt-4o-mini","gpt-4.1","gpt-4.1-mini"]'::jsonb
)
where id = 'default';
