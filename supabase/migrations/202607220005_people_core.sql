-- Prismae People OS: cadastro de colaboradores, estrutura organizacional,
-- documentos privados e fluxos de onboarding/offboarding.
-- Execute depois das migrações 001 a 004.

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  code text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name),
  unique (tenant_id, id)
);

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  department_id uuid,
  title text not null check (char_length(title) between 2 and 140),
  level text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, title, department_id),
  unique (tenant_id, id),
  foreign key (tenant_id, department_id) references public.departments(tenant_id, id) on delete set null (department_id)
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  candidate_id uuid,
  department_id uuid,
  position_id uuid,
  manager_id uuid,
  employee_number text,
  full_name text not null check (char_length(full_name) between 3 and 180),
  corporate_email text,
  personal_email text,
  phone text,
  employment_type text not null default 'employee' check (employment_type in ('employee','contractor','intern','temporary','partner')),
  work_model text not null default 'onsite' check (work_model in ('onsite','hybrid','remote')),
  status text not null default 'preboarding' check (status in ('preboarding','active','on_leave','terminated')),
  hire_date date,
  termination_date date,
  location text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, candidate_id),
  unique (tenant_id, corporate_email),
  unique (tenant_id, employee_number),
  foreign key (tenant_id, candidate_id) references public.candidates(tenant_id, id) on delete set null (candidate_id),
  foreign key (tenant_id, department_id) references public.departments(tenant_id, id) on delete set null (department_id),
  foreign key (tenant_id, position_id) references public.positions(tenant_id, id) on delete set null (position_id),
  foreign key (tenant_id, manager_id) references public.employees(tenant_id, id) on delete set null (manager_id),
  check (termination_date is null or hire_date is null or termination_date >= hire_date)
);

create table if not exists public.employee_workflows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null,
  kind text not null check (kind in ('onboarding','offboarding')),
  title text not null check (char_length(title) between 2 and 180),
  status text not null default 'open' check (status in ('open','in_progress','completed','canceled')),
  due_date date,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, employee_id) references public.employees(tenant_id, id) on delete cascade
);

create table if not exists public.employee_workflow_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  workflow_id uuid not null,
  title text not null check (char_length(title) between 2 and 180),
  responsible_user_id uuid references auth.users(id) on delete set null,
  due_date date,
  sort_order integer not null default 0,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, workflow_id) references public.employee_workflows(tenant_id, id) on delete cascade
);

create table if not exists public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null,
  category text not null check (category in ('identity','contract','medical','payroll','certificate','other')),
  title text not null check (char_length(title) between 2 and 180),
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  expires_on date,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, employee_id) references public.employees(tenant_id, id) on delete cascade
);

create index if not exists departments_tenant_idx on public.departments(tenant_id, name);
create index if not exists positions_tenant_idx on public.positions(tenant_id, department_id, title);
create index if not exists employees_tenant_status_idx on public.employees(tenant_id, status, full_name);
create index if not exists employees_department_idx on public.employees(tenant_id, department_id);
create index if not exists employee_workflows_employee_idx on public.employee_workflows(tenant_id, employee_id, created_at desc);
create index if not exists employee_workflow_tasks_workflow_idx on public.employee_workflow_tasks(tenant_id, workflow_id, sort_order);
create index if not exists employee_documents_employee_idx on public.employee_documents(tenant_id, employee_id, created_at desc);

do $$
declare table_name text;
begin
  foreach table_name in array array['departments','positions','employees','employee_workflows','employee_workflow_tasks']
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['departments','positions','employees','employee_workflows','employee_workflow_tasks','employee_documents']
  loop
    execute format('drop trigger if exists protect_%I_tenant_id on public.%I', table_name, table_name);
    execute format('create trigger protect_%I_tenant_id before update of tenant_id on public.%I for each row execute function public.prevent_tenant_id_change()', table_name, table_name);
    execute format('drop trigger if exists audit_%I_changes on public.%I', table_name, table_name);
    execute format('create trigger audit_%I_changes after insert or update or delete on public.%I for each row execute function public.audit_tenant_record()', table_name, table_name);
  end loop;
end;
$$;

