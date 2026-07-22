-- Prismae People OS: clima, eNPS, pesquisas anônimas, reconhecimento e planos de ação.
-- Execute depois das migrações 001 a 006.

update public.plans set features = features || '{"performance":false,"engagement":false}'::jsonb, updated_at = now() where code = 'basic';
update public.plans set features = features || '{"performance":true,"engagement":true}'::jsonb, updated_at = now() where code in ('pro','custom');

create or replace function public.tenant_has_feature(p_tenant_id uuid, p_feature text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.subscriptions s join public.plans p on p.id=s.plan_id
    where s.tenant_id=p_tenant_id and coalesce((p.features->>p_feature)::boolean,false)
      and (
        s.status='active'
        or (s.status='trialing' and (s.trial_ends_at is null or s.trial_ends_at>now()))
        or (s.status in ('past_due','grace') and (s.grace_ends_at is null or s.grace_ends_at>now()))
      )
  );
$$;

revoke all on function public.tenant_has_feature(uuid,text) from public,anon;
grant execute on function public.tenant_has_feature(uuid,text) to authenticated;

create or replace function public.protect_performance_plan_writes()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not public.tenant_has_feature(new.tenant_id,'performance') then raise exception 'PERFORMANCE_PLAN_REQUIRED'; end if;
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['performance_cycles','performance_goals','performance_reviews','performance_checkins']
  loop
    execute format('drop trigger if exists protect_%I_plan on public.%I',table_name,table_name);
    execute format('create trigger protect_%I_plan before insert or update on public.%I for each row execute function public.protect_performance_plan_writes()',table_name,table_name);
  end loop;
end;
$$;

drop policy if exists "performance_cycles_read" on public.performance_cycles;
create policy "performance_cycles_read" on public.performance_cycles for select to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','hr','manager']) and public.tenant_has_feature(tenant_id,'performance'));
drop policy if exists "performance_goals_read" on public.performance_goals;
create policy "performance_goals_read" on public.performance_goals for select to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','hr','manager']) and public.tenant_has_feature(tenant_id,'performance'));
drop policy if exists "performance_reviews_read" on public.performance_reviews;
create policy "performance_reviews_read" on public.performance_reviews for select to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','hr','manager']) and public.tenant_has_feature(tenant_id,'performance'));
drop policy if exists "performance_checkins_read" on public.performance_checkins;
create policy "performance_checkins_read" on public.performance_checkins for select to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','hr','manager']) and public.tenant_has_feature(tenant_id,'performance'));

create table if not exists public.engagement_surveys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 180),
  description text,
  kind text not null default 'pulse' check (kind in ('enps','pulse','climate','custom')),
  status text not null default 'draft' check (status in ('draft','active','closed','canceled')),
  anonymous boolean not null default true,
  starts_on date,
  ends_on date,
  min_responses_to_display smallint not null default 3 check (min_responses_to_display between 1 and 50),
  public_token uuid not null unique default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table if not exists public.engagement_questions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  survey_id uuid not null,
  prompt text not null check (char_length(prompt) between 3 and 500),
  question_type text not null check (question_type in ('enps','scale','text','single_choice')),
  category text not null default 'custom' check (category in ('enps','leadership','wellbeing','career','belonging','recognition','communication','custom')),
  required boolean not null default true,
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, survey_id, position),
  foreign key (tenant_id, survey_id) references public.engagement_surveys(tenant_id, id) on delete cascade
);

create table if not exists public.engagement_responses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  survey_id uuid not null,
  response_key_hash text not null check (char_length(response_key_hash) between 16 and 128),
  submitted_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (survey_id, response_key_hash),
  foreign key (tenant_id, survey_id) references public.engagement_surveys(tenant_id, id) on delete cascade
);

