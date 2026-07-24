import { getAppUrl } from "@/lib/http/app-url";

export { getAppUrl };

export const BILLING_PLAN_CODES = ["basic", "pro"] as const;

export type BillingPlanCode = (typeof BILLING_PLAN_CODES)[number];

export function isBillingPlanCode(value: string): value is BillingPlanCode {
  return BILLING_PLAN_CODES.includes(value as BillingPlanCode);
}

export function getStripePriceId(planCode: BillingPlanCode) {
  return planCode === "basic" ? process.env.STRIPE_BASIC_PRICE_ID : process.env.STRIPE_PRO_PRICE_ID;
}

export function getPlanCodeFromPriceId(priceId: string | null | undefined): BillingPlanCode | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_BASIC_PRICE_ID) return "basic";
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return "pro";
  return null;
}

export function getPlanCodeFromPriceIds(priceIds: Array<string | null | undefined>, metadataPlanCode?: string | null): BillingPlanCode | null {
  for (const priceId of priceIds) {
    const planCode = getPlanCodeFromPriceId(priceId);
    if (planCode) return planCode;
  }
  return metadataPlanCode && isBillingPlanCode(metadataPlanCode) ? metadataPlanCode : null;
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_BASIC_PRICE_ID && process.env.STRIPE_PRO_PRICE_ID);
}
