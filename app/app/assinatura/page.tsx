import { openBillingPortal, startCheckout } from "./actions";
import { SubmitButton } from "../_components/submit-button";
import { requireWorkspace } from "@/lib/auth/workspace";
import { isStripeConfigured } from "@/lib/billing/config";
import { canManageTeam } from "@/lib/domain/team";

const STATUS_LABELS: Record<string, string> = { trialing: "Período de avaliação", active: "Ativa", past_due: "Pagamento pendente", grace: "Prazo de regularização", suspended: "Suspensa", canceled: "Cancelada" };
const FEATURES: Record<string, string[]> = {
  basic: ["CRM de clientes e contatos", "ATS e banco de talentos", "Pessoas, jornadas e ausências", "Até 5 usuários e 10 vagas ativas"],
  pro: ["Tudo do Basic", "Até 20 usuários e vagas ilimitadas", "Desempenho, OKRs, 1:1 e clima", "Automações e central inteligente", "API e analytics avançado"],
  custom: ["Tudo do Pro", "Usuários e unidades sob medida", "SSO, marca própria e governança", "Implantação e SLA acompanhados"],
};

const PLAN_COPY: Record<string, { eyebrow: string; description: string }> = {
  basic: { eyebrow: "ESSENCIAL", description: "Para estruturar CRM, recrutamento e Pessoas em uma única operação." },
  pro: { eyebrow: "MAIOR VALOR", description: "Para escalar o RH com desempenho, clima, automações e inteligência." },
  custom: { eyebrow: "ENTERPRISE", description: "Para grupos maiores que precisam de governança e implantação dedicada." },
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
    <div className="billing-plans">{(plansResult.data ?? []).map((plan, index) => { const limits = plan.limits as { users?: number | null; active_jobs?: number | null }; const current = plan.code === currentPlan?.code; const copy = PLAN_COPY[plan.code] ?? { eyebrow: "PLANO", description: "Recursos para sua operação." }; return <article className={`billing-plan billing-plan-${plan.code} ${plan.code === "pro" ? "featured-plan" : ""}`} key={plan.code}>
      <header className="billing-plan-header"><div><small>{current ? "SEU PLANO" : copy.eyebrow}</small><span className="plan-number">0{index + 1}</span></div><h2>{plan.name}</h2><p>{copy.description}</p><div className="billing-price"><strong>{currency(plan.price_monthly_cents)}</strong>{plan.price_monthly_cents !== null && <span>/mês</span>}</div></header>
      <ul>{(FEATURES[plan.code] ?? [`${limits.users ?? "Ilimitados"} usuários`]).map(feature => <li key={feature}><span>✓</span>{feature}</li>)}</ul>
      <footer className="billing-plan-footer">{plan.code === "custom" ? <a className="plan-action secondary-plan-action" href={`mailto:comercial@prismae.com.br?subject=${encodeURIComponent(`Plano Custom - ${tenant.name}`)}`}>Conversar com especialista <span>→</span></a> : manager && !current && !subscription?.provider_customer_id ? <form action={startCheckout}><input type="hidden" name="plan_code" value={plan.code} /><SubmitButton className="plan-action" pendingLabel="Abrindo checkout...">Começar com {plan.name} <span>→</span></SubmitButton></form> : manager && !current && subscription?.provider_customer_id ? <form action={openBillingPortal}><SubmitButton className="plan-action" pendingLabel="Abrindo portal...">Mudar para {plan.name} <span>→</span></SubmitButton></form> : current ? <span className="plan-action current-plan-action"><span>✓</span> Este é seu plano atual</span> : <span className="plan-action disabled-plan-action">Fale com o administrador</span>}</footer>
    </article>; })}</div>
    <p className="billing-footnote">Valores mensais. Impostos e condições comerciais podem variar. O plano Custom depende de proposta.</p>
  </div>;
}
