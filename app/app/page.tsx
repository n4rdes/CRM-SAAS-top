import Link from "next/link";
import { SubmitButton } from "./_components/submit-button";
import { saveDashboardPreferences } from "./preferencias/actions";
import { requireWorkspace } from "@/lib/auth/workspace";
import { ACTIVITY_TYPE_LABELS, APPLICATION_STAGE_LABELS } from "@/lib/domain/hr";
import { DASHBOARD_CARD_IDS, DASHBOARD_CARD_LABELS, sanitizeColumns, sanitizeDashboardCards } from "@/lib/domain/reporting";

type EngagementSummary = { locked: boolean; enps: number | null; participation: number };

const ENTITY_LABELS: Record<string, string> = { crm_companies: "cliente", jobs: "vaga", candidates: "candidato", applications: "candidatura", departments: "departamento", positions: "cargo", employees: "colaborador", employee_workflows: "checklist", employee_workflow_tasks: "tarefa", employee_documents: "documento", performance_cycles: "ciclo de desempenho", performance_goals: "meta", performance_reviews: "avaliação", performance_checkins: "check-in 1:1", engagement_surveys: "pesquisa de clima", engagement_questions: "pergunta de clima", engagement_action_plans: "plano de ação", employee_recognitions: "reconhecimento", tenant: "empresa" };
const ACTION_LABELS: Record<string, string> = { insert: "criou", update: "atualizou", delete: "excluiu", "tenant.created": "criou" };

