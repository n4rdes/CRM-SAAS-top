"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/auth/workspace";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function fail(path: string, message: string) {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function createCompany(formData: FormData) {
  const name = text(formData, "name");
  if (name.length < 2) fail("/app/clientes", "Informe o nome do cliente.");
  const { supabase, tenant } = await requireWorkspace();
  const { error } = await supabase.from("crm_companies").insert({
    tenant_id: tenant.id,
    name,
    email: text(formData, "email") || null,
    phone: text(formData, "phone") || null,
    stage: "lead",
  });
  if (error) fail("/app/clientes", error.message);
  revalidatePath("/app"); revalidatePath("/app/clientes");
}

export async function createCandidate(formData: FormData) {
  const fullName = text(formData, "full_name");
  const email = text(formData, "email");
  if (fullName.length < 3 || !email) fail("/app/candidatos", "Informe nome e e-mail do candidato.");
  const { supabase, tenant, user } = await requireWorkspace();
  const { error } = await supabase.from("candidates").insert({ tenant_id: tenant.id, full_name: fullName, email, phone: text(formData, "phone") || null, source: text(formData, "source") || "manual", created_by: user.id });
  if (error) fail("/app/candidatos", error.message);
  revalidatePath("/app"); revalidatePath("/app/candidatos");
}

export async function createJob(formData: FormData) {
  const title = text(formData, "title");
  if (title.length < 2) fail("/app/vagas", "Informe o título da vaga.");
  const { supabase, tenant, user } = await requireWorkspace();
  const companyId = text(formData, "company_id");
  const { error } = await supabase.from("jobs").insert({ tenant_id: tenant.id, title, company_id: companyId || null, openings: Math.max(1, Number(text(formData, "openings")) || 1), status: "open", created_by: user.id });
  if (error) fail("/app/vagas", error.message);
  revalidatePath("/app"); revalidatePath("/app/vagas");
}