create or replace function public.create_employee_with_onboarding(
  p_tenant_id uuid,
  p_full_name text,
  p_email text default null,
  p_phone text default null,
  p_department_id uuid default null,
  p_position_id uuid default null,
  p_hire_date date default null,
  p_candidate_id uuid default null
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  clean_name text := trim(p_full_name);
  clean_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  maximum_employees integer;
  occupied_slots integer;
  employee_id uuid;
  workflow_id uuid;
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.has_tenant_role(p_tenant_id, array['owner','admin','hr','manager']) then raise exception 'PEOPLE_PERMISSION_REQUIRED'; end if;
  if char_length(clean_name) < 3 then raise exception 'INVALID_EMPLOYEE_NAME'; end if;

  if not exists (
    select 1 from public.subscriptions
    where tenant_id = p_tenant_id and status in ('trialing','active','grace')
  ) then raise exception 'SUBSCRIPTION_INACTIVE'; end if;

  select nullif(p.limits ->> 'employees', '')::integer into maximum_employees
  from public.subscriptions s join public.plans p on p.id = s.plan_id
  where s.tenant_id = p_tenant_id;

  if maximum_employees is not null then
    select count(*) into occupied_slots from public.employees
    where tenant_id = p_tenant_id and status <> 'terminated';
    if occupied_slots >= maximum_employees then raise exception 'EMPLOYEE_LIMIT_REACHED'; end if;
  end if;

  if p_candidate_id is not null then
    if not exists (
      select 1 from public.candidates c
      where c.id = p_candidate_id and c.tenant_id = p_tenant_id
    ) then raise exception 'CANDIDATE_NOT_FOUND'; end if;
    if not exists (
      select 1 from public.applications a
      where a.candidate_id = p_candidate_id and a.tenant_id = p_tenant_id and a.stage = 'hired'
    ) then raise exception 'CANDIDATE_NOT_HIRED'; end if;
  end if;

  insert into public.employees (
    tenant_id, candidate_id, department_id, position_id, full_name,
    corporate_email, personal_email, phone, hire_date, status, created_by
  ) values (
    p_tenant_id, p_candidate_id, p_department_id, p_position_id, clean_name,
    case when p_candidate_id is null then clean_email else null end,
    case when p_candidate_id is not null then clean_email else null end,
    nullif(trim(coalesce(p_phone, '')), ''), p_hire_date, 'preboarding', actor_id
  ) returning id into employee_id;

  insert into public.employee_workflows (tenant_id, employee_id, kind, title, due_date, created_by)
  values (p_tenant_id, employee_id, 'onboarding', 'Admissão de ' || clean_name, p_hire_date, actor_id)
  returning id into workflow_id;

  insert into public.employee_workflow_tasks (tenant_id, workflow_id, title, due_date, sort_order)
  values
    (p_tenant_id, workflow_id, 'Coletar documentos admissionais', p_hire_date, 10),
    (p_tenant_id, workflow_id, 'Preparar contrato e acessos', p_hire_date, 20),
    (p_tenant_id, workflow_id, 'Definir gestor, cargo e departamento', p_hire_date, 30),
    (p_tenant_id, workflow_id, 'Organizar integração com a equipe', p_hire_date, 40),
    (p_tenant_id, workflow_id, 'Realizar check-in da primeira semana', case when p_hire_date is null then null else p_hire_date + 7 end, 50);

  return employee_id;
exception
  when unique_violation then
    if p_candidate_id is not null then
      select id into employee_id from public.employees where tenant_id = p_tenant_id and candidate_id = p_candidate_id;
      if employee_id is not null then return employee_id; end if;
    end if;
    raise;
end;
$$;

revoke all on function public.create_employee_with_onboarding(uuid,text,text,text,uuid,uuid,date,uuid) from public, anon;
grant execute on function public.create_employee_with_onboarding(uuid,text,text,text,uuid,uuid,date,uuid) to authenticated;

alter table public.departments enable row level security;
alter table public.positions enable row level security;
alter table public.employees enable row level security;
alter table public.employee_workflows enable row level security;
alter table public.employee_workflow_tasks enable row level security;
alter table public.employee_documents enable row level security;

drop policy if exists "departments_people_read" on public.departments;
create policy "departments_people_read" on public.departments for select to authenticated
using (public.has_tenant_role(tenant_id, array['owner','admin','hr','manager']));
drop policy if exists "departments_people_write" on public.departments;
create policy "departments_people_write" on public.departments for all to authenticated
using (public.has_tenant_role(tenant_id, array['owner','admin','hr']))
with check (public.has_tenant_role(tenant_id, array['owner','admin','hr']));

drop policy if exists "positions_people_read" on public.positions;
create policy "positions_people_read" on public.positions for select to authenticated
using (public.has_tenant_role(tenant_id, array['owner','admin','hr','manager']));
drop policy if exists "positions_people_write" on public.positions;
create policy "positions_people_write" on public.positions for all to authenticated
using (public.has_tenant_role(tenant_id, array['owner','admin','hr']))
with check (public.has_tenant_role(tenant_id, array['owner','admin','hr']));

drop policy if exists "employees_people_read" on public.employees;
create policy "employees_people_read" on public.employees for select to authenticated
using (public.has_tenant_role(tenant_id, array['owner','admin','hr','manager']));
drop policy if exists "employees_people_write" on public.employees;
create policy "employees_people_write" on public.employees for all to authenticated
using (public.has_tenant_role(tenant_id, array['owner','admin','hr']))
with check (public.has_tenant_role(tenant_id, array['owner','admin','hr']));

drop policy if exists "employee_workflows_people_read" on public.employee_workflows;
create policy "employee_workflows_people_read" on public.employee_workflows for select to authenticated
using (public.has_tenant_role(tenant_id, array['owner','admin','hr','manager']));
drop policy if exists "employee_workflows_people_write" on public.employee_workflows;
create policy "employee_workflows_people_write" on public.employee_workflows for all to authenticated
using (public.has_tenant_role(tenant_id, array['owner','admin','hr','manager']))
with check (public.has_tenant_role(tenant_id, array['owner','admin','hr','manager']));

drop policy if exists "employee_tasks_people_read" on public.employee_workflow_tasks;
create policy "employee_tasks_people_read" on public.employee_workflow_tasks for select to authenticated
using (public.has_tenant_role(tenant_id, array['owner','admin','hr','manager']));
drop policy if exists "employee_tasks_people_write" on public.employee_workflow_tasks;
create policy "employee_tasks_people_write" on public.employee_workflow_tasks for all to authenticated
using (public.has_tenant_role(tenant_id, array['owner','admin','hr','manager']))
with check (public.has_tenant_role(tenant_id, array['owner','admin','hr','manager']));

drop policy if exists "employee_documents_people_read" on public.employee_documents;
create policy "employee_documents_people_read" on public.employee_documents for select to authenticated
using (public.has_tenant_role(tenant_id, array['owner','admin','hr']));
drop policy if exists "employee_documents_people_write" on public.employee_documents;
create policy "employee_documents_people_write" on public.employee_documents for all to authenticated
using (public.has_tenant_role(tenant_id, array['owner','admin','hr']))
with check (public.has_tenant_role(tenant_id, array['owner','admin','hr']));

grant select, insert, update, delete on public.departments to authenticated;
grant select, insert, update, delete on public.positions to authenticated;
grant select, insert, update, delete on public.employees to authenticated;
grant select, insert, update, delete on public.employee_workflows to authenticated;
grant select, insert, update, delete on public.employee_workflow_tasks to authenticated;
grant select, insert, update, delete on public.employee_documents to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'employee-documents',
  'employee-documents',
  false,
  10485760,
  array['application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "employee_files_read" on storage.objects;
create policy "employee_files_read" on storage.objects for select to authenticated
using (
  bucket_id = 'employee-documents'
  and exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.role in ('owner','admin','hr')
      and m.tenant_id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists "employee_files_insert" on storage.objects;
create policy "employee_files_insert" on storage.objects for insert to authenticated
with check (
  bucket_id = 'employee-documents'
  and exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.role in ('owner','admin','hr')
      and m.tenant_id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists "employee_files_delete" on storage.objects;
create policy "employee_files_delete" on storage.objects for delete to authenticated
using (
  bucket_id = 'employee-documents'
  and exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.role in ('owner','admin','hr')
      and m.tenant_id::text = (storage.foldername(name))[1]
  )
);
