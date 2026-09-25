-- 046: WhatsApp through a linked device (packages/wa-worker).
--
-- Each store links its own WhatsApp number by scanning a QR code, the way
-- WhatsApp Web is linked. The session lives in packages/wa-worker, a Go process
-- on whatsmeow, carried over from Suyla. This is NOT the official WhatsApp
-- Business Platform; the connect screens say so.
--
-- Three pieces:
--   1. public.whatsapp_connections — one row per merchant, the state the
--      dashboard shows (status, QR, number). Written by the worker, read by the
--      API with the service role.
--   2. schema wa_session — whatsmeow's own tables (device keys for every linked
--      account) and the worker's undelivered-event queue. Kept OUT of public on
--      purpose: public is exposed over PostgREST with the anon key that ships
--      in the web bundle, and these tables are the keys to merchants' WhatsApp
--      accounts.
--   3. role recete_wa_worker — what the worker connects as. It can use
--      wa_session and the connections row, nothing else: no users, no orders,
--      no messages. Created NOLOGIN; the owner enables it with a password
--      outside the repo (see packages/wa-worker/README.md).

-- 1. Connection state ---------------------------------------------------------

create table if not exists public.whatsapp_connections (
  merchant_id uuid primary key references public.merchants(id) on delete cascade,
  status text not null default 'disconnected'
    check (status in ('disconnected', 'connecting', 'qr', 'connected', 'logged_out')),
  phone_e164 text,
  -- data:image/png;base64 QR while pairing; null otherwise.
  qr text,
  last_error text,
  connected_at timestamptz,
  -- whatsmeow device JID. Non-null means a paired session to restore at boot.
  wm_jid text,
  -- First successful pairing ever. The worker's daily send caps warm up from
  -- this, and re-pairing never resets it.
  first_paired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One number, one store: two stores on one line would give an inbound message
-- two owners. The worker also refuses this at pairing time; this makes it hold
-- under a race.
create unique index if not exists whatsapp_connections_phone_unique
  on public.whatsapp_connections (phone_e164)
  where phone_e164 is not null;

alter table public.whatsapp_connections enable row level security;

-- 2. Provider value for rows the worker produces ------------------------------

alter table public.whatsapp_inbound_events
  drop constraint if exists whatsapp_inbound_events_provider_check;
alter table public.whatsapp_inbound_events
  add constraint whatsapp_inbound_events_provider_check
  check (provider in ('meta', 'twilio', 'whatsmeow'));

alter table public.whatsapp_outbound_events
  drop constraint if exists whatsapp_outbound_events_provider_check;
alter table public.whatsapp_outbound_events
  add constraint whatsapp_outbound_events_provider_check
  check (provider in ('meta', 'twilio', 'whatsmeow'));

-- Delivery receipts from the linked device.
alter table public.whatsapp_outbound_events
  add column if not exists delivered_at timestamptz,
  add column if not exists read_at timestamptz;

create index if not exists idx_whatsapp_outbound_provider_message
  on public.whatsapp_outbound_events (merchant_id, provider_message_id)
  where provider_message_id is not null;

-- 3. Worker role and its schema ----------------------------------------------

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'recete_wa_worker') then
    create role recete_wa_worker nologin;
  end if;
end
$$;

create schema if not exists wa_session;
-- whatsmeow creates its tables unqualified, so they land in the first schema on
-- the search path. Set on the role rather than only in the DSN: poolers may
-- drop startup parameters, a role default survives them.
alter role recete_wa_worker set search_path = wa_session;
revoke all on schema wa_session from public;
grant usage, create on schema wa_session to recete_wa_worker;

grant usage on schema public to recete_wa_worker;
grant select, insert, update on public.whatsapp_connections to recete_wa_worker;

-- The worker is not the service role, so RLS applies to it. It may touch the
-- connections table and nothing else.
drop policy if exists whatsapp_connections_worker on public.whatsapp_connections;
create policy whatsapp_connections_worker on public.whatsapp_connections
  for all to recete_wa_worker using (true) with check (true);
