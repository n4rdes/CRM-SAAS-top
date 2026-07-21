import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/auth/workspace";

type Limits = { active_jobs?: number | null };

function deny(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function requireActiveSubscription(path: string) {
  const workspace = await requireWorkspace();
  const { data, error } = await workspace.supabase
    .from("subscriptions")
    .select("status, trial_ends_at, grace_ends_at, plan:plans(code, name, limits)")
    .eq("tenant_id", workspace.tenant.id)
    .single();

  if (error || !data) deny(path, "A assinatura da empresa não foi encontrada.");
  if (["suspended", "canceled"].includes(data.status)) {
    deny(path, "A assinatura está inativa. Regularize o plano para continuar.");
  }
  if (data.status === "trialing" && data.trial_ends_at && new Date(data.trial_ends_at) <= new Date()) {
    deny(path, "O período de avaliação terminou. Escolha um plano para continuar.");
  }
  if (["past_due", "grace"].includes(data.status) && data.grace_ends_at && new Date(data.grace_ends_at) <= new Date()) {
    deny(path, "O prazo de regularização da assinatura terminou.");
  }

  const plan = data.plan as unknown as { code: string; name: string; limits: Limits };
  return { ...workspace, subscription: data, plan };
}

export async function assertActiveJobLimit(path = "/app/vagas") {
  const context = await requireActiveSubscription(path);
  const limit = context.plan.limits.active_jobs;
  if (typeof limit === "number") {
    const { count } = await context.supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", context.tenant.id)
      .in("status", ["open", "paused"]);
    if ((count ?? 0) >= limit) {
      deny(path, `Seu plano permite até ${limit} vagas ativas. Encerre uma vaga ou faça upgrade.`);
    }
  }
  return context;
}
