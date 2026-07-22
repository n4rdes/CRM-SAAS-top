"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/auth/workspace";
import { canManageEmployeeDocuments, canManagePeople, canViewPeople } from "@/lib/domain/team";
import { isDocumentCategory, isEmployeeStatus, isEmploymentType, isWorkflowKind, isWorkModel } from "@/lib/domain/people";
import { requireActiveSubscription } from "@/lib/subscriptions/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const MAX_DOCUMENT_SIZE = 8 * 1024 * 1024;

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

function nullableUuid(value: string) {
  return isUuid(value) ? value : null;
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function done(path: string, message: string): never {
  redirect(`${path}?success=${encodeURIComponent(message)}`);
}

function revalidatePeople() {
  revalidatePath("/app", "layout");
  revalidatePath("/app/pessoas");
}

function requirePeopleManager(role: string, path: string) {
  if (!canManagePeople(role)) fail(path, "Somente proprietários, administradores e RH podem alterar dados de Pessoas.");
}

function requireWorkflowManager(role: string, path: string) {
  if (!canViewPeople(role)) fail(path, "Sua função não permite gerenciar este fluxo.");
}

function friendlyCreateError(message: string) {
  if (message.includes("EMPLOYEE_LIMIT_REACHED")) return "O limite de colaboradores do plano foi atingido.";
  if (message.includes("CANDIDATE_NOT_HIRED")) return "Mova o candidato para Contratado antes de convertê-lo em colaborador.";
  if (message.includes("PEOPLE_PERMISSION_REQUIRED")) return "Sua função não permite criar colaboradores.";
  if (message.includes("duplicate key")) return "Já existe um colaborador com esse e-mail, matrícula ou candidato.";
  return "Não foi possível criar o colaborador. Confirme se a migração 005 foi executada.";
}

export async function createDepartment(formData: FormData) {
  const path = "/app/pessoas";
  const name = text(formData, "name");
  if (name.length < 2) fail(path, "Informe o nome do departamento.");
  const { supabase, tenant, membership } = await requireActiveSubscription(path);
  requirePeopleManager(membership.role, path);
  const { error } = await supabase.from("departments").insert({
    tenant_id: tenant.id,
    name,
    code: text(formData, "code") || null,
    description: text(formData, "description") || null,
  });
  if (error) fail(path, error.code === "23505" ? "Esse departamento já existe." : "Não foi possível criar o departamento.");
  revalidatePeople();
  done(path, "Departamento criado.");
}

export async function createPosition(formData: FormData) {
  const path = "/app/pessoas";
  const title = text(formData, "title");
  if (title.length < 2) fail(path, "Informe o nome do cargo.");
  const { supabase, tenant, membership } = await requireActiveSubscription(path);
  requirePeopleManager(membership.role, path);
  const { error } = await supabase.from("positions").insert({
    tenant_id: tenant.id,
    department_id: nullableUuid(text(formData, "department_id")),
    title,
    level: text(formData, "level") || null,
    description: text(formData, "description") || null,
  });
  if (error) fail(path, error.code === "23505" ? "Esse cargo já existe no departamento." : "Não foi possível criar o cargo.");
  revalidatePeople();
  done(path, "Cargo criado.");
}

export async function createEmployee(formData: FormData) {
  const path = "/app/pessoas";
  const fullName = text(formData, "full_name");
  if (fullName.length < 3) fail(path, "Informe o nome completo do colaborador.");
  const { supabase, tenant, membership } = await requireActiveSubscription(path);
  requirePeopleManager(membership.role, path);
  const { data, error } = await supabase.rpc("create_employee_with_onboarding", {
    p_tenant_id: tenant.id,
    p_full_name: fullName,
    p_email: text(formData, "email") || null,
    p_phone: text(formData, "phone") || null,
    p_department_id: nullableUuid(text(formData, "department_id")),
    p_position_id: nullableUuid(text(formData, "position_id")),
    p_hire_date: text(formData, "hire_date") || null,
    p_candidate_id: null,
  });
  if (error || !data) fail(path, friendlyCreateError(error?.message ?? ""));
  revalidatePeople();
  redirect(`/app/pessoas/${data}?success=${encodeURIComponent("Colaborador criado com checklist de admissão.")}`);
}

export async function convertCandidateToEmployee(formData: FormData) {
  const candidateId = text(formData, "candidate_id");
  const candidatePath = `/app/candidatos/${candidateId}`;
  if (!isUuid(candidateId)) fail("/app/candidatos", "Candidato inválido.");
  const { supabase, tenant, membership } = await requireActiveSubscription(candidatePath);
  requirePeopleManager(membership.role, candidatePath);
  const { data: candidate } = await supabase.from("candidates").select("full_name,email,phone").eq("id", candidateId).eq("tenant_id", tenant.id).maybeSingle();
  if (!candidate) fail(candidatePath, "Candidato não encontrado.");
  const { data, error } = await supabase.rpc("create_employee_with_onboarding", {
    p_tenant_id: tenant.id,
    p_full_name: candidate.full_name,
    p_email: candidate.email,
    p_phone: candidate.phone,
    p_department_id: nullableUuid(text(formData, "department_id")),
    p_position_id: nullableUuid(text(formData, "position_id")),
    p_hire_date: text(formData, "hire_date") || null,
    p_candidate_id: candidateId,
  });
  if (error || !data) fail(candidatePath, friendlyCreateError(error?.message ?? ""));
  revalidatePeople();
  redirect(`/app/pessoas/${data}?success=${encodeURIComponent("Candidato convertido em colaborador sem duplicar o cadastro.")}`);
}

export async function updateEmployee(formData: FormData) {
  const id = text(formData, "employee_id");
  const path = `/app/pessoas/${id}`;
  const fullName = text(formData, "full_name");
  const status = text(formData, "status");
  const employmentType = text(formData, "employment_type");
  const workModel = text(formData, "work_model");
  if (!isUuid(id) || fullName.length < 3 || !isEmployeeStatus(status) || !isEmploymentType(employmentType) || !isWorkModel(workModel)) fail(path, "Revise os dados do colaborador.");
  const { supabase, tenant, membership } = await requireActiveSubscription(path);
  requirePeopleManager(membership.role, path);
  const managerId = nullableUuid(text(formData, "manager_id"));
  if (managerId === id) fail(path, "O colaborador não pode ser o próprio gestor.");
  const { error } = await supabase.from("employees").update({
    full_name: fullName,
    employee_number: text(formData, "employee_number") || null,
    corporate_email: text(formData, "corporate_email").toLowerCase() || null,
    personal_email: text(formData, "personal_email").toLowerCase() || null,
    phone: text(formData, "phone") || null,
    department_id: nullableUuid(text(formData, "department_id")),
    position_id: nullableUuid(text(formData, "position_id")),
    manager_id: managerId,
    employment_type: employmentType,
    work_model: workModel,
    status,
    hire_date: text(formData, "hire_date") || null,
    termination_date: status === "terminated" ? text(formData, "termination_date") || new Date().toISOString().slice(0, 10) : null,
    location: text(formData, "location") || null,
    notes: text(formData, "notes") || null,
  }).eq("id", id).eq("tenant_id", tenant.id);
  if (error) fail(path, error.code === "23505" ? "E-mail ou matrícula já utilizado por outro colaborador." : "Não foi possível atualizar o colaborador.");
  revalidatePeople();
  done(path, "Cadastro do colaborador atualizado.");
}

export async function startOffboarding(formData: FormData) {
  const id = text(formData, "employee_id");
  const path = `/app/pessoas/${id}`;
  if (!isUuid(id)) fail("/app/pessoas", "Colaborador inválido.");
  const { supabase, tenant, user, membership } = await requireActiveSubscription(path);
  requirePeopleManager(membership.role, path);
  const terminationDate = text(formData, "termination_date") || new Date().toISOString().slice(0, 10);
  const { data: employee } = await supabase.from("employees").select("full_name").eq("id", id).eq("tenant_id", tenant.id).maybeSingle();
  if (!employee) fail(path, "Colaborador não encontrado.");
  const { error: employeeError } = await supabase.from("employees").update({ status: "terminated", termination_date: terminationDate }).eq("id", id).eq("tenant_id", tenant.id);
  if (employeeError) fail(path, "Não foi possível iniciar o desligamento.");
  const { data: existing } = await supabase.from("employee_workflows").select("id").eq("tenant_id", tenant.id).eq("employee_id", id).eq("kind", "offboarding").in("status", ["open", "in_progress"]).maybeSingle();
  if (!existing) {
    const { data: workflow } = await supabase.from("employee_workflows").insert({ tenant_id: tenant.id, employee_id: id, kind: "offboarding", title: `Desligamento de ${employee.full_name}`, due_date: terminationDate, created_by: user.id }).select("id").single();
    if (workflow) await supabase.from("employee_workflow_tasks").insert([
      { tenant_id: tenant.id, workflow_id: workflow.id, title: "Revogar acessos e recolher ativos", due_date: terminationDate, sort_order: 10 },
      { tenant_id: tenant.id, workflow_id: workflow.id, title: "Conferir documentos e obrigações", due_date: terminationDate, sort_order: 20 },
      { tenant_id: tenant.id, workflow_id: workflow.id, title: "Realizar entrevista de desligamento", due_date: terminationDate, sort_order: 30 },
      { tenant_id: tenant.id, workflow_id: workflow.id, title: "Comunicar equipe e atualizar sistemas", due_date: terminationDate, sort_order: 40 },
    ]);
  }
  revalidatePeople();
  done(path, "Offboarding iniciado e checklist criado.");
}

export async function createWorkflow(formData: FormData) {
  const employeeId = text(formData, "employee_id");
  const path = `/app/pessoas/${employeeId}`;
  const kind = text(formData, "kind");
  const title = text(formData, "title");
  if (!isUuid(employeeId) || !isWorkflowKind(kind) || title.length < 2) fail(path, "Revise os dados do checklist.");
  const { supabase, tenant, user, membership } = await requireActiveSubscription(path);
  requireWorkflowManager(membership.role, path);
  const { error } = await supabase.from("employee_workflows").insert({ tenant_id: tenant.id, employee_id: employeeId, kind, title, due_date: text(formData, "due_date") || null, created_by: user.id });
  if (error) fail(path, "Não foi possível criar o checklist.");
  revalidatePeople();
  done(path, "Checklist criado.");
}

export async function addWorkflowTask(formData: FormData) {
  const employeeId = text(formData, "employee_id");
  const workflowId = text(formData, "workflow_id");
  const path = `/app/pessoas/${employeeId}`;
  const title = text(formData, "title");
  if (!isUuid(employeeId) || !isUuid(workflowId) || title.length < 2) fail(path, "Informe a tarefa.");
  const { supabase, tenant, membership } = await requireActiveSubscription(path);
  requireWorkflowManager(membership.role, path);
  const { count } = await supabase.from("employee_workflow_tasks").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).eq("workflow_id", workflowId);
  const { error } = await supabase.from("employee_workflow_tasks").insert({ tenant_id: tenant.id, workflow_id: workflowId, title, due_date: text(formData, "due_date") || null, sort_order: ((count ?? 0) + 1) * 10 });
  if (error) fail(path, "Não foi possível adicionar a tarefa.");
  revalidatePeople();
  done(path, "Tarefa adicionada.");
}