function DashboardMetricIcon({ kind }: { kind: "clients" | "jobs" | "candidates" | "pipeline" | "people" | "goals" | "engagement" | "time_off" }) {
  const paths = {
    clients: <><path d="M4 20V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v15M17 9h3v11M2 20h20M8 7h2M8 11h2M8 15h2" /></>,
    jobs: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" /></>,
    candidates: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M16 6h5M16 10h5M17 14h4M17 18h4" /></>,
    pipeline: <><path d="M4 5h16M7 12h10M10 19h4" /><path d="m18 3 2 2-2 2M15 10l2 2-2 2M12 17l2 2-2 2" /></>,
    people: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 6" /></>,
    goals: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /><path d="m15 9 5-5" /></>,
    engagement: <><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /><path d="M8 12h2l1.2-2.3L13 14l1.2-2H17" /></>,
    time_off: <><path d="M5 4h14v16H5z" /><path d="M8 2v4M16 2v4M5 9h14M9 13l2 2 4-4" /></>,
  };
  return <span className={`dashboard-metric-icon metric-icon-${kind}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg></span>;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ welcome?: string; success?: string; error?: string }> }) {
  const params = await searchParams;
  const { supabase, tenant, user } = await requireWorkspace();
  const [clients, jobs, candidates, applications, subscription, audit, activities, employees, performanceCycles, performanceGoals, performanceReviews, engagementSurveys, engagementActions, leaveRequests, viewPreferences] = await Promise.all([
    supabase.from("crm_companies").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).in("status", ["open", "paused"]),
    supabase.from("candidates").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
    supabase.from("applications").select("id,stage", { count: "exact" }).eq("tenant_id", tenant.id),
    supabase.from("subscriptions").select("status, trial_ends_at, plan:plans(name, features, limits)").eq("tenant_id", tenant.id).maybeSingle(),
    supabase.from("audit_logs").select("id,action,entity_type,created_at").eq("tenant_id", tenant.id).order("created_at", { ascending: false }).limit(8),
    supabase.from("activities").select("id,subject,activity_type,due_at").eq("tenant_id", tenant.id).is("completed_at", null).order("due_at", { ascending: true, nullsFirst: false }).limit(5),
    supabase.from("employees").select("id,status").eq("tenant_id", tenant.id).neq("status", "terminated"),
    supabase.from("performance_cycles").select("id,name,status").eq("tenant_id", tenant.id).in("status", ["active", "calibration"]).maybeSingle(),
    supabase.from("performance_goals").select("progress,status").eq("tenant_id", tenant.id).not("status", "in", "(draft,canceled)"),
    supabase.from("performance_reviews").select("status").eq("tenant_id", tenant.id),
    supabase.from("engagement_surveys").select("id,title,status").eq("tenant_id", tenant.id).order("created_at", { ascending: false }).limit(1),
    supabase.from("engagement_action_plans").select("id,status").eq("tenant_id", tenant.id),
    supabase.from("leave_requests").select("id,status,start_date,end_date,total_days").eq("tenant_id", tenant.id),
    supabase.from("workspace_view_preferences").select("dashboard_cards,dashboard_columns").eq("tenant_id", tenant.id).eq("user_id", user.id).maybeSingle(),
  ]);
  const planData = subscription.data?.plan as unknown as { name?: string; features?: Record<string, boolean>; limits?: { active_jobs?: number | null; employees?: number | null } } | null;
  const plan = planData?.name ?? "Basic";
  const hasPerformance = planData?.features?.performance === true;
  const hasEngagement = planData?.features?.engagement === true;
  const activeJobLimit = planData?.limits?.active_jobs;
  const trialEndLabel = subscription.data?.trial_ends_at
    ? new Intl.DateTimeFormat("pt-BR").format(new Date(subscription.data.trial_ends_at))
    : null;
  const applicationRows = applications.data ?? [];
  const activeApplications = applicationRows.filter(item => !["hired", "rejected", "withdrawn"].includes(item.stage)).length;
  const hires = applicationRows.filter(item => item.stage === "hired").length;
  const employeeRows = employees.data ?? [];
  const preboarding = employeeRows.filter(item => item.status === "preboarding").length;
  const goalRows = performanceGoals.data ?? [];
  const averageGoalProgress = goalRows.length ? Math.round(goalRows.reduce((sum, goal) => sum + goal.progress, 0) / goalRows.length) : 0;
  const pendingReviews = (performanceReviews.data ?? []).filter(review => review.status === "draft").length;
  const currentEngagementSurvey = engagementSurveys.data?.[0] ?? null;
  let engagementSummary: EngagementSummary | null = null;
  if (currentEngagementSurvey && hasEngagement) {
    const result = await supabase.rpc("get_engagement_survey_summary", { p_survey_id: currentEngagementSurvey.id });
    engagementSummary = result.data as EngagementSummary | null;
  }
  const openEngagementActions = (engagementActions.data ?? []).filter(item => !["completed", "canceled"].includes(item.status)).length;
  const preferenceData = viewPreferences.data as { dashboard_cards?: string[]; dashboard_columns?: number } | null;
  const dashboardCards = sanitizeDashboardCards(preferenceData?.dashboard_cards ?? [...DASHBOARD_CARD_IDS]);
  const dashboardColumns = sanitizeColumns(Number(preferenceData?.dashboard_columns ?? 4), 2, 4, 4);
  const today = new Date().toISOString().slice(0, 10);
  const leaveRows = leaveRequests.data ?? [];
  const pendingLeaves = leaveRows.filter(item => item.status === "pending").length;
  const awayToday = leaveRows.filter(item => item.status === "approved" && item.start_date <= today && item.end_date >= today).length;

  return <div className="workspace-content">
    <div className="page-heading"><div><h1>Visão geral</h1><p>Dados reais e isolados do ambiente {tenant.name}.</p></div><span className="plan-chip">Plano {plan}</span></div>
    {params.welcome && <div className="notice">Ambiente criado com sucesso. Agora você já pode cadastrar seus primeiros dados.</div>}
    {params.success && <div className="notice">{params.success}</div>}
    {params.error && <div className="notice error-notice">{params.error}</div>}
    <details className="view-customizer panel"><summary><span>Personalizar visão</span><small>Escolha cards e densidade do layout</small><b>＋</b></summary><form action={saveDashboardPreferences}><div className="view-card-options">{DASHBOARD_CARD_IDS.map(card => <label key={card}><input type="checkbox" name="cards" value={card} defaultChecked={dashboardCards.includes(card)} /><span>{DASHBOARD_CARD_LABELS[card]}</span></label>)}</div><div className="view-layout-options"><label>Cards por linha<select name="columns" defaultValue={dashboardColumns}><option value="2">2 cards</option><option value="3">3 cards</option><option value="4">4 cards</option></select></label><SubmitButton pendingLabel="Salvando visão...">Salvar minha visão</SubmitButton></div></form></details>
    <section className={`metric-grid dashboard-metric-grid dashboard-columns-${dashboardColumns}`}>
      {dashboardCards.includes("clients") && <article className="metric-card"><DashboardMetricIcon kind="clients" /><small>Clientes no CRM</small><strong>{clients.count ?? 0}</strong><em>carteira comercial</em></article>}
      {dashboardCards.includes("jobs") && <article className="metric-card"><DashboardMetricIcon kind="jobs" /><small>Vagas ativas</small><strong>{jobs.count ?? 0}{typeof activeJobLimit === "number" ? `/${activeJobLimit}` : ""}</strong><em>limite do plano</em></article>}
      {dashboardCards.includes("candidates") && <article className="metric-card"><DashboardMetricIcon kind="candidates" /><small>Candidatos</small><strong>{candidates.count ?? 0}</strong><em>banco de talentos</em></article>}
      {dashboardCards.includes("pipeline") && <article className="metric-card"><DashboardMetricIcon kind="pipeline" /><small>No pipeline</small><strong>{activeApplications}</strong><em>{hires} contratação(ões)</em></article>}
      {dashboardCards.includes("people") && <article className="metric-card"><DashboardMetricIcon kind="people" /><small>Headcount</small><strong>{employeeRows.length}{typeof planData?.limits?.employees === "number" ? `/${planData.limits.employees}` : ""}</strong><em>{preboarding} em admissão</em></article>}
      {dashboardCards.includes("goals") && <article className="metric-card"><DashboardMetricIcon kind="goals" /><small>Metas</small><strong>{hasPerformance ? `${averageGoalProgress}%` : "PRO"}</strong><em>{hasPerformance ? `${pendingReviews} avaliação(ões) pendente(s)` : "desbloqueie desempenho"}</em></article>}
      {dashboardCards.includes("engagement") && <article className="metric-card"><DashboardMetricIcon kind="engagement" /><small>Clima & eNPS</small><strong>{hasEngagement && engagementSummary && !engagementSummary.locked && engagementSummary.enps !== null ? engagementSummary.enps : hasEngagement ? "—" : "PRO"}</strong><em>{!hasEngagement ? "desbloqueie escuta contínua" : currentEngagementSurvey ? `${engagementSummary?.participation ?? 0}% participação · ${openEngagementActions} ação(ões)` : "crie a primeira escuta"}</em></article>}
      {dashboardCards.includes("time_off") && <article className="metric-card"><DashboardMetricIcon kind="time_off" /><small>Férias & ausências</small><strong>{awayToday}</strong><em>{pendingLeaves} solicitação(ões) pendente(s)</em></article>}
    </section>
    <section className="dashboard-panels"><article className="panel"><h2>Ações rápidas</h2><p>Cadastre dados ou abra os módulos completos.</p><div className="quick-links dashboard-quick-links"><Link href="/app/central"><span>01</span>Abrir central de trabalho</Link><Link href="/app/clientes"><span>02</span>Gerenciar clientes</Link><Link href="/app/vagas"><span>03</span>Pipeline de vagas</Link><Link href="/app/pessoas"><span>04</span>Gestão de Pessoas</Link><Link href="/app/ausencias"><span>05</span>Férias & ausências</Link><Link href="/app/desempenho"><span>06</span>{performanceCycles.data?.name ?? "Desempenho"}</Link><Link href="/app/clima"><span>07</span>Medir clima & eNPS</Link><Link href="/app/automacoes"><span>08</span>Configurar automações</Link><Link href="/app/agenda"><span>09</span>Organizar agenda</Link></div></article><article className="panel subscription-summary"><h2>Assinatura</h2><p>{subscription.data?.status === "trialing" ? `Avaliação ativa${trialEndLabel ? ` · termina em ${trialEndLabel}` : ""}` : `Status: ${subscription.data?.status ?? "não encontrado"}`}</p><span className="plan-chip">{plan}</span></article></section>
    <section className="dashboard-operations"><article className="panel"><div className="panel-heading"><div><h2>Próximas atividades</h2><p>O que exige atenção da equipe.</p></div><Link className="row-link" href="/app/agenda">Ver agenda →</Link></div>{activities.data?.length ? <div className="dashboard-agenda">{activities.data.map(item => <div key={item.id}><span>{ACTIVITY_TYPE_LABELS[item.activity_type as keyof typeof ACTIVITY_TYPE_LABELS] ?? item.activity_type}</span><strong>{item.subject}</strong><time>{item.due_at ? new Date(item.due_at).toLocaleString("pt-BR") : "Sem prazo"}</time></div>)}</div> : <div className="empty-state compact">Nenhuma atividade pendente. Crie o próximo passo na agenda.</div>}</article><article className="panel"><div className="panel-heading"><div><h2>Saúde do pipeline</h2><p>Candidaturas por etapa.</p></div><Link className="row-link" href="/app/relatorios">Relatórios →</Link></div><div className="mini-funnel">{Object.entries(APPLICATION_STAGE_LABELS).slice(0,6).map(([stage,label]) => { const count = applicationRows.filter(item => item.stage === stage).length; return <div key={stage}><span>{label}</span><i><b style={{ width: `${applicationRows.length ? Math.max(4, Math.round(count / applicationRows.length * 100)) : 0}%` }} /></i><strong>{count}</strong></div>; })}</div></article></section>
    <section className="panel activity-panel"><div className="panel-heading"><div><h2>Atividade recente</h2><p>Ações registradas automaticamente no ambiente.</p></div></div>{audit.data?.length ? <div className="activity-list">{audit.data.map(item => <div key={item.id}><span>{ACTION_LABELS[item.action] ?? item.action}</span><strong>{ENTITY_LABELS[item.entity_type] ?? item.entity_type}</strong><time>{new Date(item.created_at).toLocaleString("pt-BR")}</time></div>)}</div> : <div className="empty-state compact">As próximas alterações aparecerão aqui após executar a migração de auditoria.</div>}</section>
  </div>;
}
