"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { createRequestFingerprint } from "@/lib/security/request";
import { MAX_DOCUMENT_SIZE, scanDocument, validateDocumentFile } from "@/lib/security/files";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

function tokenPath(token: string, message: string, type: "success" | "error" = "success"): never {
  if (!UUID_PATTERN.test(token)) redirect("/");
  redirect(`/portal/candidato/${token}?${type}=${encodeURIComponent(message)}`);
}

async function enforcePortalRateLimit(token: string, action: string, limit: number, windowSeconds: number) {
  if (!UUID_PATTERN.test(token)) redirect("/");
  const headerStore = await headers();
  const fingerprint = createRequestFingerprint(headerStore, `candidate-portal:${token}:${action}`);
  let result;
  try {
    result = await consumeRateLimit({
      scope: `candidate-portal:${action}`,
      keyHash: fingerprint,
      limit,
      windowSeconds,
    });
  } catch {
    tokenPath(token, "A proteção do portal está temporariamente indisponível. Tente novamente em instantes.", "error");
  }
  if (!result.allowed) tokenPath(token, "Muitas tentativas. Aguarde alguns minutos antes de continuar.", "error");
}

export async function updatePortalProfile(formData: FormData) {
  const token = text(formData, "token");
  await enforcePortalRateLimit(token, "profile", 20, 60 * 60);
  const admin = createAdminClient();
  const { error } = await admin.rpc("update_candidate_portal_profile", {
    p_token: token,
    p_full_name: text(formData, "full_name").slice(0, 180),
    p_phone: text(formData, "phone").slice(0, 40),
    p_talent_pool: formData.get("talent_pool") === "on",
    p_job_alerts: formData.get("job_alerts") === "on",
  });
  if (error) tokenPath(token, "Não foi possível atualizar seu perfil.", "error");
  revalidatePath(`/portal/candidato/${token}`);
  tokenPath(token, "Perfil e preferências atualizados.");
}

export async function postPortalMessage(formData: FormData) {
  const token = text(formData, "token");
  const body = text(formData, "body").slice(0, 5000);
  await enforcePortalRateLimit(token, "message", 30, 60 * 60);
  if (!body) tokenPath(token, "Escreva uma mensagem antes de enviar.", "error");
  const admin = createAdminClient();
  const { error } = await admin.rpc("post_candidate_portal_message", { p_token: token, p_body: body });
  if (error) tokenPath(token, "Não foi possível enviar a mensagem.", "error");
  revalidatePath(`/portal/candidato/${token}`);
  tokenPath(token, "Mensagem enviada para a equipe.");
}

export async function bookPortalInterview(formData: FormData) {
  const token = text(formData, "token");
  const slot = text(formData, "slot_id");
  await enforcePortalRateLimit(token, "interview", 12, 60 * 60);
  if (!UUID_PATTERN.test(slot)) tokenPath(token, "Horário inválido.", "error");
  const admin = createAdminClient();
  const { error } = await admin.rpc("book_candidate_interview", { p_token: token, p_slot_id: slot });
  if (error) tokenPath(token, "Esse horário não está mais disponível.", "error");
  revalidatePath(`/portal/candidato/${token}`);
  tokenPath(token, "Entrevista confirmada.");
}

export async function respondPortalOffer(formData: FormData) {
  const token = text(formData, "token");
  const offer = text(formData, "offer_id");
  const accept = text(formData, "decision") === "accept";
  await enforcePortalRateLimit(token, "offer", 10, 60 * 60);
  if (!UUID_PATTERN.test(offer)) tokenPath(token, "Proposta inválida.", "error");
  const admin = createAdminClient();
  const { error } = await admin.rpc("respond_candidate_offer", {
    p_token: token,
    p_offer_id: offer,
    p_accept: accept,
    p_note: text(formData, "note").slice(0, 2000) || null,
  });
  if (error) tokenPath(token, "A proposta não está mais disponível.", "error");
  revalidatePath(`/portal/candidato/${token}`);
  tokenPath(token, accept ? "Proposta aceita. Parabéns!" : "Resposta registrada.");
}

export async function requestPortalDataAction(formData: FormData) {
  const token = text(formData, "token");
  const type = text(formData, "request_type");
  await enforcePortalRateLimit(token, "lgpd", 5, 24 * 60 * 60);
  if (!new Set(["access", "correction", "deletion", "portability"]).has(type)) tokenPath(token, "Solicitação inválida.", "error");
  const admin = createAdminClient();
  const { error } = await admin.rpc("request_candidate_data_action", {
    p_token: token,
    p_request_type: type,
    p_details: text(formData, "details").slice(0, 5000) || null,
  });
  if (error) tokenPath(token, "Não foi possível registrar a solicitação.", "error");
  revalidatePath(`/portal/candidato/${token}`);
  tokenPath(token, "Solicitação LGPD registrada e enviada ao RH.");
}

export async function uploadCandidateDocument(formData: FormData) {
  const token = text(formData, "token");
  await enforcePortalRateLimit(token, "document", 12, 60 * 60);
  const fileEntry = formData.get("file");
  if (!(fileEntry instanceof File) || fileEntry.size === 0) tokenPath(token, "Selecione um arquivo.", "error");
  const file = fileEntry as File;
  if (file.size > MAX_DOCUMENT_SIZE || !(await validateDocumentFile(file))) tokenPath(token, "Use PDF, JPG, PNG ou DOCX com até 8 MB.", "error");

  const admin = createAdminClient();
  const { data: context, error: ctxError } = await admin.rpc("resolve_candidate_portal", { p_token: token });
  const ctx = Array.isArray(context) ? context[0] : null;
  if (ctxError || !ctx) tokenPath(token, "Portal inválido ou expirado.", "error");

  const scan = await scanDocument(file);
  if (scan.status === "infected") tokenPath(token, "O arquivo foi bloqueado pela verificação de segurança.", "error");
  const safeName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120);
  const path = `${ctx.tenant_id}/${ctx.candidate_id}/${crypto.randomUUID()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage.from("candidate-documents").upload(path, buffer, { contentType: file.type, upsert: false });
  if (uploadError) tokenPath(token, "Não foi possível armazenar o documento.", "error");

  const { error: dbError } = await admin.from("candidate_documents").insert({
    tenant_id: ctx.tenant_id,
    candidate_id: ctx.candidate_id,
    document_type: text(formData, "document_type").slice(0, 80) || "other",
    category: "candidate",
    file_name: file.name.slice(0, 240),
    storage_path: path,
    mime_type: file.type,
    size_bytes: file.size,
    scan_status: scan.status === "clean" ? "clean" : scan.status === "not_configured" ? "not_configured" : "failed",
    uploaded_by_candidate: true,
  });
  if (dbError) {
    await admin.storage.from("candidate-documents").remove([path]);
    tokenPath(token, "Não foi possível registrar o documento.", "error");
  }
  revalidatePath(`/portal/candidato/${token}`);
  tokenPath(token, "Documento enviado com segurança.");
}