export async function toggleWorkflowTask(formData: FormData) {
  const employeeId = text(formData, "employee_id");
  const taskId = text(formData, "task_id");
  const workflowId = text(formData, "workflow_id");
  const path = `/app/pessoas/${employeeId}`;
  if (!isUuid(employeeId) || !isUuid(taskId) || !isUuid(workflowId)) fail(path, "Tarefa inválida.");
  const { supabase, tenant, user, membership } = await requireActiveSubscription(path);
  requireWorkflowManager(membership.role, path);
  const completed = text(formData, "completed") === "true";
  const { error } = await supabase.from("employee_workflow_tasks").update({ completed_at: completed ? null : new Date().toISOString(), completed_by: completed ? null : user.id }).eq("id", taskId).eq("workflow_id", workflowId).eq("tenant_id", tenant.id);
  if (error) fail(path, "Não foi possível atualizar a tarefa.");
  const { data: tasks } = await supabase.from("employee_workflow_tasks").select("completed_at").eq("workflow_id", workflowId).eq("tenant_id", tenant.id);
  const allComplete = Boolean(tasks?.length) && tasks!.every(task => task.completed_at);
  const anyComplete = Boolean(tasks?.some(task => task.completed_at));
  await supabase.from("employee_workflows").update({ status: allComplete ? "completed" : anyComplete ? "in_progress" : "open", completed_at: allComplete ? new Date().toISOString() : null }).eq("id", workflowId).eq("tenant_id", tenant.id);
  revalidatePeople();
  done(path, completed ? "Tarefa reaberta." : "Tarefa concluída.");
}