create table if not exists public.engagement_answers (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  survey_id uuid not null,
  response_id uuid not null,
  question_id uuid not null,
  numeric_value smallint check (numeric_value between 0 and 10),
  text_value text check (text_value is null or char_length(text_value) <= 4000),
  option_value text,
  created_at timestamptz not null default now(),
  unique (response_id, question_id),
  foreign key (tenant_id, survey_id) references public.engagement_surveys(tenant_id, id) on delete cascade,
  foreign key (tenant_id, response_id) references public.engagement_responses(tenant_id, id) on delete cascade,
  foreign key (tenant_id, question_id) references public.engagement_questions(tenant_id, id) on delete cascade,
  check (num_nonnulls(numeric_value, text_value, option_value) = 1)
);

create table if not exists public.engagement_action_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  survey_id uuid,
  title text not null check (char_length(title) between 3 and 180),
  description text,
  category text not null default 'custom' check (category in ('enps','leadership','wellbeing','career','belonging','recognition','communication','custom')),
  status text not null default 'planned' check (status in ('planned','in_progress','completed','canceled')),
  progress smallint not null default 0 check (progress between 0 and 100),
  owner_user_id uuid references auth.users(id) on delete set null,
  due_on date,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, survey_id) references public.engagement_surveys(tenant_id, id) on delete set null (survey_id)
);

create table if not exists public.employee_recognitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  recipient_employee_id uuid not null,
  message text not null check (char_length(message) between 3 and 1000),
  value_tag text not null default 'collaboration' check (value_tag in ('collaboration','ownership','customer','innovation','results','culture')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, recipient_employee_id) references public.employees(tenant_id, id) on delete cascade
);

create index if not exists engagement_surveys_tenant_idx on public.engagement_surveys(tenant_id, status, created_at desc);
create index if not exists engagement_questions_survey_idx on public.engagement_questions(tenant_id, survey_id, position);
create index if not exists engagement_responses_survey_idx on public.engagement_responses(tenant_id, survey_id, submitted_at desc);
create index if not exists engagement_answers_survey_idx on public.engagement_answers(tenant_id, survey_id, question_id);
create index if not exists engagement_action_plans_tenant_idx on public.engagement_action_plans(tenant_id, status, due_on);
create index if not exists employee_recognitions_tenant_idx on public.employee_recognitions(tenant_id, created_at desc);

create or replace function public.protect_engagement_question_structure()
returns trigger language plpgsql set search_path = '' as $$
declare selected_survey_id uuid := new.survey_id; selected_status text;
begin
  select status into selected_status from public.engagement_surveys where id=selected_survey_id;
  if selected_status is distinct from 'draft' then raise exception 'SURVEY_STRUCTURE_LOCKED'; end if;
  return new;
end;
$$;

drop trigger if exists protect_engagement_question_structure on public.engagement_questions;
create trigger protect_engagement_question_structure before insert or update on public.engagement_questions
for each row execute function public.protect_engagement_question_structure();

do $$
declare table_name text;
begin
  foreach table_name in array array['engagement_surveys','engagement_questions','engagement_action_plans']
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
  foreach table_name in array array['engagement_surveys','engagement_questions','engagement_responses','engagement_answers','engagement_action_plans','employee_recognitions']
  loop
    execute format('drop trigger if exists protect_%I_tenant_id on public.%I', table_name, table_name);
    execute format('create trigger protect_%I_tenant_id before update of tenant_id on public.%I for each row execute function public.prevent_tenant_id_change()', table_name, table_name);
  end loop;
  foreach table_name in array array['engagement_surveys','engagement_questions','engagement_action_plans','employee_recognitions']
  loop
    execute format('drop trigger if exists audit_%I_changes on public.%I', table_name, table_name);
    execute format('create trigger audit_%I_changes after insert or update or delete on public.%I for each row execute function public.audit_tenant_record()', table_name, table_name);
  end loop;
end;
$$;

create or replace function public.sync_engagement_action_plan_state()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.progress = 100 and new.status not in ('completed','canceled') then new.status := 'completed'; end if;
  if new.status = 'completed' then
    if tg_op = 'INSERT' then new.completed_at := coalesce(new.completed_at, now());
    elsif old.status is distinct from 'completed' then new.completed_at := now(); end if;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_engagement_action_plan_state on public.engagement_action_plans;
