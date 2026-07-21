-- Prismae People OS: fundação multiempresa, assinatura e módulos iniciais.
-- Execute pelo SQL Editor do Supabase ou com `supabase db push`.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  slug text not null unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','sales','recruiter','hr','manager','member','viewer')),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create index if not exists memberships_user_idx on public.memberships(user_id);
create index if not exists memberships_tenant_idx on public.memberships(tenant_id);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('basic','pro','custom')),
  name text not null,
  price_monthly_cents integer check (price_monthly_cents is null or price_monthly_cents >= 0),
  features jsonb not null default '{}'::jsonb,
  limits jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.plans (code, name, price_monthly_cents, features, limits)
values
  ('basic', 'Basic', 29700, '{"crm":true,"ats":true,"people":true,"automations":false,"ai":false}'::jsonb, '{"users":5,"employees":100,"active_jobs":10,"storage_gb":10}'::jsonb),
  ('pro', 'Pro', 69700, '{"crm":true,"ats":true,"people":true,"automations":true,"ai":true,"api":true}'::jsonb, '{"users":20,"employees":500,"active_jobs":null,"storage_gb":50}'::jsonb),
  ('custom', 'Custom', null, '{"crm":true,"ats":true,"people":true,"automations":true,"ai":true,"api":true,"sso":true,"white_label":true}'::jsonb, '{"users":null,"employees":null,"active_jobs":null,"storage_gb":null}'::jsonb)
on conflict (code) do update set
  name = excluded.name,
  price_monthly_cents = excluded.price_monthly_cents,
  features = excluded.features,
  limits = excluded.limits,
  updated_at = now();

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  status text not null default 'trialing' check (status in ('trialing','active','past_due','grace','suspended','canceled')),
  provider text,
  provider_customer_id text,
  provider_subscription_id text unique,
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  grace_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_companies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 180),
  document text,
  email text,
  phone text,
  stage text not null default 'lead' check (stage in ('lead','qualified','proposal','customer','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id)
);

create index if not exists crm_companies_tenant_idx on public.crm_companies(tenant_id);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  company_id uuid,
  title text not null check (char_length(title) between 2 and 180),
  description text,
  status text not null default 'draft' check (status in ('draft','open','paused','closed','canceled')),
  openings integer not null default 1 check (openings > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, company_id) references public.crm_companies(tenant_id, id) on delete set null (company_id)
);

create index if not exists jobs_tenant_idx on public.jobs(tenant_id);
create index if not exists jobs_company_idx on public.jobs(company_id);

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 3 and 180),
  email text not null,
  phone text,
  source text not null default 'manual',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, email),
  unique (tenant_id, id)
);

create index if not exists candidates_tenant_idx on public.candidates(tenant_id);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  job_id uuid not null,
  candidate_id uuid not null,
  stage text not null default 'applied' check (stage in ('applied','screening','interview','assessment','offer','hired','rejected','withdrawn')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, candidate_id),
  foreign key (tenant_id, job_id) references public.jobs(tenant_id, id) on delete cascade,
  foreign key (tenant_id, candidate_id) references public.candidates(tenant_id, id) on delete cascade
);

