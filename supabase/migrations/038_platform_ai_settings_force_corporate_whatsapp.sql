alter table public.platform_ai_settings
  add column if not exists force_corporate_whatsapp_for_customer_messaging boolean not null default false;

update public.platform_ai_settings
set force_corporate_whatsapp_for_customer_messaging = false
where id = 'default'
  and force_corporate_whatsapp_for_customer_messaging is null;
