import { openBillingPortal, startCheckout } from "./actions";
import { SubmitButton } from "../_components/submit-button";
import { requireWorkspace } from "@/lib/auth/workspace";
import { isStripeConfigured } from "@/lib/billing/config";
import { canManageTeam } from "@/lib/domain/team";

const STATUS_LABELS: Record<string, string> = { trialing: "Período de avaliação", active: "Ativa", past_due: "Pagamento pendente", grace: "Prazo de regularização", suspended: "Suspensa", canceled: "Cancelada" };
const FEATURES: Record<string, string[]> = {
  basic: ["CRM de clientes", "ATS e banco de talentos", "Até 5 usuários", "Até 10 vagas ativas"],
  pro: ["Tudo do Basic", "Até 20 usuários", "Vagas ativas ilimitadas", "Automações e IA (em evolução)"],
  custom: ["Tudo do Pro", "Usuários ilimitados", "SSO e marca própria", "Implantação acompanhada"],
};

function currency(cents: number | null) {
  if (cents === null) return "Sob consulta";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(cents / 100);
}

export default async function SubscriptionPage({ searchParams }: { searchParams: Promise<{ error?: string; checkout?: string }> }) {
  const params = await searchParams;
  const { supabase, tenant, membership } = await requireWorkspace();
  const [subscriptionResult, plansResult, membersResult, jobsResult] = await Promise.all([
    supabase.from("subscriptions").select("status,trial_ends_at,current_period_ends_at,cancel_at_period_end,provider_customer_id,plan:plans(code,name,price_monthly_cents,limits)").eq("tenant_id", tenant.id).single(),
    supabase.from("plans").select("code,name,price_monthly_cents,limits").eq("active", true).order("price_monthly_cents", { ascending: true, nullsFirst: false }),
    supabase.from("memberships").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).in("status", ["open", "paused"]),
  ]);
  const subscription = subscriptionResult.data;
  const currentPlan = subscription?.plan as unknown as { code: string; name: string; price_monthly_cents: number | null; limits: { users?: number | null; active_jobs?: number | null } } | null;
  const manager = canManageTeam(membership.role);
  const configured = isStripeConfigured();
  const endDate = subscription?.current_period_ends_at ?? subscription?.trial_ends_at;

  return <div className="workspace-content">
    <div className="page-heading"><div><h1>Assinatura</h1><p>Plano, limites de uso e cobrança da empresa.</p></div><span className={`subscription-status subscription-${subscription?.status ?? "unknown"}`}>{STATUS_LABELS[subscription?.status ?? ""] ?? subscription?.status}</span></div>
    {params.error && <div className="notice error-notice">{params.error}</div>}
    {params.checkout === "success" && <div className="notice">Pagamento concluído. A confirmação da assinatura pode levar alguns segundos.</div>}
    {params.checkout === "canceled" && <div className="notice error-notice">Checkout cancelado. Nenhuma cobrança foi realizada.</div>}
    {!configured && manager && <div className="setup-notice"><strong>Modo de preparação</strong><span>Os planos já estão funcionais, mas o Stripe ainda precisa das chaves para receber pagamentos.</span></div>}
    <section className="current-subscription panel"><div><small>PLANO ATUAL</small><h2>{currentPlan?.name ?? "Basic"}</h2><p>{STATUS_LABELS[subscription?.status ?? ""] ?? "Status indisponível"}{endDate ? ` · próximo marco em ${new Date(endDate).toLocaleDateString("pt-BR")}` : ""}</p></div><div className="usage-summary"><div><span>Usuários</span><strong>{membersResult.count ?? 0}{typeof currentPlan?.limits?.users === "number" ? `/${currentPlan.limits.users}` : ""}</strong></div><div><span>Vagas ativas</span><strong>{jobsResult.count ?? 0}{typeof currentPlan?.limits?.active_jobs === "number" ? `/${currentPlan.limits.active_jobs}` : ""}</strong></div></div>{manager && subscription?.provider_customer_id && <form action={openBillingPortal}><SubmitButton pendingLabel="Abrindo...">Gerenciar cobrança</SubmitButton></form>}</section>
    <div className="billing-plans">{(plansResult.data ?? []).map(plan => { const limits = plan.limits as { users?: number | null; active_jobs?: number | null }; const current = plan.code === currentPlan?.code; return <article className={`billing-plan ${plan.code === "pro" ? "featured-plan" : ""}`} key={plan.code}><div><small>{current ? "SEU PLANO" : plan.code === "pro" ? "MAIS COMPLETO" : "PLANO"}</small><h2>{plan.name}</h2><div className="billing-price"><strong>{currency(plan.price_monthly_cents)}</strong>{plan.price_monthly_cents !== null && <span>/mês</span>}</div></div><ul>{(FEATURES[plan.code] ?? [`${limits.users ?? "Ilimitados"} usuários`]).map(feature => <li key={feature}>{feature}</li>)}</ul>{plan.code === "custom" ? <a className="plan-action secondary-plan-action" href={`mailto:comercial@prismae.com.br?subject=${encodeURIComponent(`Plano Custom - ${tenant.name}`)}`}>Falar com comercial</a> : manager && !current && !subscription?.provider_customer_id ? <form action={startCheckout}><input type="hidden" name="plan_code" value={plan.code} /><SubmitButton className="plan-action" pendingLabel="Abrindo checkout...">Assinar {plan.name}</SubmitButton></form> : <span className="plan-action disabled-plan-action">{current ? "Plano atual" : manager ? "Troque pelo portal" : "Fale com o administrador"}</span>}</article>; })}</div>
    <p className="billing-footnote">Valores mensais. Impostos e condições comerciais podem variar. O plano Custom depende de proposta.</p>
  </div>;
}
