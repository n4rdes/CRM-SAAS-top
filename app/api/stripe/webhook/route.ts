import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getPlanCodeFromPriceId } from "@/lib/billing/config";
import { getStripe } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function subscriptionStatus(status: Stripe.Subscription.Status) {
  const map: Partial<Record<Stripe.Subscription.Status, string>> = {
    trialing: "trialing", active: "active", past_due: "past_due", unpaid: "suspended", canceled: "canceled", incomplete: "past_due", incomplete_expired: "canceled", paused: "suspended",
  };
  return map[status] ?? "past_due";
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const admin = createAdminClient();
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const priceId = subscription.items.data[0]?.price.id ?? null;
  const planCode = getPlanCodeFromPriceId(priceId) || subscription.metadata.plan_code;
  let tenantId = subscription.metadata.tenant_id;
  if (!tenantId) {
    const { data } = await admin.from("subscriptions").select("tenant_id").eq("provider_customer_id", customerId).maybeSingle();
    tenantId = data?.tenant_id ?? "";
  }
  if (!tenantId || !planCode) throw new Error("BILLING_METADATA_MISSING");
  const { data: plan } = await admin.from("plans").select("id").eq("code", planCode).single();
  if (!plan) throw new Error("BILLING_PLAN_NOT_FOUND");
  const periodEnd = subscription.items.data[0]?.current_period_end;
  const { error } = await admin.from("subscriptions").update({
    plan_id: plan.id,
    status: subscriptionStatus(subscription.status),
    provider: "stripe",
    provider_customer_id: customerId,
    provider_subscription_id: subscription.id,
    provider_price_id: priceId,
    current_period_ends_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: subscription.cancel_at_period_end,
    grace_ends_at: subscription.status === "past_due" ? new Date(Date.now() + 3 * 86_400_000).toISOString() : null,
  }).eq("tenant_id", tenantId);
  if (error) throw error;
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) return NextResponse.json({ error: "Webhook não configurado" }, { status: 400 });
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Assinatura do webhook inválida" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data: processed } = await admin.from("billing_webhook_events").select("id").eq("id", event.id).maybeSingle();
    if (processed) return NextResponse.json({ received: true, duplicate: true });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (typeof session.subscription === "string") await syncSubscription(await getStripe().subscriptions.retrieve(session.subscription));
    }
    if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
      await syncSubscription(event.data.object as Stripe.Subscription);
    }

    await admin.from("billing_webhook_events").insert({ id: event.id, provider: "stripe", event_type: event.type });
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Falha ao processar evento" }, { status: 500 });
  }
}
