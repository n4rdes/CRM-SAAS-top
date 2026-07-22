import { requireWorkspace } from "@/lib/auth/workspace";
import { APPLICATION_STAGES, APPLICATION_STAGE_LABELS, COMPANY_STAGES, COMPANY_STAGE_LABELS } from "@/lib/domain/hr";
import { GOAL_STATUSES, GOAL_STATUS_LABELS } from "@/lib/domain/performance";

type EngagementReportSummary = { locked: boolean; response_count: number; participation: number; enps: number | null; scale_average: number | null };

function percent(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

export default async function ReportsPage() {
  const { supabase, tenant } = await requireWorkspace();
  const [companies, jobs, candidates, applications, activities, employees, workflows, performanceGoals, performanceReviews, performanceCheckins, engagementSurveys, engagementActions, recognitions, subscription] = await Promise.all([
    supabase.from("crm_companies").select("stage,created_at").eq("tenant_id", tenant.id),
    supabase.from("jobs").select("id,status,openings,created_at").eq("tenant_id", tenant.id),
    supabase.from("candidates").select("source,created_at").eq("tenant_id", tenant.id),
    supabase.from("applications").select("stage,created_at").eq("tenant_id", tenant.id),
    supabase.from("activities").select("completed_at,due_at").eq("tenant_id", tenant.id),
    supabase.from("employees").select("status,department:departments(name)").eq("tenant_id", tenant.id),
    supabase.from("employee_workflows").select("status,kind").eq("tenant_id", tenant.id),
    supabase.from("performance_goals").select("status,progress,weight").eq("tenant_id", tenant.id),
    supabase.from("performance_reviews").select("status,overall_rating").eq("tenant_id", tenant.id),
    supabase.from("performance_checkins").select("mood,energy,happened_on").eq("tenant_id", tenant.id),
    supabase.from("engagement_surveys").select("id,title,status").eq("tenant_id", tenant.id).order("created_at", { ascending: false }).limit(1),
    supabase.from("engagement_action_plans").select("status,progress").eq("tenant_id", tenant.id),
    supabase.from("employee_recognitions").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
    supabase.from("subscriptions").select("plan:plans(features)").eq("tenant_id", tenant.id).maybeSingle(),
  ]);
  const plan = subscription.data?.plan as unknown as { features?: Record<string, boolean> } | null;
  const hasPerformance = plan?.features?.performance === true;
  const hasEngagement = plan?.features?.engagement === true;
  const applicationRows = applications.data ?? [];
  const companyRows = companies.data ?? [];
  const jobRows = jobs.data ?? [];
  const candidateRows = candidates.data ?? [];
  const activityRows = activities.data ?? [];
  const employeeRows = employees.data ?? [];
  const workflowRows = workflows.data ?? [];
  const hires = applicationRows.filter(item => item.stage === "hired").length;
  const activeJobs = jobRows.filter(item => ["open", "paused"].includes(item.status)).length;
  const completedActivities = activityRows.filter(item => item.completed_at).length;
  const sourceCounts = candidateRows.reduce<Record<string, number>>((acc, item) => { acc[item.source || "manual"] = (acc[item.source || "manual"] ?? 0) + 1; return acc; }, {});
  const maxSource = Math.max(1, ...Object.values(sourceCounts));
  const activeEmployees = employeeRows.filter(item => item.status === "active").length;
  const departmentCounts = employeeRows.filter(item => item.status !== "terminated").reduce<Record<string, number>>((acc, item) => { const department = item.department as unknown as { name?: string } | null; const name = department?.name ?? "Sem departamento"; acc[name] = (acc[name] ?? 0) + 1; return acc; }, {});
  const maxDepartment = Math.max(1, ...Object.values(departmentCounts));
  const completedWorkflows = workflowRows.filter(item => item.status === "completed").length;
  const performanceGoalRows = hasPerformance ? performanceGoals.data ?? [] : [];
  const performanceReviewRows = hasPerformance ? performanceReviews.data ?? [] : [];
  const checkinRows = hasPerformance ? performanceCheckins.data ?? [] : [];
  const scoredGoalRows = performanceGoalRows.filter(item => !["draft", "canceled"].includes(item.status));
  const totalGoalWeight = scoredGoalRows.reduce((sum, goal) => sum + goal.weight, 0);
  const weightedGoalProgress = totalGoalWeight ? Math.round(scoredGoalRows.reduce((sum, goal) => sum + goal.progress * goal.weight, 0) / totalGoalWeight) : 0;
  const reviewRatings = performanceReviewRows.filter(item => item.status !== "draft" && item.overall_rating).map(item => Number(item.overall_rating));
  const averageReviewRating = reviewRatings.length ? reviewRatings.reduce((sum, rating) => sum + rating, 0) / reviewRatings.length : 0;
  const averageMood = checkinRows.filter(item => item.mood).length ? checkinRows.filter(item => item.mood).reduce((sum, item) => sum + Number(item.mood), 0) / checkinRows.filter(item => item.mood).length : 0;
  const latestSurvey = hasEngagement ? engagementSurveys.data?.[0] ?? null : null;
  let engagementSummary: EngagementReportSummary | null = null;
  if (latestSurvey) {
    const result = await supabase.rpc("get_engagement_survey_summary", { p_survey_id: latestSurvey.id });
    engagementSummary = result.data as EngagementReportSummary | null;
  }
  const engagementActionRows = hasEngagement ? engagementActions.data ?? [] : [];
  const openEngagementActions = engagementActionRows.filter(item => !["completed", "canceled"].includes(item.status));
  const actionProgress = openEngagementActions.length ? Math.round(openEngagementActions.reduce((sum,item) => sum + item.progress,0) / openEngagementActions.length) : 0;

  return <div className="workspace-content">
    <div className="page-heading"><div><h1>Relatórios</h1><p>Indicadores comerciais e de recrutamento calculados com os dados do seu ambiente.</p></div><span className="record-count">Atualizado agora</span></div>
    {activities.error && <div className="setup-notice"><strong>Indicadores de produtividade indisponíveis</strong><span>Execute a migração 004 para ativar agenda, contatos e avaliações.</span></div>}
    {employees.error && <div className="setup-notice"><strong>People Analytics aguardando configuração</strong><span>Execute a migração 005 para ativar headcount, departamentos e jornadas.</span></div>}
    {performanceGoals.error && <div className="setup-notice"><strong>Performance Analytics aguardando configuração</strong><span>Execute a migração 006 para ativar metas, avaliações e check-ins.</span></div>}
    {engagementSurveys.error && <div className="setup-notice"><strong>Engagement Analytics aguardando configuração</strong><span>Execute a migração 007 para ativar pesquisas, eNPS e planos de ação.</span></div>}
    {!hasPerformance && <div className="setup-notice"><strong>Desempenho é um recurso Pro</strong><span>Faça upgrade para liberar OKRs, avaliações, check-ins e os indicadores relacionados.</span></div>}
    {!hasEngagement && <div className="setup-notice"><strong>Clima & engajamento é um recurso Pro</strong><span>Faça upgrade para liberar pesquisas anônimas, eNPS, reconhecimentos e planos de ação.</span></div>}
    <section className="metric-grid report-metrics"><article className="metric-card"><small>Conversão em contratação</small><strong>{percent(hires, applicationRows.length)}%</strong><em>{hires} de {applicationRows.length} candidaturas</em></article><article className="metric-card"><small>Vagas ativas</small><strong>{activeJobs}</strong><em>{jobRows.reduce((sum, job) => sum + (job.openings ?? 0), 0)} posições cadastradas</em></article><article className="metric-card"><small>Conversão comercial</small><strong>{percent(companyRows.filter(item => item.stage === "customer").length, companyRows.length)}%</strong><em>{companyRows.length} empresas no funil</em></article><article className="metric-card"><small>Atividades concluídas</small><strong>{completedActivities}</strong><em>{activityRows.length - completedActivities} pendentes</em></article></section>
    <div className="reports-grid">
      <article className="panel"><div className="panel-heading"><div><h2>Funil de recrutamento</h2><p>Distribuição atual das candidaturas.</p></div></div><div className="bar-report">{APPLICATION_STAGES.map(stage => { const count = applicationRows.filter(item => item.stage === stage).length; return <div key={stage}><div><span>{APPLICATION_STAGE_LABELS[stage]}</span><strong>{count}</strong></div><i><b style={{ width: `${percent(count, Math.max(1, applicationRows.length))}%` }} /></i></div>; })}</div></article>
      <article className="panel"><div className="panel-heading"><div><h2>Funil comercial</h2><p>Empresas por etapa do CRM.</p></div></div><div className="bar-report">{COMPANY_STAGES.map(stage => { const count = companyRows.filter(item => item.stage === stage).length; return <div key={stage}><div><span>{COMPANY_STAGE_LABELS[stage]}</span><strong>{count}</strong></div><i><b style={{ width: `${percent(count, Math.max(1, companyRows.length))}%` }} /></i></div>; })}</div></article>
      <article className="panel"><div className="panel-heading"><div><h2>Origem dos candidatos</h2><p>Quais canais alimentam seu banco de talentos.</p></div></div>{Object.keys(sourceCounts).length ? <div className="source-report">{Object.entries(sourceCounts).sort((a,b) => b[1] - a[1]).map(([source,count]) => <div key={source}><span>{source}</span><i><b style={{ width: `${percent(count,maxSource)}%` }} /></i><strong>{count}</strong></div>)}</div> : <div className="empty-state">Cadastre candidatos para visualizar as origens.</div>}</article>
      <article className="panel"><div className="panel-heading"><div><h2>Headcount por departamento</h2><p>{activeEmployees} colaborador(es) ativo(s) · {completedWorkflows}/{workflowRows.length} jornadas concluídas.</p></div></div>{Object.keys(departmentCounts).length ? <div className="source-report">{Object.entries(departmentCounts).sort((a,b) => b[1] - a[1]).map(([department,count]) => <div key={department}><span>{department}</span><i><b style={{ width: `${percent(count,maxDepartment)}%` }} /></i><strong>{count}</strong></div>)}</div> : <div className="empty-state">Cadastre colaboradores para visualizar o headcount.</div>}</article>
      <article className="panel"><div className="panel-heading"><div><h2>Saúde das metas</h2><p>{weightedGoalProgress}% de progresso ponderado · {performanceGoalRows.length} meta(s).</p></div></div>{performanceGoalRows.length ? <div className="bar-report">{GOAL_STATUSES.map(status => { const count = performanceGoalRows.filter(item => item.status === status).length; return <div key={status}><div><span>{GOAL_STATUS_LABELS[status]}</span><strong>{count}</strong></div><i><b style={{ width: `${percent(count,performanceGoalRows.length)}%` }} /></i></div>; })}</div> : <div className="empty-state">Crie metas para visualizar a saúde do desempenho.</div>}</article>
      <article className="panel performance-report-card"><div className="panel-heading"><div><h2>Avaliações e 1:1</h2><p>Qualidade e cadência da gestão de desempenho.</p></div></div><div className="performance-report-numbers"><div><small>Nota média</small><strong>{averageReviewRating ? averageReviewRating.toFixed(1) : "—"}</strong><span>{reviewRatings.length} avaliação(ões)</span></div><div><small>Humor médio</small><strong>{averageMood ? averageMood.toFixed(1) : "—"}</strong><span>{checkinRows.length} check-in(s)</span></div><div><small>Pendências</small><strong>{performanceReviewRows.filter(item => item.status === "draft").length}</strong><span>avaliações abertas</span></div></div></article>
      <article className="panel performance-report-card"><div className="panel-heading"><div><h2>Clima & engajamento</h2><p>{latestSurvey?.title ?? "Nenhuma pesquisa criada"}</p></div></div><div className="performance-report-numbers"><div><small>eNPS</small><strong>{engagementSummary && !engagementSummary.locked && engagementSummary.enps !== null ? engagementSummary.enps : "—"}</strong><span>{engagementSummary?.locked ? "amostra protegida" : `${engagementSummary?.response_count ?? 0} resposta(s)`}</span></div><div><small>Participação</small><strong>{engagementSummary ? `${engagementSummary.participation}%` : "—"}</strong><span>na última escuta</span></div><div><small>Execução</small><strong>{actionProgress}%</strong><span>{openEngagementActions.length} plano(s) · {recognitions.count ?? 0} reconhecimento(s)</span></div></div></article>
      <article className="panel insight-panel"><small>LEITURA RÁPIDA</small><h2>{applicationRows.length ? `${percent(hires, applicationRows.length)}% das candidaturas chegaram à contratação.` : "Seu relatório ganhará contexto com as primeiras candidaturas."}</h2><p>{activeJobs ? `Existem ${activeJobs} vagas exigindo acompanhamento ativo.` : "Não há vagas ativas no momento."} Use a agenda para transformar esses números em próximos passos.</p></article>
    </div>
  </div>;
}
