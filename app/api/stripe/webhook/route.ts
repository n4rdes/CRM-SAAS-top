import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { syncStripeSubscription } from "@/lib/billing/subscription-sync";
import { getStripe } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

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
      if (session.subscription) {
        const subscription = typeof session.subscription === "string"
          ? await getStripe().subscriptions.retrieve(session.subscription)
          : session.subscription;
        await syncStripeSubscription(subscription);
      }
    }
    if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
      await syncStripeSubscription(event.data.object as Stripe.Subscription);
    }

    await admin.from("billing_webhook_events").insert({ id: event.id, provider: "stripe", event_type: event.type });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[stripe-webhook] Falha ao processar evento", event.id, event.type, error);
    return NextResponse.json({ error: "Falha ao processar evento" }, { status: 500 });
  }
}
