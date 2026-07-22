-- Prismae People OS: CRM de contatos, agenda operacional, avaliações e histórico do ATS.
-- Execute depois das migrações 001, 002 e 003.

create table if not exists public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  company_id uuid not null,
  full_name text not null check (char_length(full_name) between 2 and 180),
  job_title text,
  email text,
  phone text,
  decision_maker boolean not null default false,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, company_id) references public.crm_companies(tenant_id, id) on delete cascade
);

create index if not exists crm_contacts_company_idx on public.crm_contacts(tenant_id, company_id);
create index if not exists crm_contacts_email_idx on public.crm_contacts(tenant_id, lower(email));

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  entity_type text not null default 'general' check (entity_type in ('general','company','candidate','job','application')),
  entity_id uuid,
  activity_type text not null check (activity_type in ('task','call','email','meeting','interview','follow_up','note')),
  subject text not null check (char_length(subject) between 2 and 180),
  description text,
  due_at timestamptz,
  completed_at timestamptz,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists activities_agenda_idx on public.activities(tenant_id, completed_at, due_at);
create index if not exists activities_entity_idx on public.activities(tenant_id, entity_type, entity_id, created_at desc);

create table if not exists public.application_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  application_id uuid not null,
  reviewer_id uuid references auth.users(id) on delete set null,
  score smallint not null check (score between 1 and 5),
  recommendation text not null check (recommendation in ('strong_no','no','neutral','yes','strong_yes')),
  strengths text,
  risks text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, reviewer_id),
  foreign key (tenant_id, application_id) references public.applications(tenant_id, id) on delete cascade
);

create index if not exists application_reviews_application_idx on public.application_reviews(tenant_id, application_id);

create table if not exists public.application_stage_history (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  application_id uuid not null,
  from_stage text,
  to_stage text not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, application_id) references public.applications(tenant_id, id) on delete cascade
);

create index if not exists application_stage_history_idx on public.application_stage_history(tenant_id, application_id, created_at desc);

drop trigger if exists set_crm_contacts_updated_at on public.crm_contacts;
create trigger set_crm_contacts_updated_at before update on public.crm_contacts
for each row execute function public.set_updated_at();
drop trigger if exists set_activities_updated_at on public.activities;
create trigger set_activities_updated_at before update on public.activities
for each row execute function public.set_updated_at();
drop trigger if exists set_application_reviews_updated_at on public.application_reviews;
create trigger set_application_reviews_updated_at before update on public.application_reviews
for each row execute function public.set_updated_at();

do $$
declare table_name text;
begin
  foreach table_name in array array['crm_contacts','activities','application_reviews','application_stage_history']
  loop
    execute format('drop trigger if exists protect_%I_tenant_id on public.%I', table_name, table_name);
    execute format('create trigger protect_%I_tenant_id before update of tenant_id on public.%I for each row execute function public.prevent_tenant_id_change()', table_name, table_name);
  end loop;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['crm_contacts','activities','application_reviews']
  loop
    execute format('drop trigger if exists audit_%I_changes on public.%I', table_name, table_name);
    execute format('create trigger audit_%I_changes after insert or update or delete on public.%I for each row execute function public.audit_tenant_record()', table_name, table_name);
  end loop;
end;
$$;

create or replace function public.record_application_stage_history()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    insert into public.application_stage_history (tenant_id, application_id, from_stage, to_stage, changed_by)
    values (new.tenant_id, new.id, case when tg_op = 'UPDATE' then old.stage else null end, new.stage, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists record_application_stage on public.applications;
create trigger record_application_stage after insert or update of stage on public.applications
for each row execute function public.record_application_stage_history();

alter table public.crm_contacts enable row level security;
alter table public.activities enable row level security;
alter table public.application_reviews enable row level security;
alter table public.application_stage_history enable row level security;

create policy "crm_contacts_select_member" on public.crm_contacts for select to authenticated using (public.is_tenant_member(tenant_id));
create policy "crm_contacts_insert_member" on public.crm_contacts for insert to authenticated with check (public.is_tenant_member(tenant_id));
create policy "crm_contacts_update_member" on public.crm_contacts for update to authenticated using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));
create policy "crm_contacts_delete_member" on public.crm_contacts for delete to authenticated using (public.is_tenant_member(tenant_id));

create policy "activities_select_member" on public.activities for select to authenticated using (public.is_tenant_member(tenant_id));
create policy "activities_insert_member" on public.activities for insert to authenticated with check (public.is_tenant_member(tenant_id));
create policy "activities_update_member" on public.activities for update to authenticated using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));
create policy "activities_delete_member" on public.activities for delete to authenticated using (public.is_tenant_member(tenant_id));

create policy "reviews_select_member" on public.application_reviews for select to authenticated using (public.is_tenant_member(tenant_id));
create policy "reviews_insert_recruitment" on public.application_reviews for insert to authenticated with check (public.has_tenant_role(tenant_id, array['owner','admin','recruiter','hr','manager','member']));
create policy "reviews_update_own_or_admin" on public.application_reviews for update to authenticated using (reviewer_id = auth.uid() or public.has_tenant_role(tenant_id, array['owner','admin'])) with check (public.is_tenant_member(tenant_id));
create policy "reviews_delete_own_or_admin" on public.application_reviews for delete to authenticated using (reviewer_id = auth.uid() or public.has_tenant_role(tenant_id, array['owner','admin']));

create policy "stage_history_select_member" on public.application_stage_history for select to authenticated using (public.is_tenant_member(tenant_id));

grant select, insert, update, delete on public.crm_contacts to authenticated;
grant select, insert, update, delete on public.activities to authenticated;
grant select, insert, update, delete on public.application_reviews to authenticated;
grant select on public.application_stage_history to authenticated;
grant usage, select on sequence public.application_stage_history_id_seq to authenticated;
