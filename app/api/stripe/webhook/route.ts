import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { syncStripeSubscription } from "@/lib/billing/subscription-sync";
import { getStripe } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENT_PRIORITIES: Record<string, number> = {
  "checkout.session.completed": 5,
  "customer.subscription.created": 10,
  "customer.subscription.updated": 20,
  "customer.subscription.deleted": 30,
};

function subscriptionIdFromEvent(event: Stripe.Event) {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    return typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
  }
  if (event.type.startsWith("customer.subscription.")) {
    return (event.data.object as Stripe.Subscription).id;
  }
  return null;
}

async function completeEvent(input: {
  id: string;
  status: "processed" | "ignored" | "failed";
  outcome?: string;
  error?: string;
  tenantId?: string;
}) {
  const { data, error } = await createAdminClient().rpc("complete_billing_webhook_event", {
    p_id: input.id,
    p_status: input.status,
    p_outcome: input.outcome ?? null,
    p_error: input.error ?? null,
    p_tenant_id: input.tenantId ?? null,
  });
  if (error || data !== true) {
    throw error ?? new Error("WEBHOOK_EVENT_NOT_COMPLETED");
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook não configurado" }, { status: 400 });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > 1_048_576) {
    return NextResponse.json({ error: "Payload muito grande" }, { status: 413 });
  }

  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > 1_048_576) {
    return NextResponse.json({ error: "Payload muito grande" }, { status: 413 });
  }
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Assinatura do webhook inválida" }, { status: 400 });
  }

  const admin = createAdminClient();
  const subscriptionId = subscriptionIdFromEvent(event);
  const { data: claimData, error: claimError } = await admin.rpc("claim_billing_webhook_event", {
    p_id: event.id,
    p_provider: "stripe",
    p_event_type: event.type,
    p_event_created_at: new Date(event.created * 1000).toISOString(),
    p_payload: event as unknown as Record<string, unknown>,
    p_provider_subscription_id: subscriptionId,
  });

  if (claimError) {
    console.error("[stripe-webhook] Falha ao registrar evento", event.id, claimError.message);
    return NextResponse.json({ error: "Falha ao registrar evento" }, { status: 500 });
  }

  const claim = Array.isArray(claimData) ? claimData[0] : claimData;
  if (!claim?.claimed) {
    if (claim?.state === "processing") {
      return NextResponse.json(
        { received: false, processing: true },
        { status: 409, headers: { "Retry-After": "10" } },
      );
    }
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    let subscription: Stripe.Subscription | null = null;
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.subscription) {
        subscription = typeof session.subscription === "string"
          ? await getStripe().subscriptions.retrieve(session.subscription)
          : session.subscription;
      }
    } else if ([
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ].includes(event.type)) {
      subscription = event.data.object as Stripe.Subscription;
    }

    if (!subscription) {
      await completeEvent({ id: event.id, status: "ignored", outcome: "event_not_handled" });
      return NextResponse.json({ received: true, ignored: true });
    }

    const result = await syncStripeSubscription(subscription, undefined, {
      eventId: event.id,
      eventCreatedAt: new Date(event.created * 1000),
      eventPriority: EVENT_PRIORITIES[event.type] ?? 0,
    });

    await completeEvent({
      id: event.id,
      status: result.applied ? "processed" : "ignored",
      outcome: result.applied ? "subscription_updated" : "out_of_order_event",
      tenantId: result.tenantId,
    });
    return NextResponse.json({ received: true, applied: result.applied });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_WEBHOOK_ERROR";
    try {
      await completeEvent({ id: event.id, status: "failed", error: message });
    } catch (completionError) {
      console.error("[stripe-webhook] Falha ao registrar erro do evento", event.id, completionError);
    }
    console.error("[stripe-webhook] Falha ao processar evento", event.id, event.type, error);
    return NextResponse.json({ error: "Falha ao processar evento" }, { status: 500 });
  }
}
