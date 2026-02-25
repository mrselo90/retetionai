-- Additive memory controls for super admin AI settings
alter table public.platform_ai_settings
  add column if not exists conversation_memory_mode text not null default 'last_n',
  add column if not exists conversation_memory_count integer not null default 10;

update public.platform_ai_settings
set conversation_memory_mode = coalesce(conversation_memory_mode, 'last_n'),
    conversation_memory_count = greatest(1, least(200, coalesce(conversation_memory_count, 10)))
where id = 'default';