export async function uploadEmployeeDocument(formData: FormData) {
  const employeeId = text(formData, "employee_id");
  const path = `/app/pessoas/${employeeId}`;
  const category = text(formData, "category");
  const title = text(formData, "title");
  const file = formData.get("file");
  if (!isUuid(employeeId) || !isDocumentCategory(category) || title.length < 2 || !(file instanceof File) || file.size === 0) fail(path, "Selecione um documento válido.");
  if (file.size > MAX_DOCUMENT_SIZE) fail(path, "O documento deve ter no máximo 8 MB.");
  if (!DOCUMENT_MIME_TYPES.has(file.type)) fail(path, "Formato não permitido. Envie PDF, JPG, PNG ou DOCX.");
  const { supabase, tenant, user, membership } = await requireActiveSubscription(path);
  if (!canManageEmployeeDocuments(membership.role)) fail(path, "Sua função não permite acessar documentos de colaboradores.");
  const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "documento";
  const storagePath = `${tenant.id}/${employeeId}/${randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from("employee-documents").upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) fail(path, "Não foi possível enviar o arquivo. Confirme a migração 005 e o limite do documento.");
  const { error } = await supabase.from("employee_documents").insert({
    tenant_id: tenant.id,
    employee_id: employeeId,
    category,
    title,
    file_name: file.name,
    storage_path: storagePath,
    mime_type: file.type,
    size_bytes: file.size,
    expires_on: text(formData, "expires_on") || null,
    uploaded_by: user.id,
  });
  if (error) {
    await supabase.storage.from("employee-documents").remove([storagePath]);
    fail(path, "O arquivo foi recebido, mas o registro não pôde ser salvo.");
  }
  revalidatePeople();
  done(path, "Documento enviado com acesso privado.");
}

export async function deleteEmployeeDocument(formData: FormData) {
  const employeeId = text(formData, "employee_id");
  const documentId = text(formData, "document_id");
  const path = `/app/pessoas/${employeeId}`;
  if (!isUuid(employeeId) || !isUuid(documentId)) fail(path, "Documento inválido.");
  const { supabase, tenant, membership } = await requireWorkspace();
  if (!canManageEmployeeDocuments(membership.role)) fail(path, "Sua função não permite excluir documentos.");
  const { data: document } = await supabase.from("employee_documents").select("storage_path").eq("id", documentId).eq("employee_id", employeeId).eq("tenant_id", tenant.id).maybeSingle();
  if (!document) fail(path, "Documento não encontrado.");
  const { error: storageError } = await supabase.storage.from("employee-documents").remove([document.storage_path]);
  if (storageError) fail(path, "Não foi possível remover o arquivo privado.");
  const { error } = await supabase.from("employee_documents").delete().eq("id", documentId).eq("employee_id", employeeId).eq("tenant_id", tenant.id);
  if (error) fail(path, "O arquivo foi removido, mas o registro precisa ser revisado.");
  revalidatePeople();
  done(path, "Documento excluído.");
}
