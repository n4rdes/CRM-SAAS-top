import "server-only";
import type Stripe from "stripe";
import { getPlanCodeFromPriceIds, getStripePriceId } from "./config";
import { getStripe } from "./stripe";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export type BillingSyncResult = {
  planCode: "basic" | "pro";
  status: string;
  subscriptionId: string;
  tenantId: string;
};

export function normalizeSubscriptionStatus(status: Stripe.Subscription.Status) {
  const statusMap: Partial<Record<Stripe.Subscription.Status, string>> = {
    trialing: "trialing",
    active: "active",
    past_due: "past_due",
    unpaid: "suspended",
    canceled: "canceled",
    incomplete: "past_due",
    incomplete_expired: "canceled",
    paused: "suspended",
  };
  return statusMap[status] ?? "past_due";
}

async function findTenantId(admin: AdminClient, subscription: Stripe.Subscription, customerId: string) {
  if (subscription.metadata.tenant_id) return subscription.metadata.tenant_id;

  const bySubscription = await admin
    .from("subscriptions")
    .select("tenant_id")
    .eq("provider_subscription_id", subscription.id)
    .maybeSingle();
  if (bySubscription.data?.tenant_id) return bySubscription.data.tenant_id;

  const byCustomer = await admin
    .from("subscriptions")
    .select("tenant_id")
    .eq("provider_customer_id", customerId)
    .maybeSingle();
  return byCustomer.data?.tenant_id ?? null;
}

export async function syncStripeSubscription(subscription: Stripe.Subscription, expectedTenantId?: string): Promise<BillingSyncResult> {
  const admin = createAdminClient();
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const priceIds = subscription.items.data.map(item => item.price.id);
  const planCode = getPlanCodeFromPriceIds(priceIds, subscription.metadata.plan_code);
  const tenantId = await findTenantId(admin, subscription, customerId);

  if (!tenantId || (expectedTenantId && tenantId !== expectedTenantId)) throw new Error("BILLING_TENANT_NOT_FOUND");
  if (!planCode) throw new Error("BILLING_PRICE_NOT_MAPPED");
  const priceId = getStripePriceId(planCode) ?? priceIds[0] ?? null;

  const { data: plan, error: planError } = await admin.from("plans").select("id").eq("code", planCode).single();
  if (planError || !plan) throw planError ?? new Error("BILLING_PLAN_NOT_FOUND");

  const periodEnd = subscription.items.data
    .map(item => item.current_period_end)
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => b - a)[0];
  const normalizedStatus = normalizeSubscriptionStatus(subscription.status);
  const { error } = await admin.from("subscriptions").update({
    plan_id: plan.id,
    status: normalizedStatus,
    provider: "stripe",
    provider_customer_id: customerId,
    provider_subscription_id: subscription.id,
    provider_price_id: priceId,
    current_period_ends_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: subscription.cancel_at_period_end,
    grace_ends_at: subscription.status === "past_due" ? new Date(Date.now() + 3 * 86_400_000).toISOString() : null,
  }).eq("tenant_id", tenantId);
  if (error) throw error;

  return { planCode, status: normalizedStatus, subscriptionId: subscription.id, tenantId };
}

export async function reconcileTenantSubscription(tenantId: string): Promise<BillingSyncResult | null> {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.SUPABASE_SECRET_KEY) return null;

  const admin = createAdminClient();
  const { data: stored, error } = await admin
    .from("subscriptions")
    .select("provider_subscription_id,provider_customer_id")
    .eq("tenant_id", tenantId)
    .single();
  if (error) throw error;

  let subscription: Stripe.Subscription | null = null;
  if (stored?.provider_subscription_id) {
    subscription = await getStripe().subscriptions.retrieve(stored.provider_subscription_id);
  } else if (stored?.provider_customer_id) {
    const subscriptions = await getStripe().subscriptions.list({ customer: stored.provider_customer_id, status: "all", limit: 10 });
    subscription = subscriptions.data
      .filter(item => !["canceled", "incomplete_expired"].includes(item.status))
      .sort((a, b) => b.created - a.created)[0] ?? subscriptions.data.sort((a, b) => b.created - a.created)[0] ?? null;
  }

  return subscription ? syncStripeSubscription(subscription, tenantId) : null;
}
