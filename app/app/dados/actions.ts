"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/auth/workspace";
import { CUSTOM_FIELD_TYPES, isDataEntityType, normalizeHeader, normalizeImportRow, parseDelimitedText, type DataEntityType } from "@/lib/domain/data-foundation";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const uuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const fail = (message: string): never => redirect(`/app/dados?error=${encodeURIComponent(message)}`);
const success = (message: string): never => redirect(`/app/dados?success=${encodeURIComponent(message)}`);

export async function analyzeImport(formData: FormData) {
  const entityTypeValue = text(formData, "entity_type");
  const fileEntry = formData.get("file");
  if (!isDataEntityType(entityTypeValue) || !(fileEntry instanceof File) || !fileEntry.name.toLowerCase().endsWith(".csv")) fail("Selecione um arquivo CSV válido.");
  const entityType = entityTypeValue as DataEntityType;
  const file = fileEntry as File;
  if (file.size > 3_000_000) fail("O arquivo deve ter no máximo 3 MB.");
  const { supabase, tenant, user, membership } = await requireWorkspace();
  if (!["owner","admin","hr","recruiter","sales"].includes(membership.role)) fail("Sua função não permite importar dados.");
  const parsed = parseDelimitedText(await file.text());
  if (!parsed.rows.length) fail("O CSV não possui linhas para importar.");
  if (parsed.rows.length > 3000) fail("Importe no máximo 3.000 linhas por arquivo.");
  const analyzed = parsed.rows.map((row, index) => ({ row_number: index + 2, payload: row, ...normalizeImportRow(entityType, row) }));
  const validRows = analyzed.filter(row => row.errors.length === 0).length;
  const { data: imported, error } = await supabase.from("data_imports").insert({
    tenant_id: tenant.id, entity_type: entityType, source_filename: file.name, status: "ready", total_rows: analyzed.length,
    valid_rows: validRows, failed_rows: analyzed.length - validRows, column_mapping: { headers: parsed.headers }, created_by: user.id,
  }).select("id").single();
  if (error || !imported) fail("Não foi possível preparar a importação. Confirme se a migration 010 foi executada.");
  const importRecord = imported!;
  for (let offset = 0; offset < analyzed.length; offset += 300) {
    const chunk = analyzed.slice(offset, offset + 300).map(row => ({ tenant_id: tenant.id, import_id: importRecord.id, row_number: row.row_number, payload: row.payload, normalized_payload: row.normalized, errors: row.errors, status: row.errors.length ? "failed" : "valid" }));
    const { error: rowsError } = await supabase.from("data_import_rows").insert(chunk);
    if (rowsError) fail("A análise foi criada, mas as linhas não puderam ser salvas.");
  }
  redirect(`/app/dados/importacoes/${importRecord.id}`);
}

export async function confirmImport(formData: FormData) {
  const importId = text(formData, "import_id");
  if (!uuid(importId)) fail("Importação inválida.");
  const { supabase, tenant, user, membership } = await requireWorkspace();
  if (!["owner","admin","hr","recruiter","sales"].includes(membership.role)) fail("Sua função não permite importar dados.");
  const { data: job } = await supabase.from("data_imports").select("id,entity_type,status").eq("id", importId).eq("tenant_id", tenant.id).single();
  if (!job || !isDataEntityType(job.entity_type) || job.status !== "ready") fail("Essa importação não está pronta para confirmação.");
  const importJob = job!;
  await supabase.from("data_imports").update({ status: "processing", started_at: new Date().toISOString() }).eq("id", importId).eq("tenant_id", tenant.id);
  const { data: rows } = await supabase.from("data_import_rows").select("id,normalized_payload").eq("import_id", importId).eq("tenant_id", tenant.id).eq("status", "valid").order("row_number").limit(3000);
  let importedCount = 0; let failedCount = 0;
  for (const row of rows ?? []) {
    const value = row.normalized_payload as Record<string, string>;
    let result: { data: { id: string } | null; error: { message: string } | null };
    if (importJob.entity_type === "candidate") {
      result = await supabase.from("candidates").upsert({ tenant_id: tenant.id, full_name: value.full_name, email: value.email.toLowerCase(), phone: value.phone || null, source: value.source || "importacao", created_by: user.id }, { onConflict: "tenant_id,email" }).select("id").single();
    } else if (importJob.entity_type === "company") {
      const existing = await supabase.from("crm_companies").select("id").eq("tenant_id", tenant.id).ilike("name", value.name).maybeSingle();
      result = existing.data ? { data: existing.data, error: null } : await supabase.from("crm_companies").insert({ tenant_id: tenant.id, name: value.name, document: value.document || null, email: value.email || null, phone: value.phone || null, stage: ["lead","qualified","proposal","customer","inactive"].includes(value.stage) ? value.stage : "lead" }).select("id").single();
    } else if (importJob.entity_type === "job") {
      result = await supabase.from("jobs").insert({ tenant_id: tenant.id, title: value.title, description: value.description || null, openings: Math.max(1, Number(value.openings) || 1), status: ["draft","open","paused","closed","canceled"].includes(value.status) ? value.status : "draft", created_by: user.id }).select("id").single();
    } else {
      const rpc = await supabase.rpc("create_employee_with_onboarding", { p_tenant_id: tenant.id, p_full_name: value.full_name, p_email: value.email || null, p_phone: value.phone || null, p_hire_date: value.hire_date || null });
      result = { data: rpc.data ? { id: rpc.data as string } : null, error: rpc.error };
    }
    if (result.error || !result.data) { failedCount += 1; await supabase.from("data_import_rows").update({ status: "failed", errors: [result.error?.message ?? "Falha ao importar"] }).eq("id", row.id); }
    else { importedCount += 1; await supabase.from("data_import_rows").update({ status: "imported", imported_entity_id: result.data.id }).eq("id", row.id); }
  }
  await supabase.from("data_imports").update({ status: failedCount ? "completed_with_errors" : "completed", imported_rows: importedCount, failed_rows: failedCount, completed_at: new Date().toISOString(), summary: { imported: importedCount, failed: failedCount } }).eq("id", importId).eq("tenant_id", tenant.id);
  revalidatePath("/app", "layout");
  redirect(`/app/dados/importacoes/${importId}?success=${encodeURIComponent(`${importedCount} registro(s) importado(s).`)}`);
}

