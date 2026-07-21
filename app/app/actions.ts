"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/auth/workspace";
import { assertActiveJobLimit, requireActiveSubscription } from "@/lib/subscriptions/server";
import { isApplicationStage, isCompanyStage, isJobStatus } from "@/lib/domain/hr";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function done(path: string, message: string): never {
  redirect(`${path}?success=${encodeURIComponent(message)}`);
}

function friendlyDatabaseError(error: { code?: string; message: string }, duplicateMessage: string) {
  return error.code === "23505" ? duplicateMessage : "Não foi possível salvar. Tente novamente.";
}

function revalidateWorkspace() {
  revalidatePath("/app", "layout");
}

function requireAdmin(role: string, path: string) {
  if (!['owner', 'admin'].includes(role)) fail(path, "Somente proprietários e administradores podem excluir registros.");
}

export async function createCompany(formData: FormData) {
  const name = text(formData, "name");
  if (name.length < 2) fail("/app/clientes", "Informe o nome do cliente.");
  const { supabase, tenant } = await requireActiveSubscription("/app/clientes");
  const { error } = await supabase.from("crm_companies").insert({
    tenant_id: tenant.id,
    name,
    email: text(formData, "email") || null,
    phone: text(formData, "phone") || null,
    stage: "lead",
  });
  if (error) fail("/app/clientes", friendlyDatabaseError(error, "Esse cliente já está cadastrado."));
  revalidateWorkspace();
  done("/app/clientes", "Cliente cadastrado com sucesso.");
}

export async function updateCompany(formData: FormData) {
  const id = text(formData, "id");
  const path = `/app/clientes/${id}`;
  const name = text(formData, "name");
  const stage = text(formData, "stage");
  if (!isUuid(id) || name.length < 2 || !isCompanyStage(stage)) fail(path, "Revise os dados do cliente.");
  const { supabase, tenant } = await requireActiveSubscription(path);
  const { error } = await supabase.from("crm_companies").update({ name, stage, email: text(formData, "email") || null, phone: text(formData, "phone") || null }).eq("id", id).eq("tenant_id", tenant.id);
  if (error) fail(path, friendlyDatabaseError(error, "Já existe um cliente com esses dados."));
  revalidateWorkspace();
  done(path, "Cliente atualizado.");
}

export async function deleteCompany(formData: FormData) {
  const id = text(formData, "id");
  const path = `/app/clientes/${id}`;
  if (!isUuid(id)) fail("/app/clientes", "Cliente inválido.");
  const { supabase, tenant, membership } = await requireWorkspace();
  requireAdmin(membership.role, path);
  const { error } = await supabase.from("crm_companies").delete().eq("id", id).eq("tenant_id", tenant.id);
  if (error) fail(path, "Não foi possível excluir o cliente.");
  revalidateWorkspace();
  done("/app/clientes", "Cliente excluído. As vagas vinculadas foram preservadas como internas.");
}

export async function createCandidate(formData: FormData) {
  const fullName = text(formData, "full_name");
  const email = text(formData, "email").toLowerCase();
  if (fullName.length < 3 || !email) fail("/app/candidatos", "Informe nome e e-mail do candidato.");
  const { supabase, tenant, user } = await requireActiveSubscription("/app/candidatos");
  const { error } = await supabase.from("candidates").insert({ tenant_id: tenant.id, full_name: fullName, email, phone: text(formData, "phone") || null, source: text(formData, "source") || "manual", created_by: user.id });
  if (error) fail("/app/candidatos", friendlyDatabaseError(error, "Já existe um candidato com esse e-mail."));
  revalidateWorkspace();
  done("/app/candidatos", "Candidato cadastrado com sucesso.");
}

export async function updateCandidate(formData: FormData) {
  const id = text(formData, "id");
  const path = `/app/candidatos/${id}`;
  const fullName = text(formData, "full_name");
  const email = text(formData, "email").toLowerCase();
  if (!isUuid(id) || fullName.length < 3 || !email) fail(path, "Revise os dados do candidato.");
  const { supabase, tenant } = await requireActiveSubscription(path);
  const { error } = await supabase.from("candidates").update({ full_name: fullName, email, phone: text(formData, "phone") || null, source: text(formData, "source") || "manual" }).eq("id", id).eq("tenant_id", tenant.id);
  if (error) fail(path, friendlyDatabaseError(error, "Já existe um candidato com esse e-mail."));
  revalidateWorkspace();
  done(path, "Candidato atualizado.");
}

export async function deleteCandidate(formData: FormData) {
  const id = text(formData, "id");
  const path = `/app/candidatos/${id}`;
  if (!isUuid(id)) fail("/app/candidatos", "Candidato inválido.");
  const { supabase, tenant, membership } = await requireWorkspace();
  requireAdmin(membership.role, path);
  const { error } = await supabase.from("candidates").delete().eq("id", id).eq("tenant_id", tenant.id);
  if (error) fail(path, "Não foi possível excluir o candidato.");
  revalidateWorkspace();
  done("/app/candidatos", "Candidato e suas candidaturas foram excluídos.");
}

