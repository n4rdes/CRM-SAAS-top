-- Prismae People OS: endurecimento para produção.
-- Caixa transacional de webhooks, ordenação Stripe, rate limiting,
-- auditoria de documentos e índices de desempenho.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Webhooks Stripe: registrar antes de processar, reivindicar atomicamente e
-- permitir retry após falha/trava expirada.
-- ---------------------------------------------------------------------------

alter table public.billing_webhook_events
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists status text,
  add column if not exists attempts integer not null default 0,
  add column if not exists event_created_at timestamptz,
  add column if not exists provider_subscription_id text,
  add column if not exists tenant_id uuid references public.tenants(id) on delete set null,
  add column if not exists locked_at timestamptz,
  add column if not exists outcome text,
  add column if not exists last_error text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.billing_webhook_events alter column processed_at drop not null;
alter table public.billing_webhook_events alter column processed_at drop default;

update public.billing_webhook_events
set status = coalesce(status, 'processed'),
    attempts = greatest(attempts, 1),
    event_created_at = coalesce(event_created_at, processed_at, created_at),
    created_at = coalesce(created_at, processed_at, now()),
    updated_at = coalesce(updated_at, processed_at, now())
where status is null or event_created_at is null;

alter table public.billing_webhook_events alter column status set default 'pending';
alter table public.billing_webhook_events alter column status set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'billing_webhook_events_status_check'
      and conrelid = 'public.billing_webhook_events'::regclass
  ) then
    alter table public.billing_webhook_events
      add constraint billing_webhook_events_status_check
      check (status in ('pending','processing','processed','ignored','failed'));
  end if;
end;
$$;

create index if not exists billing_webhook_events_status_created_idx
  on public.billing_webhook_events(status, created_at);
create index if not exists billing_webhook_events_subscription_created_idx
  on public.billing_webhook_events(provider_subscription_id, event_created_at desc);

alter table public.subscriptions
  add column if not exists provider_event_created_at timestamptz,
  add column if not exists provider_event_priority integer not null default 0,
  add column if not exists provider_event_id text;

