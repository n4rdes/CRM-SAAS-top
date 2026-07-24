"use server";

import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/auth/workspace";
import { getAppUrl, getStripePriceId, isBillingPlanCode } from "@/lib/billing/config";
import { getStripe } from "@/lib/billing/stripe";
import { reconcileTenantSubscription } from "@/lib/billing/subscription-sync";
import { canManageTeam } from "@/lib/domain/team";

function fail(message: string): never {
  redirect(`/app/assinatura?error=${encodeURIComponent(message)}`);
}

async function requireBillingManager() {
  const context = await requireWorkspace();
  if (!canManageTeam(context.membership.role)) fail("Somente o proprietário ou um administrador pode gerenciar a assinatura.");
  return context;
}

export async function startCheckout(formData: FormData) {
  const planCode = String(formData.get("plan_code") ?? "").trim();
  if (!isBillingPlanCode(planCode)) fail("Plano inválido.");
  const { supabase, tenant, user } = await requireBillingManager();
  const { data: current } = await supabase.from("subscriptions").select("provider_customer_id,provider_subscription_id").eq("tenant_id", tenant.id).single();
  if (current?.provider_customer_id && current.provider_subscription_id) fail("Sua cobrança já está ativa. Use “Gerenciar cobrança” para trocar de plano.");
  const priceId = getStripePriceId(planCode);
  if (!process.env.STRIPE_SECRET_KEY || !priceId) fail("A cobrança ainda não foi configurada pelo administrador do Prismae.");

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      client_reference_id: tenant.id,
      customer_email: user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${getAppUrl()}/app/assinatura?checkout=success`,
      cancel_url: `${getAppUrl()}/app/assinatura?checkout=canceled`,
      metadata: { tenant_id: tenant.id, plan_code: planCode },
      subscription_data: { metadata: { tenant_id: tenant.id, plan_code: planCode } },
    });
    if (!session.url) fail("A página de pagamento não foi criada.");
    redirect(session.url);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    fail("Não foi possível iniciar o checkout. Tente novamente.");
  }
}

export async function openBillingPortal() {
  const { supabase, tenant } = await requireBillingManager();
  const { data } = await supabase.from("subscriptions").select("provider_customer_id").eq("tenant_id", tenant.id).single();
  if (!data?.provider_customer_id || !process.env.STRIPE_SECRET_KEY) fail("Ainda não existe uma cobrança ativa para esta empresa.");
  try {
    const session = await getStripe().billingPortal.sessions.create({ customer: data.provider_customer_id, return_url: `${getAppUrl()}/app/assinatura?portal=return` });
    redirect(session.url);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    fail("Não foi possível abrir o portal de cobrança.");
  }
}

export async function syncBillingSubscription() {
  const { tenant } = await requireBillingManager();
  try {
    const result = await reconcileTenantSubscription(tenant.id);
    if (!result) fail("Nenhuma assinatura da Stripe foi encontrada para sincronizar.");
    redirect(`/app/assinatura?sync=success&plan=${result.planCode}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    console.error("[stripe-sync] Falha na sincronização manual", error);
    fail("Não foi possível sincronizar a assinatura com a Stripe agora.");
  }
}
