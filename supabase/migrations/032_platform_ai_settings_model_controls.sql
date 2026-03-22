alter table public.platform_ai_settings
  add column if not exists default_embedding_model text not null default 'text-embedding-3-small',
  add column if not exists allowed_embedding_models jsonb not null default '["text-embedding-3-small"]'::jsonb,
  add column if not exists default_vision_model text not null default 'gpt-4o';

update public.platform_ai_settings
set
  default_embedding_model = coalesce(nullif(default_embedding_model, ''), 'text-embedding-3-small'),
  allowed_embedding_models = coalesce(allowed_embedding_models, '["text-embedding-3-small"]'::jsonb),
  default_vision_model = coalesce(nullif(default_vision_model, ''), default_llm_model, 'gpt-4o')
where id = 'default';
