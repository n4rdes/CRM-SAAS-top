-- Prismae People OS: férias e ausências, central de trabalho, notificações e automações.
-- Execute depois das migrações 001 a 007.

update public.plans
set features = features || '{"time_off":true,"automations":false}'::jsonb, updated_at = now()
where code = 'basic';

update public.plans
set features = features || '{"time_off":true,"automations":true}'::jsonb, updated_at = now()
where code in ('pro','custom');

create table if not exists public.leave_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  code text not null check (code ~ '^[a-z0-9_-]{2,40}$'),
  leave_type text not null check (leave_type in ('vacation','sick','personal','parental','unpaid','compensatory','other')),
  allowance_days numeric(5,1) not null default 0 check (allowance_days between 0 and 366),
  deducts_balance boolean not null default true,
  requires_approval boolean not null default true,
  minimum_notice_days smallint not null default 0 check (minimum_notice_days between 0 and 365),
  color text not null default '#3156d8' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, code)
);

create table if not exists public.employee_leave_balances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null,
  policy_id uuid not null,
  period_start date not null,
  period_end date not null,
  entitled_days numeric(5,1) not null default 0 check (entitled_days between 0 and 366),
  carried_days numeric(5,1) not null default 0 check (carried_days between 0 and 366),
  adjusted_days numeric(5,1) not null default 0 check (adjusted_days between -366 and 366),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, employee_id, policy_id, period_start),
  foreign key (tenant_id, employee_id) references public.employees(tenant_id, id) on delete cascade,
  foreign key (tenant_id, policy_id) references public.leave_policies(tenant_id, id) on delete cascade,
  check (period_end >= period_start)
);

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null,
  policy_id uuid not null,
  requested_by uuid references auth.users(id) on delete set null,
  start_date date not null,
  end_date date not null,
  partial_day text not null default 'full' check (partial_day in ('full','morning','afternoon')),
  total_days numeric(5,1) not null check (total_days between 0.5 and 366),
  reason text check (reason is null or char_length(reason) <= 2000),
  status text not null default 'pending' check (status in ('pending','approved','rejected','canceled')),
  decision_note text check (decision_note is null or char_length(decision_note) <= 2000),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, employee_id) references public.employees(tenant_id, id) on delete cascade,
  foreign key (tenant_id, policy_id) references public.leave_policies(tenant_id, id) on delete restrict,
  check (end_date >= start_date),
  check (partial_day = 'full' or start_date = end_date)
);

create table if not exists public.leave_request_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  request_id uuid not null,
  event_type text not null check (event_type in ('requested','approved','rejected','canceled','balance_adjusted')),
  actor_id uuid references auth.users(id) on delete set null,
  note text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, request_id) references public.leave_requests(tenant_id, id) on delete cascade
);

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'info' check (kind in ('info','success','warning','action')),
  title text not null check (char_length(title) between 2 and 180),
  body text check (body is null or char_length(body) <= 1200),
  href text check (href is null or char_length(href) <= 500),
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, id)
);

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  template_key text,
  name text not null check (char_length(name) between 3 and 140),
  description text,
  trigger_event text not null check (trigger_event in ('leave_requested','employee_created','candidate_hired')),
  action_type text not null check (action_type in ('create_activity','notify_team')),
  action_config jsonb not null default '{}'::jsonb check (jsonb_typeof(action_config) = 'object'),
  enabled boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, template_key)
);

create table if not exists public.automation_runs (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  rule_id uuid not null,
  status text not null check (status in ('succeeded','failed','skipped')),
  is_test boolean not null default false,
  entity_type text,
  entity_id uuid,
  output jsonb not null default '{}'::jsonb check (jsonb_typeof(output) = 'object'),
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz not null default now(),
  foreign key (tenant_id, rule_id) references public.automation_rules(tenant_id, id) on delete cascade
);

create table if not exists public.workspace_view_preferences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  dashboard_cards jsonb not null default '["clients","jobs","candidates","pipeline","people","goals","engagement","time_off"]'::jsonb check (jsonb_typeof(dashboard_cards)='array'),
  dashboard_columns smallint not null default 4 check (dashboard_columns between 2 and 4),
  report_cards jsonb not null default '["recruitment","commercial","sources","headcount","goals","reviews","engagement","time_off"]'::jsonb check (jsonb_typeof(report_cards)='array'),
  report_columns smallint not null default 2 check (report_columns between 1 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, user_id)
);

