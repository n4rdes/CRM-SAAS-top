import Link from "next/link";
import { SubmitButton } from "../_components/submit-button";
import { createDepartment, createEmployee, createPosition } from "./actions";
import { requireWorkspace } from "@/lib/auth/workspace";
import { canManagePeople, canViewPeople } from "@/lib/domain/team";
import { EMPLOYEE_STATUSES, EMPLOYEE_STATUS_LABELS } from "@/lib/domain/people";

type EmployeeRow = {
  id: string;
  full_name: string;
  corporate_email: string | null;
  personal_email: string | null;
  employee_number: string | null;
  status: string;
  hire_date: string | null;
  department: { name: string } | null;
  position: { title: string } | null;
};

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; q?: string; status?: string; department?: string }> }) {
  const query = await searchParams;
  const { supabase, tenant, membership } = await requireWorkspace();
  const allowed = canViewPeople(membership.role);
  const canManage = canManagePeople(membership.role);

  if (!allowed) return <div className="workspace-content"><div className="page-heading"><div><h1>Pessoas</h1><p>Cadastro e jornada de colaboradores.</p></div></div><div className="notice error-notice">Sua função não possui acesso aos dados de Pessoas.</div></div>;

  const [employeesResult, departmentsResult, positionsResult, subscriptionResult] = await Promise.all([
    supabase.from("employees").select("id,full_name,corporate_email,personal_email,employee_number,status,hire_date,department:departments(name),position:positions(title)").eq("tenant_id", tenant.id).order("full_name"),
    supabase.from("departments").select("id,name,code").eq("tenant_id", tenant.id).order("name"),
    supabase.from("positions").select("id,title,level,department_id").eq("tenant_id", tenant.id).order("title"),
    supabase.from("subscriptions").select("plan:plans(name,limits)").eq("tenant_id", tenant.id).maybeSingle(),
  ]);

  const allEmployees = (employeesResult.data ?? []) as unknown as EmployeeRow[];
  const search = (query.q ?? "").trim().toLocaleLowerCase("pt-BR");
  const employees = allEmployees.filter(employee => {
    if (query.status && employee.status !== query.status) return false;
    if (query.department && employee.department?.name !== query.department) return false;
    if (search && ![employee.full_name, employee.corporate_email, employee.personal_email, employee.employee_number].filter(Boolean).some(value => String(value).toLocaleLowerCase("pt-BR").includes(search))) return false;
    return true;
  });
  const plan = subscriptionResult.data?.plan as unknown as { name?: string; limits?: { employees?: number | null } } | null;
  const activeCount = allEmployees.filter(item => item.status === "active").length;
  const preboardingCount = allEmployees.filter(item => item.status === "preboarding").length;
  const leaveCount = allEmployees.filter(item => item.status === "on_leave").length;
  const occupiedCount = allEmployees.filter(item => item.status !== "terminated").length;

  return <div className="workspace-content wide-content">
    <div className="page-heading"><div><h1>Pessoas</h1><p>Do candidato contratado ao ciclo completo do colaborador.</p></div><span className="record-count">{occupiedCount}{typeof plan?.limits?.employees === "number" ? `/${plan.limits.employees}` : ""} no plano {plan?.name ?? "atual"}</span></div>
    {query.error && <div className="notice error-notice">{query.error}</div>}
    {query.success && <div className="notice">{query.success}</div>}
    {employeesResult.error && <div className="setup-notice"><strong>Módulo Pessoas aguardando configuração</strong><span>Execute a migração <code>202607220005_people_core.sql</code> no SQL Editor do Supabase.</span></div>}

    <section className="metric-grid people-metrics"><article className="metric-card"><small>Colaboradores ativos</small><strong>{activeCount}</strong><em>headcount atual</em></article><article className="metric-card"><small>Em admissão</small><strong>{preboardingCount}</strong><em>checklists em andamento</em></article><article className="metric-card"><small>Afastados</small><strong>{leaveCount}</strong><em>atenção do RH</em></article><article className="metric-card"><small>Departamentos</small><strong>{departmentsResult.data?.length ?? 0}</strong><em>estrutura organizacional</em></article></section>

    {canManage && <section className="people-create-grid">
      <article className="panel"><h2>Novo colaborador</h2><p>Cria o cadastro e um checklist padrão de admissão.</p><form className="record-form people-employee-form" action={createEmployee}><label>Nome completo<input name="full_name" required /></label><label>E-mail<input name="email" type="email" /></label><label>Telefone<input name="phone" /></label><label>Data de admissão<input name="hire_date" type="date" /></label><label>Departamento<select name="department_id"><option value="">Não definido</option>{departmentsResult.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Cargo<select name="position_id"><option value="">Não definido</option>{positionsResult.data?.map(item => <option key={item.id} value={item.id}>{item.title}{item.level ? ` · ${item.level}` : ""}</option>)}</select></label><SubmitButton className="full-field" pendingLabel="Criando...">Criar colaborador e onboarding</SubmitButton></form></article>
      <div className="people-structure-stack"><article className="panel"><h2>Novo departamento</h2><form className="record-form structure-form" action={createDepartment}><label>Nome<input name="name" required /></label><label>Código<input name="code" placeholder="Ex.: TEC" /></label><label className="full-field">Descrição<input name="description" /></label><SubmitButton className="full-field" pendingLabel="Criando...">Adicionar departamento</SubmitButton></form></article><article className="panel"><h2>Novo cargo</h2><form className="record-form structure-form" action={createPosition}><label>Cargo<input name="title" required /></label><label>Nível<input name="level" placeholder="Júnior, Pleno..." /></label><label className="full-field">Departamento<select name="department_id"><option value="">Sem departamento</option>{departmentsResult.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><SubmitButton className="full-field" pendingLabel="Criando...">Adicionar cargo</SubmitButton></form></article></div>
    </section>}

    <section className="panel people-directory"><div className="panel-heading"><div><h2>Diretório de colaboradores</h2><p>{employees.length} resultado(s) · {allEmployees.length} cadastro(s) no total.</p></div></div><form className="list-filters people-filters"><input name="q" defaultValue={query.q ?? ""} placeholder="Buscar por nome, e-mail ou matrícula" /><select name="status" defaultValue={query.status ?? ""}><option value="">Todos os status</option>{EMPLOYEE_STATUSES.map(status => <option key={status} value={status}>{EMPLOYEE_STATUS_LABELS[status]}</option>)}</select><select name="department" defaultValue={query.department ?? ""}><option value="">Todos os departamentos</option>{departmentsResult.data?.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}</select><button type="submit">Filtrar</button><Link href="/app/pessoas">Limpar</Link></form>{employees.length ? <div className="employee-directory-list">{employees.map(employee => <Link href={`/app/pessoas/${employee.id}`} key={employee.id}><span className="employee-avatar">{employee.full_name.split(" ").slice(0,2).map(part => part[0]).join("").toUpperCase()}</span><div><strong>{employee.full_name}</strong><small>{employee.position?.title ?? "Cargo não definido"} · {employee.department?.name ?? "Sem departamento"}</small></div><span className={`status-badge employee-status-${employee.status}`}>{EMPLOYEE_STATUS_LABELS[employee.status as keyof typeof EMPLOYEE_STATUS_LABELS] ?? employee.status}</span><em>{employee.corporate_email ?? employee.personal_email ?? employee.employee_number ?? "Abrir perfil"}</em><b>→</b></Link>)}</div> : <div className="empty-state">Nenhum colaborador encontrado com esses filtros.</div>}</section>
  </div>;
}
