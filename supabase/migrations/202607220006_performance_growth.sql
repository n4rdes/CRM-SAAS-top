-- Prismae People OS: desempenho, metas, ciclos, avaliações e check-ins 1:1.
-- Execute depois das migrações 001 a 005.

create table if not exists public.performance_cycles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(name) between 3 and 140),
  description text,
  status text not null default 'draft' check (status in ('draft','active','calibration','closed','canceled')),
  starts_on date not null,
  ends_on date not null,
  review_due_on date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, name, starts_on),
  check (ends_on >= starts_on),
  check (review_due_on is null or review_due_on >= starts_on)
);

create unique index if not exists performance_cycles_one_running_idx
  on public.performance_cycles(tenant_id)
  where status in ('active','calibration');

create table if not exists public.performance_goals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null,
  cycle_id uuid,
  title text not null check (char_length(title) between 3 and 180),
  description text,
  category text not null default 'individual' check (category in ('company','team','individual','development')),
  status text not null default 'draft' check (status in ('draft','in_progress','at_risk','completed','canceled')),
  progress smallint not null default 0 check (progress between 0 and 100),
  weight smallint not null default 100 check (weight between 1 and 100),
  starts_on date,
  due_on date,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, employee_id) references public.employees(tenant_id, id) on delete cascade,
  foreign key (tenant_id, cycle_id) references public.performance_cycles(tenant_id, id) on delete set null (cycle_id),
  check (due_on is null or starts_on is null or due_on >= starts_on)
);

create table if not exists public.performance_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  cycle_id uuid not null,
  employee_id uuid not null,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  review_type text not null default 'manager' check (review_type in ('manager','hr','peer')),
  status text not null default 'draft' check (status in ('draft','submitted','acknowledged')),
  overall_rating numeric(2,1) check (overall_rating between 1 and 5),
  delivery_rating numeric(2,1) check (delivery_rating between 1 and 5),
  collaboration_rating numeric(2,1) check (collaboration_rating between 1 and 5),
  growth_rating numeric(2,1) check (growth_rating between 1 and 5),
  strengths text,
  improvements text,
  summary text,
  submitted_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, cycle_id, employee_id, review_type),
  foreign key (tenant_id, cycle_id) references public.performance_cycles(tenant_id, id) on delete cascade,
  foreign key (tenant_id, employee_id) references public.employees(tenant_id, id) on delete cascade
);

create table if not exists public.performance_checkins (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null,
  cycle_id uuid,
  manager_id uuid not null references auth.users(id) on delete restrict,
  happened_on date not null default current_date,
  mood smallint check (mood between 1 and 5),
  energy smallint check (energy between 1 and 5),
  summary text not null check (char_length(summary) between 3 and 4000),
  achievements text,
  blockers text,
  next_actions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, employee_id) references public.employees(tenant_id, id) on delete cascade,
  foreign key (tenant_id, cycle_id) references public.performance_cycles(tenant_id, id) on delete set null (cycle_id)
);

create index if not exists performance_cycles_tenant_idx on public.performance_cycles(tenant_id, status, starts_on desc);
create index if not exists performance_goals_employee_idx on public.performance_goals(tenant_id, employee_id, status, due_on);
create index if not exists performance_goals_cycle_idx on public.performance_goals(tenant_id, cycle_id, status);
create index if not exists performance_reviews_cycle_idx on public.performance_reviews(tenant_id, cycle_id, status);
create index if not exists performance_reviews_employee_idx on public.performance_reviews(tenant_id, employee_id, created_at desc);
create index if not exists performance_checkins_employee_idx on public.performance_checkins(tenant_id, employee_id, happened_on desc);

do $$
declare table_name text;
begin
  foreach table_name in array array['performance_cycles','performance_goals','performance_reviews','performance_checkins']
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
    execute format('drop trigger if exists protect_%I_tenant_id on public.%I', table_name, table_name);
    execute format('create trigger protect_%I_tenant_id before update of tenant_id on public.%I for each row execute function public.prevent_tenant_id_change()', table_name, table_name);
    execute format('drop trigger if exists audit_%I_changes on public.%I', table_name, table_name);
    execute format('create trigger audit_%I_changes after insert or update or delete on public.%I for each row execute function public.audit_tenant_record()', table_name, table_name);
  end loop;
end;
$$;

create or replace function public.sync_performance_goal_state()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.progress = 100 and new.status not in ('completed','canceled') then
    new.status := 'completed';
  elsif new.progress < 100 and new.status = 'completed' then
    new.status := 'in_progress';
  end if;
  if new.status = 'completed' then
    if tg_op = 'INSERT' then
      new.completed_at := coalesce(new.completed_at, now());
    elsif old.status is distinct from 'completed' then
      new.completed_at := now();
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_performance_goal_state on public.performance_goals;
create trigger sync_performance_goal_state
before insert or update of progress, status on public.performance_goals
for each row execute function public.sync_performance_goal_state();