create index if not exists leave_policies_tenant_idx on public.leave_policies(tenant_id, active, leave_type);
create index if not exists leave_balances_employee_idx on public.employee_leave_balances(tenant_id, employee_id, period_start desc);
create index if not exists leave_requests_tenant_status_idx on public.leave_requests(tenant_id, status, start_date);
create index if not exists leave_requests_employee_idx on public.leave_requests(tenant_id, employee_id, start_date desc);
create index if not exists leave_events_request_idx on public.leave_request_events(tenant_id, request_id, created_at desc);
create index if not exists notifications_user_idx on public.app_notifications(tenant_id, user_id, read_at, created_at desc);
create index if not exists automation_rules_event_idx on public.automation_rules(tenant_id, enabled, trigger_event);
create index if not exists automation_runs_rule_idx on public.automation_runs(tenant_id, rule_id, started_at desc);
create index if not exists workspace_view_preferences_user_idx on public.workspace_view_preferences(tenant_id,user_id);

do $$
declare table_name text;
begin
  foreach table_name in array array['leave_policies','employee_leave_balances','leave_requests','automation_rules','workspace_view_preferences']
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;

  foreach table_name in array array['leave_policies','employee_leave_balances','leave_requests','leave_request_events','app_notifications','automation_rules','automation_runs','workspace_view_preferences']
  loop
    execute format('drop trigger if exists protect_%I_tenant_id on public.%I', table_name, table_name);
    execute format('create trigger protect_%I_tenant_id before update of tenant_id on public.%I for each row execute function public.prevent_tenant_id_change()', table_name, table_name);
  end loop;

  foreach table_name in array array['leave_policies','employee_leave_balances','leave_requests','automation_rules']
  loop
    execute format('drop trigger if exists audit_%I_changes on public.%I', table_name, table_name);
    execute format('create trigger audit_%I_changes after insert or update or delete on public.%I for each row execute function public.audit_tenant_record()', table_name, table_name);
  end loop;
end;
$$;

create or replace function public.business_days_between(p_start date, p_end date)
returns numeric
language sql immutable set search_path = '' as $$
  select count(*)::numeric
  from generate_series(p_start, p_end, interval '1 day') day
  where extract(isodow from day) between 1 and 5;
$$;

