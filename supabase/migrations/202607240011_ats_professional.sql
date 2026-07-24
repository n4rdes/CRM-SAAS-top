-- Prismae ATS Professional: carreira, candidatura configurável, scorecards, entrevistas e propostas.
alter table public.tenants
  add column if not exists career_page_enabled boolean not null default false,
  add column if not exists career_page_title text,
  add column if not exists career_page_description text,
  add column if not exists career_primary_color text not null default '#3156d8',
  add column if not exists career_logo_url text;

alter table public.jobs
  add column if not exists public_slug text,
  add column if not exists published_at timestamptz,
  add column if not exists employment_type text not null default 'full_time' check (employment_type in ('full_time','part_time','contract','temporary','internship','apprentice')),
  add column if not exists workplace_type text not null default 'onsite' check (workplace_type in ('onsite','hybrid','remote')),
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists salary_min_cents integer,
  add column if not exists salary_max_cents integer,
  add column if not exists salary_visible boolean not null default false,
  add column if not exists application_form_config jsonb not null default '{"phone_required":true,"resume_required":false,"consent_required":true}'::jsonb;

create unique index if not exists jobs_public_slug_idx on public.jobs(tenant_id, public_slug) where public_slug is not null;
create index if not exists jobs_public_listing_idx on public.jobs(tenant_id, published_at desc) where published_at is not null and status='open';

create table if not exists public.job_screening_questions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  job_id uuid not null,
  question text not null check (char_length(question) between 3 and 500),
  question_type text not null default 'text' check (question_type in ('text','long_text','boolean','single_select','number')),
  options jsonb not null default '[]'::jsonb,
  required boolean not null default false,
  knockout boolean not null default false,
  expected_answer jsonb,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id,id),
  foreign key (tenant_id,job_id) references public.jobs(tenant_id,id) on delete cascade
);

create table if not exists public.application_answers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  application_id uuid not null,
  question_id uuid not null,
  answer jsonb not null,
  is_knockout_failure boolean not null default false,
  created_at timestamptz not null default now(),
  unique(application_id,question_id),
  foreign key (tenant_id,application_id) references public.applications(tenant_id,id) on delete cascade,
  foreign key (tenant_id,question_id) references public.job_screening_questions(tenant_id,id) on delete cascade
);

create table if not exists public.interview_kits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  job_id uuid not null,
  name text not null,
  instructions text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id,id),
  foreign key (tenant_id,job_id) references public.jobs(tenant_id,id) on delete cascade
);

create table if not exists public.interview_criteria (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kit_id uuid not null,
  name text not null,
  description text,
  weight numeric(6,2) not null default 1 check(weight>0),
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  unique(tenant_id,id),
  foreign key (tenant_id,kit_id) references public.interview_kits(tenant_id,id) on delete cascade
);

create table if not exists public.application_scorecards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  application_id uuid not null,
  kit_id uuid not null,
  reviewer_id uuid references auth.users(id) on delete set null,
  recommendation text not null default 'neutral' check(recommendation in ('strong_no','no','neutral','yes','strong_yes')),
  overall_notes text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(application_id,kit_id,reviewer_id),
  unique(tenant_id,id),
  foreign key (tenant_id,application_id) references public.applications(tenant_id,id) on delete cascade,
  foreign key (tenant_id,kit_id) references public.interview_kits(tenant_id,id) on delete cascade
);

create table if not exists public.application_scorecard_answers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  scorecard_id uuid not null,
  criterion_id uuid not null,
  score smallint not null check(score between 1 and 5),
  evidence text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(scorecard_id,criterion_id),
  foreign key (tenant_id,scorecard_id) references public.application_scorecards(tenant_id,id) on delete cascade,
  foreign key (tenant_id,criterion_id) references public.interview_criteria(tenant_id,id) on delete cascade
);

create table if not exists public.interview_slots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  job_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'America/Sao_Paulo',
  interviewer_id uuid references auth.users(id) on delete set null,
  meeting_provider text not null default 'manual' check(meeting_provider in ('manual','google_meet','microsoft_teams','zoom')),
  meeting_url text,
  capacity integer not null default 1 check(capacity between 1 and 20),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(tenant_id,id),
  foreign key (tenant_id,job_id) references public.jobs(tenant_id,id) on delete cascade,
  check(ends_at>starts_at)
);