create or replace function public.claim_billing_webhook_event(
  p_id text,
  p_provider text,
  p_event_type text,
  p_event_created_at timestamptz,
  p_payload jsonb,
  p_provider_subscription_id text default null
)
returns table (claimed boolean, duplicate boolean, attempt integer, state text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row public.billing_webhook_events%rowtype;
begin
  insert into public.billing_webhook_events (
    id, provider, event_type, payload, status, attempts,
    event_created_at, provider_subscription_id, locked_at, created_at, updated_at
  ) values (
    p_id, p_provider, p_event_type, coalesce(p_payload, '{}'::jsonb), 'processing', 1,
    p_event_created_at, p_provider_subscription_id, now(), now(), now()
  )
  on conflict (id) do nothing;

  if found then
    return query select true, false, 1, 'processing'::text;
    return;
  end if;

  select * into current_row
  from public.billing_webhook_events
  where id = p_id
  for update;

  if current_row.status in ('processed','ignored') then
    return query select false, true, current_row.attempts, current_row.status;
    return;
  end if;

  if current_row.status = 'processing'
     and current_row.locked_at is not null
     and current_row.locked_at > now() - interval '5 minutes' then
    return query select false, true, current_row.attempts, 'processing'::text;
    return;
  end if;

  update public.billing_webhook_events
  set status = 'processing',
      attempts = attempts + 1,
      locked_at = now(),
      payload = coalesce(p_payload, payload),
      event_type = p_event_type,
      event_created_at = coalesce(p_event_created_at, event_created_at),
      provider_subscription_id = coalesce(p_provider_subscription_id, provider_subscription_id),
      last_error = null,
      updated_at = now()
  where id = p_id
  returning * into current_row;

  return query select true, false, current_row.attempts, 'retrying'::text;
end;
$$;

create or replace function public.complete_billing_webhook_event(
  p_id text,
  p_status text,
  p_outcome text default null,
  p_error text default null,
  p_tenant_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('processed','ignored','failed') then
    raise exception 'INVALID_WEBHOOK_STATUS';
  end if;

  update public.billing_webhook_events
  set status = p_status,
      outcome = left(p_outcome, 500),
      last_error = left(p_error, 2000),
      tenant_id = coalesce(p_tenant_id, tenant_id),
      processed_at = case when p_status in ('processed','ignored') then now() else null end,
      locked_at = null,
      updated_at = now()
  where id = p_id and status = 'processing';

  return found;
end;
$$;

create or replace function public.apply_stripe_subscription_event(
  p_tenant_id uuid,
  p_plan_id uuid,
  p_status text,
  p_customer_id text,
  p_subscription_id text,
  p_price_id text,
  p_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_grace_ends_at timestamptz,
  p_event_id text,
  p_event_created_at timestamptz,
  p_event_priority integer default 0,
  p_force boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.subscriptions
  set plan_id = p_plan_id,
      status = p_status,
      provider = 'stripe',
      provider_customer_id = p_customer_id,
      provider_subscription_id = p_subscription_id,
      provider_price_id = p_price_id,
      current_period_ends_at = p_period_end,
      cancel_at_period_end = p_cancel_at_period_end,
      grace_ends_at = p_grace_ends_at,
      provider_event_id = p_event_id,
      provider_event_created_at = p_event_created_at,
      provider_event_priority = p_event_priority,
      updated_at = now()
  where tenant_id = p_tenant_id
    and (
      p_force
      or provider_event_created_at is null
      or p_event_created_at > provider_event_created_at
      or (
        p_event_created_at = provider_event_created_at
        and (
          p_event_priority > provider_event_priority
          or (p_event_priority = provider_event_priority and p_event_id > coalesce(provider_event_id, ''))
        )
      )
    );

  return found;
end;
$$;

revoke all on function public.claim_billing_webhook_event(text,text,text,timestamptz,jsonb,text) from public, anon, authenticated;
revoke all on function public.complete_billing_webhook_event(text,text,text,text,uuid) from public, anon, authenticated;
revoke all on function public.apply_stripe_subscription_event(uuid,uuid,text,text,text,text,timestamptz,boolean,timestamptz,text,timestamptz,integer,boolean) from public, anon, authenticated;
grant execute on function public.claim_billing_webhook_event(text,text,text,timestamptz,jsonb,text) to service_role;
grant execute on function public.complete_billing_webhook_event(text,text,text,text,uuid) to service_role;
grant execute on function public.apply_stripe_subscription_event(uuid,uuid,text,text,text,text,timestamptz,boolean,timestamptz,text,timestamptz,integer,boolean) to service_role;

-- ---------------------------------------------------------------------------
-- Rate limiting distribuído. A aplicação envia somente hashes HMAC; nenhum IP
-- ou e-mail em texto puro é armazenado.
-- ---------------------------------------------------------------------------

create table if not exists public.api_rate_limits (
  scope text not null,
  key_hash text not null,
  window_started_at timestamptz not null,
  hit_count integer not null default 1 check (hit_count > 0),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (scope, key_hash, window_started_at)
);

create index if not exists api_rate_limits_expiry_idx on public.api_rate_limits(expires_at);
alter table public.api_rate_limits enable row level security;

create or replace function public.consume_api_rate_limit(
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_window timestamptz;
  current_count integer;
  expiry timestamptz;
begin
  if char_length(p_scope) < 2 or char_length(p_scope) > 120 then raise exception 'INVALID_RATE_SCOPE'; end if;
  if char_length(p_key_hash) < 32 or char_length(p_key_hash) > 128 then raise exception 'INVALID_RATE_KEY'; end if;
  if p_limit < 1 or p_limit > 10000 then raise exception 'INVALID_RATE_LIMIT'; end if;
  if p_window_seconds < 1 or p_window_seconds > 604800 then raise exception 'INVALID_RATE_WINDOW'; end if;

  current_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  expiry := current_window + make_interval(secs => p_window_seconds);

  -- Limpeza oportunista e limitada ao mesmo identificador. Evita crescimento
  -- indefinido sem transformar cada requisição em uma varredura global.
  delete from public.api_rate_limits
  where scope = p_scope
    and key_hash = p_key_hash
    and expires_at < now() - interval '1 day';

  insert into public.api_rate_limits(scope, key_hash, window_started_at, hit_count, expires_at, updated_at)
  values (p_scope, p_key_hash, current_window, 1, expiry, now())
  on conflict (scope, key_hash, window_started_at)
  do update set hit_count = public.api_rate_limits.hit_count + 1, updated_at = now()
  returning hit_count into current_count;

  return query select
    current_count <= p_limit,
    greatest(p_limit - current_count, 0),
    greatest(ceil(extract(epoch from expiry - now()))::integer, 1);
end;
$$;

revoke all on table public.api_rate_limits from public, anon, authenticated;
revoke all on function public.consume_api_rate_limit(text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text,text,integer,integer) to service_role;

-- ---------------------------------------------------------------------------
-- Documentos: classificação, retenção, estado de varredura e log de acesso.
-- ---------------------------------------------------------------------------

alter table public.employee_documents
  add column if not exists document_scope text not null default 'personal',
  add column if not exists retention_until date,
  add column if not exists malware_scan_status text not null default 'not_configured',
  add column if not exists malware_scan_provider text,
  add column if not exists malware_scan_reference text,
  add column if not exists malware_scanned_at timestamptz,
  add column if not exists integrity_validated_at timestamptz,
  add column if not exists download_count integer not null default 0,
  add column if not exists last_downloaded_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'employee_documents_scope_check'
      and conrelid = 'public.employee_documents'::regclass
  ) then
    alter table public.employee_documents
      add constraint employee_documents_scope_check
      check (document_scope in ('personal','company'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'employee_documents_scan_status_check'
      and conrelid = 'public.employee_documents'::regclass
  ) then
    alter table public.employee_documents
      add constraint employee_documents_scan_status_check
      check (malware_scan_status in ('not_configured','pending','clean','infected','error'));
  end if;
end;
$$;

create table if not exists public.employee_document_access_logs (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  document_id uuid references public.employee_documents(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('download','upload','delete','scan')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists employee_document_access_tenant_created_idx
  on public.employee_document_access_logs(tenant_id, created_at desc);
create index if not exists employee_document_access_document_idx
  on public.employee_document_access_logs(document_id, created_at desc);

alter table public.employee_document_access_logs enable row level security;

drop policy if exists "employee_document_access_read" on public.employee_document_access_logs;
create policy "employee_document_access_read"
on public.employee_document_access_logs for select to authenticated
using (public.has_tenant_role(tenant_id, array['owner','admin','hr']));

create or replace function public.register_employee_document_download(
  p_document_id uuid,
  p_require_clean boolean default false
)
returns table (storage_path text, file_name text, mime_type text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_document public.employee_documents%rowtype;
begin
  select * into selected_document
  from public.employee_documents
  where id = p_document_id;

  if selected_document.id is null then raise exception 'DOCUMENT_NOT_FOUND'; end if;
  if not public.has_tenant_role(selected_document.tenant_id, array['owner','admin','hr']) then
    raise exception 'DOCUMENT_ACCESS_DENIED';
  end if;
  if selected_document.malware_scan_status = 'infected'
     or (p_require_clean and selected_document.malware_scan_status <> 'clean') then
    raise exception 'DOCUMENT_QUARANTINED';
  end if;

  update public.employee_documents
  set download_count = download_count + 1,
      last_downloaded_at = now()
  where id = selected_document.id;

  insert into public.employee_document_access_logs(tenant_id, document_id, employee_id, actor_id, action)
  values(selected_document.tenant_id, selected_document.id, selected_document.employee_id, auth.uid(), 'download');

  return query select selected_document.storage_path, selected_document.file_name, selected_document.mime_type;
end;
$$;

revoke all on function public.register_employee_document_download(uuid,boolean) from public, anon;
grant execute on function public.register_employee_document_download(uuid,boolean) to authenticated;
grant select on public.employee_document_access_logs to authenticated;

-- Downloads passam obrigatoriamente pela rota auditada. Upload e exclusão
-- continuam respeitando as policies específicas da migration 005.
drop policy if exists "employee_files_read" on storage.objects;

-- ---------------------------------------------------------------------------
-- Índices de consultas mais frequentes para reduzir leituras e travamentos.
-- ---------------------------------------------------------------------------

create index if not exists subscriptions_tenant_status_idx on public.subscriptions(tenant_id, status);
create index if not exists jobs_tenant_status_updated_idx on public.jobs(tenant_id, status, updated_at desc);
create index if not exists candidates_tenant_created_idx on public.candidates(tenant_id, created_at desc);
create index if not exists applications_tenant_stage_updated_idx on public.applications(tenant_id, stage, updated_at desc);
create index if not exists employees_tenant_status_name_idx on public.employees(tenant_id, status, full_name);
create index if not exists employee_workflows_tenant_employee_created_idx on public.employee_workflows(tenant_id, employee_id, created_at desc);
create index if not exists employee_documents_tenant_employee_created_idx on public.employee_documents(tenant_id, employee_id, created_at desc);
create index if not exists engagement_surveys_tenant_status_created_idx on public.engagement_surveys(tenant_id, status, created_at desc);
create index if not exists leave_requests_tenant_status_dates_idx on public.leave_requests(tenant_id, status, start_date, end_date);
create index if not exists app_notifications_unread_idx on public.app_notifications(tenant_id, user_id, created_at desc) where read_at is null;
create index if not exists automation_runs_tenant_created_idx on public.automation_runs(tenant_id, started_at desc);

-- Evita que tabelas técnicas apareçam na API pública mesmo se grants futuros
-- forem aplicados de forma ampla.
revoke all on table public.billing_webhook_events from public, anon, authenticated;
