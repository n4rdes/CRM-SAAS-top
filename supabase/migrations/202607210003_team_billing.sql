-- Equipe, convites, configurações e infraestrutura de cobrança do Prismae.
-- Esta migração preserva todos os dados existentes.

alter table public.tenants add column if not exists document text;
alter table public.tenants add column if not exists phone text;
alter table public.tenants add column if not exists timezone text not null default 'America/Sao_Paulo';

alter table public.subscriptions add column if not exists provider_price_id text;
alter table public.subscriptions add column if not exists cancel_at_period_end boolean not null default false;

create table if not exists public.tenant_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin','sales','recruiter','hr','manager','member','viewer')),
  token uuid not null unique default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending','accepted','canceled','expired')),
  invited_by uuid not null references auth.users(id),
  accepted_by uuid references auth.users(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists tenant_invitations_pending_email_idx
  on public.tenant_invitations (tenant_id, lower(email)) where status = 'pending';
create index if not exists tenant_invitations_tenant_idx on public.tenant_invitations(tenant_id, created_at desc);
create index if not exists tenant_invitations_token_idx on public.tenant_invitations(token);

create table if not exists public.billing_webhook_events (
  id text primary key,
  provider text not null,
  event_type text not null,
  processed_at timestamptz not null default now()
);

create table if not exists public.marketing_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company text not null,
  company_size text,
  objective text,
  source text not null default 'website',
  status text not null default 'new' check (status in ('new','contacted','qualified','won','lost')),
  attribution jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists marketing_leads_created_idx on public.marketing_leads(created_at desc);

drop trigger if exists set_tenant_invitations_updated_at on public.tenant_invitations;
create trigger set_tenant_invitations_updated_at
before update on public.tenant_invitations
for each row execute function public.set_updated_at();

create or replace function public.protect_tenant_identity()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.slug is distinct from old.slug or new.created_by is distinct from old.created_by then
    raise exception 'TENANT_IDENTITY_IMMUTABLE';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_tenant_identity_fields on public.tenants;
create trigger protect_tenant_identity_fields
before update of slug, created_by on public.tenants
for each row execute function public.protect_tenant_identity();

create or replace function public.shares_tenant_with(profile_user_id uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.tenant_id = mine.tenant_id
    where mine.user_id = auth.uid() and theirs.user_id = profile_user_id
  );
$$;

create or replace function public.create_tenant_invitation(p_tenant_id uuid, p_email text, p_role text default 'member')
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  clean_email text := lower(trim(p_email));
  selected_role text := lower(trim(p_role));
  plan_limits jsonb;
  maximum_users integer;
  occupied_slots integer;
  new_token uuid;
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if clean_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'INVALID_EMAIL'; end if;
  if selected_role not in ('admin','sales','recruiter','hr','manager','member','viewer') then raise exception 'INVALID_ROLE'; end if;

  select role into actor_role from public.memberships
  where tenant_id = p_tenant_id and user_id = actor_id;
  if actor_role not in ('owner','admin') then raise exception 'ADMIN_REQUIRED'; end if;
  if selected_role = 'admin' and actor_role <> 'owner' then raise exception 'OWNER_REQUIRED_FOR_ADMIN'; end if;

  if exists (
    select 1 from public.memberships m
    join auth.users u on u.id = m.user_id
    where m.tenant_id = p_tenant_id and lower(u.email) = clean_email
  ) then raise exception 'ALREADY_A_MEMBER'; end if;

  select p.limits into plan_limits
  from public.subscriptions s join public.plans p on p.id = s.plan_id
  where s.tenant_id = p_tenant_id;
  maximum_users := nullif(plan_limits ->> 'users', '')::integer;

  if maximum_users is not null then
    select
      (select count(*) from public.memberships where tenant_id = p_tenant_id) +
      (select count(*) from public.tenant_invitations where tenant_id = p_tenant_id and status = 'pending' and expires_at > now())
    into occupied_slots;
    if occupied_slots >= maximum_users then raise exception 'USER_LIMIT_REACHED'; end if;
  end if;

  update public.tenant_invitations
  set status = case when expires_at <= now() then 'expired' else 'canceled' end
  where tenant_id = p_tenant_id and lower(email) = clean_email and status = 'pending';

  insert into public.tenant_invitations (tenant_id, email, role, invited_by)
  values (p_tenant_id, clean_email, selected_role, actor_id)
  returning token into new_token;

  insert into public.audit_logs (tenant_id, actor_id, action, entity_type, entity_id, metadata)
  values (p_tenant_id, actor_id, 'invite.created', 'tenant_invitation', new_token::text, jsonb_build_object('email', clean_email, 'role', selected_role));

  return new_token;
end;
$$;

create or replace function public.preview_tenant_invitation(p_token uuid)
returns table (tenant_name text, invited_email text, invited_role text, invitation_status text, invitation_expires_at timestamptz)
language sql
stable
security definer set search_path = ''
as $$
  select t.name, i.email, i.role,
    case when i.status = 'pending' and i.expires_at <= now() then 'expired' else i.status end,
    i.expires_at
  from public.tenant_invitations i
  join public.tenants t on t.id = i.tenant_id
  where i.token = p_token;
$$;

create or replace function public.accept_tenant_invitation(p_token uuid)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  invitation_record public.tenant_invitations%rowtype;
  membership_id uuid;
  maximum_users integer;
  current_members integer;
begin
  if current_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into invitation_record from public.tenant_invitations
  where token = p_token for update;
  if invitation_record.id is null then raise exception 'INVITATION_NOT_FOUND'; end if;
  if invitation_record.status <> 'pending' then raise exception 'INVITATION_NOT_PENDING'; end if;
  if invitation_record.expires_at <= now() then
    update public.tenant_invitations set status = 'expired' where id = invitation_record.id;
    raise exception 'INVITATION_EXPIRED';
  end if;
  if current_email <> lower(invitation_record.email) then raise exception 'INVITATION_EMAIL_MISMATCH'; end if;
  if exists (select 1 from public.memberships where user_id = current_user_id and tenant_id <> invitation_record.tenant_id) then
    raise exception 'USER_ALREADY_HAS_WORKSPACE';
  end if;

  select nullif(p.limits ->> 'users', '')::integer into maximum_users
  from public.subscriptions s join public.plans p on p.id = s.plan_id
  where s.tenant_id = invitation_record.tenant_id;
  if maximum_users is not null then
    select count(*) into current_members from public.memberships where tenant_id = invitation_record.tenant_id;
    if current_members >= maximum_users and not exists (
      select 1 from public.memberships where tenant_id = invitation_record.tenant_id and user_id = current_user_id
    ) then raise exception 'USER_LIMIT_REACHED'; end if;
  end if;

  insert into public.memberships (tenant_id, user_id, role)
  values (invitation_record.tenant_id, current_user_id, invitation_record.role)
  on conflict (tenant_id, user_id) do update set role = excluded.role
  returning id into membership_id;

  update public.tenant_invitations
  set status = 'accepted', accepted_by = current_user_id, accepted_at = now()
  where id = invitation_record.id;

  insert into public.audit_logs (tenant_id, actor_id, action, entity_type, entity_id, metadata)
  values (invitation_record.tenant_id, current_user_id, 'invite.accepted', 'membership', membership_id::text, jsonb_build_object('role', invitation_record.role));

  return invitation_record.tenant_id;
end;
$$;

create or replace function public.cancel_tenant_invitation(p_invitation_id uuid)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  invitation_tenant_id uuid;
begin
  select tenant_id into invitation_tenant_id from public.tenant_invitations where id = p_invitation_id;
  if invitation_tenant_id is null then raise exception 'INVITATION_NOT_FOUND'; end if;
  if not public.has_tenant_role(invitation_tenant_id, array['owner','admin']) then raise exception 'ADMIN_REQUIRED'; end if;

  update public.tenant_invitations set status = 'canceled'
  where id = p_invitation_id and status = 'pending';
  return found;
end;
$$;

create or replace function public.update_tenant_member_role(p_membership_id uuid, p_role text)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  target_tenant_id uuid;
  target_role text;
  selected_role text := lower(trim(p_role));
begin
  if selected_role not in ('admin','sales','recruiter','hr','manager','member','viewer') then raise exception 'INVALID_ROLE'; end if;
  select tenant_id, role into target_tenant_id, target_role from public.memberships where id = p_membership_id;
  if target_tenant_id is null then raise exception 'MEMBER_NOT_FOUND'; end if;
  select role into actor_role from public.memberships where tenant_id = target_tenant_id and user_id = actor_id;
  if actor_role not in ('owner','admin') then raise exception 'ADMIN_REQUIRED'; end if;
  if target_role = 'owner' then raise exception 'OWNER_ROLE_IMMUTABLE'; end if;
  if (target_role = 'admin' or selected_role = 'admin') and actor_role <> 'owner' then raise exception 'OWNER_REQUIRED_FOR_ADMIN'; end if;

  update public.memberships set role = selected_role where id = p_membership_id;
  insert into public.audit_logs (tenant_id, actor_id, action, entity_type, entity_id, metadata)
  values (target_tenant_id, actor_id, 'membership.role_updated', 'membership', p_membership_id::text, jsonb_build_object('from', target_role, 'to', selected_role));
  return true;
end;
$$;

create or replace function public.remove_tenant_member(p_membership_id uuid)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  target_tenant_id uuid;
  target_user_id uuid;
  target_role text;
begin
  select tenant_id, user_id, role into target_tenant_id, target_user_id, target_role
  from public.memberships where id = p_membership_id;
  if target_tenant_id is null then raise exception 'MEMBER_NOT_FOUND'; end if;
  select role into actor_role from public.memberships where tenant_id = target_tenant_id and user_id = actor_id;
  if actor_role not in ('owner','admin') then raise exception 'ADMIN_REQUIRED'; end if;
  if target_role = 'owner' or target_user_id = actor_id then raise exception 'CANNOT_REMOVE_OWNER_OR_SELF'; end if;
  if target_role = 'admin' and actor_role <> 'owner' then raise exception 'OWNER_REQUIRED_FOR_ADMIN'; end if;

  delete from public.memberships where id = p_membership_id;
  insert into public.audit_logs (tenant_id, actor_id, action, entity_type, entity_id)
  values (target_tenant_id, actor_id, 'membership.removed', 'membership', p_membership_id::text);
  return true;
end;
$$;

revoke all on function public.shares_tenant_with(uuid) from public;
revoke all on function public.protect_tenant_identity() from public;
revoke all on function public.create_tenant_invitation(uuid, text, text) from public;
revoke all on function public.preview_tenant_invitation(uuid) from public;
revoke all on function public.accept_tenant_invitation(uuid) from public;
revoke all on function public.cancel_tenant_invitation(uuid) from public;
revoke all on function public.update_tenant_member_role(uuid, text) from public;
revoke all on function public.remove_tenant_member(uuid) from public;

grant execute on function public.shares_tenant_with(uuid) to authenticated;
grant execute on function public.create_tenant_invitation(uuid, text, text) to authenticated;
grant execute on function public.preview_tenant_invitation(uuid) to anon, authenticated;
grant execute on function public.accept_tenant_invitation(uuid) to authenticated;
grant execute on function public.cancel_tenant_invitation(uuid) to authenticated;
grant execute on function public.update_tenant_member_role(uuid, text) to authenticated;
grant execute on function public.remove_tenant_member(uuid) to authenticated;

alter table public.tenant_invitations enable row level security;
alter table public.billing_webhook_events enable row level security;
alter table public.marketing_leads enable row level security;

drop policy if exists "profiles_select_teammate" on public.profiles;
create policy "profiles_select_teammate" on public.profiles for select to authenticated using (public.shares_tenant_with(id));

drop policy if exists "invitations_select_admin_or_recipient" on public.tenant_invitations;
create policy "invitations_select_admin_or_recipient" on public.tenant_invitations for select to authenticated
using (
  public.has_tenant_role(tenant_id, array['owner','admin'])
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

-- Papéis operacionais: viewer é leitura; sales cuida do CRM; recruiter/RH cuidam do ATS.
drop policy if exists "companies_insert_member" on public.crm_companies;
drop policy if exists "companies_update_member" on public.crm_companies;
create policy "companies_insert_operator" on public.crm_companies for insert to authenticated
with check (public.has_tenant_role(tenant_id, array['owner','admin','sales','manager','member']));
create policy "companies_update_operator" on public.crm_companies for update to authenticated
using (public.has_tenant_role(tenant_id, array['owner','admin','sales','manager','member']))
with check (public.has_tenant_role(tenant_id, array['owner','admin','sales','manager','member']));

drop policy if exists "jobs_insert_member" on public.jobs;
drop policy if exists "jobs_update_member" on public.jobs;
create policy "jobs_insert_operator" on public.jobs for insert to authenticated
with check (public.has_tenant_role(tenant_id, array['owner','admin','recruiter','hr','manager','member']));
create policy "jobs_update_operator" on public.jobs for update to authenticated
using (public.has_tenant_role(tenant_id, array['owner','admin','recruiter','hr','manager','member']))
with check (public.has_tenant_role(tenant_id, array['owner','admin','recruiter','hr','manager','member']));

drop policy if exists "candidates_insert_member" on public.candidates;
drop policy if exists "candidates_update_member" on public.candidates;
create policy "candidates_insert_operator" on public.candidates for insert to authenticated
with check (public.has_tenant_role(tenant_id, array['owner','admin','recruiter','hr','manager','member']));
create policy "candidates_update_operator" on public.candidates for update to authenticated
using (public.has_tenant_role(tenant_id, array['owner','admin','recruiter','hr','manager','member']))
with check (public.has_tenant_role(tenant_id, array['owner','admin','recruiter','hr','manager','member']));

drop policy if exists "applications_insert_member" on public.applications;
drop policy if exists "applications_update_member" on public.applications;
drop policy if exists "applications_delete_admin" on public.applications;
create policy "applications_insert_operator" on public.applications for insert to authenticated
with check (public.has_tenant_role(tenant_id, array['owner','admin','recruiter','hr','manager','member']));
create policy "applications_update_operator" on public.applications for update to authenticated
using (public.has_tenant_role(tenant_id, array['owner','admin','recruiter','hr','manager','member']))
with check (public.has_tenant_role(tenant_id, array['owner','admin','recruiter','hr','manager','member']));
create policy "applications_delete_operator" on public.applications for delete to authenticated
using (public.has_tenant_role(tenant_id, array['owner','admin','recruiter','hr','manager','member']));

revoke insert, update, delete on public.memberships from authenticated;
revoke all on public.tenant_invitations, public.billing_webhook_events, public.marketing_leads from anon, authenticated;
grant select on public.tenant_invitations to authenticated;
