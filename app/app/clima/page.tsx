import Link from "next/link";
import { requirePlanFeature } from "@/lib/subscriptions/server";
import { canManageEngagement, canManageEngagementActions, canViewEngagement } from "@/lib/domain/team";
import { ACTION_PLAN_STATUSES, ACTION_PLAN_STATUS_LABELS, ENGAGEMENT_CATEGORIES, ENGAGEMENT_CATEGORY_LABELS, RECOGNITION_VALUES, RECOGNITION_VALUE_LABELS, SURVEY_KINDS, SURVEY_KIND_LABELS, SURVEY_STATUS_LABELS, enpsLabel } from "@/lib/domain/engagement";
import { SubmitButton } from "../_components/submit-button";
import { createEmployeeRecognition, createEngagementActionPlan, createEngagementSurvey, updateEngagementActionPlan } from "./actions";

type Survey = { id: string; title: string; description: string | null; kind: string; status: string; starts_on: string | null; ends_on: string | null; created_at: string };
type ActionPlan = { id: string; survey_id: string | null; title: string; description: string | null; category: string; status: string; progress: number; due_on: string | null };
type Employee = { id: string; full_name: string; department: { name: string } | null };
type Recognition = { id: string; message: string; value_tag: string; created_at: string; employee: { full_name: string } | null };
type Summary = { locked: boolean; response_count: number; minimum: number; employee_count: number; participation: number; enps: number | null; scale_average: number | null };

function date(value: string | null) { return value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "sem prazo"; }
function datetime(value: string) { return new Date(value).toLocaleDateString("pt-BR"); }

