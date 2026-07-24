"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/auth/workspace";
import { sanitizeColumns, sanitizeDashboardCards, sanitizeReportCards } from "@/lib/domain/reporting";

function values(formData: FormData, key: string) {
  return formData.getAll(key).map(value => String(value));
}

export async function saveDashboardPreferences(formData: FormData) {
  const cards = sanitizeDashboardCards(values(formData, "cards"));
  const columns = sanitizeColumns(Number(formData.get("columns")), 2, 4, 4);
  const { supabase, tenant, user } = await requireWorkspace();
  const { error } = await supabase.from("workspace_view_preferences").upsert({ tenant_id: tenant.id, user_id: user.id, dashboard_cards: cards, dashboard_columns: columns }, { onConflict: "tenant_id,user_id" });
  if (error) redirect(`/app?error=${encodeURIComponent("Não foi possível salvar sua visão. Execute a migração 008.")}`);
  revalidatePath("/app");
  redirect("/app?success=Visão personalizada salva.");
}

export async function saveReportPreferences(formData: FormData) {
  const cards = sanitizeReportCards(values(formData, "cards"));
  const columns = sanitizeColumns(Number(formData.get("columns")), 1, 3, 2);
  const returnQuery = String(formData.get("return_query") ?? "");
  const { supabase, tenant, user } = await requireWorkspace();
  const { error } = await supabase.from("workspace_view_preferences").upsert({ tenant_id: tenant.id, user_id: user.id, report_cards: cards, report_columns: columns }, { onConflict: "tenant_id,user_id" });
  if (error) redirect(`/app/relatorios?error=${encodeURIComponent("Não foi possível salvar sua visão. Execute a migração 008.")}`);
  revalidatePath("/app/relatorios");
  redirect(`/app/relatorios?${returnQuery}${returnQuery ? "&" : ""}success=${encodeURIComponent("Layout dos relatórios salvo.")}`);
}