export async function createJob(formData: FormData) {
  const title = text(formData, "title");
  if (title.length < 2) fail("/app/vagas", "Informe o título da vaga.");
  const { supabase, tenant, user } = await assertActiveJobLimit();
  const companyId = text(formData, "company_id");
  const { error } = await supabase.from("jobs").insert({ tenant_id: tenant.id, title, company_id: isUuid(companyId) ? companyId : null, openings: Math.max(1, Number(text(formData, "openings")) || 1), status: "open", description: text(formData, "description") || null, created_by: user.id });
  if (error) fail("/app/vagas", "Não foi possível abrir a vaga.");
  revalidateWorkspace();
  done("/app/vagas", "Vaga aberta com sucesso.");
}

export async function updateJob(formData: FormData) {
  const id = text(formData, "id");
  const path = `/app/vagas/${id}`;
  const title = text(formData, "title");
  const status = text(formData, "status");
  if (!isUuid(id) || title.length < 2 || !isJobStatus(status)) fail(path, "Revise os dados da vaga.");
  const context = await requireActiveSubscription(path);
  const { data: current } = await context.supabase.from("jobs").select("status").eq("id", id).eq("tenant_id", context.tenant.id).single();
  if (current && !["open", "paused"].includes(current.status) && ["open", "paused"].includes(status)) await assertActiveJobLimit(path);
  const companyId = text(formData, "company_id");
  const { error } = await context.supabase.from("jobs").update({ title, status, company_id: isUuid(companyId) ? companyId : null, openings: Math.max(1, Number(text(formData, "openings")) || 1), description: text(formData, "description") || null }).eq("id", id).eq("tenant_id", context.tenant.id);
  if (error) fail(path, "Não foi possível atualizar a vaga.");
  revalidateWorkspace();
  done(path, "Vaga atualizada.");
}

export async function deleteJob(formData: FormData) {
  const id = text(formData, "id");
  const path = `/app/vagas/${id}`;
  if (!isUuid(id)) fail("/app/vagas", "Vaga inválida.");
  const { supabase, tenant, membership } = await requireWorkspace();
  requireAdmin(membership.role, path);
  const { error } = await supabase.from("jobs").delete().eq("id", id).eq("tenant_id", tenant.id);
  if (error) fail(path, "Não foi possível excluir a vaga.");
  revalidateWorkspace();
  done("/app/vagas", "Vaga e candidaturas vinculadas foram excluídas.");
}

export async function createApplication(formData: FormData) {
  const jobId = text(formData, "job_id");
  const candidateId = text(formData, "candidate_id");
  const path = `/app/vagas/${jobId}`;
  if (!isUuid(jobId) || !isUuid(candidateId)) fail(path, "Escolha um candidato válido.");
  const { supabase, tenant } = await requireActiveSubscription(path);
  const { error } = await supabase.from("applications").insert({ tenant_id: tenant.id, job_id: jobId, candidate_id: candidateId, stage: "applied" });
  if (error) fail(path, friendlyDatabaseError(error, "Esse candidato já está nesta vaga."));
  revalidateWorkspace();
  done(path, "Candidato adicionado ao processo seletivo.");
}

export async function updateApplicationStage(formData: FormData) {
  const id = text(formData, "application_id");
  const jobId = text(formData, "job_id");
  const stage = text(formData, "stage");
  const path = `/app/vagas/${jobId}`;
  if (!isUuid(id) || !isUuid(jobId) || !isApplicationStage(stage)) fail(path, "Etapa inválida.");
  const { supabase, tenant } = await requireActiveSubscription(path);
  const { error } = await supabase.from("applications").update({ stage }).eq("id", id).eq("job_id", jobId).eq("tenant_id", tenant.id);
  if (error) fail(path, "Não foi possível mover o candidato.");
  revalidateWorkspace();
  done(path, "Etapa do candidato atualizada.");
}

export async function deleteApplication(formData: FormData) {
  const id = text(formData, "application_id");
  const jobId = text(formData, "job_id");
  const path = `/app/vagas/${jobId}`;
  if (!isUuid(id) || !isUuid(jobId)) fail(path, "Candidatura inválida.");
  const { supabase, tenant } = await requireActiveSubscription(path);
  const { error } = await supabase.from("applications").delete().eq("id", id).eq("job_id", jobId).eq("tenant_id", tenant.id);
  if (error) fail(path, "Não foi possível remover o candidato da vaga.");
  revalidateWorkspace();
  done(path, "Candidato removido do processo seletivo.");
}
