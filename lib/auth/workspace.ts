import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const loadWorkspace = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: membership } = await supabase
    .from("memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, slug")
    .eq("id", membership.tenant_id)
    .single();
  if (!tenant) redirect("/onboarding");

  return { supabase, user, membership, tenant };
});

export async function requireWorkspace() {
  return loadWorkspace();
}
