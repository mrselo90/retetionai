create table if not exists gdpr_exports (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  source text not null,
  shop_domain text,
  status text not null default 'ready',
  payload jsonb not null,
  requested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_gdpr_exports_merchant_id
  on gdpr_exports(merchant_id);

create index if not exists idx_gdpr_exports_user_id
  on gdpr_exports(user_id);

create index if not exists idx_gdpr_exports_requested_at
  on gdpr_exports(requested_at desc);
