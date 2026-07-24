import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "../../../_components/submit-button";
import { createPerformanceCheckin, createPerformanceGoal, submitPerformanceReview, updatePerformanceGoal } from "../../actions";
import { requirePlanFeature } from "@/lib/subscriptions/server";
import { canReviewPerformance, canViewPerformance } from "@/lib/domain/team";
import { GOAL_CATEGORIES, GOAL_CATEGORY_LABELS, GOAL_STATUSES, GOAL_STATUS_LABELS, REVIEW_TYPE_LABELS, ratingLabel } from "@/lib/domain/performance";
import { EMPLOYEE_STATUS_LABELS } from "@/lib/domain/people";

type CycleRow = { id: string; name: string; status: string; starts_on: string; ends_on: string };
type GoalRow = { id: string; cycle_id: string | null; title: string; description: string | null; category: string; status: string; progress: number; weight: number; due_on: string | null; cycle: { name: string } | null };
type ReviewRow = { id: string; cycle_id: string; review_type: string; status: string; overall_rating: number | null; delivery_rating: number | null; collaboration_rating: number | null; growth_rating: number | null; strengths: string | null; improvements: string | null; summary: string | null; submitted_at: string | null; cycle: { name: string } | null };
type CheckinRow = { id: string; cycle_id: string | null; happened_on: string; mood: number | null; energy: number | null; summary: string; achievements: string | null; blockers: string | null; next_actions: string | null; cycle: { name: string } | null };

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}

function scoreOptions() {
  return [1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} · {value === 1 ? "Muito abaixo" : value === 2 ? "Abaixo" : value === 3 ? "Esperado" : value === 4 ? "Acima" : "Excepcional"}</option>);
}

