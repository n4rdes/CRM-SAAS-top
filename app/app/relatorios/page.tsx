import { SubmitButton } from "../_components/submit-button";
import { saveReportPreferences } from "../preferencias/actions";
import { requireWorkspace } from "@/lib/auth/workspace";
import { APPLICATION_STAGES, APPLICATION_STAGE_LABELS, COMPANY_STAGES, COMPANY_STAGE_LABELS } from "@/lib/domain/hr";
import { GOAL_STATUSES, GOAL_STATUS_LABELS } from "@/lib/domain/performance";
import { normalizeReportPeriod, REPORT_CARD_IDS, REPORT_CARD_LABELS, sanitizeColumns, sanitizeReportCards } from "@/lib/domain/reporting";

type EngagementReportSummary = { locked: boolean; response_count: number; participation: number; enps: number | null; scale_average: number | null };

function percent(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function daysBefore(value: string, days: number) {
  return new Date(new Date(`${value}T12:00:00.000Z`).getTime() - (days - 1) * 86400000).toISOString().slice(0, 10);
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; error?: string; success?: string }> }) {
  const query = await searchParams;
  const period = normalizeReportPeriod(query.from, query.to);
  const periodStart = `${period.from}T00:00:00.000Z`;
  const periodEnd = `${period.to}T23:59:59.999Z`;
  const { supabase, tenant, user } = await requireWorkspace();
  const [companies, jobs, candidates, applications, activities, employees, workflows, performanceGoals, performanceReviews, performanceCheckins, engagementSurveys, engagementActions, recognitions, subscription, leaveRequests, viewPreferences] = await Promise.all([
    supabase.from("crm_companies").select("stage,created_at").eq("tenant_id", tenant.id).gte("created_at", periodStart).lte("created_at", periodEnd),
    supabase.from("jobs").select("id,status,openings,created_at").eq("tenant_id", tenant.id).gte("created_at", periodStart).lte("created_at", periodEnd),
    supabase.from("candidates").select("source,created_at").eq("tenant_id", tenant.id).gte("created_at", periodStart).lte("created_at", periodEnd),
    supabase.from("applications").select("stage,created_at").eq("tenant_id", tenant.id).gte("created_at", periodStart).lte("created_at", periodEnd),
    supabase.from("activities").select("completed_at,due_at,created_at").eq("tenant_id", tenant.id).gte("created_at", periodStart).lte("created_at", periodEnd),
    supabase.from("employees").select("status,hire_date,termination_date,department:departments(name)").eq("tenant_id", tenant.id),
    supabase.from("employee_workflows").select("status,kind,created_at").eq("tenant_id", tenant.id).gte("created_at", periodStart).lte("created_at", periodEnd),
    supabase.from("performance_goals").select("status,progress,weight,created_at").eq("tenant_id", tenant.id).gte("created_at", periodStart).lte("created_at", periodEnd),
    supabase.from("performance_reviews").select("status,overall_rating,created_at").eq("tenant_id", tenant.id).gte("created_at", periodStart).lte("created_at", periodEnd),
    supabase.from("performance_checkins").select("mood,energy,happened_on").eq("tenant_id", tenant.id).gte("happened_on", period.from).lte("happened_on", period.to),
    supabase.from("engagement_surveys").select("id,title,status,created_at").eq("tenant_id", tenant.id).gte("created_at", periodStart).lte("created_at", periodEnd).order("created_at", { ascending: false }).limit(1),
    supabase.from("engagement_action_plans").select("status,progress,created_at").eq("tenant_id", tenant.id).gte("created_at", periodStart).lte("created_at", periodEnd),
    supabase.from("employee_recognitions").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).gte("created_at", periodStart).lte("created_at", periodEnd),
    supabase.from("subscriptions").select("plan:plans(features)").eq("tenant_id", tenant.id).maybeSingle(),
    supabase.from("leave_requests").select("status,start_date,end_date,total_days,policy:leave_policies(name)").eq("tenant_id", tenant.id).lte("start_date", period.to).gte("end_date", period.from),
    supabase.from("workspace_view_preferences").select("report_cards,report_columns").eq("tenant_id", tenant.id).eq("user_id", user.id).maybeSingle(),
  ]);
  const plan = subscription.data?.plan as unknown as { features?: Record<string, boolean> } | null;
  const hasPerformance = plan?.features?.performance === true;
  const hasEngagement = plan?.features?.engagement === true;
  const applicationRows = applications.data ?? [];
  const companyRows = companies.data ?? [];
  const jobRows = jobs.data ?? [];
  const candidateRows = candidates.data ?? [];
  const activityRows = activities.data ?? [];
  const employeeRows = (employees.data ?? []).filter(item => (!item.hire_date || item.hire_date <= period.to) && (!item.termination_date || item.termination_date >= period.from));
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
  const preferenceData = viewPreferences.data as { report_cards?: string[]; report_columns?: number } | null;
  const visibleCards = sanitizeReportCards(preferenceData?.report_cards ?? [...REPORT_CARD_IDS]);
  const reportColumns = sanitizeColumns(Number(preferenceData?.report_columns ?? 2), 1, 3, 2);
  const leaveRows = leaveRequests.data ?? [];
  const approvedLeaveDays = leaveRows.filter(item => item.status === "approved").reduce((sum, item) => sum + Number(item.total_days), 0);
  const pendingLeaveRequests = leaveRows.filter(item => item.status === "pending").length;
  const exportParams = new URLSearchParams({ from: period.from, to: period.to, cards: visibleCards.join(",") });
  const returnQuery = new URLSearchParams({ from: period.from, to: period.to }).toString();

  return <div className="workspace-content">
    <div className="page-heading"><div><p className="page-eyebrow">PEOPLE ANALYTICS</p><h1>Relatórios</h1><p>Indicadores comerciais, recrutamento, pessoas e cultura dentro do período selecionado.</p></div><div className="report-heading-actions"><a className="export-spreadsheet-button" href={`/app/relatorios/export?${exportParams.toString()}`}>⇩ Exportar planilha</a><span className="record-count">{period.from.split("-").reverse().join("/")} — {period.to.split("-").reverse().join("/")}</span></div></div>
    {query.error && <div className="notice error-notice">{query.error}</div>}
    {query.success && <div className="notice">{query.success}</div>}
    <section className="report-controls panel"><form className="report-date-filter"><label>Data inicial<input type="date" name="from" defaultValue={period.from} /></label><label>Data final<input type="date" name="to" defaultValue={period.to} /></label><button type="submit">Aplicar período</button></form><div className="quick-periods"><span>Atalhos</span><a href={`/app/relatorios?from=${daysBefore(period.to,30)}&to=${period.to}`}>30 dias</a><a href={`/app/relatorios?from=${daysBefore(period.to,90)}&to=${period.to}`}>90 dias</a><a href={`/app/relatorios?from=${daysBefore(period.to,365)}&to=${period.to}`}>12 meses</a></div></section>
    <details className="view-customizer report-customizer panel"><summary><span>Personalizar relatórios</span><small>Escolha os painéis e a densidade da grade</small><b>＋</b></summary><form action={saveReportPreferences}><input type="hidden" name="return_query" value={returnQuery} /><div className="view-card-options">{REPORT_CARD_IDS.map(card => <label key={card}><input type="checkbox" name="cards" value={card} defaultChecked={visibleCards.includes(card)} /><span>{REPORT_CARD_LABELS[card]}</span></label>)}</div><div className="view-layout-options"><label>Colunas<select name="columns" defaultValue={reportColumns}><option value="1">1 coluna</option><option value="2">2 colunas</option><option value="3">3 colunas</option></select></label><SubmitButton pendingLabel="Salvando layout...">Salvar meus relatórios</SubmitButton></div></form></details>
    {activities.error && <div className="setup-notice"><strong>Indicadores de produtividade indisponíveis</strong><span>Execute a migração 004 para ativar agenda, contatos e avaliações.</span></div>}
    {employees.error && <div className="setup-notice"><strong>People Analytics aguardando configuração</strong><span>Execute a migração 005 para ativar headcount, departamentos e jornadas.</span></div>}
    {performanceGoals.error && <div className="setup-notice"><strong>Performance Analytics aguardando configuração</strong><span>Execute a migração 006 para ativar metas, avaliações e check-ins.</span></div>}
    {engagementSurveys.error && <div className="setup-notice"><strong>Engagement Analytics aguardando configuração</strong><span>Execute a migração 007 para ativar pesquisas, eNPS e planos de ação.</span></div>}
    {!hasPerformance && <div className="setup-notice"><strong>Desempenho é um recurso Pro</strong><span>Faça upgrade para liberar OKRs, avaliações, check-ins e os indicadores relacionados.</span></div>}
    {!hasEngagement && <div className="setup-notice"><strong>Clima & engajamento é um recurso Pro</strong><span>Faça upgrade para liberar pesquisas anônimas, eNPS, reconhecimentos e planos de ação.</span></div>}
    <section className="metric-grid report-metrics"><article className="metric-card"><small>Conversão em contratação</small><strong>{percent(hires, applicationRows.length)}%</strong><em>{hires} de {applicationRows.length} candidaturas</em></article><article className="metric-card"><small>Vagas ativas</small><strong>{activeJobs}</strong><em>{jobRows.reduce((sum, job) => sum + (job.openings ?? 0), 0)} posições cadastradas</em></article><article className="metric-card"><small>Conversão comercial</small><strong>{percent(companyRows.filter(item => item.stage === "customer").length, companyRows.length)}%</strong><em>{companyRows.length} empresas no funil</em></article><article className="metric-card"><small>Atividades concluídas</small><strong>{completedActivities}</strong><em>{activityRows.length - completedActivities} pendentes</em></article></section>
    <div className={`reports-grid reports-columns-${reportColumns}`}>
      {visibleCards.includes("recruitment") && <article className="panel"><div className="panel-heading"><div><h2>Funil de recrutamento</h2><p>Distribuição das candidaturas criadas no período.</p></div></div><div className="bar-report">{APPLICATION_STAGES.map(stage => { const count = applicationRows.filter(item => item.stage === stage).length; return <div key={stage}><div><span>{APPLICATION_STAGE_LABELS[stage]}</span><strong>{count}</strong></div><i><b style={{ width: `${percent(count, Math.max(1, applicationRows.length))}%` }} /></i></div>; })}</div></article>}
      {visibleCards.includes("commercial") && <article className="panel"><div className="panel-heading"><div><h2>Funil comercial</h2><p>Empresas adicionadas no período por etapa do CRM.</p></div></div><div className="bar-report">{COMPANY_STAGES.map(stage => { const count = companyRows.filter(item => item.stage === stage).length; return <div key={stage}><div><span>{COMPANY_STAGE_LABELS[stage]}</span><strong>{count}</strong></div><i><b style={{ width: `${percent(count, Math.max(1, companyRows.length))}%` }} /></i></div>; })}</div></article>}
      {visibleCards.includes("sources") && <article className="panel"><div className="panel-heading"><div><h2>Origem dos candidatos</h2><p>Canais que alimentaram o banco dentro do período.</p></div></div>{Object.keys(sourceCounts).length ? <div className="source-report">{Object.entries(sourceCounts).sort((a,b) => b[1] - a[1]).map(([source,count]) => <div key={source}><span>{source}</span><i><b style={{ width: `${percent(count,maxSource)}%` }} /></i><strong>{count}</strong></div>)}</div> : <div className="empty-state">Nenhum candidato no período selecionado.</div>}</article>}
      {visibleCards.includes("headcount") && <article className="panel"><div className="panel-heading"><div><h2>Headcount por departamento</h2><p>{activeEmployees} colaborador(es) no período · {completedWorkflows}/{workflowRows.length} jornadas concluídas.</p></div></div>{Object.keys(departmentCounts).length ? <div className="source-report">{Object.entries(departmentCounts).sort((a,b) => b[1] - a[1]).map(([department,count]) => <div key={department}><span>{department}</span><i><b style={{ width: `${percent(count,maxDepartment)}%` }} /></i><strong>{count}</strong></div>)}</div> : <div className="empty-state">Cadastre colaboradores para visualizar o headcount.</div>}</article>}
      {visibleCards.includes("goals") && <article className="panel"><div className="panel-heading"><div><h2>Saúde das metas</h2><p>{weightedGoalProgress}% de progresso ponderado · {performanceGoalRows.length} meta(s).</p></div></div>{performanceGoalRows.length ? <div className="bar-report">{GOAL_STATUSES.map(status => { const count = performanceGoalRows.filter(item => item.status === status).length; return <div key={status}><div><span>{GOAL_STATUS_LABELS[status]}</span><strong>{count}</strong></div><i><b style={{ width: `${percent(count,performanceGoalRows.length)}%` }} /></i></div>; })}</div> : <div className="empty-state">Nenhuma meta criada no período.</div>}</article>}
      {visibleCards.includes("reviews") && <article className="panel performance-report-card"><div className="panel-heading"><div><h2>Avaliações e 1:1</h2><p>Qualidade e cadência dentro do período.</p></div></div><div className="performance-report-numbers"><div><small>Nota média</small><strong>{averageReviewRating ? averageReviewRating.toFixed(1) : "—"}</strong><span>{reviewRatings.length} avaliação(ões)</span></div><div><small>Humor médio</small><strong>{averageMood ? averageMood.toFixed(1) : "—"}</strong><span>{checkinRows.length} check-in(s)</span></div><div><small>Pendências</small><strong>{performanceReviewRows.filter(item => item.status === "draft").length}</strong><span>avaliações abertas</span></div></div></article>}
      {visibleCards.includes("engagement") && <article className="panel performance-report-card"><div className="panel-heading"><div><h2>Clima & engajamento</h2><p>{latestSurvey?.title ?? "Nenhuma pesquisa no período"}</p></div></div><div className="performance-report-numbers"><div><small>eNPS</small><strong>{engagementSummary && !engagementSummary.locked && engagementSummary.enps !== null ? engagementSummary.enps : "—"}</strong><span>{engagementSummary?.locked ? "amostra protegida" : `${engagementSummary?.response_count ?? 0} resposta(s)`}</span></div><div><small>Participação</small><strong>{engagementSummary ? `${engagementSummary.participation}%` : "—"}</strong><span>na última escuta</span></div><div><small>Execução</small><strong>{actionProgress}%</strong><span>{openEngagementActions.length} plano(s) · {recognitions.count ?? 0} reconhecimento(s)</span></div></div></article>}
      {visibleCards.includes("time_off") && <article className="panel performance-report-card"><div className="panel-heading"><div><h2>Férias & ausências</h2><p>Períodos que cruzam o intervalo selecionado.</p></div></div><div className="performance-report-numbers"><div><small>Dias aprovados</small><strong>{approvedLeaveDays}</strong><span>dias úteis registrados</span></div><div><small>Aprovações</small><strong>{pendingLeaveRequests}</strong><span>solicitações pendentes</span></div><div><small>Períodos</small><strong>{leaveRows.length}</strong><span>solicitações no intervalo</span></div></div></article>}
      <article className="panel insight-panel"><small>LEITURA RÁPIDA</small><h2>{applicationRows.length ? `${percent(hires, applicationRows.length)}% das candidaturas chegaram à contratação.` : "Seu relatório ganhará contexto com as primeiras candidaturas."}</h2><p>{activeJobs ? `Existem ${activeJobs} vagas exigindo acompanhamento ativo.` : "Não há vagas ativas no momento."} Use a agenda para transformar esses números em próximos passos.</p></article>
    </div>
  </div>;
}
