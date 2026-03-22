alter table public.platform_ai_settings
  add column if not exists corporate_whatsapp_provider text not null default 'twilio',
  add column if not exists corporate_whatsapp_from_number text,
  add column if not exists corporate_whatsapp_phone_number_display text;

update public.platform_ai_settings
set
  corporate_whatsapp_provider = coalesce(nullif(corporate_whatsapp_provider, ''), 'twilio'),
  corporate_whatsapp_from_number = coalesce(
    nullif(corporate_whatsapp_from_number, ''),
    nullif(corporate_whatsapp_phone_number_display, ''),
    '+447915922506'
  )
where id = 'default';

update public.platform_ai_settings
set corporate_whatsapp_phone_number_display = coalesce(
  nullif(corporate_whatsapp_phone_number_display, ''),
  '+447915922506'
)
where id = 'default';