create or replace function public.request_employee_leave(
  p_tenant_id uuid,
  p_employee_id uuid,
  p_policy_id uuid,
  p_start_date date,
  p_end_date date,
  p_partial_day text default 'full',
  p_reason text default null
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor_id uuid := auth.uid();
  employee_record record;
  policy_record record;
  requested_days numeric;
  period_start_value date := make_date(extract(year from p_start_date)::integer, 1, 1);
  period_end_value date := make_date(extract(year from p_start_date)::integer, 12, 31);
  balance_record record;
  reserved_days numeric := 0;
  request_id uuid;
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.has_tenant_role(p_tenant_id, array['owner','admin','hr','manager']) then raise exception 'LEAVE_ACCESS_REQUIRED'; end if;
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then raise exception 'INVALID_LEAVE_DATES'; end if;
  if p_end_date > p_start_date + 365 then raise exception 'LEAVE_PERIOD_TOO_LONG'; end if;
  if p_partial_day not in ('full','morning','afternoon') then raise exception 'INVALID_PARTIAL_DAY'; end if;
  if p_partial_day <> 'full' and p_start_date <> p_end_date then raise exception 'PARTIAL_DAY_SINGLE_DATE_REQUIRED'; end if;

  select id,full_name,status into employee_record
  from public.employees where id=p_employee_id and tenant_id=p_tenant_id;
  if not found then raise exception 'EMPLOYEE_NOT_FOUND'; end if;
  if employee_record.status='terminated' then raise exception 'EMPLOYEE_TERMINATED'; end if;

  select id,name,allowance_days,deducts_balance,requires_approval,minimum_notice_days
  into policy_record from public.leave_policies
  where id=p_policy_id and tenant_id=p_tenant_id and active;
  if not found then raise exception 'LEAVE_POLICY_NOT_FOUND'; end if;

  if policy_record.minimum_notice_days > 0 and p_start_date < current_date + policy_record.minimum_notice_days then
    raise exception 'MINIMUM_NOTICE_NOT_MET';
  end if;

  requested_days := public.business_days_between(p_start_date,p_end_date);
  if p_partial_day <> 'full' and requested_days = 1 then requested_days := 0.5; end if;
  if requested_days <= 0 then raise exception 'NO_BUSINESS_DAYS'; end if;

  if exists (
    select 1 from public.leave_requests
    where tenant_id=p_tenant_id and employee_id=p_employee_id and status in ('pending','approved')
      and daterange(start_date,end_date,'[]') && daterange(p_start_date,p_end_date,'[]')
  ) then raise exception 'LEAVE_PERIOD_OVERLAP'; end if;

  insert into public.employee_leave_balances(tenant_id,employee_id,policy_id,period_start,period_end,entitled_days)
  values(p_tenant_id,p_employee_id,p_policy_id,period_start_value,period_end_value,policy_record.allowance_days)
  on conflict (tenant_id,employee_id,policy_id,period_start) do nothing;

  select entitled_days,carried_days,adjusted_days into balance_record
  from public.employee_leave_balances
  where tenant_id=p_tenant_id and employee_id=p_employee_id and policy_id=p_policy_id and period_start=period_start_value;

  if policy_record.deducts_balance then
    select coalesce(sum(total_days),0) into reserved_days
    from public.leave_requests
    where tenant_id=p_tenant_id and employee_id=p_employee_id and policy_id=p_policy_id
      and status in ('pending','approved') and start_date between period_start_value and period_end_value;
    if requested_days > balance_record.entitled_days + balance_record.carried_days + balance_record.adjusted_days - reserved_days then
      raise exception 'INSUFFICIENT_LEAVE_BALANCE';
    end if;
  end if;

  insert into public.leave_requests(
    tenant_id,employee_id,policy_id,requested_by,start_date,end_date,partial_day,total_days,reason,status,
    decided_by,decided_at
  ) values(
    p_tenant_id,p_employee_id,p_policy_id,actor_id,p_start_date,p_end_date,p_partial_day,requested_days,
    nullif(trim(coalesce(p_reason,'')),''),case when policy_record.requires_approval then 'pending' else 'approved' end,
    case when policy_record.requires_approval then null else actor_id end,
    case when policy_record.requires_approval then null else now() end
  ) returning id into request_id;

  return request_id;
end;
$$;

create or replace function public.decide_employee_leave(
  p_request_id uuid,
  p_decision text,
  p_note text default null
)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := auth.uid(); request_record record;
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'INVALID_LEAVE_DECISION'; end if;

  select * into request_record from public.leave_requests where id=p_request_id for update;
  if not found then raise exception 'LEAVE_REQUEST_NOT_FOUND'; end if;
  if not public.has_tenant_role(request_record.tenant_id,array['owner','admin','hr','manager']) then raise exception 'LEAVE_APPROVAL_REQUIRED'; end if;
  if request_record.status <> 'pending' then raise exception 'LEAVE_REQUEST_NOT_PENDING'; end if;

  update public.leave_requests set status=p_decision,decision_note=nullif(trim(coalesce(p_note,'')),''),decided_by=actor_id,decided_at=now()
  where id=p_request_id;

  insert into public.leave_request_events(tenant_id,request_id,event_type,actor_id,note)
  values(request_record.tenant_id,p_request_id,p_decision,actor_id,nullif(trim(coalesce(p_note,'')),''));

  if request_record.requested_by is not null and request_record.requested_by <> actor_id then
    insert into public.app_notifications(tenant_id,user_id,kind,title,body,href,entity_type,entity_id)
    values(
      request_record.tenant_id,request_record.requested_by,
      case when p_decision='approved' then 'success' else 'warning' end,
      case when p_decision='approved' then 'Ausência aprovada' else 'Ausência rejeitada' end,
      case when p_decision='approved' then 'A solicitação foi aprovada e já está no calendário da equipe.' else coalesce(nullif(trim(coalesce(p_note,'')),''),'A solicitação foi rejeitada.') end,
      '/app/ausencias','leave_request',p_request_id
    );
  end if;
  return true;
end;
$$;

create or replace function public.cancel_employee_leave(p_request_id uuid, p_note text default null)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := auth.uid(); request_record record;
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into request_record from public.leave_requests where id=p_request_id for update;
  if not found then raise exception 'LEAVE_REQUEST_NOT_FOUND'; end if;
  if request_record.status not in ('pending','approved') then raise exception 'LEAVE_REQUEST_NOT_CANCELABLE'; end if;
  if request_record.requested_by is distinct from actor_id and not public.has_tenant_role(request_record.tenant_id,array['owner','admin','hr']) then
    raise exception 'LEAVE_CANCEL_REQUIRED';
  end if;
  update public.leave_requests set status='canceled',canceled_at=now(),decision_note=coalesce(nullif(trim(coalesce(p_note,'')),''),decision_note) where id=p_request_id;
  insert into public.leave_request_events(tenant_id,request_id,event_type,actor_id,note)
  values(request_record.tenant_id,p_request_id,'canceled',actor_id,nullif(trim(coalesce(p_note,'')),''));
  return true;
end;
$$;

create or replace function public.perform_automation_rule(
  p_rule_id uuid,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_context jsonb default '{}'::jsonb,
  p_is_test boolean default false
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  rule_record record;
  recipient record;
  due_days integer;
  action_subject text;
  output_value jsonb := '{}'::jsonb;
  notification_count integer := 0;
  activity_id uuid;
begin
  select * into rule_record from public.automation_rules where id=p_rule_id;
  if not found then raise exception 'AUTOMATION_RULE_NOT_FOUND'; end if;

  begin
    if rule_record.action_type='create_activity' then
      due_days := greatest(0,least(90,coalesce((rule_record.action_config->>'due_days')::integer,0)));
      action_subject := left(coalesce(nullif(rule_record.action_config->>'subject',''),rule_record.name),180);
      insert into public.activities(tenant_id,entity_type,entity_id,activity_type,subject,description,due_at,created_by)
      values(
        rule_record.tenant_id,'general',null,'task',action_subject,
        nullif(coalesce(rule_record.action_config->>'description',p_context->>'description',''),'') ,
        now() + make_interval(days=>due_days),rule_record.created_by
      ) returning id into activity_id;
      output_value := jsonb_build_object('action','create_activity','activity_id',activity_id,'subject',action_subject);
    elsif rule_record.action_type='notify_team' then
      for recipient in
        select user_id from public.memberships where tenant_id=rule_record.tenant_id and role in ('owner','admin','hr','manager')
      loop
        insert into public.app_notifications(tenant_id,user_id,kind,title,body,href,entity_type,entity_id)
        values(
          rule_record.tenant_id,recipient.user_id,'action',
          left(coalesce(nullif(rule_record.action_config->>'title',''),rule_record.name),180),
          nullif(coalesce(rule_record.action_config->>'body',p_context->>'description',''),'') ,
          coalesce(nullif(rule_record.action_config->>'href',''),'/app/central'),p_entity_type,p_entity_id
        );
        notification_count := notification_count + 1;
      end loop;
      output_value := jsonb_build_object('action','notify_team','recipients',notification_count);
    else
      raise exception 'AUTOMATION_ACTION_NOT_SUPPORTED';
    end if;

    insert into public.automation_runs(tenant_id,rule_id,status,is_test,entity_type,entity_id,output)
    values(rule_record.tenant_id,rule_record.id,'succeeded',p_is_test,p_entity_type,p_entity_id,output_value);
    update public.automation_rules set last_run_at=now() where id=rule_record.id;
    return output_value;
  exception when others then
    insert into public.automation_runs(tenant_id,rule_id,status,is_test,entity_type,entity_id,error_message,output)
    values(rule_record.tenant_id,rule_record.id,'failed',p_is_test,p_entity_type,p_entity_id,left(sqlerrm,1000),'{}'::jsonb);
    return jsonb_build_object('error',sqlerrm);
  end;
end;
$$;

create or replace function public.execute_automation_event(
  p_tenant_id uuid,
  p_event text,
  p_entity_type text,
  p_entity_id uuid,
  p_context jsonb default '{}'::jsonb
)
returns integer
language plpgsql security definer set search_path = '' as $$
declare rule_record record; executed integer := 0;
begin
  if not public.tenant_has_feature(p_tenant_id,'automations') then return 0; end if;
  for rule_record in select id from public.automation_rules where tenant_id=p_tenant_id and trigger_event=p_event and enabled order by created_at
  loop
    perform public.perform_automation_rule(rule_record.id,p_entity_type,p_entity_id,p_context,false);
    executed := executed + 1;
  end loop;
  return executed;
end;
$$;

create or replace function public.run_automation_rule(p_rule_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := auth.uid(); rule_record record;
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into rule_record from public.automation_rules where id=p_rule_id;
  if not found then raise exception 'AUTOMATION_RULE_NOT_FOUND'; end if;
  if not public.has_tenant_role(rule_record.tenant_id,array['owner','admin','hr']) then raise exception 'AUTOMATION_ADMIN_REQUIRED'; end if;
  if not public.tenant_has_feature(rule_record.tenant_id,'automations') then raise exception 'AUTOMATIONS_PLAN_REQUIRED'; end if;
  return public.perform_automation_rule(rule_record.id,'automation_rule',rule_record.id,jsonb_build_object('description','Teste manual executado pelo usuário.'),true);
end;
$$;

create or replace function public.protect_automation_plan_writes()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- Templates desativados são preparados para todos os ambientes. Só é possível
  -- ativá-los (ou criar regras via RLS) quando o plano possui automações.
  if new.enabled and not public.tenant_has_feature(new.tenant_id,'automations') then raise exception 'AUTOMATIONS_PLAN_REQUIRED'; end if;
  return new;
end;
$$;

drop trigger if exists protect_automation_plan_writes on public.automation_rules;
create trigger protect_automation_plan_writes before insert or update on public.automation_rules
for each row execute function public.protect_automation_plan_writes();

create or replace function public.on_leave_request_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare recipient record; employee_name text; policy_name text;
begin
  insert into public.leave_request_events(tenant_id,request_id,event_type,actor_id,metadata)
  values(new.tenant_id,new.id,case when new.status='approved' then 'approved' else 'requested' end,new.requested_by,jsonb_build_object('total_days',new.total_days));

  select full_name into employee_name from public.employees where id=new.employee_id;
  select name into policy_name from public.leave_policies where id=new.policy_id;

  if new.status='pending' then
    for recipient in select user_id from public.memberships where tenant_id=new.tenant_id and role in ('owner','admin','hr','manager')
    loop
      if recipient.user_id is distinct from new.requested_by then
        insert into public.app_notifications(tenant_id,user_id,kind,title,body,href,entity_type,entity_id)
        values(new.tenant_id,recipient.user_id,'action','Nova ausência para aprovar',employee_name || ' solicitou ' || policy_name || ' por ' || new.total_days || ' dia(s).','/app/ausencias','leave_request',new.id);
      end if;
    end loop;
  end if;

  perform public.execute_automation_event(new.tenant_id,'leave_requested','leave_request',new.id,jsonb_build_object('description',employee_name || ' solicitou ' || policy_name || '.'));
  return new;
end;
$$;

drop trigger if exists on_leave_request_created on public.leave_requests;
create trigger on_leave_request_created after insert on public.leave_requests
for each row execute function public.on_leave_request_created();

create or replace function public.emit_employee_created_automation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.execute_automation_event(new.tenant_id,'employee_created','employee',new.id,jsonb_build_object('description','Novo colaborador: ' || new.full_name || '.'));
  return new;
end;
$$;

drop trigger if exists emit_employee_created_automation on public.employees;
create trigger emit_employee_created_automation after insert on public.employees
for each row execute function public.emit_employee_created_automation();

create or replace function public.emit_candidate_hired_automation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.execute_automation_event(new.tenant_id,'candidate_hired','application',new.id,jsonb_build_object('description','Uma candidatura chegou à etapa Contratado.'));
  return new;
end;
$$;

drop trigger if exists emit_candidate_hired_automation on public.applications;
create trigger emit_candidate_hired_automation after update of stage on public.applications
for each row when (new.stage='hired' and old.stage is distinct from new.stage)
execute function public.emit_candidate_hired_automation();

create or replace function public.seed_operations_for_tenant(p_tenant_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.leave_policies(tenant_id,name,code,leave_type,allowance_days,deducts_balance,requires_approval,minimum_notice_days,color)
  values
    (p_tenant_id,'Férias','vacation','vacation',30,true,true,7,'#3156d8'),
    (p_tenant_id,'Licença médica','sick','sick',0,false,true,0,'#e66f51'),
    (p_tenant_id,'Folga compensatória','compensatory','compensatory',0,false,true,1,'#2b9a70')
  on conflict (tenant_id,code) do nothing;

  insert into public.automation_rules(tenant_id,template_key,name,description,trigger_event,action_type,action_config,enabled)
  values
    (p_tenant_id,'leave-approval-alert','Avisar RH sobre nova ausência','Notifica responsáveis quando uma solicitação entra na fila.','leave_requested','notify_team','{"title":"Nova ausência aguardando aprovação","body":"Revise a solicitação na Central de Ausências.","href":"/app/ausencias"}'::jsonb,false),
    (p_tenant_id,'employee-onboarding-task','Criar tarefa de onboarding','Abre uma atividade assim que um colaborador é cadastrado.','employee_created','create_activity','{"subject":"Concluir onboarding do novo colaborador","description":"Revise documentos, acessos e responsáveis do checklist.","due_days":2}'::jsonb,false),
    (p_tenant_id,'hired-conversion-task','Converter candidato contratado','Lembra a equipe de concluir a admissão sem duplicar cadastro.','candidate_hired','create_activity','{"subject":"Converter contratado em colaborador","description":"Abra o candidato contratado e inicie o onboarding.","due_days":1}'::jsonb,false)
  on conflict (tenant_id,template_key) do nothing;
end;
$$;

create or replace function public.seed_new_tenant_operations()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.seed_operations_for_tenant(new.id);
  return new;
end;
$$;

drop trigger if exists seed_new_tenant_operations on public.tenants;
create trigger seed_new_tenant_operations after insert on public.tenants
for each row execute function public.seed_new_tenant_operations();

do $$
declare tenant_record record;
begin
  for tenant_record in select id from public.tenants loop
    perform public.seed_operations_for_tenant(tenant_record.id);
  end loop;
end;
$$;

create or replace view public.leave_balance_summary with (security_invoker=true) as
select
  b.id,
  b.tenant_id,
  b.employee_id,
  e.full_name employee_name,
  b.policy_id,
  p.name policy_name,
  p.color,
  p.deducts_balance,
  b.period_start,
  b.period_end,
  b.entitled_days,
  b.carried_days,
  b.adjusted_days,
  coalesce(sum(r.total_days) filter(where r.status='approved' and r.start_date between b.period_start and b.period_end),0)::numeric approved_days,
  coalesce(sum(r.total_days) filter(where r.status='pending' and r.start_date between b.period_start and b.period_end),0)::numeric pending_days,
  (b.entitled_days+b.carried_days+b.adjusted_days-coalesce(sum(r.total_days) filter(where r.status in ('approved','pending') and r.start_date between b.period_start and b.period_end),0))::numeric available_days
from public.employee_leave_balances b
join public.employees e on e.tenant_id=b.tenant_id and e.id=b.employee_id
join public.leave_policies p on p.tenant_id=b.tenant_id and p.id=b.policy_id
left join public.leave_requests r on r.tenant_id=b.tenant_id and r.employee_id=b.employee_id and r.policy_id=b.policy_id
group by b.id,b.tenant_id,b.employee_id,e.full_name,b.policy_id,p.name,p.color,p.deducts_balance,b.period_start,b.period_end,b.entitled_days,b.carried_days,b.adjusted_days;

alter table public.leave_policies enable row level security;
alter table public.employee_leave_balances enable row level security;
alter table public.leave_requests enable row level security;
alter table public.leave_request_events enable row level security;
alter table public.app_notifications enable row level security;
alter table public.automation_rules enable row level security;
alter table public.automation_runs enable row level security;
alter table public.workspace_view_preferences enable row level security;

create policy "leave_policies_read" on public.leave_policies for select to authenticated
using(public.has_tenant_role(tenant_id,array['owner','admin','hr','manager']));
create policy "leave_policies_manage" on public.leave_policies for all to authenticated
using(public.has_tenant_role(tenant_id,array['owner','admin','hr']))
with check(public.has_tenant_role(tenant_id,array['owner','admin','hr']));

create policy "leave_balances_read" on public.employee_leave_balances for select to authenticated
using(public.has_tenant_role(tenant_id,array['owner','admin','hr','manager']));
create policy "leave_balances_manage" on public.employee_leave_balances for all to authenticated
using(public.has_tenant_role(tenant_id,array['owner','admin','hr']))
with check(public.has_tenant_role(tenant_id,array['owner','admin','hr']));

create policy "leave_requests_read" on public.leave_requests for select to authenticated
using(public.has_tenant_role(tenant_id,array['owner','admin','hr','manager']));
create policy "leave_events_read" on public.leave_request_events for select to authenticated
using(public.has_tenant_role(tenant_id,array['owner','admin','hr','manager']));

create policy "notifications_read_own" on public.app_notifications for select to authenticated
using(user_id=auth.uid() and public.is_tenant_member(tenant_id));
create policy "notifications_update_own" on public.app_notifications for update to authenticated
using(user_id=auth.uid() and public.is_tenant_member(tenant_id))
with check(user_id=auth.uid() and public.is_tenant_member(tenant_id));

create policy "automation_rules_read" on public.automation_rules for select to authenticated
using(public.has_tenant_role(tenant_id,array['owner','admin','hr','manager']) and public.tenant_has_feature(tenant_id,'automations'));
create policy "automation_rules_manage" on public.automation_rules for all to authenticated
using(public.has_tenant_role(tenant_id,array['owner','admin','hr']) and public.tenant_has_feature(tenant_id,'automations'))
with check(public.has_tenant_role(tenant_id,array['owner','admin','hr']) and public.tenant_has_feature(tenant_id,'automations'));
create policy "automation_runs_read" on public.automation_runs for select to authenticated
using(public.has_tenant_role(tenant_id,array['owner','admin','hr','manager']) and public.tenant_has_feature(tenant_id,'automations'));

create policy "workspace_view_preferences_own" on public.workspace_view_preferences for all to authenticated
using(user_id=auth.uid() and public.is_tenant_member(tenant_id))
with check(user_id=auth.uid() and public.is_tenant_member(tenant_id));

grant select,insert,update,delete on public.leave_policies to authenticated;
grant select,insert,update,delete on public.employee_leave_balances to authenticated;
grant select on public.leave_requests to authenticated;
grant select on public.leave_request_events to authenticated;
grant select,update on public.app_notifications to authenticated;
grant select,insert,update,delete on public.automation_rules to authenticated;
grant select on public.automation_runs to authenticated;
grant select on public.leave_balance_summary to authenticated;
grant select,insert,update,delete on public.workspace_view_preferences to authenticated;

revoke all on function public.business_days_between(date,date) from public,anon;
revoke all on function public.request_employee_leave(uuid,uuid,uuid,date,date,text,text) from public,anon;
revoke all on function public.decide_employee_leave(uuid,text,text) from public,anon;
revoke all on function public.cancel_employee_leave(uuid,text) from public,anon;
revoke all on function public.perform_automation_rule(uuid,text,uuid,jsonb,boolean) from public,anon,authenticated;
revoke all on function public.execute_automation_event(uuid,text,text,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.run_automation_rule(uuid) from public,anon;
revoke all on function public.seed_operations_for_tenant(uuid) from public,anon,authenticated;

grant execute on function public.business_days_between(date,date) to authenticated;
grant execute on function public.request_employee_leave(uuid,uuid,uuid,date,date,text,text) to authenticated;
grant execute on function public.decide_employee_leave(uuid,text,text) to authenticated;
grant execute on function public.cancel_employee_leave(uuid,text) to authenticated;
grant execute on function public.run_automation_rule(uuid) to authenticated;
