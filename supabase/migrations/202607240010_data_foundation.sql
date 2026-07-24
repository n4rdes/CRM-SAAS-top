-- Prismae Data Foundation: importaÃƒÂ§ÃƒÂ£o, campos personalizados, busca, duplicidade e timeline.
create extension if not exists pg_trgm with schema extensions;

alter table public.tenants
  add column if not exists activation_completed_at timestamptz;

create table if not exists public.custom_field_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  entity_type text not null check (entity_type in ('candidate','job','company','employee')),
  field_key text not null,
  label text not null check (char_length(label) between 2 and 80),
  field_type text not null check (field_type in ('text','long_text','number','currency','date','boolean','single_select','multi_select','email','phone','url')),
  options jsonb not null default '[]'::jsonb,
  required boolean not null default false,
  searchable boolean not null default true,
  visible_roles text[] not null default array['owner','admin','sales','recruiter','hr','manager','member','viewer']::text[],
  sort_order integer not null default 100,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, entity_type, field_key),
  unique (tenant_id, id)
);

create table if not exists public.custom_field_values (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  definition_id uuid not null,
  entity_type text not null check (entity_type in ('candidate','job','company','employee')),
  entity_id uuid not null,
  value_json jsonb not null default 'null'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, definition_id, entity_id),
  foreign key (tenant_id, definition_id) references public.custom_field_definitions(tenant_id, id) on delete cascade
);

create table if not exists public.data_imports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  entity_type text not null check (entity_type in ('candidate','job','company','employee')),
  source_filename text not null,
  status text not null default 'analyzing' check (status in ('analyzing','ready','processing','completed','completed_with_errors','failed','canceled')),
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  imported_rows integer not null default 0,
  failed_rows integer not null default 0,
  column_mapping jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id)
);

create table if not exists public.data_import_rows (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  import_id uuid not null,
  row_number integer not null,
  payload jsonb not null,
  normalized_payload jsonb not null default '{}'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending','valid','imported','failed','skipped')),
  imported_entity_id uuid,
  created_at timestamptz not null default now(),
  unique (import_id, row_number),
  foreign key (tenant_id, import_id) references public.data_imports(tenant_id, id) on delete cascade
);

create table if not exists public.entity_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  event_type text not null,
  title text not null,
  description text,
  actor_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.activation_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  item_key text not null,
  label text not null,
  description text,
  href text not null,
  sort_order integer not null default 100,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, item_key)
);

create index if not exists custom_fields_entity_idx on public.custom_field_definitions(tenant_id, entity_type, active, sort_order);
create index if not exists custom_values_entity_idx on public.custom_field_values(tenant_id, entity_type, entity_id);
create index if not exists custom_values_search_idx on public.custom_field_values using gin (value_json jsonb_path_ops);
create index if not exists data_imports_tenant_created_idx on public.data_imports(tenant_id, created_at desc);
create index if not exists data_import_rows_import_status_idx on public.data_import_rows(tenant_id, import_id, status, row_number);
create index if not exists entity_events_entity_idx on public.entity_events(tenant_id, entity_type, entity_id, created_at desc);
create index if not exists entity_events_created_idx on public.entity_events(tenant_id, created_at desc);
create index if not exists candidates_name_trgm_idx on public.candidates using gin (full_name extensions.gin_trgm_ops);
create index if not exists crm_companies_name_trgm_idx on public.crm_companies using gin (name extensions.gin_trgm_ops);
create index if not exists jobs_title_trgm_idx on public.jobs using gin (title extensions.gin_trgm_ops);
create index if not exists employees_name_trgm_idx on public.employees using gin (full_name extensions.gin_trgm_ops);

-- ProteÃƒÂ§ÃƒÂµes e auditoria padrÃƒÂ£o.
do $$
declare table_name text;
begin
  foreach table_name in array array['custom_field_definitions','custom_field_values','data_imports']
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
  foreach table_name in array array['custom_field_definitions','custom_field_values','data_imports','data_import_rows','entity_events','activation_items']
  loop
    execute format('drop trigger if exists protect_%I_tenant_id on public.%I', table_name, table_name);
    execute format('create trigger protect_%I_tenant_id before update of tenant_id on public.%I for each row execute function public.prevent_tenant_id_change()', table_name, table_name);
  end loop;
end;
$$;

create or replace function public.capture_entity_event()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  row_json jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  old_json jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  tenant_value uuid := nullif(row_json ->> 'tenant_id', '')::uuid;
  entity_value uuid := nullif(row_json ->> 'id', '')::uuid;
  label_field text := coalesce(tg_argv[1], 'name');
  label_value text := coalesce(nullif(row_json ->> label_field, ''), tg_argv[0], tg_table_name);
  event_name text := lower(tg_op);