create table if not exists public.interview_bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  slot_id uuid not null,
  application_id uuid not null,
  candidate_id uuid not null,
  status text not null default 'confirmed' check(status in ('confirmed','canceled','completed','no_show')),
  booked_at timestamptz not null default now(),
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  unique(slot_id,application_id),
  foreign key (tenant_id,slot_id) references public.interview_slots(tenant_id,id) on delete cascade,
  foreign key (tenant_id,application_id) references public.applications(tenant_id,id) on delete cascade,
  foreign key (tenant_id,candidate_id) references public.candidates(tenant_id,id) on delete cascade
);

create table if not exists public.job_offers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  application_id uuid not null,
  candidate_id uuid not null,
  title text not null default 'Proposta de contratação',
  body text not null,
  salary_cents integer,
  benefits text,
  start_date date,
  expires_at timestamptz,
  status text not null default 'draft' check(status in ('draft','pending_approval','approved','sent','accepted','declined','expired','canceled')),
  version integer not null default 1,
  sent_at timestamptz,
  responded_at timestamptz,
  response_note text,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id,id),
  foreign key (tenant_id,application_id) references public.applications(tenant_id,id) on delete cascade,
  foreign key (tenant_id,candidate_id) references public.candidates(tenant_id,id) on delete cascade
);

create index if not exists screening_questions_job_idx on public.job_screening_questions(tenant_id,job_id,sort_order);
create index if not exists application_answers_application_idx on public.application_answers(tenant_id,application_id);
create index if not exists interview_kits_job_idx on public.interview_kits(tenant_id,job_id,active);
create index if not exists interview_slots_job_date_idx on public.interview_slots(tenant_id,job_id,starts_at) where active;
create index if not exists interview_bookings_candidate_idx on public.interview_bookings(tenant_id,candidate_id,booked_at desc);
create index if not exists job_offers_application_idx on public.job_offers(tenant_id,application_id,created_at desc);

create or replace function public.validate_job_offer_relationship()
returns trigger language plpgsql set search_path='' as $$
begin
  if not exists(
    select 1 from public.applications a
    where a.id=new.application_id and a.tenant_id=new.tenant_id and a.candidate_id=new.candidate_id
  ) then raise exception 'OFFER_APPLICATION_CANDIDATE_MISMATCH'; end if;
  return new;
end $$;
drop trigger if exists validate_job_offer_relationship on public.job_offers;
create trigger validate_job_offer_relationship before insert or update of tenant_id,application_id,candidate_id on public.job_offers for each row execute function public.validate_job_offer_relationship();

-- Triggers padrão.
do $$ declare table_name text; begin
  foreach table_name in array array['job_screening_questions','interview_kits','application_scorecards','application_scorecard_answers','job_offers'] loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I',table_name,table_name);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',table_name,table_name);
  end loop;
  foreach table_name in array array['job_screening_questions','application_answers','interview_kits','interview_criteria','application_scorecards','application_scorecard_answers','interview_slots','interview_bookings','job_offers'] loop
    execute format('drop trigger if exists protect_%I_tenant_id on public.%I',table_name,table_name);
    execute format('create trigger protect_%I_tenant_id before update of tenant_id on public.%I for each row execute function public.prevent_tenant_id_change()',table_name,table_name);
  end loop;
end $$;