export default async function EngagementPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const query = await searchParams;
  const { supabase, tenant, membership } = await requirePlanFeature("/app/clima", "engagement", "Clima & engajamento");
  if (!canViewEngagement(membership.role)) return <div className="workspace-content"><div className="page-heading"><div><h1>Clima & engajamento</h1><p>Escuta contínua, eNPS e planos de ação.</p></div></div><div className="notice error-notice">Sua função não possui acesso aos dados de clima.</div></div>;
  const [surveysResult, actionsResult, peopleResult, recognitionsResult] = await Promise.all([
    supabase.from("engagement_surveys").select("id,title,description,kind,status,starts_on,ends_on,created_at").eq("tenant_id", tenant.id).order("created_at", { ascending: false }),
    supabase.from("engagement_action_plans").select("id,survey_id,title,description,category,status,progress,due_on").eq("tenant_id", tenant.id).order("created_at", { ascending: false }),
    supabase.from("employees").select("id,full_name,department:departments(name)").eq("tenant_id", tenant.id).neq("status", "terminated").order("full_name"),
    supabase.from("employee_recognitions").select("id,message,value_tag,created_at,employee:employees(full_name)").eq("tenant_id", tenant.id).order("created_at", { ascending: false }).limit(12),
  ]);
  const surveys = (surveysResult.data ?? []) as Survey[];
  const actions = (actionsResult.data ?? []) as ActionPlan[];
  const employees = (peopleResult.data ?? []) as unknown as Employee[];
  const recognitions = (recognitionsResult.data ?? []) as unknown as Recognition[];
  const currentSurvey = surveys.find(item => item.status === "active") ?? surveys.find(item => item.status === "closed") ?? null;
  let summary: Summary | null = null;
  if (currentSurvey) {
    const result = await supabase.rpc("get_engagement_survey_summary", { p_survey_id: currentSurvey.id });
    summary = result.data as Summary | null;
  }
  const openActions = actions.filter(item => !["completed", "canceled"].includes(item.status));
  const overdueActions = openActions.filter(item => item.due_on && item.due_on < new Date().toISOString().slice(0, 10));
  const averageActionProgress = openActions.length ? Math.round(openActions.reduce((sum, item) => sum + item.progress, 0) / openActions.length) : 0;
  const canManage = canManageEngagement(membership.role);
  const canAct = canManageEngagementActions(membership.role);

  return <div className="workspace-content wide-content engagement-page">
    <div className="page-heading"><div><span className="page-eyebrow">PEOPLE ANALYTICS</span><h1>Clima & engajamento</h1><p>Escute com segurança, transforme sinais em decisão e prove que o feedback virou ação.</p></div>{currentSurvey && <Link className="plan-chip" href={`/app/clima/${currentSurvey.id}`}>{currentSurvey.status === "active" ? "Pesquisa ativa" : "Último resultado"} · abrir</Link>}</div>
    {query.error && <div className="notice error-notice">{query.error}</div>}{query.success && <div className="notice">{query.success}</div>}
    {surveysResult.error && <div className="setup-notice"><strong>Módulo Clima aguardando configuração</strong><span>Execute a migração <code>202607220007_engagement_climate.sql</code> no SQL Editor do Supabase.</span></div>}

    <section className="metric-grid engagement-metrics">
      <article className="metric-card"><small>eNPS atual</small><strong>{summary?.locked === false && summary.enps !== null ? summary.enps : "—"}</strong><em>{summary?.locked ? `Protegido até ${summary.minimum} respostas` : enpsLabel(summary?.enps ?? null)}</em></article>
      <article className="metric-card"><small>Participação</small><strong>{summary ? `${summary.participation}%` : "0%"}</strong><em>{summary?.response_count ?? 0} resposta(s) · {summary?.employee_count ?? employees.length} pessoa(s)</em></article>
      <article className="metric-card"><small>Favorabilidade média</small><strong>{summary?.locked === false && summary.scale_average !== null ? `${summary.scale_average}/5` : "—"}</strong><em>perguntas de escala</em></article>
      <article className="metric-card"><small>Planos em andamento</small><strong>{openActions.length}</strong><em>{averageActionProgress}% de avanço médio</em></article>
      <article className="metric-card"><small>Ações atrasadas</small><strong>{overdueActions.length}</strong><em>{overdueActions.length ? "pedem atenção" : "ritmo em dia"}</em></article>
    </section>

    <section className="engagement-command-grid">
      {canManage && <article className="panel survey-create-panel"><div className="panel-heading"><div><h2>Lançar nova escuta</h2><p>Comece com um modelo validado e personalize antes de publicar.</p></div><span className="panel-number">01</span></div><form className="record-form survey-create-form" action={createEngagementSurvey}><label className="full-field">Nome da pesquisa<input name="title" placeholder="Ex.: Pulso de cultura · agosto" required /></label><label>Modelo<select name="kind" defaultValue="pulse">{SURVEY_KINDS.map(kind => <option value={kind} key={kind}>{SURVEY_KIND_LABELS[kind]}</option>)}</select></label><label>Amostra mínima<input name="minimum" type="number" min="1" max="50" defaultValue="3" /></label><label>Início<input name="starts_on" type="date" /></label><label>Fim<input name="ends_on" type="date" /></label><label className="full-field">Contexto<textarea name="description" rows={3} placeholder="Explique por que esta escuta importa para a empresa." /></label><SubmitButton className="full-field" pendingLabel="Preparando pesquisa...">Criar pesquisa com perguntas recomendadas</SubmitButton></form></article>}
      <article className="panel engagement-radar"><div className="panel-heading"><div><h2>Radar de execução</h2><p>Da escuta ao compromisso visível.</p></div><span className="panel-number">02</span></div><div className="engagement-radar-flow"><div className={currentSurvey ? "done" : ""}><b>1</b><span><strong>Escutar</strong><small>{currentSurvey ? currentSurvey.title : "Nenhuma pesquisa ainda"}</small></span></div><div className={summary && !summary.locked ? "done" : ""}><b>2</b><span><strong>Entender</strong><small>{summary?.locked ? `Faltam ${Math.max(0,summary.minimum-summary.response_count)} respostas para abrir os dados` : summary ? "Amostra liberada para análise" : "Aguardando coleta"}</small></span></div><div className={openActions.length ? "done" : ""}><b>3</b><span><strong>Agir</strong><small>{openActions.length ? `${openActions.length} plano(s) em execução` : "Converta sinais em planos"}</small></span></div><div className={recognitions.length ? "done" : ""}><b>4</b><span><strong>Reconhecer</strong><small>{recognitions.length ? `${recognitions.length} reconhecimento(s) recente(s)` : "Reforce comportamentos positivos"}</small></span></div></div></article>
    </section>

    <section className="panel survey-library"><div className="panel-heading"><div><h2>Central de pesquisas</h2><p>{surveys.length} escuta(s) com histórico preservado.</p></div></div>{surveys.length ? <div className="survey-card-grid">{surveys.map(survey => <Link href={`/app/clima/${survey.id}`} className={`survey-card survey-${survey.status}`} key={survey.id}><header><span>{SURVEY_KIND_LABELS[survey.kind as keyof typeof SURVEY_KIND_LABELS] ?? survey.kind}</span><em>{SURVEY_STATUS_LABELS[survey.status as keyof typeof SURVEY_STATUS_LABELS] ?? survey.status}</em></header><h3>{survey.title}</h3><p>{survey.description || "Pesquisa pronta para transformar percepção em dados acionáveis."}</p><footer><small>{survey.starts_on ? `Início ${date(survey.starts_on)}` : `Criada em ${datetime(survey.created_at)}`}{survey.ends_on ? ` · fim ${date(survey.ends_on)}` : ""}</small><b>Ver pesquisa →</b></footer></Link>)}</div> : <div className="empty-state">Crie sua primeira pesquisa para começar a medir eNPS, liderança e bem-estar.</div>}</section>

    <section className="engagement-bottom-grid">
      <article className="panel action-plan-panel"><div className="panel-heading"><div><h2>Planos de ação</h2><p>Feedback sem execução vira frustração. Dê dono, prazo e progresso.</p></div></div>{canAct && <form className="record-form action-create-form" action={createEngagementActionPlan}><input type="hidden" name="return_to" value="/app/clima" /><label className="full-field">Ação<input name="title" placeholder="Ex.: instituir 1:1 quinzenal nas lideranças" required /></label><label>Categoria<select name="category">{ENGAGEMENT_CATEGORIES.filter(item => item !== "enps").map(item => <option value={item} key={item}>{ENGAGEMENT_CATEGORY_LABELS[item]}</option>)}</select></label><label>Pesquisa de origem<select name="survey_id"><option value="">Sem vínculo</option>{surveys.map(survey => <option value={survey.id} key={survey.id}>{survey.title}</option>)}</select></label><label>Prazo<input name="due_on" type="date" /></label><label className="full-field">Como faremos<textarea name="description" rows={2} /></label><SubmitButton className="full-field" pendingLabel="Criando plano...">Criar plano de ação</SubmitButton></form>}{actions.length ? <div className="action-plan-list">{actions.map(item => <article key={item.id}><div><span>{ENGAGEMENT_CATEGORY_LABELS[item.category as keyof typeof ENGAGEMENT_CATEGORY_LABELS]}</span><strong>{item.title}</strong><small>{item.due_on ? `Prazo ${date(item.due_on)}` : "Sem prazo"}{item.description ? ` · ${item.description}` : ""}</small></div><div className="action-progress"><i><b style={{ width: `${item.progress}%` }} /></i><span>{item.progress}%</span></div>{canAct && <form action={updateEngagementActionPlan}><input type="hidden" name="action_id" value={item.id} /><input type="hidden" name="survey_id" value={item.survey_id ?? ""} /><select name="status" defaultValue={item.status}>{ACTION_PLAN_STATUSES.map(status => <option value={status} key={status}>{ACTION_PLAN_STATUS_LABELS[status]}</option>)}</select><input name="progress" type="number" min="0" max="100" defaultValue={item.progress} /><SubmitButton pendingLabel="...">Salvar</SubmitButton></form>}</article>)}</div> : <div className="empty-state compact">Nenhum plano criado. Use os resultados da próxima escuta para priorizar ações.</div>}</article>

      <article className="panel recognition-panel"><div className="panel-heading"><div><h2>Mural de reconhecimento</h2><p>Torne os valores visíveis em comportamentos reais.</p></div></div>{canAct && <form className="record-form recognition-form" action={createEmployeeRecognition}><label>Pessoa<select name="employee_id" required><option value="">Selecione</option>{employees.map(employee => <option value={employee.id} key={employee.id}>{employee.full_name}{employee.department?.name ? ` · ${employee.department.name}` : ""}</option>)}</select></label><label>Valor<select name="value_tag">{RECOGNITION_VALUES.map(value => <option value={value} key={value}>{RECOGNITION_VALUE_LABELS[value]}</option>)}</select></label><label className="full-field">Reconhecimento<textarea name="message" rows={3} placeholder="Conte o que essa pessoa fez e o impacto gerado." required /></label><SubmitButton className="full-field" pendingLabel="Publicando...">Publicar reconhecimento</SubmitButton></form>}<div className="recognition-feed">{recognitions.map(item => <article key={item.id}><span className="recognition-avatar">{(item.employee?.full_name ?? "P").split(" ").slice(0,2).map(value => value[0]).join("")}</span><div><small>{RECOGNITION_VALUE_LABELS[item.value_tag as keyof typeof RECOGNITION_VALUE_LABELS]}</small><strong>{item.employee?.full_name ?? "Colaborador"}</strong><p>{item.message}</p><time>{datetime(item.created_at)}</time></div></article>)}{!recognitions.length && <div className="empty-state compact">O primeiro reconhecimento pode começar hoje.</div>}</div></article>
    </section>
  </div>;
}