begin
  if tenant_value is null then if tg_op = 'DELETE' then return old; else return new; end if; end if;
  if tg_op = 'UPDATE' and row_json = old_json then return new; end if;
  insert into public.entity_events(tenant_id, entity_type, entity_id, event_type, title, actor_id, metadata)
  values (
    tenant_value,
    tg_argv[0],
    entity_value,
    event_name,
    case event_name when 'insert' then 'Criou ' when 'update' then 'Atualizou ' else 'Excluiu ' end || label_value,
    auth.uid(),
    jsonb_build_object('table', tg_table_name, 'before', old_json, 'after', case when tg_op = 'DELETE' then '{}'::jsonb else row_json end)
  );
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

-- Timeline automÃƒÂ¡tica dos principais registros.
do $$
begin
  drop trigger if exists entity_event_candidates on public.candidates;
  create trigger entity_event_candidates after insert or update or delete on public.candidates
  for each row execute function public.capture_entity_event('candidate','full_name');
  drop trigger if exists entity_event_jobs on public.jobs;
  create trigger entity_event_jobs after insert or update or delete on public.jobs
  for each row execute function public.capture_entity_event('job','title');
  drop trigger if exists entity_event_companies on public.crm_companies;
  create trigger entity_event_companies after insert or update or delete on public.crm_companies
  for each row execute function public.capture_entity_event('company','name');
  drop trigger if exists entity_event_employees on public.employees;
  create trigger entity_event_employees after insert or update or delete on public.employees
  for each row execute function public.capture_entity_event('employee','full_name');
end;
$$;

create or replace function public.workspace_global_search(p_query text, p_limit integer default 30)
returns table(entity_type text, entity_id uuid, title text, subtitle text, href text, relevance real)
language sql
stable
security definer set search_path = ''
as $$
  with input as (select trim(coalesce(p_query,'')) as q),
results(entity_type, entity_id, title, subtitle, href, relevance) as (
    select 'candidate'::text, c.id, c.full_name, coalesce(c.email,c.phone,'Candidato'), '/app/candidatos/'||c.id,
      greatest(extensions.similarity(c.full_name,(select q from input)), case when lower(c.email)=lower((select q from input)) then 1 else 0 end)::real
    from public.candidates c where public.is_tenant_member(c.tenant_id) and ((select q from input) <> '')
      and (c.full_name OPERATOR(extensions.%) (select q from input) or c.full_name ilike '%'||(select q from input)||'%' or c.email ilike '%'||(select q from input)||'%' or coalesce(c.phone,'') ilike '%'||(select q from input)||'%')
    union all
    select 'job', j.id, j.title, coalesce(co.name,'Vaga interna'), '/app/vagas/'||j.id,
      extensions.similarity(j.title,(select q from input))::real
    from public.jobs j left join public.crm_companies co on co.id=j.company_id and co.tenant_id=j.tenant_id
    where public.is_tenant_member(j.tenant_id) and ((select q from input) <> '') and (j.title OPERATOR(extensions.%) (select q from input) or j.title ilike '%'||(select q from input)||'%')
    union all
    select 'company', c.id, c.name, coalesce(c.email,c.phone,'Cliente'), '/app/clientes/'||c.id,
      extensions.similarity(c.name,(select q from input))::real
    from public.crm_companies c where public.is_tenant_member(c.tenant_id) and ((select q from input) <> '')
      and (c.name OPERATOR(extensions.%) (select q from input) or c.name ilike '%'||(select q from input)||'%' or coalesce(c.email,'') ilike '%'||(select q from input)||'%')
    union all
    select 'employee', e.id, e.full_name, coalesce(e.corporate_email,e.personal_email,e.status), '/app/pessoas/'||e.id,
      extensions.similarity(e.full_name,(select q from input))::real
    from public.employees e where public.is_tenant_member(e.tenant_id) and ((select q from input) <> '')
      and (e.full_name OPERATOR(extensions.%) (select q from input) or e.full_name ilike '%'||(select q from input)||'%' or coalesce(e.corporate_email,'') ilike '%'||(select q from input)||'%' or coalesce(e.personal_email,'') ilike '%'||(select q from input)||'%')
  )
  select
    r.entity_type,
    r.entity_id,
    r.title,
    r.subtitle,
    r.href,
    r.relevance
  from results r
  order by r.relevance desc, r.title
  limit greatest(1, least(coalesce(p_limit,30),100));
$$;