create trigger sync_engagement_action_plan_state before insert or update of progress, status on public.engagement_action_plans
for each row execute function public.sync_engagement_action_plan_state();

create or replace function public.create_engagement_survey_with_template(
  p_tenant_id uuid,
  p_title text,
  p_description text default null,
  p_kind text default 'pulse',
  p_starts_on date default null,
  p_ends_on date default null,
  p_min_responses smallint default 3
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := auth.uid(); new_survey_id uuid;
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.has_tenant_role(p_tenant_id, array['owner','admin','hr']) then raise exception 'ENGAGEMENT_ADMIN_REQUIRED'; end if;
  if p_kind not in ('enps','pulse','climate','custom') then raise exception 'INVALID_SURVEY_KIND'; end if;
  if char_length(trim(p_title)) < 3 then raise exception 'INVALID_SURVEY_TITLE'; end if;
  if p_ends_on is not null and p_starts_on is not null and p_ends_on < p_starts_on then raise exception 'INVALID_SURVEY_DATES'; end if;
  if not public.tenant_has_feature(p_tenant_id,'engagement') then raise exception 'ENGAGEMENT_PLAN_REQUIRED'; end if;

  insert into public.engagement_surveys (tenant_id,title,description,kind,starts_on,ends_on,min_responses_to_display,created_by)
  values (p_tenant_id,trim(p_title),nullif(trim(coalesce(p_description,'')),''),p_kind,p_starts_on,p_ends_on,greatest(1,least(50,p_min_responses)),actor_id)
  returning id into new_survey_id;

  if p_kind in ('enps','pulse','climate') then
    insert into public.engagement_questions (tenant_id,survey_id,prompt,question_type,category,position) values
      (p_tenant_id,new_survey_id,'De 0 a 10, o quanto você recomendaria esta empresa como um bom lugar para trabalhar?','enps','enps',10),
      (p_tenant_id,new_survey_id,'Sinto que minha liderança cria condições para eu realizar um bom trabalho.','scale','leadership',20),
      (p_tenant_id,new_survey_id,'Tenho energia e equilíbrio para realizar meu trabalho de forma sustentável.','scale','wellbeing',30);
  end if;
  if p_kind in ('pulse','climate') then
    insert into public.engagement_questions (tenant_id,survey_id,prompt,question_type,category,position) values
      (p_tenant_id,new_survey_id,'Recebo reconhecimento quando realizo um bom trabalho.','scale','recognition',40),
      (p_tenant_id,new_survey_id,'Consigo enxergar oportunidades reais de desenvolvimento aqui.','scale','career',50);
  end if;
  if p_kind = 'climate' then
    insert into public.engagement_questions (tenant_id,survey_id,prompt,question_type,category,position) values
      (p_tenant_id,new_survey_id,'Sinto que pertenço e posso ser quem sou dentro da empresa.','scale','belonging',60),
      (p_tenant_id,new_survey_id,'As informações importantes chegam de forma clara e no momento certo.','scale','communication',70);
  end if;
  if p_kind <> 'custom' then
    insert into public.engagement_questions (tenant_id,survey_id,prompt,question_type,category,required,position)
    values (p_tenant_id,new_survey_id,'O que a empresa deveria começar, parar ou continuar fazendo para melhorar sua experiência?','text','custom',false,90);
  end if;
  return new_survey_id;
end;
$$;

create or replace function public.launch_engagement_survey(p_survey_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare selected_tenant_id uuid; selected_status text;
begin
  select tenant_id,status into selected_tenant_id,selected_status from public.engagement_surveys where id = p_survey_id for update;
  if selected_tenant_id is null then raise exception 'SURVEY_NOT_FOUND'; end if;
  if not public.has_tenant_role(selected_tenant_id,array['owner','admin','hr']) then raise exception 'ENGAGEMENT_ADMIN_REQUIRED'; end if;
  if not public.tenant_has_feature(selected_tenant_id,'engagement') then raise exception 'ENGAGEMENT_PLAN_REQUIRED'; end if;
  if selected_status <> 'draft' then raise exception 'SURVEY_NOT_DRAFT'; end if;
  if not exists (select 1 from public.engagement_questions where survey_id = p_survey_id) then raise exception 'SURVEY_HAS_NO_QUESTIONS'; end if;
  update public.engagement_surveys set status='active', starts_on=coalesce(starts_on,current_date) where id=p_survey_id;
  return true;
end;
$$;

create or replace function public.get_public_engagement_survey(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare survey_record record; questions_json jsonb;
begin
  select s.id,s.tenant_id,s.title,s.description,s.kind,s.anonymous,s.starts_on,s.ends_on,t.name tenant_name
  into survey_record from public.engagement_surveys s join public.tenants t on t.id=s.tenant_id
  where s.public_token=p_token and s.status='active'
    and public.tenant_has_feature(s.tenant_id,'engagement')
    and (s.starts_on is null or s.starts_on <= current_date)
    and (s.ends_on is null or s.ends_on >= current_date);
  if not found then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'prompt',q.prompt,'type',q.question_type,'category',q.category,'required',q.required,'options',q.options) order by q.position),'[]'::jsonb)
  into questions_json from public.engagement_questions q where q.survey_id=survey_record.id;
  return jsonb_build_object('id',survey_record.id,'tenant_name',survey_record.tenant_name,'title',survey_record.title,'description',survey_record.description,'kind',survey_record.kind,'anonymous',survey_record.anonymous,'ends_on',survey_record.ends_on,'questions',questions_json);
