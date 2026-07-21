-- Auditoria automática dos módulos operacionais do Prismae.

create or replace function public.audit_tenant_record()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  record_data jsonb;
  record_tenant_id uuid;
  record_id text;
begin
  record_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  record_tenant_id := (record_data ->> 'tenant_id')::uuid;
  record_id := record_data ->> 'id';

  insert into public.audit_logs (tenant_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    record_tenant_id,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    record_id,
    jsonb_build_object('record', record_data)
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['crm_companies','jobs','candidates','applications']
  loop
    execute format('drop trigger if exists audit_%I_changes on public.%I', table_name, table_name);
    execute format('create trigger audit_%I_changes after insert or update or delete on public.%I for each row execute function public.audit_tenant_record()', table_name, table_name);
  end loop;
end;
$$;

revoke all on function public.audit_tenant_record() from public, anon, authenticated;
