alter table public.platform_ai_settings
add column if not exists products_cache_ttl_seconds integer not null default 300;

update public.platform_ai_settings
set products_cache_ttl_seconds = 300
where id = 'default' and (products_cache_ttl_seconds is null or products_cache_ttl_seconds = 0);
