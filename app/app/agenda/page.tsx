import { ConfirmButton } from "../_components/confirm-button";
import { SubmitButton } from "../_components/submit-button";
import { createActivity, deleteActivity, toggleActivity } from "../actions";
import { requireWorkspace } from "@/lib/auth/workspace";
import { ACTIVITY_TYPES, ACTIVITY_TYPE_LABELS } from "@/lib/domain/hr";

type Activity = { id: string; activity_type: string; subject: string; description: string | null; due_at: string | null; completed_at: string | null; created_at: string; entity_type: string; entity_id: string | null };

function dateLabel(value: string | null) {
  if (!value) return "Sem prazo";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; status?: string }> }) {
  const query = await searchParams;
  const { supabase, tenant } = await requireWorkspace();
  const { data, error } = await supabase.from("activities").select("id,activity_type,subject,description,due_at,completed_at,created_at,entity_type,entity_id").eq("tenant_id", tenant.id).order("completed_at", { ascending: true, nullsFirst: true }).order("due_at", { ascending: true, nullsFirst: false }).limit(200);
  const allActivities = (data ?? []) as Activity[];
  const activities = query.status === "completed" ? allActivities.filter(item => item.completed_at) : query.status === "all" ? allActivities : allActivities.filter(item => !item.completed_at);
  const overdue = allActivities.filter(item => !item.completed_at && item.due_at && new Date(item.due_at) < new Date()).length;
  const today = new Date().toISOString().slice(0, 10);

  return <div className="workspace-content">
    <div className="page-heading"><div><h1>Agenda e atividades</h1><p>Centralize tarefas, reuniões, ligações, entrevistas e follow-ups.</p></div><span className="record-count">{allActivities.filter(item => !item.completed_at).length} pendente(s) · {overdue} atrasada(s)</span></div>
    {query.error && <div className="notice error-notice">{query.error}</div>}
    {query.success && <div className="notice">{query.success}</div>}
    {error && <div className="setup-notice"><strong>Agenda aguardando configuração</strong><span>Execute a migração <code>202607210004_operations_analytics.sql</code> no SQL Editor do Supabase.</span></div>}
    <div className="agenda-layout">
      <article className="panel sticky-panel"><h2>Nova atividade</h2><p>O item aparecerá na agenda e na visão geral.</p><form className="record-form" action={createActivity}><input type="hidden" name="return_path" value="/app/agenda" /><input type="hidden" name="entity_type" value="general" /><label>Tipo<select name="activity_type" defaultValue="task">{ACTIVITY_TYPES.map(type => <option key={type} value={type}>{ACTIVITY_TYPE_LABELS[type]}</option>)}</select></label><label>Assunto<input name="subject" placeholder="Ex.: retorno da proposta" required /></label><label>Prazo<input name="due_at" type="datetime-local" min={`${today}T00:00`} /></label><label>Descrição<textarea name="description" rows={4} placeholder="Contexto e próximo passo" /></label><SubmitButton pendingLabel="Criando...">Criar atividade</SubmitButton></form></article>
      <article className="panel agenda-main"><div className="panel-heading"><div><h2>Compromissos</h2><p>{activities.length} registro(s) no filtro atual.</p></div><div className="filter-tabs"><a className={!query.status ? "active" : ""} href="/app/agenda">Pendentes</a><a className={query.status === "completed" ? "active" : ""} href="/app/agenda?status=completed">Concluídas</a><a className={query.status === "all" ? "active" : ""} href="/app/agenda?status=all">Todas</a></div></div>
        {activities.length ? <div className="agenda-list">{activities.map(item => { const isOverdue = !item.completed_at && item.due_at && new Date(item.due_at) < new Date(); return <div className={`agenda-item ${item.completed_at ? "is-complete" : ""}`} key={item.id}><span className={`activity-icon activity-${item.activity_type}`}>{ACTIVITY_TYPE_LABELS[item.activity_type as keyof typeof ACTIVITY_TYPE_LABELS]?.slice(0, 1) ?? "A"}</span><div className="agenda-copy"><div><strong>{item.subject}</strong><span className="activity-kind">{ACTIVITY_TYPE_LABELS[item.activity_type as keyof typeof ACTIVITY_TYPE_LABELS] ?? item.activity_type}</span></div>{item.description && <p>{item.description}</p>}<time className={isOverdue ? "overdue" : ""}>{isOverdue ? "Atrasada · " : ""}{dateLabel(item.due_at)}</time></div><div className="agenda-actions"><form action={toggleActivity}><input type="hidden" name="activity_id" value={item.id} /><input type="hidden" name="completed" value={String(Boolean(item.completed_at))} /><input type="hidden" name="return_path" value="/app/agenda" /><SubmitButton className="secondary-button" pendingLabel="...">{item.completed_at ? "Reabrir" : "Concluir"}</SubmitButton></form><form action={deleteActivity}><input type="hidden" name="activity_id" value={item.id} /><input type="hidden" name="return_path" value="/app/agenda" /><ConfirmButton className="remove-application" message="Excluir esta atividade?">Excluir</ConfirmButton></form></div></div>; })}</div> : <div className="empty-state">Nenhuma atividade neste filtro.</div>}
      </article>
    </div>
  </div>;
}
