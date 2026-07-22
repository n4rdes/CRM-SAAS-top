import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "../../../_components/confirm-button";
import { SubmitButton } from "../../../_components/submit-button";
import { createPerformanceGoal, updatePerformanceCycleStatus } from "../../actions";
import { requireWorkspace } from "@/lib/auth/workspace";
import { canManagePerformance, canViewPerformance } from "@/lib/domain/team";
import { GOAL_CATEGORIES, GOAL_CATEGORY_LABELS, GOAL_STATUS_LABELS, PERFORMANCE_CYCLE_STATUS_LABELS, REVIEW_STATUS_LABELS, ratingLabel } from "@/lib/domain/performance";

type GoalRow = { employee_id: string; title: string; status: string; progress: number; weight: number; employee: { full_name: string } | null };
type ReviewRow = { id: string; employee_id: string; status: string; overall_rating: number | null; submitted_at: string | null; employee: { full_name: string; department: { name: string } | null; position: { title: string } | null } | null };

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}

export default async function PerformanceCyclePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { supabase, tenant, membership } = await requireWorkspace();
  if (!canViewPerformance(membership.role)) return <div className="workspace-content"><div className="notice error-notice">Sua função não possui acesso a Desempenho.</div></div>;
  const canManage = canManagePerformance(membership.role);
  const [cycleResult, employeesResult, goalsResult, reviewsResult] = await Promise.all([
    supabase.from("performance_cycles").select("id,name,description,status,starts_on,ends_on,review_due_on,created_at").eq("id", id).eq("tenant_id", tenant.id).maybeSingle(),
    supabase.from("employees").select("id,full_name").eq("tenant_id", tenant.id).neq("status", "terminated").order("full_name"),
    supabase.from("performance_goals").select("employee_id,title,status,progress,weight,employee:employees(full_name)").eq("tenant_id", tenant.id).eq("cycle_id", id),
    supabase.from("performance_reviews").select("id,employee_id,status,overall_rating,submitted_at,employee:employees(full_name,department:departments(name),position:positions(title))").eq("tenant_id", tenant.id).eq("cycle_id", id).order("created_at"),
  ]);
  const cycle = cycleResult.data;
  if (!cycle) notFound();
  const goals = (goalsResult.data ?? []) as unknown as GoalRow[];
  const reviews = (reviewsResult.data ?? []) as unknown as ReviewRow[];
  const submitted = reviews.filter(review => review.status !== "draft");
  const ratings = submitted.filter(review => review.overall_rating).map(review => Number(review.overall_rating));
  const averageRating = ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null;
  const goalWeight = goals.filter(goal => goal.status !== "canceled").reduce((sum, goal) => sum + goal.weight, 0);
  const goalProgress = goalWeight ? Math.round(goals.filter(goal => goal.status !== "canceled").reduce((sum, goal) => sum + goal.progress * goal.weight, 0) / goalWeight) : 0;

  return <div className="workspace-content wide-content">
    <Link className="back-link" href="/app/desempenho">← Voltar para Desempenho</Link>
    <div className="page-heading"><div><h1>{cycle.name}</h1><p>{formatDate(cycle.starts_on)} até {formatDate(cycle.ends_on)}{cycle.review_due_on ? ` · avaliações até ${formatDate(cycle.review_due_on)}` : ""}</p></div><span className={`cycle-status cycle-${cycle.status}`}>{PERFORMANCE_CYCLE_STATUS_LABELS[cycle.status as keyof typeof PERFORMANCE_CYCLE_STATUS_LABELS]}</span></div>
    {query.error && <div className="notice error-notice">{query.error}</div>}
    {query.success && <div className="notice">{query.success}</div>}
    <section className="metric-grid cycle-metrics"><article className="metric-card"><small>Cobertura de avaliações</small><strong>{reviews.length ? Math.round(submitted.length / reviews.length * 100) : 0}%</strong><em>{submitted.length}/{reviews.length} enviadas</em></article><article className="metric-card"><small>Nota média</small><strong>{averageRating ? averageRating.toFixed(1) : "—"}</strong><em>{ratingLabel(averageRating)}</em></article><article className="metric-card"><small>Progresso das metas</small><strong>{goalProgress}%</strong><em>{goals.length} meta(s) no ciclo</em></article><article className="metric-card"><small>Metas em risco</small><strong>{goals.filter(goal => goal.status === "at_risk").length}</strong><em>exigem plano de ação</em></article></section>

    <section className="cycle-control-grid">
      <article className="panel cycle-overview"><div className="panel-heading"><div><h2>Sobre o ciclo</h2><p>{cycle.description || "Nenhuma descrição adicionada."}</p></div></div><div className="cycle-flow"><span className={cycle.status === "draft" ? "active" : ""}>1. Rascunho</span><span className={cycle.status === "active" ? "active" : ""}>2. Em andamento</span><span className={cycle.status === "calibration" ? "active" : ""}>3. Calibração</span><span className={cycle.status === "closed" ? "active" : ""}>4. Encerrado</span></div>{canManage && <div className="cycle-actions">{cycle.status === "draft" && <form action={updatePerformanceCycleStatus}><input type="hidden" name="cycle_id" value={cycle.id} /><input type="hidden" name="status" value="active" /><ConfirmButton className="primary-confirm" message="Iniciar o ciclo e preparar avaliações para todos os colaboradores ativos?">Lançar ciclo</ConfirmButton></form>}{cycle.status === "active" && <form action={updatePerformanceCycleStatus}><input type="hidden" name="cycle_id" value={cycle.id} /><input type="hidden" name="status" value="calibration" /><SubmitButton>Iniciar calibração</SubmitButton></form>}{["active", "calibration"].includes(cycle.status) && <form action={updatePerformanceCycleStatus}><input type="hidden" name="cycle_id" value={cycle.id} /><input type="hidden" name="status" value="closed" /><ConfirmButton message="Encerrar o ciclo? Depois disso ele ficará somente como histórico.">Encerrar ciclo</ConfirmButton></form>}{["draft", "active", "calibration"].includes(cycle.status) && <form action={updatePerformanceCycleStatus}><input type="hidden" name="cycle_id" value={cycle.id} /><input type="hidden" name="status" value="canceled" /><ConfirmButton message="Cancelar este ciclo?">Cancelar</ConfirmButton></form>}</div>}</article>
      <article className="panel"><h2>Adicionar meta ao ciclo</h2><form className="record-form cycle-goal-form" action={createPerformanceGoal}><input type="hidden" name="cycle_id" value={cycle.id} /><input type="hidden" name="return_to" value={`/app/desempenho/ciclos/${cycle.id}`} /><label>Colaborador<select name="employee_id" required><option value="">Selecione</option>{employeesResult.data?.map(employee => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}</select></label><label>Categoria<select name="category">{GOAL_CATEGORIES.map(category => <option key={category} value={category}>{GOAL_CATEGORY_LABELS[category]}</option>)}</select></label><label className="full-field">Meta<input name="title" required /></label><label>Peso<input name="weight" type="number" min="1" max="100" defaultValue="100" /></label><label>Prazo<input name="due_on" type="date" /></label><SubmitButton className="full-field">Adicionar meta</SubmitButton></form></article>
    </section>

    <section className="panel cycle-review-panel"><div className="panel-heading"><div><h2>Matriz de avaliações</h2><p>Acompanhe pendências e prepare a calibração do ciclo.</p></div></div>{reviews.length ? <div className="cycle-review-list">{reviews.map(review => <Link href={`/app/desempenho/pessoas/${review.employee_id}`} key={review.id}><span className="employee-avatar">{review.employee?.full_name.split(" ").slice(0,2).map(part => part[0]).join("").toUpperCase()}</span><div><strong>{review.employee?.full_name ?? "Colaborador"}</strong><small>{review.employee?.position?.title ?? "Cargo não definido"} · {review.employee?.department?.name ?? "Sem departamento"}</small></div><span className={`review-status review-${review.status}`}>{REVIEW_STATUS_LABELS[review.status as keyof typeof REVIEW_STATUS_LABELS]}</span><em>{review.overall_rating ? `${Number(review.overall_rating).toFixed(1)} · ${ratingLabel(Number(review.overall_rating))}` : "Sem nota"}</em><b>→</b></Link>)}</div> : <div className="empty-state">Lance o ciclo para preparar as avaliações dos colaboradores.</div>}</section>

    <section className="panel cycle-goals-panel"><div className="panel-heading"><div><h2>Metas vinculadas</h2><p>Resultados e progresso ponderado do período.</p></div></div>{goals.length ? <div className="cycle-goal-list">{goals.map((goal, index) => <div key={`${goal.employee_id}-${index}`}><div><strong>{goal.title}</strong><small>{goal.employee?.full_name ?? "Colaborador"}</small></div><span className={`goal-status goal-${goal.status}`}>{GOAL_STATUS_LABELS[goal.status as keyof typeof GOAL_STATUS_LABELS]}</span><i><b style={{ width: `${goal.progress}%` }} /></i><em>{goal.progress}% · peso {goal.weight}</em></div>)}</div> : <div className="empty-state compact">Ainda não existem metas vinculadas a este ciclo.</div>}</section>
  </div>;
}
