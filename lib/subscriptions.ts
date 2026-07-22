export type PlanCode = "BASIC" | "PRO" | "CUSTOM";
export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "GRACE" | "SUSPENDED" | "CANCELED";
export type FeatureCode =
  | "crm"
  | "ats"
  | "people"
  | "time_off"
  | "performance"
  | "engagement"
  | "automations"
  | "ai"
  | "api"
  | "sso"
  | "white_label";
export type LimitCode = "users" | "employees" | "active_jobs" | "storage_gb" | "ai_credits";

export interface PlanDefinition {
  code: PlanCode;
  name: string;
  priceMonthly: number | null;
  features: Record<FeatureCode, boolean>;
  limits: Record<LimitCode, number | null>;
}

export interface SubscriptionSnapshot {
  tenantId: string;
  plan: PlanCode;
  status: SubscriptionStatus;
  currentPeriodEndsAt?: string | null;
  trialEndsAt?: string | null;
  graceEndsAt?: string | null;
}

export interface AccessDecision {
  allowed: boolean;
  reason: "ALLOWED" | "SUBSCRIPTION_INACTIVE" | "TRIAL_EXPIRED" | "GRACE_EXPIRED" | "FEATURE_NOT_INCLUDED" | "LIMIT_REACHED";
  limit?: number | null;
}

const commonFeatures: Record<FeatureCode, boolean> = {
  crm: true,
  ats: true,
  people: true,
  time_off: true,
  performance: false,
  engagement: false,
  automations: false,
  ai: false,
  api: false,
  sso: false,
  white_label: false,
};

export const PLAN_CATALOG: Record<PlanCode, PlanDefinition> = {
  BASIC: {
    code: "BASIC",
    name: "Basic",
    priceMonthly: 297,
    features: commonFeatures,
    limits: { users: 5, employees: 100, active_jobs: 10, storage_gb: 10, ai_credits: 0 },
  },
  PRO: {
    code: "PRO",
    name: "Pro",
    priceMonthly: 697,
    features: {
      ...commonFeatures,
      performance: true,
      engagement: true,
      automations: true,
      ai: true,
      api: true,
    },
    limits: { users: 20, employees: 500, active_jobs: null, storage_gb: 50, ai_credits: 1000 },
  },
  CUSTOM: {
    code: "CUSTOM",
    name: "Custom",
    priceMonthly: null,
    features: Object.fromEntries(Object.keys(commonFeatures).map((feature) => [feature, true])) as Record<FeatureCode, boolean>,
    limits: { users: null, employees: null, active_jobs: null, storage_gb: null, ai_credits: null },
  },
};

function expired(value: string | null | undefined, now: Date) {
  return Boolean(value && new Date(value).getTime() <= now.getTime());
}

/**
 * Server-side entitlement decision. In production, the snapshot must come from
 * the authenticated tenant record; never accept plan or status from the client.
 */
export function evaluateAccess(
  subscription: SubscriptionSnapshot,
  feature: FeatureCode,
  usage?: { limit: LimitCode; current: number },
  now = new Date(),
): AccessDecision {
  if (subscription.status === "TRIALING" && expired(subscription.trialEndsAt, now)) {
    return { allowed: false, reason: "TRIAL_EXPIRED" };
  }

  if (["PAST_DUE", "GRACE"].includes(subscription.status) && expired(subscription.graceEndsAt, now)) {
    return { allowed: false, reason: "GRACE_EXPIRED" };
  }

  if (["SUSPENDED", "CANCELED"].includes(subscription.status)) {
    return { allowed: false, reason: "SUBSCRIPTION_INACTIVE" };
  }

  const plan = PLAN_CATALOG[subscription.plan];
  if (!plan.features[feature]) {
    return { allowed: false, reason: "FEATURE_NOT_INCLUDED" };
  }

  if (usage) {
    const limit = plan.limits[usage.limit];
    if (limit !== null && usage.current >= limit) {
      return { allowed: false, reason: "LIMIT_REACHED", limit };
    }
  }

  return { allowed: true, reason: "ALLOWED", limit: usage ? plan.limits[usage.limit] : undefined };
}

export function assertEntitlement(
  subscription: SubscriptionSnapshot,
  feature: FeatureCode,
  usage?: { limit: LimitCode; current: number },
) {
  const decision = evaluateAccess(subscription, feature, usage);
  if (!decision.allowed) {
    throw new Error(`ENTITLEMENT_DENIED:${decision.reason}`);
  }
  return decision;
}

export function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(value);
}
