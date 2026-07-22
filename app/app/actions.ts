"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/auth/workspace";
import { assertActiveJobLimit, requireActiveSubscription } from "@/lib/subscriptions/server";
import { isActivityType, isApplicationStage, isCompanyStage, isJobStatus, isReviewRecommendation } from "@/lib/domain/hr";
import { canManageCrm, canManageRecruitment } from "@/lib/domain/team";

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

function returnPath(formData: FormData, fallback: string) {
  const path = text(formData, "return_path");
  return path.startsWith("/app") && !path.startsWith("//") ? path : fallback;
}

function optionalDate(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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

function requireCrmOperator(role: string, path: string) {
  if (!canManageCrm(role)) fail(path, "Sua função não permite alterar dados do CRM.");
}

function requireRecruitmentOperator(role: string, path: string) {
  if (!canManageRecruitment(role)) fail(path, "Sua função não permite alterar vagas ou candidatos.");
}

export async function createCompany(formData: FormData) {
  const name = text(formData, "name");
  if (name.length < 2) fail("/app/clientes", "Informe o nome do cliente.");
  const { supabase, tenant, membership } = await requireActiveSubscription("/app/clientes");
  requireCrmOperator(membership.role, "/app/clientes");
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
  const { supabase, tenant, membership } = await requireActiveSubscription(path);
  requireCrmOperator(membership.role, path);
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
  const { supabase, tenant, user, membership } = await requireActiveSubscription("/app/candidatos");
  requireRecruitmentOperator(membership.role, "/app/candidatos");
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
  const { supabase, tenant, membership } = await requireActiveSubscription(path);
  requireRecruitmentOperator(membership.role, path);
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
  const { supabase, tenant, user, membership } = await assertActiveJobLimit();
  requireRecruitmentOperator(membership.role, "/app/vagas");
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
  requireRecruitmentOperator(context.membership.role, path);
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
  const { supabase, tenant, membership } = await requireActiveSubscription(path);
  requireRecruitmentOperator(membership.role, path);
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
  const { supabase, tenant, membership } = await requireActiveSubscription(path);
  requireRecruitmentOperator(membership.role, path);
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
  const { supabase, tenant, membership } = await requireActiveSubscription(path);
  requireRecruitmentOperator(membership.role, path);
  const { error } = await supabase.from("applications").delete().eq("id", id).eq("job_id", jobId).eq("tenant_id", tenant.id);
  if (error) fail(path, "Não foi possível remover o candidato da vaga.");
  revalidateWorkspace();
  done(path, "Candidato removido do processo seletivo.");
}

export async function createCompanyContact(formData: FormData) {
  const companyId = text(formData, "company_id");
  const path = `/app/clientes/${companyId}`;
  const fullName = text(formData, "full_name");
  if (!isUuid(companyId) || fullName.length < 2) fail(path, "Informe o nome do contato.");
  const { supabase, tenant, user, membership } = await requireActiveSubscription(path);
  requireCrmOperator(membership.role, path);
  const { error } = await supabase.from("crm_contacts").insert({
    tenant_id: tenant.id,
    company_id: companyId,
    full_name: fullName,
    job_title: text(formData, "job_title") || null,
    email: text(formData, "email") || null,
    phone: text(formData, "phone") || null,
    decision_maker: formData.get("decision_maker") === "on",
    notes: text(formData, "notes") || null,
    created_by: user.id,
  });
  if (error) fail(path, "Não foi possível cadastrar o contato. Execute a migração 004 no Supabase.");
  revalidateWorkspace();
  done(path, "Contato adicionado ao cliente.");
}

export async function deleteCompanyContact(formData: FormData) {
  const id = text(formData, "contact_id");
  const companyId = text(formData, "company_id");
  const path = `/app/clientes/${companyId}`;
  if (!isUuid(id) || !isUuid(companyId)) fail(path, "Contato inválido.");
  const { supabase, tenant, membership } = await requireActiveSubscription(path);
  requireCrmOperator(membership.role, path);
  const { error } = await supabase.from("crm_contacts").delete().eq("id", id).eq("company_id", companyId).eq("tenant_id", tenant.id);
  if (error) fail(path, "Não foi possível remover o contato.");
  revalidateWorkspace();
  done(path, "Contato removido.");
}

export async function createActivity(formData: FormData) {
  const path = returnPath(formData, "/app/agenda");
  const subject = text(formData, "subject");
  const activityType = text(formData, "activity_type");
  const entityType = text(formData, "entity_type") || "general";
  const entityId = text(formData, "entity_id");
  if (subject.length < 2 || !isActivityType(activityType)) fail(path, "Informe o assunto e o tipo da atividade.");
  if (!["general", "company", "candidate", "job", "application"].includes(entityType)) fail(path, "Vínculo da atividade inválido.");
  const { supabase, tenant, user } = await requireActiveSubscription(path);
  const { error } = await supabase.from("activities").insert({
    tenant_id: tenant.id,
    entity_type: entityType,
    entity_id: isUuid(entityId) ? entityId : null,
    activity_type: activityType,
    subject,
    description: text(formData, "description") || null,
    due_at: optionalDate(text(formData, "due_at")),
    assigned_to: user.id,
    created_by: user.id,
  });
  if (error) fail(path, "Não foi possível criar a atividade. Execute a migração 004 no Supabase.");
  revalidateWorkspace();
  done(path, "Atividade registrada.");
}

export async function toggleActivity(formData: FormData) {
  const id = text(formData, "activity_id");
  const path = returnPath(formData, "/app/agenda");
  if (!isUuid(id)) fail(path, "Atividade inválida.");
  const { supabase, tenant } = await requireActiveSubscription(path);
  const completed = text(formData, "completed") === "true";
  const { error } = await supabase.from("activities").update({ completed_at: completed ? null : new Date().toISOString() }).eq("id", id).eq("tenant_id", tenant.id);
  if (error) fail(path, "Não foi possível atualizar a atividade.");
  revalidateWorkspace();
  done(path, completed ? "Atividade reaberta." : "Atividade concluída.");
}

export async function deleteActivity(formData: FormData) {
  const id = text(formData, "activity_id");
  const path = returnPath(formData, "/app/agenda");
  if (!isUuid(id)) fail(path, "Atividade inválida.");
  const { supabase, tenant } = await requireActiveSubscription(path);
  const { error } = await supabase.from("activities").delete().eq("id", id).eq("tenant_id", tenant.id);
  if (error) fail(path, "Não foi possível excluir a atividade.");
  revalidateWorkspace();
  done(path, "Atividade excluída.");
}

export async function saveApplicationReview(formData: FormData) {
  const applicationId = text(formData, "application_id");
  const jobId = text(formData, "job_id");
  const path = `/app/vagas/${jobId}`;
  const recommendation = text(formData, "recommendation");
  const score = Number(text(formData, "score"));
  if (!isUuid(applicationId) || !isUuid(jobId) || !Number.isInteger(score) || score < 1 || score > 5 || !isReviewRecommendation(recommendation)) fail(path, "Revise a nota e a recomendação.");
  const { supabase, tenant, user, membership } = await requireActiveSubscription(path);
  requireRecruitmentOperator(membership.role, path);
  const { error } = await supabase.from("application_reviews").upsert({
    tenant_id: tenant.id,
    application_id: applicationId,
    reviewer_id: user.id,
    score,
    recommendation,
    strengths: text(formData, "strengths") || null,
    risks: text(formData, "risks") || null,
    notes: text(formData, "notes") || null,
  }, { onConflict: "application_id,reviewer_id" });
  if (error) fail(path, "Não foi possível salvar a avaliação. Execute a migração 004 no Supabase.");
  revalidateWorkspace();
  done(path, "Avaliação salva.");
}