create or replace function public.get_public_career_page(p_tenant_slug text)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'tenant',jsonb_build_object('id',t.id,'name',t.name,'slug',t.slug,'title',coalesce(t.career_page_title,'Faça parte do nosso time'),'description',coalesce(t.career_page_description,'Conheça nossas oportunidades e construa o próximo capítulo da sua carreira.'),'primary_color',t.career_primary_color,'logo_url',t.career_logo_url),
    'jobs',coalesce((select jsonb_agg(jsonb_build_object('id',j.id,'slug',j.public_slug,'title',j.title,'description',j.description,'employment_type',j.employment_type,'workplace_type',j.workplace_type,'city',j.city,'state',j.state,'salary_min_cents',case when j.salary_visible then j.salary_min_cents end,'salary_max_cents',case when j.salary_visible then j.salary_max_cents end,'published_at',j.published_at) order by j.published_at desc) from public.jobs j where j.tenant_id=t.id and j.status='open' and j.published_at is not null),'[]'::jsonb)
  ) from public.tenants t where t.slug=p_tenant_slug and t.career_page_enabled=true;
$$;

create or replace function public.get_public_job(p_tenant_slug text,p_job_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'tenant',jsonb_build_object('id',t.id,'name',t.name,'slug',t.slug,'primary_color',t.career_primary_color,'logo_url',t.career_logo_url),
    'job',jsonb_build_object('id',j.id,'title',j.title,'description',j.description,'employment_type',j.employment_type,'workplace_type',j.workplace_type,'city',j.city,'state',j.state,'salary_min_cents',case when j.salary_visible then j.salary_min_cents end,'salary_max_cents',case when j.salary_visible then j.salary_max_cents end,'form_config',j.application_form_config),
    'questions',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'question',q.question,'question_type',q.question_type,'options',q.options,'required',q.required) order by q.sort_order) from public.job_screening_questions q where q.job_id=j.id and q.tenant_id=j.tenant_id),'[]'::jsonb)
  ) from public.tenants t join public.jobs j on j.tenant_id=t.id where t.slug=p_tenant_slug and t.career_page_enabled=true and j.id=p_job_id and j.status='open' and j.published_at is not null;
$$;

