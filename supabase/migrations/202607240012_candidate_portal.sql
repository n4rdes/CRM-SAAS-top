-- Prismae Candidate Portal: experiência contínua do candidato e autosserviço LGPD.
create table if not exists public.candidate_portal_access (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  candidate_id uuid not null,
  access_token uuid not null default gen_random_uuid() unique,
  active boolean not null default true,
  expires_at timestamptz not null default (now()+interval '365 days'),
  last_accessed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id,candidate_id),
  unique(tenant_id,id),
  foreign key (tenant_id,candidate_id) references public.candidates(tenant_id,id) on delete cascade
);

create table if not exists public.candidate_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  candidate_id uuid not null,
  application_id uuid,
  direction text not null check(direction in ('to_candidate','from_candidate','internal')),
  body text not null check(char_length(body) between 1 and 5000),
  sender_user_id uuid references auth.users(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(tenant_id,id),
  foreign key (tenant_id,candidate_id) references public.candidates(tenant_id,id) on delete cascade,
  foreign key (tenant_id,application_id) references public.applications(tenant_id,id) on delete set null
);

create table if not exists public.candidate_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  candidate_id uuid not null,
  application_id uuid,
  category text not null default 'candidate' check(category in ('candidate','application','offer','admission')),
  document_type text not null default 'other',
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check(size_bytes>0 and size_bytes<=10485760),
  scan_status text not null default 'pending' check(scan_status in ('pending','clean','infected','failed','not_configured')),
  uploaded_by_candidate boolean not null default true,
  created_at timestamptz not null default now(),
  unique(tenant_id,id),
  foreign key (tenant_id,candidate_id) references public.candidates(tenant_id,id) on delete cascade,
  foreign key (tenant_id,application_id) references public.applications(tenant_id,id) on delete set null
);

create table if not exists public.candidate_consents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  candidate_id uuid not null,
  consent_type text not null check(consent_type in ('recruitment','talent_pool','job_alerts','communications')),
  granted boolean not null,
  policy_version text not null default '1.0',
  source text not null default 'candidate_portal',
  ip_hash text,
  created_at timestamptz not null default now(),
  unique(tenant_id,candidate_id,consent_type),
  foreign key (tenant_id,candidate_id) references public.candidates(tenant_id,id) on delete cascade
);

create table if not exists public.candidate_data_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  candidate_id uuid not null,
  request_type text not null check(request_type in ('access','correction','deletion','portability')),
  status text not null default 'open' check(status in ('open','in_review','completed','rejected','canceled')),
  details text,
  resolution_notes text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id,id),
  foreign key (tenant_id,candidate_id) references public.candidates(tenant_id,id) on delete cascade
);

create table if not exists public.candidate_job_alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  candidate_id uuid not null,
  active boolean not null default true,
  keywords text[],
  locations text[],
  workplace_types text[],
  frequency text not null default 'weekly' check(frequency in ('instant','daily','weekly')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id,candidate_id),
  foreign key (tenant_id,candidate_id) references public.candidates(tenant_id,id) on delete cascade
);

create index if not exists candidate_portal_token_idx on public.candidate_portal_access(access_token) where active;
create index if not exists candidate_messages_candidate_idx on public.candidate_messages(tenant_id,candidate_id,created_at desc);
create index if not exists candidate_documents_candidate_idx on public.candidate_documents(tenant_id,candidate_id,created_at desc);
create index if not exists candidate_requests_status_idx on public.candidate_data_requests(tenant_id,status,created_at);