export async function createCustomField(formData: FormData) {
  const entityType = text(formData, "entity_type"); const label = text(formData, "label"); const fieldType = text(formData, "field_type");
  if (!isDataEntityType(entityType) || label.length < 2 || !CUSTOM_FIELD_TYPES.includes(fieldType as never)) fail("Revise os dados do campo personalizado.");
  const { supabase, tenant, user, membership } = await requireWorkspace();
  if (!["owner","admin","hr","recruiter","sales"].includes(membership.role)) fail("Sua função não permite criar campos.");
  const options = text(formData, "options").split(",").map(item => item.trim()).filter(Boolean);
  const baseKey = normalizeHeader(label).slice(0, 42) || `campo_${Date.now()}`;
  const { error } = await supabase.from("custom_field_definitions").insert({ tenant_id: tenant.id, entity_type: entityType, field_key: `${baseKey}_${Date.now().toString(36)}`, label, field_type: fieldType, options, required: formData.get("required") === "on", searchable: formData.get("searchable") === "on", created_by: user.id });
  if (error) fail("Não foi possível criar o campo personalizado.");
  revalidatePath("/app", "layout"); success("Campo personalizado criado.");
}

export async function deleteCustomField(formData: FormData) {
  const id = text(formData, "id"); const { supabase, tenant, membership } = await requireWorkspace();
  if (!uuid(id) || !["owner","admin"].includes(membership.role)) fail("Campo inválido ou permissão insuficiente.");
  await supabase.from("custom_field_definitions").delete().eq("id", id).eq("tenant_id", tenant.id);
  revalidatePath("/app", "layout"); success("Campo removido.");
}

export async function saveCustomFieldValues(formData: FormData) {
  const entityType = text(formData, "entity_type"); const entityId = text(formData, "entity_id"); const returnPath = text(formData, "return_path");
  if (!isDataEntityType(entityType) || !uuid(entityId) || !returnPath.startsWith("/app/")) fail("Registro inválido.");
  const { supabase, tenant, user } = await requireWorkspace();
  const { data: definitions } = await supabase.from("custom_field_definitions").select("id,field_type").eq("tenant_id", tenant.id).eq("entity_type", entityType).eq("active", true);
  for (const definition of definitions ?? []) {
    const rawValues = formData.getAll(`field_${definition.id}`).map(String).map(item => item.trim()).filter(Boolean);
    const value: unknown = definition.field_type === "multi_select" ? rawValues : definition.field_type === "boolean" ? rawValues.includes("true") : rawValues[0] || null;
    if (value === null || (Array.isArray(value) && !value.length)) await supabase.from("custom_field_values").delete().eq("tenant_id", tenant.id).eq("definition_id", definition.id).eq("entity_id", entityId);
    else await supabase.from("custom_field_values").upsert({ tenant_id: tenant.id, definition_id: definition.id, entity_type: entityType, entity_id: entityId, value_json: value, created_by: user.id, updated_by: user.id }, { onConflict: "tenant_id,definition_id,entity_id" });
  }
  revalidatePath(returnPath); redirect(`${returnPath}?success=${encodeURIComponent("Campos personalizados atualizados.")}`);
}

export async function mergeCandidateDuplicates(formData: FormData) {
  const primary = text(formData, "primary_id"); const duplicate = text(formData, "duplicate_id");
  if (!uuid(primary) || !uuid(duplicate) || primary === duplicate) fail("Selecione registros diferentes.");
  const { supabase } = await requireWorkspace(); const { error } = await supabase.rpc("merge_candidates", { p_primary_id: primary, p_duplicate_id: duplicate });
  if (error) fail("Não foi possível mesclar os candidatos.");
  revalidatePath("/app", "layout"); success("Candidatos mesclados e histórico preservado.");
}