create index if not exists applications_tenant_idx on public.applications(tenant_id);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_tenant_created_idx on public.audit_logs(tenant_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','tenants','plans','subscriptions','crm_companies','jobs','candidates','applications']
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end;
$$;

create or replace function public.prevent_tenant_id_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.tenant_id is distinct from old.tenant_id then
    raise exception 'TENANT_ID_IMMUTABLE';
  end if;
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['memberships','subscriptions','crm_companies','jobs','candidates','applications']
  loop
    execute format('drop trigger if exists protect_%I_tenant_id on public.%I', table_name, table_name);
    execute format('create trigger protect_%I_tenant_id before update of tenant_id on public.%I for each row execute function public.prevent_tenant_id_change()', table_name, table_name);
  end loop;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_tenant_member(check_tenant_id uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships
    where tenant_id = check_tenant_id and user_id = auth.uid()
  );
$$;

create or replace function public.has_tenant_role(check_tenant_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships
    where tenant_id = check_tenant_id
      and user_id = auth.uid()
      and role = any(allowed_roles)
  );
$$;

create or replace function public.create_tenant_for_current_user(p_name text, p_plan_code text default 'basic')
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  new_tenant_id uuid;
  selected_plan_id uuid;
  clean_name text := trim(p_name);
begin
  if current_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if char_length(clean_name) < 2 then raise exception 'INVALID_TENANT_NAME'; end if;
  if exists (select 1 from public.memberships where user_id = current_user_id) then
    raise exception 'USER_ALREADY_HAS_TENANT';
  end if;

  select id into selected_plan_id from public.plans where code = lower(p_plan_code) and active = true;
  if selected_plan_id is null then select id into selected_plan_id from public.plans where code = 'basic'; end if;

  insert into public.profiles (id, full_name)
  values (current_user_id, nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''))
  on conflict (id) do nothing;

  insert into public.tenants (name, slug, created_by)
  values (clean_name, 'empresa-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12), current_user_id)
  returning id into new_tenant_id;

  insert into public.memberships (tenant_id, user_id, role)
  values (new_tenant_id, current_user_id, 'owner');

  insert into public.subscriptions (tenant_id, plan_id, status, trial_ends_at)
  values (new_tenant_id, selected_plan_id, 'trialing', now() + interval '14 days');

  insert into public.audit_logs (tenant_id, actor_id, action, entity_type, entity_id)
  values (new_tenant_id, current_user_id, 'tenant.created', 'tenant', new_tenant_id::text);

  return new_tenant_id;
end;
$$;

revoke all on function public.create_tenant_for_current_user(text, text) from public;
revoke all on function public.is_tenant_member(uuid) from public;
revoke all on function public.has_tenant_role(uuid, text[]) from public;
grant execute on function public.create_tenant_for_current_user(text, text) to authenticated;
grant execute on function public.is_tenant_member(uuid) to authenticated;
grant execute on function public.has_tenant_role(uuid, text[]) to authenticated;

alter table public.profiles enable row level security;
alter table public.tenants enable row level security;
alter table public.memberships enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.crm_companies enable row level security;
alter table public.jobs enable row level security;
alter table public.candidates enable row level security;
alter table public.applications enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "tenants_select_member" on public.tenants for select to authenticated using (public.is_tenant_member(id));
create policy "tenants_update_admin" on public.tenants for update to authenticated using (public.has_tenant_role(id, array['owner','admin'])) with check (public.has_tenant_role(id, array['owner','admin']));

create policy "memberships_select_member" on public.memberships for select to authenticated using (user_id = auth.uid() or public.is_tenant_member(tenant_id));
create policy "memberships_insert_admin" on public.memberships for insert to authenticated with check (public.has_tenant_role(tenant_id, array['owner','admin']));
create policy "memberships_update_admin" on public.memberships for update to authenticated using (public.has_tenant_role(tenant_id, array['owner','admin'])) with check (public.has_tenant_role(tenant_id, array['owner','admin']));
create policy "memberships_delete_admin" on public.memberships for delete to authenticated using (public.has_tenant_role(tenant_id, array['owner','admin']) and user_id <> auth.uid());

create policy "plans_read_active" on public.plans for select to anon, authenticated using (active = true);
create policy "subscriptions_select_member" on public.subscriptions for select to authenticated using (public.is_tenant_member(tenant_id));

create policy "companies_select_member" on public.crm_companies for select to authenticated using (public.is_tenant_member(tenant_id));
create policy "companies_insert_member" on public.crm_companies for insert to authenticated with check (public.is_tenant_member(tenant_id));
create policy "companies_update_member" on public.crm_companies for update to authenticated using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));
create policy "companies_delete_admin" on public.crm_companies for delete to authenticated using (public.has_tenant_role(tenant_id, array['owner','admin']));

create policy "jobs_select_member" on public.jobs for select to authenticated using (public.is_tenant_member(tenant_id));
create policy "jobs_insert_member" on public.jobs for insert to authenticated with check (public.is_tenant_member(tenant_id));
create policy "jobs_update_member" on public.jobs for update to authenticated using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));
create policy "jobs_delete_admin" on public.jobs for delete to authenticated using (public.has_tenant_role(tenant_id, array['owner','admin']));

create policy "candidates_select_member" on public.candidates for select to authenticated using (public.is_tenant_member(tenant_id));
create policy "candidates_insert_member" on public.candidates for insert to authenticated with check (public.is_tenant_member(tenant_id));
create policy "candidates_update_member" on public.candidates for update to authenticated using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));
create policy "candidates_delete_admin" on public.candidates for delete to authenticated using (public.has_tenant_role(tenant_id, array['owner','admin']));

create policy "applications_select_member" on public.applications for select to authenticated using (public.is_tenant_member(tenant_id));
create policy "applications_insert_member" on public.applications for insert to authenticated with check (public.is_tenant_member(tenant_id));
create policy "applications_update_member" on public.applications for update to authenticated using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));
create policy "applications_delete_admin" on public.applications for delete to authenticated using (public.has_tenant_role(tenant_id, array['owner','admin']));

create policy "audit_select_admin" on public.audit_logs for select to authenticated using (public.has_tenant_role(tenant_id, array['owner','admin']));

-- Privilégios mínimos; as políticas RLS continuam sendo aplicadas em todas as consultas.
revoke all on public.profiles, public.tenants, public.memberships, public.plans, public.subscriptions, public.crm_companies, public.jobs, public.candidates, public.applications, public.audit_logs from anon, authenticated;
grant select on public.plans to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, update on public.tenants to authenticated;
grant select, insert, update, delete on public.memberships to authenticated;
grant select on public.subscriptions to authenticated;
grant select, insert, update, delete on public.crm_companies, public.jobs, public.candidates, public.applications to authenticated;
grant select on public.audit_logs to authenticated;