do $$ declare table_name text; begin
  foreach table_name in array array['candidate_portal_access','candidate_data_requests','candidate_job_alerts'] loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I',table_name,table_name);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',table_name,table_name);
  end loop;
  foreach table_name in array array['candidate_portal_access','candidate_messages','candidate_documents','candidate_consents','candidate_data_requests','candidate_job_alerts'] loop
    execute format('drop trigger if exists protect_%I_tenant_id on public.%I',table_name,table_name);
    execute format('create trigger protect_%I_tenant_id before update of tenant_id on public.%I for each row execute function public.prevent_tenant_id_change()',table_name,table_name);
  end loop;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('candidate-documents','candidate-documents',false,10485760,array['application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.create_candidate_portal_access(p_candidate_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare tenant_value uuid; token_value uuid; begin
  select tenant_id into tenant_value from public.candidates where id=p_candidate_id;
  if tenant_value is null or not public.has_tenant_role(tenant_value,array['owner','admin','recruiter','hr','manager']) then raise exception 'PORTAL_ACCESS_FORBIDDEN'; end if;
  insert into public.candidate_portal_access(tenant_id,candidate_id,created_by,active,expires_at)
  values(tenant_value,p_candidate_id,auth.uid(),true,now()+interval '365 days')
  on conflict(tenant_id,candidate_id) do update set active=true,expires_at=now()+interval '365 days',access_token=gen_random_uuid(),updated_at=now()
  returning access_token into token_value;
  insert into public.entity_events(tenant_id,entity_type,entity_id,event_type,title,actor_id) values(tenant_value,'candidate',p_candidate_id,'portal_activated','Ativou o portal do candidato',auth.uid());
  return token_value;
end $$;

create or replace function public.resolve_candidate_portal(p_token uuid)
returns table(tenant_id uuid,candidate_id uuid)
language sql stable security definer set search_path='' as $$
 select p.tenant_id,p.candidate_id from public.candidate_portal_access p where p.access_token=p_token and p.active and p.expires_at>now();
$$;

create or replace function public.get_candidate_portal(p_token uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare tenant_value uuid; candidate_value uuid; result jsonb; begin
  select p.tenant_id,p.candidate_id into tenant_value,candidate_value from public.candidate_portal_access p where p.access_token=p_token and p.active and p.expires_at>now();
  if candidate_value is null then return null; end if;
  update public.candidate_portal_access set last_accessed_at=now() where access_token=p_token;
  select jsonb_build_object(
    'company',(select jsonb_build_object('name',t.name,'slug',t.slug,'color',t.career_primary_color,'logo_url',t.career_logo_url) from public.tenants t where t.id=tenant_value),
    'candidate',(select jsonb_build_object('id',c.id,'full_name',c.full_name,'email',c.email,'phone',c.phone,'source',c.source) from public.candidates c where c.id=candidate_value),
    'applications',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'stage',case a.stage when 'applied' then 'Candidatura recebida' when 'screening' then 'Em análise' when 'interview' then 'Entrevistas' when 'assessment' then 'Avaliação' when 'offer' then 'Proposta' when 'hired' then 'Contratado' when 'rejected' then 'Processo encerrado' when 'withdrawn' then 'Desistência registrada' else 'Em andamento' end,'updated_at',a.updated_at,'job',jsonb_build_object('id',j.id,'title',j.title,'city',j.city,'state',j.state,'workplace_type',j.workplace_type)) order by a.updated_at desc) from public.applications a join public.jobs j on j.id=a.job_id and j.tenant_id=a.tenant_id where a.tenant_id=tenant_value and a.candidate_id=candidate_value),'[]'::jsonb),
    'messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'direction',m.direction,'body',m.body,'created_at',m.created_at) order by m.created_at) from public.candidate_messages m where m.tenant_id=tenant_value and m.candidate_id=candidate_value and m.direction<>'internal'),'[]'::jsonb),
    'slots',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'job_id',s.job_id,'starts_at',s.starts_at,'ends_at',s.ends_at,'meeting_provider',s.meeting_provider,'meeting_url',s.meeting_url,'job_title',j.title) order by s.starts_at) from public.interview_slots s join public.jobs j on j.id=s.job_id where s.tenant_id=tenant_value and s.active and s.starts_at>now() and exists(select 1 from public.applications a where a.tenant_id=tenant_value and a.candidate_id=candidate_value and a.job_id=s.job_id and a.stage in ('screening','interview','assessment')) and (select count(*) from public.interview_bookings b where b.slot_id=s.id and b.status='confirmed')<s.capacity),'[]'::jsonb),
    'bookings',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'slot_id',b.slot_id,'status',b.status,'starts_at',s.starts_at,'ends_at',s.ends_at,'meeting_url',s.meeting_url,'job_title',j.title) order by s.starts_at desc) from public.interview_bookings b join public.interview_slots s on s.id=b.slot_id join public.jobs j on j.id=s.job_id where b.tenant_id=tenant_value and b.candidate_id=candidate_value),'[]'::jsonb),
    'offers',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'title',o.title,'body',o.body,'salary_cents',o.salary_cents,'benefits',o.benefits,'start_date',o.start_date,'expires_at',o.expires_at,'status',o.status,'job_title',j.title) order by o.created_at desc) from public.job_offers o join public.applications a on a.id=o.application_id join public.jobs j on j.id=a.job_id where o.tenant_id=tenant_value and o.candidate_id=candidate_value and o.status in ('sent','accepted','declined')),'[]'::jsonb),
    'documents',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'file_name',d.file_name,'document_type',d.document_type,'category',d.category,'created_at',d.created_at) order by d.created_at desc) from public.candidate_documents d where d.tenant_id=tenant_value and d.candidate_id=candidate_value),'[]'::jsonb),
    'consents',coalesce((select jsonb_object_agg(c.consent_type,c.granted) from public.candidate_consents c where c.tenant_id=tenant_value and c.candidate_id=candidate_value),'{}'::jsonb),
    'requests',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'request_type',r.request_type,'status',r.status,'created_at',r.created_at) order by r.created_at desc) from public.candidate_data_requests r where r.tenant_id=tenant_value and r.candidate_id=candidate_value),'[]'::jsonb)
  ) into result;
  return result;
