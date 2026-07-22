"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveSubscription } from "@/lib/subscriptions/server";
import { canManagePerformance, canReviewPerformance } from "@/lib/domain/team";
import { isGoalCategory, isGoalStatus, isPerformanceCycleStatus, isReviewType } from "@/lib/domain/performance";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

function nullableUuid(value: string) {
  return isUuid(value) ? value : null;
}

function integer(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function done(path: string, message: string): never {
  redirect(`${path}?success=${encodeURIComponent(message)}`);
}

function revalidatePerformance(employeeId?: string, cycleId?: string) {
  revalidatePath("/app", "layout");
  revalidatePath("/app/desempenho");
  revalidatePath("/app/relatorios");
  if (employeeId) {
    revalidatePath(`/app/desempenho/pessoas/${employeeId}`);
    revalidatePath(`/app/pessoas/${employeeId}`);
  }
  if (cycleId) revalidatePath(`/app/desempenho/ciclos/${cycleId}`);
}

function requirePerformanceAdmin(role: string, path: string) {
  if (!canManagePerformance(role)) fail(path, "Somente proprietários, administradores e RH podem gerenciar ciclos.");
}

function requireReviewer(role: string, path: string) {
  if (!canReviewPerformance(role)) fail(path, "Sua função não permite registrar desempenho.");
}

export async function createPerformanceCycle(formData: FormData) {
  const path = "/app/desempenho";
  const name = text(formData, "name");
  const startsOn = text(formData, "starts_on");
  const endsOn = text(formData, "ends_on");
  if (name.length < 3 || !startsOn || !endsOn || endsOn < startsOn) fail(path, "Revise o nome e as datas do ciclo.");
  const { supabase, tenant, user, membership } = await requireActiveSubscription(path);
  requirePerformanceAdmin(membership.role, path);
  const { data, error } = await supabase.from("performance_cycles").insert({
    tenant_id: tenant.id,
    name,
    description: text(formData, "description") || null,
    starts_on: startsOn,
    ends_on: endsOn,
    review_due_on: text(formData, "review_due_on") || null,
    created_by: user.id,
  }).select("id").single();
  if (error || !data) fail(path, error?.code === "23505" ? "Já existe um ciclo com esse nome e período." : "Não foi possível criar o ciclo. Confirme a migração 006.");
  revalidatePerformance(undefined, data.id);
  redirect(`/app/desempenho/ciclos/${data.id}?success=${encodeURIComponent("Ciclo criado como rascunho.")}`);
}

export async function updatePerformanceCycleStatus(formData: FormData) {
  const cycleId = text(formData, "cycle_id");
  const nextStatus = text(formData, "status");
  const path = `/app/desempenho/ciclos/${cycleId}`;
  if (!isUuid(cycleId) || !isPerformanceCycleStatus(nextStatus)) fail("/app/desempenho", "Ciclo inválido.");
  const { supabase, tenant, membership } = await requireActiveSubscription(path);
  requirePerformanceAdmin(membership.role, path);
  const { data: cycle } = await supabase.from("performance_cycles").select("status").eq("id", cycleId).eq("tenant_id", tenant.id).maybeSingle();
  if (!cycle) fail("/app/desempenho", "Ciclo não encontrado.");
  const allowed: Record<string, string[]> = {
    draft: ["active", "canceled"],
    active: ["calibration", "closed", "canceled"],
    calibration: ["active", "closed", "canceled"],
    closed: [],
    canceled: [],
  };
  if (!allowed[cycle.status]?.includes(nextStatus)) fail(path, "Essa mudança de etapa não é permitida.");
  if (nextStatus === "active") {
    const { data, error } = await supabase.rpc("launch_performance_cycle", { p_cycle_id: cycleId });
    if (error) {
      if (error.message.includes("ACTIVE_CYCLE_EXISTS")) fail(path, "Já existe outro ciclo em andamento ou calibração.");
      fail(path, "Não foi possível iniciar o ciclo.");
    }
    revalidatePerformance(undefined, cycleId);
    done(path, `Ciclo iniciado com ${data ?? 0} avaliação(ões) preparada(s).`);
  }
  const { error } = await supabase.from("performance_cycles").update({ status: nextStatus }).eq("id", cycleId).eq("tenant_id", tenant.id);
  if (error) fail(path, "Não foi possível atualizar a etapa do ciclo.");
  revalidatePerformance(undefined, cycleId);
  done(path, nextStatus === "closed" ? "Ciclo encerrado." : nextStatus === "calibration" ? "Ciclo enviado para calibração." : "Ciclo cancelado.");
}

export async function createPerformanceGoal(formData: FormData) {
  const employeeId = text(formData, "employee_id");
  const returnTo = text(formData, "return_to");
  const path = returnTo.startsWith("/app/desempenho") ? returnTo : `/app/desempenho/pessoas/${employeeId}`;
  const title = text(formData, "title");
  const category = text(formData, "category");
  const startsOn = text(formData, "starts_on");
  const dueOn = text(formData, "due_on");
  const weight = integer(text(formData, "weight"), 100);
  if (!isUuid(employeeId) || title.length < 3 || !isGoalCategory(category) || weight < 1 || weight > 100 || (startsOn && dueOn && dueOn < startsOn)) fail(path, "Revise os dados da meta.");
  const { supabase, tenant, user, membership } = await requireActiveSubscription(path);
  requireReviewer(membership.role, path);
  const cycleId = nullableUuid(text(formData, "cycle_id"));
  const { error } = await supabase.from("performance_goals").insert({
    tenant_id: tenant.id,
    employee_id: employeeId,
    cycle_id: cycleId,
    title,
    description: text(formData, "description") || null,
    category,
    status: "in_progress",
    progress: 0,
    weight,
    starts_on: startsOn || null,
    due_on: dueOn || null,
    created_by: user.id,
  });
  if (error) fail(path, "Não foi possível criar a meta. Confirme colaborador, ciclo e migração 006.");
  revalidatePerformance(employeeId, cycleId ?? undefined);
  done(path, "Meta criada e colocada em andamento.");
}

export async function updatePerformanceGoal(formData: FormData) {
  const goalId = text(formData, "goal_id");
  const employeeId = text(formData, "employee_id");
  const returnTo = text(formData, "return_to");
  const path = returnTo.startsWith("/app/desempenho") ? returnTo : `/app/desempenho/pessoas/${employeeId}`;
  const status = text(formData, "status");
  const progress = integer(text(formData, "progress"), -1);
  if (!isUuid(goalId) || !isUuid(employeeId) || !isGoalStatus(status) || progress < 0 || progress > 100) fail(path, "Progresso da meta inválido.");
  const { supabase, tenant, membership } = await requireActiveSubscription(path);
  requireReviewer(membership.role, path);
  const { data, error } = await supabase.from("performance_goals").update({ status, progress }).eq("id", goalId).eq("employee_id", employeeId).eq("tenant_id", tenant.id).select("cycle_id").maybeSingle();
  if (error || !data) fail(path, "Não foi possível atualizar a meta.");
  revalidatePerformance(employeeId, data.cycle_id ?? undefined);
  done(path, progress === 100 ? "Meta concluída." : "Progresso da meta atualizado.");
}

export async function submitPerformanceReview(formData: FormData) {
  const employeeId = text(formData, "employee_id");
  const cycleId = text(formData, "cycle_id");
  const returnTo = text(formData, "return_to");
  const path = returnTo.startsWith("/app/desempenho") ? returnTo : `/app/desempenho/pessoas/${employeeId}`;
  const reviewType = text(formData, "review_type");
  const overall = integer(text(formData, "overall_rating"), 0);
  const delivery = integer(text(formData, "delivery_rating"), 0);
  const collaboration = integer(text(formData, "collaboration_rating"), 0);
  const growth = integer(text(formData, "growth_rating"), 0);
  if (!isUuid(employeeId) || !isUuid(cycleId) || !isReviewType(reviewType) || [overall, delivery, collaboration, growth].some(value => value < 1 || value > 5)) fail(path, "Preencha todas as notas da avaliação de 1 a 5.");
  const { supabase, tenant, user, membership } = await requireActiveSubscription(path);
  requireReviewer(membership.role, path);
  const { error } = await supabase.from("performance_reviews").upsert({
    tenant_id: tenant.id,
    cycle_id: cycleId,
    employee_id: employeeId,
    reviewer_id: user.id,
    review_type: reviewType,
    status: "submitted",
    overall_rating: overall,
    delivery_rating: delivery,
    collaboration_rating: collaboration,
    growth_rating: growth,
    strengths: text(formData, "strengths") || null,
    improvements: text(formData, "improvements") || null,
    summary: text(formData, "summary") || null,
    submitted_at: new Date().toISOString(),
  }, { onConflict: "tenant_id,cycle_id,employee_id,review_type" });
  if (error) fail(path, "Não foi possível enviar a avaliação.");
  revalidatePerformance(employeeId, cycleId);
  done(path, "Avaliação enviada e incluída nos indicadores do ciclo.");
}

export async function createPerformanceCheckin(formData: FormData) {
  const employeeId = text(formData, "employee_id");
  const returnTo = text(formData, "return_to");
  const path = returnTo.startsWith("/app/desempenho") ? returnTo : `/app/desempenho/pessoas/${employeeId}`;
  const summary = text(formData, "summary");
  const mood = integer(text(formData, "mood"), 0);
  const energy = integer(text(formData, "energy"), 0);
  if (!isUuid(employeeId) || summary.length < 3 || mood < 1 || mood > 5 || energy < 1 || energy > 5) fail(path, "Registre resumo, humor e energia do check-in.");
  const { supabase, tenant, user, membership } = await requireActiveSubscription(path);
  requireReviewer(membership.role, path);
  const cycleId = nullableUuid(text(formData, "cycle_id"));
  const { error } = await supabase.from("performance_checkins").insert({
    tenant_id: tenant.id,
    employee_id: employeeId,
    cycle_id: cycleId,
    manager_id: user.id,
    happened_on: text(formData, "happened_on") || new Date().toISOString().slice(0, 10),
    mood,
    energy,
    summary,
    achievements: text(formData, "achievements") || null,
    blockers: text(formData, "blockers") || null,
    next_actions: text(formData, "next_actions") || null,
  });
  if (error) fail(path, "Não foi possível salvar o check-in.");
  revalidatePerformance(employeeId, cycleId ?? undefined);
  done(path, "Check-in 1:1 registrado.");
}
