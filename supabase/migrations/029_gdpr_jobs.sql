create table if not exists gdpr_jobs (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  job_type text not null,
  payload jsonb not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_gdpr_jobs_merchant_id
  on gdpr_jobs(merchant_id);

create index if not exists idx_gdpr_jobs_status
  on gdpr_jobs(status);

create index if not exists idx_gdpr_jobs_created_at
  on gdpr_jobs(created_at desc);
