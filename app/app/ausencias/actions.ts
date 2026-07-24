"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canManagePeople, canViewPeople } from "@/lib/domain/team";
import { isLeaveType, isPartialDay } from "@/lib/domain/time-off";
import { requireActiveSubscription } from "@/lib/subscriptions/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function fail(message: string): never {
  redirect(`/app/ausencias?error=${encodeURIComponent(message)}`);
}

function done(message: string): never {
  revalidatePath("/app", "layout");
  revalidatePath("/app/ausencias");
  revalidatePath("/app/central");
  redirect(`/app/ausencias?success=${encodeURIComponent(message)}`);
}

function slug(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

function friendlyRequestError(message: string) {
  if (message.includes("INSUFFICIENT_LEAVE_BALANCE")) return "O colaborador não possui saldo suficiente para esse período.";
  if (message.includes("LEAVE_PERIOD_OVERLAP")) return "Já existe uma solicitação pendente ou aprovada nesse período.";
  if (message.includes("MINIMUM_NOTICE_NOT_MET")) return "A política exige mais antecedência para essa solicitação.";
  if (message.includes("NO_BUSINESS_DAYS")) return "O período selecionado não possui dias úteis.";
  if (message.includes("EMPLOYEE_TERMINATED")) return "Não é possível solicitar ausência para um colaborador desligado.";
  if (message.includes("LEAVE_ACCESS_REQUIRED")) return "Sua função não permite solicitar ausências.";
  if (message.includes("LEAVE_POLICY_NOT_FOUND")) return "A política selecionada não está disponível.";
  return "Não foi possível criar a solicitação. Confirme os dados e a migração 008.";
}

export async function createLeaveRequest(formData: FormData) {
  const employeeId = text(formData, "employee_id");
  const policyId = text(formData, "policy_id");
  const startDate = text(formData, "start_date");
  const endDate = text(formData, "end_date");
  const partialDay = text(formData, "partial_day") || "full";
  if (!UUID_PATTERN.test(employeeId) || !UUID_PATTERN.test(policyId) || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || !isPartialDay(partialDay)) {
    fail("Revise o colaborador, a política e o período da ausência.");
  }
  const { supabase, tenant, membership } = await requireActiveSubscription("/app/ausencias");
  if (!canViewPeople(membership.role)) fail("Sua função não permite gerenciar ausências.");
  const { error } = await supabase.rpc("request_employee_leave", {
    p_tenant_id: tenant.id,
    p_employee_id: employeeId,
    p_policy_id: policyId,
    p_start_date: startDate,
    p_end_date: endDate,
    p_partial_day: partialDay,
    p_reason: text(formData, "reason") || null,
  });
  if (error) fail(friendlyRequestError(error.message));
  done("Solicitação criada e responsáveis notificados.");
}

export async function decideLeaveRequest(formData: FormData) {
  const requestId = text(formData, "request_id");
  const decision = text(formData, "decision");
  if (!UUID_PATTERN.test(requestId) || !["approved", "rejected"].includes(decision)) fail("Solicitação ou decisão inválida.");
  const { supabase, membership } = await requireActiveSubscription("/app/ausencias");
  if (!canViewPeople(membership.role)) fail("Sua função não permite aprovar ausências.");
  const { error } = await supabase.rpc("decide_employee_leave", { p_request_id: requestId, p_decision: decision, p_note: text(formData, "note") || null });
  if (error) fail(error.message.includes("NOT_PENDING") ? "Essa solicitação já foi analisada." : "Não foi possível registrar a decisão.");
  done(decision === "approved" ? "Ausência aprovada e adicionada ao calendário." : "Solicitação rejeitada.");
}

export async function cancelLeaveRequest(formData: FormData) {
  const requestId = text(formData, "request_id");
  if (!UUID_PATTERN.test(requestId)) fail("Solicitação inválida.");
  const { supabase } = await requireActiveSubscription("/app/ausencias");
  const { error } = await supabase.rpc("cancel_employee_leave", { p_request_id: requestId, p_note: text(formData, "note") || null });
  if (error) fail("Não foi possível cancelar essa solicitação.");
  done("Solicitação cancelada e saldo liberado.");
}

export async function createLeavePolicy(formData: FormData) {
  const name = text(formData, "name");
  const leaveType = text(formData, "leave_type");
  const allowance = Number(text(formData, "allowance_days") || 0);
  const notice = Number(text(formData, "minimum_notice_days") || 0);
  const color = text(formData, "color") || "#3156d8";
  if (name.length < 2 || !isLeaveType(leaveType) || !Number.isFinite(allowance) || allowance < 0 || allowance > 366 || !Number.isInteger(notice) || notice < 0 || notice > 365 || !/^#[0-9a-f]{6}$/i.test(color)) {
    fail("Revise os dados da política.");
  }
  const { supabase, tenant, user, membership } = await requireActiveSubscription("/app/ausencias");
  if (!canManagePeople(membership.role)) fail("Somente proprietários, administradores e RH podem criar políticas.");
  const { error } = await supabase.from("leave_policies").insert({
    tenant_id: tenant.id,
    name,
    code: `${slug(name)}-${Date.now().toString(36)}`.slice(0, 40),
    leave_type: leaveType,
    allowance_days: allowance,
    deducts_balance: text(formData, "deducts_balance") === "on",
    requires_approval: text(formData, "requires_approval") === "on",
    minimum_notice_days: notice,
    color,
    created_by: user.id,
  });
  if (error) fail(error.code === "23505" ? "Já existe uma política com esse identificador." : "Não foi possível criar a política.");
  done("Política de ausência criada.");
}

export async function adjustLeaveBalance(formData: FormData) {
  const employeeId = text(formData, "employee_id");
  const policyId = text(formData, "policy_id");
  const year = Number(text(formData, "year"));
  const entitledDays = Number(text(formData, "entitled_days") || 0);
  const carriedDays = Number(text(formData, "carried_days") || 0);
  const adjustedDays = Number(text(formData, "adjusted_days") || 0);
  if (!UUID_PATTERN.test(employeeId) || !UUID_PATTERN.test(policyId) || !Number.isInteger(year) || year < 2020 || year > 2100 || [entitledDays, carriedDays, adjustedDays].some(value => !Number.isFinite(value) || value < -366 || value > 366)) {
    fail("Revise o ajuste de saldo.");
  }
  const { supabase, tenant, membership } = await requireActiveSubscription("/app/ausencias");
  if (!canManagePeople(membership.role)) fail("Somente proprietários, administradores e RH podem ajustar saldos.");
  const periodStart = `${year}-01-01`;
  const { error } = await supabase.from("employee_leave_balances").upsert({
    tenant_id: tenant.id,
    employee_id: employeeId,
    policy_id: policyId,
    period_start: periodStart,
    period_end: `${year}-12-31`,
    entitled_days: Math.max(0, entitledDays),
    carried_days: Math.max(0, carriedDays),
    adjusted_days: adjustedDays,
    notes: text(formData, "notes") || null,
  }, { onConflict: "tenant_id,employee_id,policy_id,period_start" });
  if (error) fail("Não foi possível ajustar o saldo.");
  done("Saldo atualizado com registro de auditoria.");
}