create or replace function public.launch_performance_cycle(p_cycle_id uuid)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  selected_tenant_id uuid;
  selected_status text;
  generated_reviews integer := 0;
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED'; end if;
  select tenant_id, status into selected_tenant_id, selected_status
  from public.performance_cycles where id = p_cycle_id for update;
  if selected_tenant_id is null then raise exception 'CYCLE_NOT_FOUND'; end if;
  if not public.has_tenant_role(selected_tenant_id, array['owner','admin','hr']) then raise exception 'PERFORMANCE_ADMIN_REQUIRED'; end if;
  if not exists (
    select 1 from public.subscriptions
    where tenant_id = selected_tenant_id and status in ('trialing','active','grace')
  ) then raise exception 'SUBSCRIPTION_INACTIVE'; end if;
  if selected_status in ('closed','canceled') then raise exception 'CYCLE_CANNOT_BE_LAUNCHED'; end if;
  if exists (
    select 1 from public.performance_cycles
    where tenant_id = selected_tenant_id and id <> p_cycle_id and status in ('active','calibration')
  ) then raise exception 'ACTIVE_CYCLE_EXISTS'; end if;

  update public.performance_cycles set status = 'active' where id = p_cycle_id;
  insert into public.performance_reviews (tenant_id, cycle_id, employee_id, reviewer_id, review_type)
  select selected_tenant_id, p_cycle_id, e.id, actor_id, 'manager'
  from public.employees e
  where e.tenant_id = selected_tenant_id and e.status in ('preboarding','active','on_leave')
  on conflict (tenant_id, cycle_id, employee_id, review_type) do nothing;
  get diagnostics generated_reviews = row_count;
  return generated_reviews;
end;
$$;

revoke all on function public.launch_performance_cycle(uuid) from public, anon;
grant execute on function public.launch_performance_cycle(uuid) to authenticated;

alter table public.performance_cycles enable row level security;
alter table public.performance_goals enable row level security;
alter table public.performance_reviews enable row level security;
alter table public.performance_checkins enable row level security;

drop policy if exists "performance_cycles_read" on public.performance_cycles;
create policy "performance_cycles_read" on public.performance_cycles for select to authenticated
using (public.has_tenant_role(tenant_id, array['owner','admin','hr','manager']));
drop policy if exists "performance_cycles_manage" on public.performance_cycles;
create policy "performance_cycles_manage" on public.performance_cycles for all to authenticated
using (public.has_tenant_role(tenant_id, array['owner','admin','hr']))
with check (public.has_tenant_role(tenant_id, array['owner','admin','hr']));

drop policy if exists "performance_goals_read" on public.performance_goals;
create policy "performance_goals_read" on public.performance_goals for select to authenticated
using (public.has_tenant_role(tenant_id, array['owner','admin','hr','manager']));
drop policy if exists "performance_goals_write" on public.performance_goals;
create policy "performance_goals_write" on public.performance_goals for all to authenticated
using (public.has_tenant_role(tenant_id, array['owner','admin','hr','manager']))
with check (public.has_tenant_role(tenant_id, array['owner','admin','hr','manager']));

drop policy if exists "performance_reviews_read" on public.performance_reviews;
create policy "performance_reviews_read" on public.performance_reviews for select to authenticated
using (public.has_tenant_role(tenant_id, array['owner','admin','hr','manager']));
drop policy if exists "performance_reviews_write" on public.performance_reviews;
create policy "performance_reviews_write" on public.performance_reviews for all to authenticated
using (public.has_tenant_role(tenant_id, array['owner','admin','hr','manager']))
with check (public.has_tenant_role(tenant_id, array['owner','admin','hr','manager']));

drop policy if exists "performance_checkins_read" on public.performance_checkins;
create policy "performance_checkins_read" on public.performance_checkins for select to authenticated
using (public.has_tenant_role(tenant_id, array['owner','admin','hr','manager']));
drop policy if exists "performance_checkins_write" on public.performance_checkins;
create policy "performance_checkins_write" on public.performance_checkins for all to authenticated
using (public.has_tenant_role(tenant_id, array['owner','admin','hr','manager']))
with check (public.has_tenant_role(tenant_id, array['owner','admin','hr','manager']));

grant select, insert, update, delete on public.performance_cycles to authenticated;
grant select, insert, update, delete on public.performance_goals to authenticated;
grant select, insert, update, delete on public.performance_reviews to authenticated;
grant select, insert, update, delete on public.performance_checkins to authenticated;
