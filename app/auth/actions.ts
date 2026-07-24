"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/http/app-url";
import { createRequestFingerprint } from "@/lib/security/request";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { safeInternalPath } from "@/lib/security/redirects";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function authError(path: string, message: string, next?: string): never {
  const params = new URLSearchParams({ error: message });
  if (next) params.set("next", safeInternalPath(next));
  redirect(`${path}?${params.toString()}`);
}

async function enforceAuthRateLimit(input: {
  scope: string;
  discriminator: string;
  limit: number;
  windowSeconds: number;
  path: string;
  next?: string;
}) {
  const headerStore = await headers();
  const keyHash = createRequestFingerprint(headerStore, input.discriminator.toLowerCase());
  let result;
  try {
    result = await consumeRateLimit({
      scope: input.scope,
      keyHash,
      limit: input.limit,
      windowSeconds: input.windowSeconds,
    });
  } catch {
    authError(input.path, "A proteção de acesso está temporariamente indisponível. Tente novamente em instantes.", input.next);
  }
  if (!result.allowed) authError(input.path, "Muitas tentativas. Aguarde alguns minutos e tente novamente.", input.next);
}

export async function signIn(formData: FormData) {
  const email = value(formData, "email").toLowerCase();
  const password = value(formData, "password");
  const next = safeInternalPath(value(formData, "next"));
  if (!email || !password) authError("/auth/login", "Informe e-mail e senha.", next);

  await enforceAuthRateLimit({ scope: "auth-sign-in", discriminator: email, limit: 10, windowSeconds: 15 * 60, path: "/auth/login", next });
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) authError("/auth/login", "E-mail ou senha inválidos.", next);
  redirect(next);
}

export async function signUp(formData: FormData) {
  const fullName = value(formData, "full_name");
  const email = value(formData, "email").toLowerCase();
  const password = value(formData, "password");
  const next = safeInternalPath(value(formData, "next"));
  const plan = ["basic", "pro", "custom"].includes(value(formData, "plan")) ? value(formData, "plan") : "basic";
  const attribution = Object.fromEntries(["utm_source","utm_medium","utm_campaign","utm_content","utm_term","gclid"].map(key => [key,value(formData,key)]).filter(([,entry]) => entry));

  if (fullName.length < 3) authError("/auth/signup", "Informe seu nome completo.", next);
  if (!email || password.length < 8) authError("/auth/signup", "Use um e-mail válido e uma senha com pelo menos 8 caracteres.", next);

  await enforceAuthRateLimit({ scope: "auth-sign-up", discriminator: email, limit: 5, windowSeconds: 60 * 60, path: "/auth/signup", next });
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, selected_plan: plan, acquisition: attribution },
      emailRedirectTo: `${getAppUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) authError("/auth/signup", "Não foi possível criar a conta. Revise os dados ou tente novamente.", next);
  if (!data.session) redirect(`/auth/check-email?email=${encodeURIComponent(email)}`);
  redirect(next);
}

export async function requestPasswordReset(formData: FormData) {
  const email = value(formData, "email").toLowerCase();
  if (!email) authError("/auth/forgot-password", "Informe seu e-mail.");

  await enforceAuthRateLimit({ scope: "auth-password-reset", discriminator: email, limit: 5, windowSeconds: 60 * 60, path: "/auth/forgot-password" });
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getAppUrl()}/auth/callback?next=/auth/update-password`,
  });
  if (error) console.error("[auth] Falha ao solicitar redefinição", error.message);
  redirect(`/auth/check-email?email=${encodeURIComponent(email)}&recovery=1`);
}

export async function updatePassword(formData: FormData) {
  const password = value(formData, "password");
  if (password.length < 8) authError("/auth/update-password", "A senha precisa ter pelo menos 8 caracteres.");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) authError("/auth/update-password", "Não foi possível atualizar a senha. Solicite um novo link.");
  redirect("/app?success=Senha atualizada com sucesso.");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