end $$;

create or replace function public.update_candidate_portal_profile(p_token uuid,p_full_name text,p_phone text,p_talent_pool boolean,p_job_alerts boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare ctx record; begin
  select * into ctx from public.resolve_candidate_portal(p_token); if ctx.candidate_id is null then raise exception 'INVALID_PORTAL'; end if;
  if char_length(trim(p_full_name))<3 then raise exception 'INVALID_NAME'; end if;
  update public.candidates set full_name=trim(p_full_name),phone=nullif(trim(coalesce(p_phone,'')),'') where id=ctx.candidate_id and tenant_id=ctx.tenant_id;
  insert into public.candidate_consents(tenant_id,candidate_id,consent_type,granted) values(ctx.tenant_id,ctx.candidate_id,'talent_pool',p_talent_pool)
    on conflict(tenant_id,candidate_id,consent_type) do update set granted=excluded.granted,created_at=now();
  insert into public.candidate_consents(tenant_id,candidate_id,consent_type,granted) values(ctx.tenant_id,ctx.candidate_id,'job_alerts',p_job_alerts)
    on conflict(tenant_id,candidate_id,consent_type) do update set granted=excluded.granted,created_at=now();
  insert into public.candidate_job_alerts(tenant_id,candidate_id,active) values(ctx.tenant_id,ctx.candidate_id,p_job_alerts)
    on conflict(tenant_id,candidate_id) do update set active=excluded.active,updated_at=now();
  return true;
end $$;

create or replace function public.post_candidate_portal_message(p_token uuid,p_body text)
returns uuid language plpgsql security definer set search_path='' as $$
declare ctx record; message_id uuid; begin
  select * into ctx from public.resolve_candidate_portal(p_token); if ctx.candidate_id is null or char_length(trim(p_body))<1 then raise exception 'INVALID_MESSAGE'; end if;
  insert into public.candidate_messages(tenant_id,candidate_id,direction,body) values(ctx.tenant_id,ctx.candidate_id,'from_candidate',trim(p_body)) returning id into message_id;
  return message_id;
end $$;

create or replace function public.book_candidate_interview(p_token uuid,p_slot_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare ctx record; slot_row record; application_value uuid; booking_id uuid; begin
  select * into ctx from public.resolve_candidate_portal(p_token); if ctx.candidate_id is null then raise exception 'INVALID_PORTAL'; end if;
  select * into slot_row from public.interview_slots where id=p_slot_id and tenant_id=ctx.tenant_id and active and starts_at>now() for update;
  if slot_row.id is null or (select count(*) from public.interview_bookings where slot_id=p_slot_id and status='confirmed')>=slot_row.capacity then raise exception 'SLOT_UNAVAILABLE'; end if;
  select id into application_value from public.applications where tenant_id=ctx.tenant_id and candidate_id=ctx.candidate_id and job_id=slot_row.job_id and stage in ('screening','interview','assessment') order by updated_at desc limit 1;
  if application_value is null then raise exception 'APPLICATION_NOT_ELIGIBLE'; end if;
  insert into public.interview_bookings(tenant_id,slot_id,application_id,candidate_id) values(ctx.tenant_id,p_slot_id,application_value,ctx.candidate_id)
  on conflict(slot_id,application_id) do update set status='confirmed',canceled_at=null returning id into booking_id;
  update public.applications set stage='interview' where id=application_value;
  return booking_id;
end $$;

create or replace function public.respond_candidate_offer(p_token uuid,p_offer_id uuid,p_accept boolean,p_note text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare ctx record; application_value uuid; begin
  select * into ctx from public.resolve_candidate_portal(p_token); if ctx.candidate_id is null then raise exception 'INVALID_PORTAL'; end if;
  update public.job_offers set status=case when p_accept then 'accepted' else 'declined' end,responded_at=now(),response_note=nullif(trim(coalesce(p_note,'')),'') where id=p_offer_id and tenant_id=ctx.tenant_id and candidate_id=ctx.candidate_id and status='sent' returning application_id into application_value;
  if application_value is null then raise exception 'OFFER_NOT_AVAILABLE'; end if;
  if p_accept then update public.applications set stage='hired' where id=application_value; end if;
  return true;
end $$;

create or replace function public.request_candidate_data_action(p_token uuid,p_request_type text,p_details text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare ctx record; request_id uuid; begin
  select * into ctx from public.resolve_candidate_portal(p_token); if ctx.candidate_id is null or p_request_type not in ('access','correction','deletion','portability') then raise exception 'INVALID_REQUEST'; end if;
  insert into public.candidate_data_requests(tenant_id,candidate_id,request_type,details) values(ctx.tenant_id,ctx.candidate_id,p_request_type,nullif(trim(coalesce(p_details,'')),'')) returning id into request_id;
  return request_id;
end $$;

-- Completa merge de candidatos com dados do portal.
create or replace function public.merge_candidates(p_primary_id uuid,p_duplicate_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare tenant_value uuid; app record; begin
  select tenant_id into tenant_value from public.candidates where id=p_primary_id;
  if tenant_value is null or not public.has_tenant_role(tenant_value,array['owner','admin','recruiter','hr']) then raise exception 'CANDIDATE_MERGE_FORBIDDEN'; end if;
  if not exists(select 1 from public.candidates where id=p_duplicate_id and tenant_id=tenant_value) then raise exception 'DUPLICATE_NOT_FOUND'; end if;
  for app in select * from public.applications where candidate_id=p_duplicate_id and tenant_id=tenant_value loop
    if exists(select 1 from public.applications where tenant_id=tenant_value and job_id=app.job_id and candidate_id=p_primary_id) then delete from public.applications where id=app.id; else update public.applications set candidate_id=p_primary_id where id=app.id; end if;
  end loop;
  update public.activities set entity_id=p_primary_id where tenant_id=tenant_value and entity_type='candidate' and entity_id=p_duplicate_id;
  update public.custom_field_values set entity_id=p_primary_id where tenant_id=tenant_value and entity_type='candidate' and entity_id=p_duplicate_id and not exists(select 1 from public.custom_field_values x where x.tenant_id=tenant_value and x.definition_id=custom_field_values.definition_id and x.entity_id=p_primary_id);
  delete from public.custom_field_values where tenant_id=tenant_value and entity_type='candidate' and entity_id=p_duplicate_id;
  update public.candidate_messages set candidate_id=p_primary_id where tenant_id=tenant_value and candidate_id=p_duplicate_id;
  update public.candidate_documents set candidate_id=p_primary_id where tenant_id=tenant_value and candidate_id=p_duplicate_id;
  update public.candidate_data_requests set candidate_id=p_primary_id where tenant_id=tenant_value and candidate_id=p_duplicate_id;
  delete from public.candidate_portal_access where tenant_id=tenant_value and candidate_id=p_duplicate_id;
  delete from public.candidate_consents where tenant_id=tenant_value and candidate_id=p_duplicate_id;
  delete from public.candidate_job_alerts where tenant_id=tenant_value and candidate_id=p_duplicate_id;
  insert into public.entity_events(tenant_id,entity_type,entity_id,event_type,title,actor_id,metadata) values(tenant_value,'candidate',p_primary_id,'merged','Mesclou registros duplicados',auth.uid(),jsonb_build_object('duplicate_id',p_duplicate_id));
  delete from public.candidates where id=p_duplicate_id and tenant_id=tenant_value; return p_primary_id;
end $$;

-- RLS interno; acesso externo somente por funções security definer.
do $$ declare table_name text; begin foreach table_name in array array['candidate_portal_access','candidate_messages','candidate_documents','candidate_consents','candidate_data_requests','candidate_job_alerts'] loop execute format('alter table public.%I enable row level security',table_name); end loop; end $$;
create policy "portal_access_read" on public.candidate_portal_access for select to authenticated using(public.is_tenant_member(tenant_id));
create policy "portal_access_manage" on public.candidate_portal_access for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','recruiter','hr','manager'])) with check(public.has_tenant_role(tenant_id,array['owner','admin','recruiter','hr','manager']));
create policy "candidate_messages_read" on public.candidate_messages for select to authenticated using(public.is_tenant_member(tenant_id));
create policy "candidate_messages_write" on public.candidate_messages for insert to authenticated with check(public.has_tenant_role(tenant_id,array['owner','admin','recruiter','hr','manager','member']));
create policy "candidate_documents_read" on public.candidate_documents for select to authenticated using(public.is_tenant_member(tenant_id));
create policy "candidate_consents_read" on public.candidate_consents for select to authenticated using(public.is_tenant_member(tenant_id));
create policy "candidate_requests_read" on public.candidate_data_requests for select to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','recruiter','hr']));
create policy "candidate_requests_manage" on public.candidate_data_requests for update to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','hr'])) with check(public.has_tenant_role(tenant_id,array['owner','admin','hr']));
create policy "candidate_alerts_read" on public.candidate_job_alerts for select to authenticated using(public.is_tenant_member(tenant_id));
grant select,insert,update,delete on public.candidate_portal_access,public.candidate_messages,public.candidate_documents,public.candidate_consents,public.candidate_data_requests,public.candidate_job_alerts to authenticated;
grant execute on function public.create_candidate_portal_access(uuid) to authenticated;
revoke execute on function public.resolve_candidate_portal(uuid),public.get_candidate_portal(uuid),public.update_candidate_portal_profile(uuid,text,text,boolean,boolean),public.post_candidate_portal_message(uuid,text),public.book_candidate_interview(uuid,uuid),public.respond_candidate_offer(uuid,uuid,boolean,text),public.request_candidate_data_action(uuid,text,text) from public,anon,authenticated;
grant execute on function public.resolve_candidate_portal(uuid),public.get_candidate_portal(uuid),public.update_candidate_portal_profile(uuid,text,text,boolean,boolean),public.post_candidate_portal_message(uuid,text),public.book_candidate_interview(uuid,uuid),public.respond_candidate_offer(uuid,uuid,boolean,text),public.request_candidate_data_action(uuid,text,text) to service_role;
update public.plans set features=features||'{"candidate_portal":true,"candidate_messaging":true,"candidate_documents":true,"candidate_lgpd":true}'::jsonb,updated_at=now();
