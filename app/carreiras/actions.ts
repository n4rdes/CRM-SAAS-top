"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { createRequestFingerprint } from "@/lib/security/request";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function applicationError(tenantSlug: string, jobId: string, message: string): never {
  redirect(`/carreiras/${tenantSlug}/vagas/${jobId}?error=${encodeURIComponent(message)}`);
}

export async function submitCareerApplication(formData: FormData) {
  const tenantSlug = String(formData.get("tenant_slug") ?? "").trim().slice(0, 80);
  const jobId = String(formData.get("job_id") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim().slice(0, 180);
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 320);
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 40);
  const honeypot = String(formData.get("website") ?? "").trim();

  if (!tenantSlug || !UUID_PATTERN.test(jobId)) redirect("/");
  if (honeypot) redirect(`/carreiras/${tenantSlug}/vagas/${jobId}?success=1`);
  if (fullName.length < 3 || !email.includes("@")) applicationError(tenantSlug, jobId, "Informe nome e e-mail válidos.");

  const headerStore = await headers();
  const fingerprint = createRequestFingerprint(headerStore, `career:${tenantSlug}:${jobId}:${email}`);
  try {
    const rate = await consumeRateLimit({
      scope: `career-application:${tenantSlug}:${jobId}`,
      keyHash: fingerprint,
      limit: 5,
      windowSeconds: 60 * 60,
    });
    if (!rate.allowed) applicationError(tenantSlug, jobId, "Muitas candidaturas foram enviadas deste dispositivo. Aguarde e tente novamente.");
  } catch {
    applicationError(tenantSlug, jobId, "A proteção da candidatura está temporariamente indisponível. Tente novamente em instantes.");
  }

  const answers: Record<string, unknown> = {};
  let answerCharacters = 0;
  let answerCount = 0;
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("answer_")) continue;
    const questionId = key.slice(7);
    if (!UUID_PATTERN.test(questionId) || answerCount >= 100) continue;
    const raw = String(value).trim().slice(0, 5000);
    answerCharacters += raw.length;
    answerCount += 1;
    if (answerCharacters > 100_000) applicationError(tenantSlug, jobId, "As respostas excederam o limite permitido.");
    answers[questionId] = raw === "true" ? true : raw === "false" ? false : raw;
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("submit_public_application", {
    p_tenant_slug: tenantSlug,
    p_job_id: jobId,
    p_full_name: fullName,
    p_email: email,
    p_phone: phone,
    p_answers: answers,
    p_consent: formData.get("consent") === "on",
  });

  if (error) applicationError(tenantSlug, jobId, "Não foi possível concluir a candidatura. Revise os campos obrigatórios.");
  redirect(`/carreiras/${tenantSlug}/vagas/${jobId}?success=1`);
}