create or replace function public.submit_public_application(p_tenant_slug text,p_job_id uuid,p_full_name text,p_email text,p_phone text,p_answers jsonb default '{}'::jsonb,p_consent boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare tenant_value uuid; candidate_value uuid; application_value uuid; question_row record; answer_value jsonb; knockout_failure boolean:=false;
begin
  if not p_consent then raise exception 'CONSENT_REQUIRED'; end if;
  select t.id into tenant_value from public.tenants t join public.jobs j on j.tenant_id=t.id where t.slug=p_tenant_slug and t.career_page_enabled and j.id=p_job_id and j.status='open' and j.published_at is not null;
  if tenant_value is null then raise exception 'JOB_NOT_AVAILABLE'; end if;
  if char_length(trim(p_full_name))<3 or position('@' in p_email)=0 then raise exception 'INVALID_CANDIDATE'; end if;
  insert into public.candidates(tenant_id,full_name,email,phone,source,created_by)
  values(tenant_value,trim(p_full_name),lower(trim(p_email)),nullif(trim(coalesce(p_phone,'')),''),'site_carreiras',(select created_by from public.tenants where id=tenant_value))
  on conflict(tenant_id,email) do update set full_name=excluded.full_name,phone=coalesce(excluded.phone,public.candidates.phone),updated_at=now()
  returning id into candidate_value;
  insert into public.applications(tenant_id,job_id,candidate_id,stage) values(tenant_value,p_job_id,candidate_value,'applied')
  on conflict(job_id,candidate_id) do update set updated_at=now() returning id into application_value;
  for question_row in select * from public.job_screening_questions where tenant_id=tenant_value and job_id=p_job_id loop
    answer_value:=p_answers->question_row.id::text;
    if question_row.required and (answer_value is null or answer_value='null'::jsonb or answer_value='""'::jsonb) then raise exception 'REQUIRED_ANSWER_MISSING'; end if;
    if answer_value is not null then
      knockout_failure:=question_row.knockout and question_row.expected_answer is not null and answer_value<>question_row.expected_answer;
      insert into public.application_answers(tenant_id,application_id,question_id,answer,is_knockout_failure) values(tenant_value,application_value,question_row.id,answer_value,knockout_failure)
      on conflict(application_id,question_id) do update set answer=excluded.answer,is_knockout_failure=excluded.is_knockout_failure;
    end if;
  end loop;
  if exists(select 1 from public.application_answers where application_id=application_value and is_knockout_failure) then update public.applications set stage='screening' where id=application_value; end if;
  insert into public.entity_events(tenant_id,entity_type,entity_id,event_type,title,metadata) values(tenant_value,'candidate',candidate_value,'public_application','Candidatura recebida pela página de carreiras',jsonb_build_object('job_id',p_job_id,'application_id',application_value));
  return jsonb_build_object('candidate_id',candidate_value,'application_id',application_value);
end $$;

-- RLS.
do $$ declare table_name text; begin
  foreach table_name in array array['job_screening_questions','application_answers','interview_kits','interview_criteria','application_scorecards','application_scorecard_answers','interview_slots','interview_bookings','job_offers'] loop execute format('alter table public.%I enable row level security',table_name); end loop;
end $$;
create policy "screening_read" on public.job_screening_questions for select to authenticated using(public.is_tenant_member(tenant_id));
create policy "screening_manage" on public.job_screening_questions for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','recruiter','hr','manager'])) with check(public.has_tenant_role(tenant_id,array['owner','admin','recruiter','hr','manager']));
create policy "answers_read" on public.application_answers for select to authenticated using(public.is_tenant_member(tenant_id));
create policy "kits_read" on public.interview_kits for select to authenticated using(public.is_tenant_member(tenant_id));
create policy "kits_manage" on public.interview_kits for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','recruiter','hr','manager'])) with check(public.has_tenant_role(tenant_id,array['owner','admin','recruiter','hr','manager']));
create policy "criteria_read" on public.interview_criteria for select to authenticated using(public.is_tenant_member(tenant_id));
create policy "criteria_manage" on public.interview_criteria for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','recruiter','hr','manager'])) with check(public.has_tenant_role(tenant_id,array['owner','admin','recruiter','hr','manager']));
create policy "scorecards_read" on public.application_scorecards for select to authenticated using(public.is_tenant_member(tenant_id));
create policy "scorecards_write" on public.application_scorecards for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','recruiter','hr','manager','member'])) with check(public.has_tenant_role(tenant_id,array['owner','admin','recruiter','hr','manager','member']));
create policy "scorecard_answers_read" on public.application_scorecard_answers for select to authenticated using(public.is_tenant_member(tenant_id));
create policy "scorecard_answers_write" on public.application_scorecard_answers for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','recruiter','hr','manager','member'])) with check(public.has_tenant_role(tenant_id,array['owner','admin','recruiter','hr','manager','member']));
create policy "interview_slots_read" on public.interview_slots for select to authenticated using(public.is_tenant_member(tenant_id));
create policy "interview_slots_manage" on public.interview_slots for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','recruiter','hr','manager'])) with check(public.has_tenant_role(tenant_id,array['owner','admin','recruiter','hr','manager']));
create policy "bookings_read" on public.interview_bookings for select to authenticated using(public.is_tenant_member(tenant_id));
create policy "bookings_manage" on public.interview_bookings for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','recruiter','hr','manager'])) with check(public.has_tenant_role(tenant_id,array['owner','admin','recruiter','hr','manager']));
create policy "offers_read" on public.job_offers for select to authenticated using(public.is_tenant_member(tenant_id));
create policy "offers_manage" on public.job_offers for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','recruiter','hr','manager'])) with check(public.has_tenant_role(tenant_id,array['owner','admin','recruiter','hr','manager']));

grant select,insert,update,delete on public.job_screening_questions,public.interview_kits,public.interview_criteria,public.application_scorecards,public.application_scorecard_answers,public.interview_slots,public.interview_bookings,public.job_offers to authenticated;
grant select on public.application_answers to authenticated;
revoke execute on function public.submit_public_application(text,uuid,text,text,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.get_public_career_page(text),public.get_public_job(text,uuid) to anon,authenticated;
grant execute on function public.submit_public_application(text,uuid,text,text,text,jsonb,boolean) to service_role;
update public.plans set features=features||'{"career_page":true,"structured_interviews":true,"self_scheduling":true,"offers":true}'::jsonb,updated_at=now();
