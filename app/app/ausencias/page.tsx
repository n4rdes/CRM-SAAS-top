import { redirect } from "next/navigation";
import { ConfirmButton } from "../_components/confirm-button";
import { SubmitButton } from "../_components/submit-button";
import { requireWorkspace } from "@/lib/auth/workspace";
import { canManagePeople, canViewPeople } from "@/lib/domain/team";
import { formatLeaveDays, LEAVE_STATUS_LABELS, LEAVE_TYPE_LABELS, LEAVE_TYPES, PARTIAL_DAY_LABELS, PARTIAL_DAY_OPTIONS, type LeaveStatus, type LeaveType, type PartialDay } from "@/lib/domain/time-off";
import { adjustLeaveBalance, cancelLeaveRequest, createLeavePolicy, createLeaveRequest, decideLeaveRequest } from "./actions";

type Employee = { id: string; full_name: string; status: string; department: { name?: string } | null };
type Policy = { id: string; name: string; code: string; leave_type: LeaveType; allowance_days: number; deducts_balance: boolean; requires_approval: boolean; minimum_notice_days: number; color: string; active: boolean };
type LeaveRequest = { id: string; start_date: string; end_date: string; partial_day: PartialDay; total_days: number; reason: string | null; status: LeaveStatus; decision_note: string | null; created_at: string; employee: { full_name?: string; department?: { name?: string } | null } | null; policy: { name?: string; color?: string; leave_type?: LeaveType } | null };
type Balance = { id: string; employee_id: string; employee_name: string; policy_id: string; policy_name: string; color: string; deducts_balance: boolean; entitled_days: number; carried_days: number; adjusted_days: number; approved_days: number; pending_days: number; available_days: number };

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function shortDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).format(value).replace(".", "");
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default async function TimeOffPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; status?: string }> }) {
  const query = await searchParams;
  const { supabase, tenant, membership } = await requireWorkspace();
  if (!canViewPeople(membership.role)) redirect("/app");
  const manager = canManagePeople(membership.role);
  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const [policiesResult, employeesResult, requestsResult, balancesResult] = await Promise.all([
    supabase.from("leave_policies").select("id,name,code,leave_type,allowance_days,deducts_balance,requires_approval,minimum_notice_days,color,active").eq("tenant_id", tenant.id).order("active", { ascending: false }).order("name"),
    supabase.from("employees").select("id,full_name,status,department:departments(name)").eq("tenant_id", tenant.id).neq("status", "terminated").order("full_name"),
    supabase.from("leave_requests").select("id,start_date,end_date,partial_day,total_days,reason,status,decision_note,created_at,employee:employees(full_name,department:departments(name)),policy:leave_policies(name,color,leave_type)").eq("tenant_id", tenant.id).order("start_date", { ascending: false }).limit(250),
    supabase.from("leave_balance_summary").select("id,employee_id,employee_name,policy_id,policy_name,color,deducts_balance,entitled_days,carried_days,adjusted_days,approved_days,pending_days,available_days").eq("tenant_id", tenant.id).eq("period_start", yearStart).order("employee_name"),
  ]);
  const policies = (policiesResult.data ?? []) as Policy[];
  const employees = (employeesResult.data ?? []) as unknown as Employee[];
  const requests = (requestsResult.data ?? []) as unknown as LeaveRequest[];
  const balances = (balancesResult.data ?? []) as unknown as Balance[];
  const pending = requests.filter(item => item.status === "pending");
  const today = isoDate(new Date());
  const approved = requests.filter(item => item.status === "approved");
  const awayToday = approved.filter(item => item.start_date <= today && item.end_date >= today);
  const upcoming = approved.filter(item => item.start_date > today).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const approvedDays = approved.filter(item => item.start_date.startsWith(String(year))).reduce((sum, item) => sum + Number(item.total_days), 0);
  const statusFilter = ["pending", "approved", "rejected", "canceled"].includes(query.status ?? "") ? query.status : "all";
  const visibleRequests = statusFilter === "all" ? requests : requests.filter(item => item.status === statusFilter);
  const days = Array.from({ length: 14 }, (_, index) => { const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() + index); return date; });

  return <div className="workspace-content wide-content timeoff-page">
    <div className="page-heading"><div><p className="page-eyebrow">RH OPERACIONAL</p><h1>Férias & ausências</h1><p>Políticas, saldos, aprovações e calendário da equipe em uma única operação.</p></div><span className="record-count">{pending.length} aguardando decisão</span></div>
    {query.error && <div className="notice error-notice">{query.error}</div>}
    {query.success && <div className="notice">{query.success}</div>}
    {policiesResult.error && <div className="setup-notice"><strong>Férias & ausências aguardando configuração</strong><span>Execute a migração <code>202607220008_timeoff_automations.sql</code> no Supabase.</span></div>}

    <section className="metric-grid timeoff-metrics">
      <article className="metric-card"><small>Aguardando aprovação</small><strong>{pending.length}</strong><em>{pending.length ? "decisões na sua fila" : "fila em dia"}</em></article>
      <article className="metric-card"><small>Ausentes hoje</small><strong>{awayToday.length}</strong><em>de {employees.length} pessoas ativas</em></article>
      <article className="metric-card"><small>Próximas saídas</small><strong>{upcoming.length}</strong><em>períodos já aprovados</em></article>
      <article className="metric-card"><small>Dias aprovados em {year}</small><strong>{new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(approvedDays)}</strong><em>visão consolidada</em></article>
    </section>

    <section className="timeoff-command-grid">
      <article className="panel timeoff-calendar-panel">
        <div className="panel-heading"><div><h2>Calendário da equipe</h2><p>Próximos 14 dias de disponibilidade.</p></div><span className="calendar-legend"><i /> ausência aprovada</span></div>
        <div className="team-calendar">{days.map(day => { const value = isoDate(day); const people = approved.filter(item => item.start_date <= value && item.end_date >= value); return <div className={value === today ? "is-today" : ""} key={value}><header><span>{shortDate(day)}</span>{value === today && <em>Hoje</em>}</header><section>{people.length ? people.slice(0, 3).map(item => <span style={{ borderColor: item.policy?.color ?? "#3156d8" }} key={item.id}><b>{item.employee?.full_name}</b><small>{item.policy?.name}</small></span>) : <small>Livre</small>}{people.length > 3 && <em>+{people.length - 3}</em>}</section></div>; })}</div>
      </article>
      <article className="panel request-leave-panel">
        <div className="panel-heading"><div><h2>Nova solicitação</h2><p>O saldo e conflitos são validados no servidor.</p></div></div>
        <form className="record-form leave-request-form" action={createLeaveRequest}>
          <label>Colaborador<select name="employee_id" required defaultValue=""><option value="" disabled>Selecione uma pessoa</option>{employees.map(employee => <option value={employee.id} key={employee.id}>{employee.full_name}{employee.department?.name ? ` · ${employee.department.name}` : ""}</option>)}</select></label>
          <label>Política<select name="policy_id" required defaultValue=""><option value="" disabled>Selecione a política</option>{policies.filter(policy => policy.active).map(policy => <option value={policy.id} key={policy.id}>{policy.name}{policy.deducts_balance ? ` · ${policy.allowance_days} dias` : ""}</option>)}</select></label>
          <div className="form-row"><label>Início<input type="date" name="start_date" min={today} required /></label><label>Fim<input type="date" name="end_date" min={today} required /></label></div>
          <label>Período<select name="partial_day" defaultValue="full">{PARTIAL_DAY_OPTIONS.map(option => <option value={option} key={option}>{PARTIAL_DAY_LABELS[option]}</option>)}</select></label>
          <label>Motivo ou contexto<textarea name="reason" rows={3} placeholder="Informação opcional para quem vai aprovar" /></label>
          <SubmitButton pendingLabel="Validando saldo...">Enviar para aprovação</SubmitButton>
        </form>
      </article>
    </section>

    <section className="panel leave-requests-panel">
      <div className="panel-heading"><div><h2>Solicitações</h2><p>Histórico completo de decisões e períodos.</p></div><div className="filter-tabs"><a className={statusFilter === "all" ? "active" : ""} href="/app/ausencias">Todas</a>{(["pending", "approved", "rejected", "canceled"] as LeaveStatus[]).map(status => <a className={statusFilter === status ? "active" : ""} href={`/app/ausencias?status=${status}`} key={status}>{LEAVE_STATUS_LABELS[status]}</a>)}</div></div>
      {visibleRequests.length ? <div className="leave-request-list">{visibleRequests.map(item => <article key={item.id}><span className="leave-person-avatar">{item.employee?.full_name?.split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase() ?? "PE"}</span><div className="leave-request-copy"><div><strong>{item.employee?.full_name ?? "Colaborador"}</strong><em className={`leave-status leave-${item.status}`}>{LEAVE_STATUS_LABELS[item.status]}</em></div><p><i style={{ background: item.policy?.color ?? "#3156d8" }} />{item.policy?.name ?? "Ausência"} · {dateLabel(item.start_date)} até {dateLabel(item.end_date)}</p><small>{formatLeaveDays(Number(item.total_days))}{item.partial_day !== "full" ? ` · ${PARTIAL_DAY_LABELS[item.partial_day]}` : ""}{item.reason ? ` · ${item.reason}` : ""}</small>{item.decision_note && <small className="decision-note">Decisão: {item.decision_note}</small>}</div><div className="leave-request-actions">{item.status === "pending" && <><form action={decideLeaveRequest}><input type="hidden" name="request_id" value={item.id} /><input type="hidden" name="decision" value="approved" /><SubmitButton className="approve-button" pendingLabel="...">Aprovar</SubmitButton></form><form action={decideLeaveRequest}><input type="hidden" name="request_id" value={item.id} /><input type="hidden" name="decision" value="rejected" /><SubmitButton className="reject-button" pendingLabel="...">Rejeitar</SubmitButton></form></>}{["pending", "approved"].includes(item.status) && <form action={cancelLeaveRequest}><input type="hidden" name="request_id" value={item.id} /><ConfirmButton className="quiet-danger-button" message="Cancelar esta solicitação e liberar o saldo?">Cancelar</ConfirmButton></form>}</div></article>)}</div> : <div className="empty-state">Nenhuma solicitação neste filtro.</div>}
    </section>

    <section className="timeoff-admin-grid">
      <article className="panel"><div className="panel-heading"><div><h2>Políticas ativas</h2><p>Regras preparadas para cada tipo de ausência.</p></div></div><div className="leave-policy-list">{policies.map(policy => <article key={policy.id}><i style={{ background: policy.color }} /><div><strong>{policy.name}</strong><span>{LEAVE_TYPE_LABELS[policy.leave_type]}</span></div><b>{policy.deducts_balance ? `${policy.allowance_days} dias` : "Sem desconto"}</b><small>{policy.requires_approval ? "Com aprovação" : "Aprovação automática"} · {policy.minimum_notice_days}d antecedência</small></article>)}</div></article>
      <article className="panel"><div className="panel-heading"><div><h2>Saldos de {year}</h2><p>Disponível já desconta solicitações pendentes.</p></div></div>{balances.length ? <div className="leave-balance-list">{balances.slice(0, 12).map(balance => <div key={balance.id}><i style={{ background: balance.color }} /><span><strong>{balance.employee_name}</strong><small>{balance.policy_name} · {balance.approved_days} usados · {balance.pending_days} pendentes</small></span><b>{balance.deducts_balance ? `${balance.available_days}d` : "—"}</b></div>)}</div> : <div className="empty-state compact">Os saldos surgirão na primeira solicitação ou ajuste.</div>}</article>
    </section>

    {manager && <section className="timeoff-admin-grid timeoff-forms-grid">
      <article className="panel"><div className="panel-heading"><div><h2>Nova política</h2><p>Personalize regras além dos modelos iniciais.</p></div></div><form className="record-form policy-form" action={createLeavePolicy}><label>Nome<input name="name" placeholder="Ex.: Dia de aniversário" required /></label><label>Tipo<select name="leave_type" defaultValue="personal">{LEAVE_TYPES.map(type => <option value={type} key={type}>{LEAVE_TYPE_LABELS[type]}</option>)}</select></label><div className="form-row"><label>Direito anual<input name="allowance_days" type="number" min="0" max="366" step="0.5" defaultValue="1" /></label><label>Antecedência<input name="minimum_notice_days" type="number" min="0" max="365" defaultValue="0" /></label></div><label>Cor<input className="color-input" name="color" type="color" defaultValue="#3156d8" /></label><div className="check-row"><label><input type="checkbox" name="deducts_balance" defaultChecked /> Desconta saldo</label><label><input type="checkbox" name="requires_approval" defaultChecked /> Exige aprovação</label></div><SubmitButton pendingLabel="Criando política...">Criar política</SubmitButton></form></article>
      <article className="panel"><div className="panel-heading"><div><h2>Ajustar saldo</h2><p>Concessões e correções ficam na auditoria.</p></div></div><form className="record-form balance-form" action={adjustLeaveBalance}><label>Colaborador<select name="employee_id" required defaultValue=""><option value="" disabled>Selecione</option>{employees.map(employee => <option value={employee.id} key={employee.id}>{employee.full_name}</option>)}</select></label><label>Política<select name="policy_id" required defaultValue=""><option value="" disabled>Selecione</option>{policies.filter(policy => policy.active).map(policy => <option value={policy.id} key={policy.id}>{policy.name}</option>)}</select></label><input type="hidden" name="year" value={year} /><div className="form-row three-fields"><label>Direito<input name="entitled_days" type="number" step="0.5" min="0" max="366" defaultValue="30" /></label><label>Carregado<input name="carried_days" type="number" step="0.5" min="0" max="366" defaultValue="0" /></label><label>Ajuste<input name="adjusted_days" type="number" step="0.5" min="-366" max="366" defaultValue="0" /></label></div><label>Justificativa<textarea name="notes" rows={3} placeholder="Motivo do ajuste" /></label><SubmitButton pendingLabel="Atualizando saldo...">Salvar saldo</SubmitButton></form></article>
    </section>}
  </div>;
}
