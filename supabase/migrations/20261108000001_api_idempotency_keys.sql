-- Server-side claim store for retry-safe state-changing routes (e.g. POST /api/schools).
-- Service role only; RLS stays on with no policies so authenticated/anon have no access.

create table if not exists public.api_idempotency_keys (
  key uuid primary key,
  scope text not null,
  request_hash text not null,
  state text not null check (state in ('in_progress', 'done', 'failed')),
  resource_id uuid,
  response jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);

create index if not exists api_idempotency_keys_expires_idx
  on public.api_idempotency_keys (expires_at);

alter table public.api_idempotency_keys enable row level security;

create or replace function public.cleanup_api_idempotency_keys()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.api_idempotency_keys where expires_at < now();
$$;

revoke all on function public.cleanup_api_idempotency_keys() from public, anon;
grant execute on function public.cleanup_api_idempotency_keys() to service_role;
