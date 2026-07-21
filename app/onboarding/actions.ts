"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createWorkspace(formData: FormData) {
  const name = String(formData.get("company_name") ?? "").trim();
  const selectedPlan = String(formData.get("plan") ?? "basic").toLowerCase();

  if (name.length < 2) redirect("/onboarding?error=Informe o nome da empresa.");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { error } = await supabase.rpc("create_tenant_for_current_user", {
    p_name: name,
    p_plan_code: ["basic", "pro", "custom"].includes(selectedPlan) ? selectedPlan : "basic",
  });

  if (error) redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);
  redirect("/app?welcome=1");
}