end;
$$;

create or replace function public.submit_engagement_survey(p_token uuid,p_response_key_hash text,p_answers jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare survey_record record; response_id uuid; answer_item jsonb; question_record record; question_uuid uuid; raw_value text; numeric_answer smallint;
begin
  select id,tenant_id into survey_record from public.engagement_surveys
  where public_token=p_token and status='active'
    and public.tenant_has_feature(tenant_id,'engagement')
    and (starts_on is null or starts_on <= current_date)
    and (ends_on is null or ends_on >= current_date) for update;
  if not found then raise exception 'SURVEY_NOT_AVAILABLE'; end if;
  if char_length(p_response_key_hash) < 16 then raise exception 'INVALID_RESPONSE_KEY'; end if;
  if jsonb_typeof(p_answers) <> 'array' then raise exception 'INVALID_ANSWERS'; end if;
  if exists (select 1 from public.engagement_responses where survey_id=survey_record.id and response_key_hash=p_response_key_hash) then raise exception 'SURVEY_ALREADY_ANSWERED'; end if;
  if exists (
    select 1 from public.engagement_questions q where q.survey_id=survey_record.id and q.required
    and not exists (select 1 from jsonb_array_elements(p_answers) item where item->>'question_id'=q.id::text and length(trim(coalesce(item->>'value',''))) > 0)
  ) then raise exception 'REQUIRED_ANSWER_MISSING'; end if;

  insert into public.engagement_responses(tenant_id,survey_id,response_key_hash)
  values(survey_record.tenant_id,survey_record.id,p_response_key_hash) returning id into response_id;

  for answer_item in select value from jsonb_array_elements(p_answers)
  loop
    begin question_uuid := (answer_item->>'question_id')::uuid; exception when others then raise exception 'INVALID_QUESTION'; end;
    select id,question_type,options into question_record from public.engagement_questions where id=question_uuid and survey_id=survey_record.id;
    if not found then raise exception 'INVALID_QUESTION'; end if;
    raw_value := left(trim(coalesce(answer_item->>'value','')),4000);
    if raw_value = '' then continue; end if;
    if question_record.question_type in ('enps','scale') then
      begin numeric_answer := raw_value::smallint; exception when others then raise exception 'INVALID_NUMERIC_ANSWER'; end;
      if (question_record.question_type='enps' and numeric_answer not between 0 and 10) or (question_record.question_type='scale' and numeric_answer not between 1 and 5) then raise exception 'ANSWER_OUT_OF_RANGE'; end if;
      insert into public.engagement_answers(tenant_id,survey_id,response_id,question_id,numeric_value) values(survey_record.tenant_id,survey_record.id,response_id,question_uuid,numeric_answer);
    elsif question_record.question_type='single_choice' then
      if not (question_record.options ? raw_value) then raise exception 'INVALID_OPTION'; end if;
      insert into public.engagement_answers(tenant_id,survey_id,response_id,question_id,option_value) values(survey_record.tenant_id,survey_record.id,response_id,question_uuid,raw_value);
    else
      insert into public.engagement_answers(tenant_id,survey_id,response_id,question_id,text_value) values(survey_record.tenant_id,survey_record.id,response_id,question_uuid,raw_value);
    end if;
  end loop;
  return response_id;
end;
$$;

create or replace function public.get_engagement_survey_summary(p_survey_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare survey_record record; response_count integer; employee_count integer; participation integer; enps_score integer; scale_average numeric; question_results jsonb;
begin
  select id,tenant_id,min_responses_to_display into survey_record from public.engagement_surveys where id=p_survey_id;
  if not found then raise exception 'SURVEY_NOT_FOUND'; end if;
  if not public.has_tenant_role(survey_record.tenant_id,array['owner','admin','hr','manager']) then raise exception 'ENGAGEMENT_ACCESS_REQUIRED'; end if;
  if not public.tenant_has_feature(survey_record.tenant_id,'engagement') then raise exception 'ENGAGEMENT_PLAN_REQUIRED'; end if;
  select count(*) into response_count from public.engagement_responses where survey_id=p_survey_id;
  select count(*) into employee_count from public.employees where tenant_id=survey_record.tenant_id and status <> 'terminated';
  participation := case when employee_count=0 then 0 else least(100,round(response_count::numeric*100/employee_count))::integer end;
  if response_count < survey_record.min_responses_to_display then
    return jsonb_build_object('locked',true,'response_count',response_count,'minimum',survey_record.min_responses_to_display,'employee_count',employee_count,'participation',participation,'enps',null,'scale_average',null,'questions','[]'::jsonb);
  end if;
  select round(100.0*(count(*) filter(where a.numeric_value>=9)-count(*) filter(where a.numeric_value<=6))/nullif(count(*),0))::integer
  into enps_score from public.engagement_answers a join public.engagement_questions q on q.id=a.question_id where a.survey_id=p_survey_id and q.question_type='enps';
  select round(avg(a.numeric_value)::numeric,1) into scale_average from public.engagement_answers a join public.engagement_questions q on q.id=a.question_id where a.survey_id=p_survey_id and q.question_type='scale';
  select coalesce(jsonb_agg(jsonb_build_object('id',stats.id,'prompt',stats.prompt,'type',stats.question_type,'category',stats.category,'answer_count',stats.answer_count,'average',stats.average,'texts',stats.texts,'options',stats.option_counts) order by stats.position),'[]'::jsonb)
  into question_results from (
    select q.id,q.prompt,q.question_type,q.category,q.position,count(a.id)::integer answer_count,round(avg(a.numeric_value)::numeric,1) average,
      coalesce(jsonb_agg(a.text_value order by a.created_at) filter(where a.text_value is not null),'[]'::jsonb) texts,
      (select coalesce(jsonb_object_agg(option_stats.option_value,option_stats.total),'{}'::jsonb) from (
        select a2.option_value,count(*)::integer total from public.engagement_answers a2
        where a2.question_id=q.id and a2.option_value is not null group by a2.option_value
      ) option_stats) option_counts
    from public.engagement_questions q left join public.engagement_answers a on a.question_id=q.id
    where q.survey_id=p_survey_id group by q.id,q.prompt,q.question_type,q.category,q.position
  ) stats;
  return jsonb_build_object('locked',false,'response_count',response_count,'minimum',survey_record.min_responses_to_display,'employee_count',employee_count,'participation',participation,'enps',enps_score,'scale_average',scale_average,'questions',question_results);
end;
$$;

revoke all on function public.create_engagement_survey_with_template(uuid,text,text,text,date,date,smallint) from public,anon;
revoke all on function public.launch_engagement_survey(uuid) from public,anon;
revoke all on function public.get_public_engagement_survey(uuid) from public;
revoke all on function public.submit_engagement_survey(uuid,text,jsonb) from public;
revoke all on function public.get_engagement_survey_summary(uuid) from public,anon;
grant execute on function public.create_engagement_survey_with_template(uuid,text,text,text,date,date,smallint) to authenticated;
grant execute on function public.launch_engagement_survey(uuid) to authenticated;
grant execute on function public.get_public_engagement_survey(uuid) to anon,authenticated;
grant execute on function public.submit_engagement_survey(uuid,text,jsonb) to anon,authenticated;
grant execute on function public.get_engagement_survey_summary(uuid) to authenticated;

alter table public.engagement_surveys enable row level security;
alter table public.engagement_questions enable row level security;
alter table public.engagement_responses enable row level security;
alter table public.engagement_answers enable row level security;
alter table public.engagement_action_plans enable row level security;
alter table public.employee_recognitions enable row level security;

drop policy if exists "engagement_surveys_read" on public.engagement_surveys;
drop policy if exists "engagement_surveys_manage" on public.engagement_surveys;
drop policy if exists "engagement_questions_read" on public.engagement_questions;
drop policy if exists "engagement_questions_manage" on public.engagement_questions;
drop policy if exists "engagement_action_plans_read" on public.engagement_action_plans;
drop policy if exists "engagement_action_plans_write" on public.engagement_action_plans;
drop policy if exists "employee_recognitions_read" on public.employee_recognitions;
drop policy if exists "employee_recognitions_write" on public.employee_recognitions;

create policy "engagement_surveys_read" on public.engagement_surveys for select to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','hr','manager']) and public.tenant_has_feature(tenant_id,'engagement'));
create policy "engagement_surveys_manage" on public.engagement_surveys for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','hr']) and public.tenant_has_feature(tenant_id,'engagement')) with check(public.has_tenant_role(tenant_id,array['owner','admin','hr']) and public.tenant_has_feature(tenant_id,'engagement'));
create policy "engagement_questions_read" on public.engagement_questions for select to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','hr','manager']) and public.tenant_has_feature(tenant_id,'engagement'));
create policy "engagement_questions_manage" on public.engagement_questions for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','hr']) and public.tenant_has_feature(tenant_id,'engagement')) with check(public.has_tenant_role(tenant_id,array['owner','admin','hr']) and public.tenant_has_feature(tenant_id,'engagement'));
create policy "engagement_action_plans_read" on public.engagement_action_plans for select to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','hr','manager']) and public.tenant_has_feature(tenant_id,'engagement'));
create policy "engagement_action_plans_write" on public.engagement_action_plans for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','hr','manager']) and public.tenant_has_feature(tenant_id,'engagement')) with check(public.has_tenant_role(tenant_id,array['owner','admin','hr','manager']) and public.tenant_has_feature(tenant_id,'engagement'));
create policy "employee_recognitions_read" on public.employee_recognitions for select to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','hr','manager']) and public.tenant_has_feature(tenant_id,'engagement'));
create policy "employee_recognitions_write" on public.employee_recognitions for insert to authenticated with check(public.has_tenant_role(tenant_id,array['owner','admin','hr','manager']) and public.tenant_has_feature(tenant_id,'engagement'));

grant select,insert,update,delete on public.engagement_surveys to authenticated;
grant select,insert,update,delete on public.engagement_questions to authenticated;
grant select,insert,update,delete on public.engagement_action_plans to authenticated;
grant select,insert on public.employee_recognitions to authenticated;