export default async function EmployeePerformancePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { supabase, tenant, membership } = await requirePlanFeature("/app/desempenho", "performance", "Desempenho");
  if (!canViewPerformance(membership.role)) return <div className="workspace-content"><div className="notice error-notice">Sua função não possui acesso a Desempenho.</div></div>;
  const canReview = canReviewPerformance(membership.role);
  const [employeeResult, cyclesResult, goalsResult, reviewsResult, checkinsResult, managersResult] = await Promise.all([
    supabase.from("employees").select("id,manager_id,full_name,status,hire_date,department:departments(name),position:positions(title,level)").eq("id", id).eq("tenant_id", tenant.id).maybeSingle(),
    supabase.from("performance_cycles").select("id,name,status,starts_on,ends_on").eq("tenant_id", tenant.id).order("starts_on", { ascending: false }),
    supabase.from("performance_goals").select("id,cycle_id,title,description,category,status,progress,weight,due_on,cycle:performance_cycles(name)").eq("tenant_id", tenant.id).eq("employee_id", id).order("created_at", { ascending: false }),
    supabase.from("performance_reviews").select("id,cycle_id,review_type,status,overall_rating,delivery_rating,collaboration_rating,growth_rating,strengths,improvements,summary,submitted_at,cycle:performance_cycles(name)").eq("tenant_id", tenant.id).eq("employee_id", id).order("created_at", { ascending: false }),
    supabase.from("performance_checkins").select("id,cycle_id,happened_on,mood,energy,summary,achievements,blockers,next_actions,cycle:performance_cycles(name)").eq("tenant_id", tenant.id).eq("employee_id", id).order("happened_on", { ascending: false }),
    supabase.from("employees").select("id,full_name").eq("tenant_id", tenant.id).neq("status", "terminated"),
  ]);
  const employee = employeeResult.data;
  if (!employee) notFound();
  const department = employee.department as unknown as { name: string } | null;
  const position = employee.position as unknown as { title: string; level: string | null } | null;
  const manager = managersResult.data?.find(item => item.id === employee.manager_id) ?? null;
  const cycles = (cyclesResult.data ?? []) as CycleRow[];
  const goals = (goalsResult.data ?? []) as unknown as GoalRow[];
  const reviews = (reviewsResult.data ?? []) as unknown as ReviewRow[];
  const checkins = (checkinsResult.data ?? []) as unknown as CheckinRow[];
  const activeCycle = cycles.find(cycle => ["active", "calibration"].includes(cycle.status));
  const currentReview = activeCycle ? reviews.find(review => review.cycle_id === activeCycle.id && review.review_type === "manager") : undefined;
  const activeGoals = goals.filter(goal => !["canceled", "completed"].includes(goal.status));
  const goalWeight = goals.filter(goal => goal.status !== "canceled").reduce((sum, goal) => sum + goal.weight, 0);
  const goalProgress = goalWeight ? Math.round(goals.filter(goal => goal.status !== "canceled").reduce((sum, goal) => sum + goal.progress * goal.weight, 0) / goalWeight) : 0;
  const ratings = reviews.filter(review => review.status !== "draft" && review.overall_rating).map(review => Number(review.overall_rating));
  const averageRating = ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null;
  const moodAverage = checkins.filter(checkin => checkin.mood).length ? checkins.filter(checkin => checkin.mood).reduce((sum, checkin) => sum + Number(checkin.mood), 0) / checkins.filter(checkin => checkin.mood).length : null;

  return <div className="workspace-content wide-content">
    <div className="performance-breadcrumb"><Link href="/app/desempenho">← Desempenho</Link><Link href={`/app/pessoas/${employee.id}`}>Abrir cadastro completo →</Link></div>
    <div className="employee-performance-hero"><span className="employee-avatar large-avatar">{employee.full_name.split(" ").slice(0,2).map((part: string) => part[0]).join("").toUpperCase()}</span><div><small>PERFIL DE DESEMPENHO</small><h1>{employee.full_name}</h1><p>{position?.title ?? "Cargo não definido"}{position?.level ? ` · ${position.level}` : ""} · {department?.name ?? "Sem departamento"}{manager ? ` · gestor: ${manager.full_name}` : ""}</p></div><span className={`status-badge employee-status-${employee.status}`}>{EMPLOYEE_STATUS_LABELS[employee.status as keyof typeof EMPLOYEE_STATUS_LABELS]}</span></div>
    {query.error && <div className="notice error-notice">{query.error}</div>}
    {query.success && <div className="notice">{query.success}</div>}
    <section className="metric-grid employee-performance-metrics"><article className="metric-card"><small>Progresso ponderado</small><strong>{goalProgress}%</strong><em>{activeGoals.length} meta(s) aberta(s)</em></article><article className="metric-card"><small>Nota histórica</small><strong>{averageRating ? averageRating.toFixed(1) : "—"}</strong><em>{ratingLabel(averageRating)}</em></article><article className="metric-card"><small>Humor nos 1:1</small><strong>{moodAverage ? moodAverage.toFixed(1) : "—"}</strong><em>{checkins.length} check-in(s)</em></article><article className="metric-card"><small>Ciclo atual</small><strong className="metric-text">{activeCycle?.name ?? "Sem ciclo"}</strong><em>{currentReview?.status === "submitted" ? "avaliação enviada" : "avaliação pendente"}</em></article></section>

    <div className="employee-performance-grid">
      <section className="performance-main-column">
        <article className="panel"><div className="panel-heading"><div><h2>Metas e OKRs</h2><p>Resultados individuais, de equipe e desenvolvimento.</p></div></div><div className="employee-goal-list">{goals.map(goal => <div key={goal.id} className={`employee-goal goal-card-${goal.status}`}><div className="goal-heading"><span>{GOAL_CATEGORY_LABELS[goal.category as keyof typeof GOAL_CATEGORY_LABELS]}</span><em className={`goal-status goal-${goal.status}`}>{GOAL_STATUS_LABELS[goal.status as keyof typeof GOAL_STATUS_LABELS]}</em></div><h3>{goal.title}</h3>{goal.description && <p>{goal.description}</p>}<small>{goal.cycle?.name ?? "Sem ciclo"}{goal.due_on ? ` · prazo ${formatDate(goal.due_on)}` : ""} · peso {goal.weight}</small><div className="goal-progress"><i><b style={{ width: `${goal.progress}%` }} /></i><strong>{goal.progress}%</strong></div>{canReview && !["canceled"].includes(goal.status) && <form action={updatePerformanceGoal} className="goal-detail-update"><input type="hidden" name="goal_id" value={goal.id} /><input type="hidden" name="employee_id" value={employee.id} /><select name="status" defaultValue={goal.status}>{GOAL_STATUSES.filter(status => status !== "draft").map(status => <option key={status} value={status}>{GOAL_STATUS_LABELS[status]}</option>)}</select><input name="progress" type="number" min="0" max="100" defaultValue={goal.progress} /><SubmitButton pendingLabel="Salvando...">Salvar progresso</SubmitButton></form>}</div>)}{!goals.length && <div className="empty-state compact">Nenhuma meta cadastrada.</div>}</div></article>

        <article className="panel performance-history"><div className="panel-heading"><div><h2>Histórico de avaliações</h2><p>Evolução das notas e registros qualitativos.</p></div></div>{reviews.filter(review => review.status !== "draft").length ? <div className="review-history-list">{reviews.filter(review => review.status !== "draft").map(review => <div key={review.id}><div className="review-history-score"><strong>{review.overall_rating ? Number(review.overall_rating).toFixed(1) : "—"}</strong><small>{ratingLabel(review.overall_rating ? Number(review.overall_rating) : null)}</small></div><div><span>{REVIEW_TYPE_LABELS[review.review_type as keyof typeof REVIEW_TYPE_LABELS]} · {review.cycle?.name ?? "Ciclo"}</span><strong>{review.summary || "Avaliação enviada sem resumo."}</strong><small>Entrega {review.delivery_rating ?? "—"} · Colaboração {review.collaboration_rating ?? "—"} · Crescimento {review.growth_rating ?? "—"}</small>{review.strengths && <p><b>Pontos fortes:</b> {review.strengths}</p>}{review.improvements && <p><b>Desenvolvimento:</b> {review.improvements}</p>}</div><time>{review.submitted_at ? new Date(review.submitted_at).toLocaleDateString("pt-BR") : ""}</time></div>)}</div> : <div className="empty-state compact">Nenhuma avaliação concluída.</div>}</article>

        <article className="panel checkin-history"><div className="panel-heading"><div><h2>Histórico de 1:1</h2><p>Conversas, bloqueios e compromissos de acompanhamento.</p></div></div>{checkins.length ? <div className="checkin-timeline">{checkins.map(checkin => <div key={checkin.id}><i /><div><span>{formatDate(checkin.happened_on)} · humor {checkin.mood ?? "—"}/5 · energia {checkin.energy ?? "—"}/5</span><strong>{checkin.summary}</strong>{checkin.achievements && <p><b>Conquistas:</b> {checkin.achievements}</p>}{checkin.blockers && <p><b>Bloqueios:</b> {checkin.blockers}</p>}{checkin.next_actions && <p><b>Próximas ações:</b> {checkin.next_actions}</p>}<small>{checkin.cycle?.name ?? "Fora de ciclo"}</small></div></div>)}</div> : <div className="empty-state compact">Nenhum check-in registrado.</div>}</article>
      </section>

      <aside className="performance-side-column">
        {canReview && <article className="panel sticky-performance-form"><h2>Nova meta</h2><form className="record-form sidebar-performance-form" action={createPerformanceGoal}><input type="hidden" name="employee_id" value={employee.id} /><label>Ciclo<select name="cycle_id"><option value="">Sem ciclo</option>{cycles.filter(cycle => !["closed", "canceled"].includes(cycle.status)).map(cycle => <option key={cycle.id} value={cycle.id}>{cycle.name}</option>)}</select></label><label>Categoria<select name="category">{GOAL_CATEGORIES.map(category => <option key={category} value={category}>{GOAL_CATEGORY_LABELS[category]}</option>)}</select></label><label>Meta<input name="title" required /></label><label>Descrição<textarea name="description" rows={2} /></label><div className="split-fields"><label>Peso<input name="weight" type="number" min="1" max="100" defaultValue="100" /></label><label>Prazo<input name="due_on" type="date" /></label></div><SubmitButton pendingLabel="Criando...">Criar meta</SubmitButton></form></article>}

        {canReview && activeCycle && <article className="panel"><div className="panel-heading"><div><h2>Avaliação do ciclo</h2><p>{activeCycle.name}</p></div></div><form className="record-form sidebar-performance-form" action={submitPerformanceReview}><input type="hidden" name="employee_id" value={employee.id} /><input type="hidden" name="cycle_id" value={activeCycle.id} /><input type="hidden" name="review_type" value="manager" /><div className="review-score-grid"><label>Geral<select name="overall_rating" defaultValue={currentReview?.overall_rating ?? ""} required><option value="">Nota</option>{scoreOptions()}</select></label><label>Entrega<select name="delivery_rating" defaultValue={currentReview?.delivery_rating ?? ""} required><option value="">Nota</option>{scoreOptions()}</select></label><label>Colaboração<select name="collaboration_rating" defaultValue={currentReview?.collaboration_rating ?? ""} required><option value="">Nota</option>{scoreOptions()}</select></label><label>Crescimento<select name="growth_rating" defaultValue={currentReview?.growth_rating ?? ""} required><option value="">Nota</option>{scoreOptions()}</select></label></div><label>Pontos fortes<textarea name="strengths" rows={3} defaultValue={currentReview?.strengths ?? ""} /></label><label>Pontos de desenvolvimento<textarea name="improvements" rows={3} defaultValue={currentReview?.improvements ?? ""} /></label><label>Resumo da avaliação<textarea name="summary" rows={3} defaultValue={currentReview?.summary ?? ""} /></label><SubmitButton pendingLabel="Enviando...">{currentReview?.status === "submitted" ? "Atualizar avaliação" : "Enviar avaliação"}</SubmitButton></form></article>}

        {canReview && <article className="panel"><div className="panel-heading"><div><h2>Registrar check-in 1:1</h2><p>Crie memória gerencial e próximos passos claros.</p></div></div><form className="record-form sidebar-performance-form" action={createPerformanceCheckin}><input type="hidden" name="employee_id" value={employee.id} /><input type="hidden" name="cycle_id" value={activeCycle?.id ?? ""} /><label>Data<input name="happened_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label><div className="split-fields"><label>Humor<select name="mood" defaultValue="3">{[1,2,3,4,5].map(value => <option key={value} value={value}>{value}/5</option>)}</select></label><label>Energia<select name="energy" defaultValue="3">{[1,2,3,4,5].map(value => <option key={value} value={value}>{value}/5</option>)}</select></label></div><label>Resumo<textarea name="summary" rows={3} required /></label><label>Conquistas<textarea name="achievements" rows={2} /></label><label>Bloqueios<textarea name="blockers" rows={2} /></label><label>Próximas ações<textarea name="next_actions" rows={2} /></label><SubmitButton pendingLabel="Salvando...">Registrar 1:1</SubmitButton></form></article>}
      </aside>
    </div>
  </div>;
}
