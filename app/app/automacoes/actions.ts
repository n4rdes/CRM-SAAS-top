"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAutomationAction, isAutomationEvent, normalizeDueDays } from "@/lib/domain/automations";
import { canManagePeople } from "@/lib/domain/team";
import { requirePlanFeature } from "@/lib/subscriptions/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function fail(message: string): never {
  redirect(`/app/automacoes?error=${encodeURIComponent(message)}`);
}

function done(message: string): never {
  revalidatePath("/app/automacoes");
  revalidatePath("/app/central");
  revalidatePath("/app", "layout");
  redirect(`/app/automacoes?success=${encodeURIComponent(message)}`);
}

export async function createAutomationRule(formData: FormData) {
  const name = text(formData, "name");
  const event = text(formData, "trigger_event");
  const action = text(formData, "action_type");
  if (name.length < 3 || !isAutomationEvent(event) || !isAutomationAction(action)) fail("Revise o nome, o gatilho e a ação da automação.");
  const { supabase, tenant, user, membership } = await requirePlanFeature("/app/automacoes", "automations", "Automações");
  if (!canManagePeople(membership.role)) fail("Somente proprietários, administradores e RH podem criar automações.");
  const subject = text(formData, "subject") || name;
  const description = text(formData, "action_description") || null;
  const actionConfig = action === "create_activity"
    ? { subject, description, due_days: normalizeDueDays(Number(text(formData, "due_days") || 0)) }
    : { title: subject, body: description, href: text(formData, "href") || "/app/central" };
  const { error } = await supabase.from("automation_rules").insert({
    tenant_id: tenant.id,
    name,
    description: text(formData, "description") || null,
    trigger_event: event,
    action_type: action,
    action_config: actionConfig,
    enabled: text(formData, "enabled") === "on",
    created_by: user.id,
  });
  if (error) fail(error.message.includes("AUTOMATIONS_PLAN_REQUIRED") ? "Automações exigem o plano Pro ou Custom." : "Não foi possível criar a automação.");
  done("Automação criada e pronta para executar.");
}

export async function toggleAutomationRule(formData: FormData) {
  const ruleId = text(formData, "rule_id");
  if (!UUID_PATTERN.test(ruleId)) fail("Automação inválida.");
  const { supabase, tenant, membership } = await requirePlanFeature("/app/automacoes", "automations", "Automações");
  if (!canManagePeople(membership.role)) fail("Sua função não permite alterar automações.");
  const enabled = text(formData, "enabled") === "true";
  const { error } = await supabase.from("automation_rules").update({ enabled: !enabled }).eq("id", ruleId).eq("tenant_id", tenant.id);
  if (error) fail("Não foi possível alterar a automação.");
  done(enabled ? "Automação pausada." : "Automação ativada.");
}

export async function testAutomationRule(formData: FormData) {
  const ruleId = text(formData, "rule_id");
  if (!UUID_PATTERN.test(ruleId)) fail("Automação inválida.");
  const { supabase, membership } = await requirePlanFeature("/app/automacoes", "automations", "Automações");
  if (!canManagePeople(membership.role)) fail("Sua função não permite testar automações.");
  const { data, error } = await supabase.rpc("run_automation_rule", { p_rule_id: ruleId });
  if (error || (data as { error?: string } | null)?.error) fail("O teste falhou. Consulte o histórico de execuções.");
  done("Teste executado: a ação real foi criada e registrada no histórico.");
}

export async function deleteAutomationRule(formData: FormData) {
  const ruleId = text(formData, "rule_id");
  if (!UUID_PATTERN.test(ruleId)) fail("Automação inválida.");
  const { supabase, tenant, membership } = await requirePlanFeature("/app/automacoes", "automations", "Automações");
  if (!canManagePeople(membership.role)) fail("Sua função não permite excluir automações.");
  const { error } = await supabase.from("automation_rules").delete().eq("id", ruleId).eq("tenant_id", tenant.id).is("template_key", null);
  if (error) fail("Não foi possível excluir a automação.");
  done("Automação removida.");
}