create or replace function public.find_candidate_duplicates(p_tenant_id uuid, p_threshold real default 0.62)
returns table(candidate_a uuid, candidate_b uuid, name_a text, name_b text, email_a text, email_b text, phone_a text, phone_b text, score real, reasons text[])
language sql
stable
security definer set search_path = ''
as $$
  select a.id,b.id,a.full_name,b.full_name,a.email,b.email,a.phone,b.phone,
    greatest(extensions.similarity(a.full_name,b.full_name), case when lower(a.email)=lower(b.email) then 1 else 0 end,
      case when nullif(regexp_replace(coalesce(a.phone,''),'\D','','g'),'') = nullif(regexp_replace(coalesce(b.phone,''),'\D','','g'),'') then .96 else 0 end)::real,
    array_remove(array[
      case when lower(a.email)=lower(b.email) then 'Mesmo e-mail' end,
      case when nullif(regexp_replace(coalesce(a.phone,''),'\D','','g'),'') = nullif(regexp_replace(coalesce(b.phone,''),'\D','','g'),'') then 'Mesmo telefone' end,
      case when extensions.similarity(a.full_name,b.full_name)>=p_threshold then 'Nome semelhante' end
    ],null)
  from public.candidates a join public.candidates b on b.tenant_id=a.tenant_id and b.id>a.id
  where a.tenant_id=p_tenant_id and public.has_tenant_role(p_tenant_id,array['owner','admin','recruiter','hr','manager'])
    and (lower(a.email)=lower(b.email)
      or (nullif(regexp_replace(coalesce(a.phone,''),'\D','','g'),'') is not null and regexp_replace(coalesce(a.phone,''),'\D','','g')=regexp_replace(coalesce(b.phone,''),'\D','','g'))
      or extensions.similarity(a.full_name,b.full_name)>=p_threshold)
  order by 9 desc;
$$;

create or replace function public.merge_candidates(p_primary_id uuid, p_duplicate_id uuid)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  tenant_value uuid;
  app record;
begin
  select tenant_id into tenant_value from public.candidates where id=p_primary_id;
  if tenant_value is null or not public.has_tenant_role(tenant_value,array['owner','admin','recruiter','hr']) then raise exception 'CANDIDATE_MERGE_FORBIDDEN'; end if;
  if not exists(select 1 from public.candidates where id=p_duplicate_id and tenant_id=tenant_value) then raise exception 'DUPLICATE_NOT_FOUND'; end if;

  for app in select * from public.applications where candidate_id=p_duplicate_id and tenant_id=tenant_value loop
    if exists(select 1 from public.applications where tenant_id=tenant_value and job_id=app.job_id and candidate_id=p_primary_id) then
      delete from public.applications where id=app.id;
    else
      update public.applications set candidate_id=p_primary_id where id=app.id;
    end if;
  end loop;
  update public.activities set entity_id=p_primary_id where tenant_id=tenant_value and entity_type='candidate' and entity_id=p_duplicate_id;
  update public.custom_field_values set entity_id=p_primary_id where tenant_id=tenant_value and entity_type='candidate' and entity_id=p_duplicate_id
    and not exists(select 1 from public.custom_field_values x where x.tenant_id=tenant_value and x.definition_id=custom_field_values.definition_id and x.entity_id=p_primary_id);
  delete from public.custom_field_values where tenant_id=tenant_value and entity_type='candidate' and entity_id=p_duplicate_id;
  insert into public.entity_events(tenant_id,entity_type,entity_id,event_type,title,actor_id,metadata)
  values(tenant_value,'candidate',p_primary_id,'merged','Mesclou registros duplicados',auth.uid(),jsonb_build_object('duplicate_id',p_duplicate_id));
  delete from public.candidates where id=p_duplicate_id and tenant_id=tenant_value;
  return p_primary_id;
end;
$$;

