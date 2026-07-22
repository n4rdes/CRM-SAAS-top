"use server";

import { createHash, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function submitPublicEngagementSurvey(formData: FormData) {
  const token = String(formData.get("survey_token") ?? "");
  if (!UUID_PATTERN.test(token)) redirect("/?survey=invalid");
  const cookieStore = await cookies();
  const cookieName = `prismae_survey_${token.slice(0,8)}`;
  const browserKey = cookieStore.get(cookieName)?.value ?? randomUUID();
  const responseKeyHash = createHash("sha256").update(`${token}:${browserKey}`).digest("hex");
  const answers: Array<{ question_id: string; value: string }> = [];
  for (const [key, rawValue] of formData.entries()) {
    if (!key.startsWith("question_")) continue;
    const questionId = key.slice("question_".length);
    if (!UUID_PATTERN.test(questionId)) continue;
    answers.push({ question_id: questionId, value: String(rawValue).trim() });
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_engagement_survey", { p_token: token, p_response_key_hash: responseKeyHash, p_answers: answers });
  if (error) {
    const message = error.message.includes("ALREADY_ANSWERED") ? "Este navegador já enviou uma resposta para esta pesquisa." : error.message.includes("REQUIRED_ANSWER") ? "Responda todas as perguntas obrigatórias." : "Não foi possível enviar. A pesquisa pode ter sido encerrada; tente atualizar a página.";
    redirect(`/pesquisa/${token}?error=${encodeURIComponent(message)}`);
  }
  cookieStore.set(cookieName, browserKey, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365, path: `/pesquisa/${token}` });
  redirect(`/pesquisa/${token}?success=1`);
}
