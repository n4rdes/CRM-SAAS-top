"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/auth/workspace";
import { canManageTeam } from "@/lib/domain/team";

const TIMEZONES = ["America/Sao_Paulo", "America/Manaus", "America/Recife", "America/Fortaleza", "America/Cuiaba"];

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function fail(message: string): never {
  redirect(`/app/configuracoes?error=${encodeURIComponent(message)}`);
}

function success(message: string): never {
  redirect(`/app/configuracoes?success=${encodeURIComponent(message)}`);
}

export async function updateProfile(formData: FormData) {
  const fullName = value(formData, "full_name");
  if (fullName.length < 3) fail("Informe seu nome completo.");
  const { supabase, user } = await requireWorkspace();
  const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
  if (error) fail("Não foi possível atualizar seu perfil.");
  revalidatePath("/app", "layout");
  success("Perfil atualizado.");
}

export async function updateTenantSettings(formData: FormData) {
  const name = value(formData, "name");
  const timezone = value(formData, "timezone");
  if (name.length < 2 || !TIMEZONES.includes(timezone)) fail("Revise o nome e o fuso horário da empresa.");
  const { supabase, tenant, membership } = await requireWorkspace();
  if (!canManageTeam(membership.role)) fail("Somente proprietários e administradores podem alterar a empresa.");
  const { error } = await supabase.from("tenants").update({
    name,
    document: value(formData, "document") || null,
    phone: value(formData, "phone") || null,
    timezone,
  }).eq("id", tenant.id);
  if (error) fail("Não foi possível atualizar os dados da empresa.");
  revalidatePath("/app", "layout");
  success("Dados da empresa atualizados.");
}
