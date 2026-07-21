"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function safeNext(next: string) {
  return next.startsWith("/") && !next.startsWith("//") ? next : "/app";
}

async function getOrigin() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3000";
  const protocol = headerStore.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

function authError(path: string, message: string, next?: string) {
  const params = new URLSearchParams({ error: message });
  if (next) params.set("next", safeNext(next));
  redirect(`${path}?${params.toString()}`);
}

export async function signIn(formData: FormData) {
  const email = value(formData, "email");
  const password = value(formData, "password");
  const next = safeNext(value(formData, "next"));

  if (!email || !password) authError("/auth/login", "Informe e-mail e senha.", next);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) authError("/auth/login", "E-mail ou senha inválidos.", next);
  redirect(next);
}

export async function signUp(formData: FormData) {
  const fullName = value(formData, "full_name");
  const email = value(formData, "email");
  const password = value(formData, "password");
  const next = safeNext(value(formData, "next"));
  const plan = ["basic", "pro", "custom"].includes(value(formData, "plan"))
    ? value(formData, "plan")
    : "basic";

  if (fullName.length < 3) authError("/auth/signup", "Informe seu nome completo.", next);
  if (!email || password.length < 8) {
    authError("/auth/signup", "Use um e-mail válido e uma senha com pelo menos 8 caracteres.", next);
  }

  const supabase = await createClient();
  const origin = await getOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, selected_plan: plan },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) authError("/auth/signup", error.message, next);
  if (!data.session) redirect(`/auth/check-email?email=${encodeURIComponent(email)}`);
  redirect(next);
}

export async function requestPasswordReset(formData: FormData) {
  const email = value(formData, "email");
  if (!email) authError("/auth/forgot-password", "Informe seu e-mail.");

  const supabase = await createClient();
  const origin = await getOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/auth/update-password`,
  });

  if (error) authError("/auth/forgot-password", error.message);
  redirect(`/auth/check-email?email=${encodeURIComponent(email)}&recovery=1`);
}

export async function updatePassword(formData: FormData) {
  const password = value(formData, "password");
  if (password.length < 8) {
    authError("/auth/update-password", "A senha precisa ter pelo menos 8 caracteres.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) authError("/auth/update-password", error.message);
  redirect("/app?success=Senha atualizada com sucesso.");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