create or replace function public.seed_activation_items(p_tenant_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.activation_items(tenant_id,item_key,label,description,href,sort_order) values
    (p_tenant_id,'company','Complete os dados da empresa','Identidade, documento e fuso horÃƒÂ¡rio.','/app/configuracoes',10),
    (p_tenant_id,'team','Convide sua equipe','Adicione responsÃƒÂ¡veis para operar o ambiente.','/app/equipe',20),
    (p_tenant_id,'import','Importe seus dados','Traga candidatos, pessoas, vagas ou clientes.','/app/dados',30),
    (p_tenant_id,'career','Publique a pÃƒÂ¡gina de carreiras','Ative a captaÃƒÂ§ÃƒÂ£o contÃƒÂ­nua de candidatos.','/app/ats',40),
    (p_tenant_id,'first_job','Abra a primeira vaga','Configure o pipeline e o formulÃƒÂ¡rio.','/app/vagas',50),
    (p_tenant_id,'custom_fields','Personalize os cadastros','Crie campos prÃƒÂ³prios sem alterar o cÃƒÂ³digo.','/app/dados#campos',60)
  on conflict(tenant_id,item_key) do nothing;
end;
$$;

create or replace function public.get_activation_checklist(p_tenant_id uuid)
returns table(item_key text,label text,description text,href text,completed boolean,sort_order integer)
language sql
stable
security definer set search_path = ''
as $$
  select a.item_key,a.label,a.description,a.href,
    case a.item_key
      when 'company' then exists(select 1 from public.tenants t where t.id=p_tenant_id and (t.document is not null or t.phone is not null))
      when 'team' then (select count(*) from public.memberships m where m.tenant_id=p_tenant_id)>1
      when 'import' then exists(select 1 from public.data_imports i where i.tenant_id=p_tenant_id and i.status in ('completed','completed_with_errors'))
      when 'career' then exists(select 1 from public.jobs j where j.tenant_id=p_tenant_id and j.status='open')
      when 'first_job' then exists(select 1 from public.jobs j where j.tenant_id=p_tenant_id)
      when 'custom_fields' then exists(select 1 from public.custom_field_definitions f where f.tenant_id=p_tenant_id and f.active)
      else false end,
    a.sort_order
  from public.activation_items a
  where a.tenant_id=p_tenant_id and a.dismissed_at is null and public.is_tenant_member(p_tenant_id)
  order by a.sort_order;
$$;

-- Seed para ambientes atuais e futuros.
select public.seed_activation_items(id) from public.tenants;
create or replace function public.seed_activation_for_new_tenant()
returns trigger language plpgsql security definer set search_path='' as $$
begin perform public.seed_activation_items(new.id); return new; end; $$;
drop trigger if exists seed_activation_after_tenant on public.tenants;
create trigger seed_activation_after_tenant after insert on public.tenants for each row execute function public.seed_activation_for_new_tenant();

alter table public.custom_field_definitions enable row level security;
alter table public.custom_field_values enable row level security;
alter table public.data_imports enable row level security;
alter table public.data_import_rows enable row level security;
alter table public.entity_events enable row level security;
alter table public.activation_items enable row level security;

create policy "custom_definitions_read" on public.custom_field_definitions for select to authenticated using(public.is_tenant_member(tenant_id));
create policy "custom_definitions_manage" on public.custom_field_definitions for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','hr','recruiter','sales'])) with check(public.has_tenant_role(tenant_id,array['owner','admin','hr','recruiter','sales']));
create policy "custom_values_read" on public.custom_field_values for select to authenticated using(public.is_tenant_member(tenant_id));
create policy "custom_values_write" on public.custom_field_values for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','hr','recruiter','sales','manager','member'])) with check(public.has_tenant_role(tenant_id,array['owner','admin','hr','recruiter','sales','manager','member']));
create policy "data_imports_read" on public.data_imports for select to authenticated using(public.is_tenant_member(tenant_id));
create policy "data_imports_manage" on public.data_imports for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','hr','recruiter','sales'])) with check(public.has_tenant_role(tenant_id,array['owner','admin','hr','recruiter','sales']));
create policy "data_import_rows_read" on public.data_import_rows for select to authenticated using(public.is_tenant_member(tenant_id));
create policy "data_import_rows_manage" on public.data_import_rows for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','hr','recruiter','sales'])) with check(public.has_tenant_role(tenant_id,array['owner','admin','hr','recruiter','sales']));
create policy "entity_events_read" on public.entity_events for select to authenticated using(public.is_tenant_member(tenant_id));
create policy "activation_items_read" on public.activation_items for select to authenticated using(public.is_tenant_member(tenant_id));
create policy "activation_items_manage" on public.activation_items for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin'])) with check(public.has_tenant_role(tenant_id,array['owner','admin']));

grant select,insert,update,delete on public.custom_field_definitions,public.custom_field_values,public.data_imports,public.data_import_rows to authenticated;
grant select on public.entity_events,public.activation_items to authenticated;
grant usage,select on sequence public.data_import_rows_id_seq,public.entity_events_id_seq to authenticated;
grant execute on function public.workspace_global_search(text,integer),public.find_candidate_duplicates(uuid,real),public.merge_candidates(uuid,uuid),public.get_activation_checklist(uuid) to authenticated;

update public.plans set features = features || '{"data_foundation":true,"custom_fields":true,"imports":true,"global_search":true}'::jsonb, updated_at=now();
