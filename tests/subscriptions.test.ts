import { describe, expect, it } from "vitest";
import { evaluateAccess, PLAN_CATALOG, type SubscriptionSnapshot } from "../lib/subscriptions";
import { getPlanCodeFromPriceIds } from "../lib/billing/config";

const activeBasic: SubscriptionSnapshot = { tenantId: "tenant", plan: "BASIC", status: "ACTIVE" };

describe("subscription entitlements", () => {
  it("libera CRM, ATS, Pessoas e ausências no Basic", () => {
    for (const feature of ["crm", "ats", "people", "time_off"] as const) {
      expect(evaluateAccess(activeBasic, feature).allowed).toBe(true);
    }
  });

  it("mantém automações, desempenho e clima no Pro", () => {
    expect(evaluateAccess(activeBasic, "automations")).toMatchObject({ allowed: false, reason: "FEATURE_NOT_INCLUDED" });
    expect(PLAN_CATALOG.PRO.features.automations).toBe(true);
    expect(PLAN_CATALOG.PRO.features.performance).toBe(true);
    expect(PLAN_CATALOG.PRO.features.engagement).toBe(true);
  });

  it("bloqueia assinatura cancelada e trial vencido", () => {
    expect(evaluateAccess({ ...activeBasic, status: "CANCELED" }, "crm").reason).toBe("SUBSCRIPTION_INACTIVE");
    expect(evaluateAccess({ ...activeBasic, status: "TRIALING", trialEndsAt: "2026-01-01" }, "crm", undefined, new Date("2026-01-02"))).toMatchObject({ allowed: false, reason: "TRIAL_EXPIRED" });
  });

  it("aplica limites do plano sem limitar o Custom", () => {
    expect(evaluateAccess(activeBasic, "ats", { limit: "active_jobs", current: 10 })).toMatchObject({ allowed: false, reason: "LIMIT_REACHED", limit: 10 });
    expect(evaluateAccess({ ...activeBasic, plan: "CUSTOM" }, "ats", { limit: "active_jobs", current: 10000 }).allowed).toBe(true);
  });
});

describe("Stripe plan mapping", () => {
  it("prioriza o preço atual da assinatura sobre o metadata antigo", () => {
    process.env.STRIPE_BASIC_PRICE_ID = "price_basic";
    process.env.STRIPE_PRO_PRICE_ID = "price_pro";
    expect(getPlanCodeFromPriceIds(["price_pro"], "basic")).toBe("pro");
  });

  it("aceita qualquer item conhecido e rejeita metadata inválido", () => {
    process.env.STRIPE_BASIC_PRICE_ID = "price_basic";
    process.env.STRIPE_PRO_PRICE_ID = "price_pro";
    expect(getPlanCodeFromPriceIds(["price_extra", "price_basic"], "pro")).toBe("basic");
    expect(getPlanCodeFromPriceIds(["price_unknown"], "enterprise")).toBeNull();
  });
});
