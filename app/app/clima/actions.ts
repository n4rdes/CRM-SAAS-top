"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlanFeature } from "@/lib/subscriptions/server";
import { canManageEngagement, canManageEngagementActions } from "@/lib/domain/team";
import { isActionPlanStatus, isEngagementCategory, isQuestionType, isRecognitionValue, isSurveyKind } from "@/lib/domain/engagement";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const isUuid = (value: string) => UUID_PATTERN.test(value);
const number = (value: string, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const fail = (path: string, message: string): never => redirect(`${path}?error=${encodeURIComponent(message)}`);
const done = (path: string, message: string): never => redirect(`${path}?success=${encodeURIComponent(message)}`);
const requireEngagement = (path: string) => requirePlanFeature(path, "engagement", "Clima & engajamento");

function refresh(id?: string) {
  revalidatePath("/app", "layout");
  revalidatePath("/app/clima");
  revalidatePath("/app/relatorios");
  if (id) revalidatePath(`/app/clima/${id}`);
}

export async function createEngagementSurvey(formData: FormData) {
  const path = "/app/clima";
  const title = text(formData, "title");
  const kind = text(formData, "kind");
  const startsOn = text(formData, "starts_on");
  const endsOn = text(formData, "ends_on");
  const minimum = Math.round(number(text(formData, "minimum"), 3));
  if (title.length < 3 || !isSurveyKind(kind) || minimum < 1 || minimum > 50 || (startsOn && endsOn && endsOn < startsOn)) fail(path, "Revise o nome, o modelo, as datas e a amostra mínima.");
  const { supabase, tenant, membership } = await requireEngagement(path);
  if (!canManageEngagement(membership.role)) fail(path, "Somente proprietários, administradores e RH podem criar pesquisas.");
  const { data, error } = await supabase.rpc("create_engagement_survey_with_template", {
    p_tenant_id: tenant.id, p_title: title, p_description: text(formData, "description") || null,
    p_kind: kind, p_starts_on: startsOn || null, p_ends_on: endsOn || null, p_min_responses: minimum,
  });
  if (error || !data) fail(path, "Não foi possível criar a pesquisa. Confirme a migração 007 no Supabase.");
  refresh(String(data));
  redirect(`/app/clima/${data}?success=${encodeURIComponent("Pesquisa criada com perguntas recomendadas. Revise e publique quando quiser.")}`);
}

export async function addEngagementQuestion(formData: FormData) {
  const surveyId = text(formData, "survey_id");
  const path = `/app/clima/${surveyId}`;
  const prompt = text(formData, "prompt");
  const type = text(formData, "question_type");
  const category = text(formData, "category");
  if (!isUuid(surveyId) || prompt.length < 3 || !isQuestionType(type) || !isEngagementCategory(category)) fail("/app/clima", "Pergunta inválida.");
  const options = text(formData, "options").split(",").map(value => value.trim()).filter(Boolean);
  if (type === "single_choice" && options.length < 2) fail(path, "Informe pelo menos duas opções separadas por vírgula.");
  const { supabase, tenant, membership } = await requireEngagement(path);
  if (!canManageEngagement(membership.role)) fail(path, "Você não pode alterar esta pesquisa.");
  const { data: latest } = await supabase.from("engagement_questions").select("position").eq("tenant_id", tenant.id).eq("survey_id", surveyId).order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("engagement_questions").insert({ tenant_id: tenant.id, survey_id: surveyId, prompt, question_type: type, category, required: formData.get("required") === "on", options, position: Number(latest?.position ?? 0) + 10 });
  if (error) fail(path, "Não foi possível adicionar a pergunta.");
  refresh(surveyId); done(path, "Pergunta adicionada.");
}

export async function launchEngagementSurvey(formData: FormData) {
  const surveyId = text(formData, "survey_id"); const path = `/app/clima/${surveyId}`;
  if (!isUuid(surveyId)) fail("/app/clima", "Pesquisa inválida.");
  const { supabase, membership } = await requireEngagement(path);
  if (!canManageEngagement(membership.role)) fail(path, "Você não pode publicar esta pesquisa.");
  const { error } = await supabase.rpc("launch_engagement_survey", { p_survey_id: surveyId });
  if (error) fail(path, error.message.includes("NO_QUESTIONS") ? "Inclua pelo menos uma pergunta antes de publicar." : "Não foi possível publicar a pesquisa.");
  refresh(surveyId); done(path, "Pesquisa publicada. O link anônimo já está pronto para ser compartilhado.");
}

export async function closeEngagementSurvey(formData: FormData) {
  const surveyId = text(formData, "survey_id"); const path = `/app/clima/${surveyId}`;
  if (!isUuid(surveyId)) fail("/app/clima", "Pesquisa inválida.");
  const { supabase, tenant, membership } = await requireEngagement(path);
  if (!canManageEngagement(membership.role)) fail(path, "Você não pode encerrar esta pesquisa.");
  const { error } = await supabase.from("engagement_surveys").update({ status: "closed" }).eq("tenant_id", tenant.id).eq("id", surveyId).eq("status", "active");
  if (error) fail(path, "Não foi possível encerrar a coleta.");
  refresh(surveyId); done(path, "Coleta encerrada. Os resultados permanecem disponíveis.");
}

export async function createEngagementActionPlan(formData: FormData) {
  const surveyId = text(formData, "survey_id"); const returnTo = text(formData, "return_to");
  const path = returnTo.startsWith("/app/clima") ? returnTo : "/app/clima";
  const title = text(formData, "title"); const category = text(formData, "category");
  if (title.length < 3 || !isEngagementCategory(category) || (surveyId && !isUuid(surveyId))) fail(path, "Revise os dados do plano de ação.");
  const { supabase, tenant, user, membership } = await requireEngagement(path);
  if (!canManageEngagementActions(membership.role)) fail(path, "Você não pode criar planos de ação.");
  const { error } = await supabase.from("engagement_action_plans").insert({ tenant_id: tenant.id, survey_id: surveyId || null, title, description: text(formData, "description") || null, category, due_on: text(formData, "due_on") || null, owner_user_id: user.id, created_by: user.id });
  if (error) fail(path, "Não foi possível criar o plano de ação.");
  refresh(surveyId || undefined); done(path, "Plano de ação criado e atribuído a você.");
}

export async function updateEngagementActionPlan(formData: FormData) {
  const id = text(formData, "action_id"); const surveyId = text(formData, "survey_id"); const path = surveyId ? `/app/clima/${surveyId}` : "/app/clima";
  const status = text(formData, "status"); const progress = Math.round(number(text(formData, "progress"), -1));
  if (!isUuid(id) || !isActionPlanStatus(status) || progress < 0 || progress > 100) fail(path, "Atualização inválida.");
  const { supabase, tenant, membership } = await requireEngagement(path);
  if (!canManageEngagementActions(membership.role)) fail(path, "Você não pode atualizar este plano.");
  const { error } = await supabase.from("engagement_action_plans").update({ status, progress }).eq("tenant_id", tenant.id).eq("id", id);
  if (error) fail(path, "Não foi possível atualizar o plano.");
  refresh(surveyId || undefined); done(path, "Plano de ação atualizado.");
}

export async function createEmployeeRecognition(formData: FormData) {
  const employeeId = text(formData, "employee_id"); const valueTag = text(formData, "value_tag"); const message = text(formData, "message"); const path = "/app/clima";
  if (!isUuid(employeeId) || !isRecognitionValue(valueTag) || message.length < 3) fail(path, "Escolha uma pessoa, um valor e escreva o reconhecimento.");
  const { supabase, tenant, user, membership } = await requireEngagement(path);
  if (!canManageEngagementActions(membership.role)) fail(path, "Você não pode registrar reconhecimentos.");
  const { error } = await supabase.from("employee_recognitions").insert({ tenant_id: tenant.id, recipient_employee_id: employeeId, message, value_tag: valueTag, created_by: user.id });
  if (error) fail(path, "Não foi possível publicar o reconhecimento.");
  refresh(); done(path, "Reconhecimento publicado no mural.");
}
