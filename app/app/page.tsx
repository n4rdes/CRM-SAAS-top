import Link from "next/link";
import { requireWorkspace } from "@/lib/auth/workspace";

const ENTITY_LABELS: Record<string, string> = { crm_companies: "cliente", jobs: "vaga", candidates: "candidato", applications: "candidatura", tenant: "empresa" };
const ACTION_LABELS: Record<string, string> = { insert: "criou", update: "atualizou", delete: "excluiu", "tenant.created": "criou" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ welcome?: string; success?: string }> }) {
  const params = await searchParams;
  const { supabase, tenant } = await requireWorkspace();
  const [clients, jobs, candidates, applications, subscription, audit] = await Promise.all([
    supabase.from("crm_companies").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).in("status", ["open", "paused"]),
    supabase.from("candidates").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
    supabase.from("applications").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).not("stage", "in", "(hired,rejected,withdrawn)"),
    supabase.from("subscriptions").select("status, trial_ends_at, plan:plans(name, limits)").eq("tenant_id", tenant.id).maybeSingle(),
    supabase.from("audit_logs").select("id,action,entity_type,created_at").eq("tenant_id", tenant.id).order("created_at", { ascending: false }).limit(8),
  ]);
  const planData = subscription.data?.plan as unknown as { name?: string; limits?: { active_jobs?: number | null } } | null;
  const plan = planData?.name ?? "Basic";
  const activeJobLimit = planData?.limits?.active_jobs;
  const trialEndLabel = subscription.data?.trial_ends_at
    ? new Intl.DateTimeFormat("pt-BR").format(new Date(subscription.data.trial_ends_at))
    : null;

  return <div className="workspace-content">
    <div className="page-heading"><div><h1>Visão geral</h1><p>Dados reais e isolados do ambiente {tenant.name}.</p></div><span className="plan-chip">Plano {plan}</span></div>
    {params.welcome && <div className="notice">Ambiente criado com sucesso. Agora você já pode cadastrar seus primeiros dados.</div>}
    {params.success && <div className="notice">{params.success}</div>}
    <section className="metric-grid"><article className="metric-card"><small>Clientes no CRM</small><strong>{clients.count ?? 0}</strong><em>carteira comercial</em></article><article className="metric-card"><small>Vagas ativas</small><strong>{jobs.count ?? 0}{typeof activeJobLimit === "number" ? `/${activeJobLimit}` : ""}</strong><em>limite do plano</em></article><article className="metric-card"><small>Candidatos</small><strong>{candidates.count ?? 0}</strong><em>banco de talentos</em></article><article className="metric-card"><small>No pipeline</small><strong>{applications.count ?? 0}</strong><em>processos em andamento</em></article></section>
    <section className="dashboard-panels"><article className="panel"><h2>Ações rápidas</h2><p>Cadastre dados ou abra os módulos completos.</p><div className="quick-links"><Link href="/app/clientes"><span>01</span>Gerenciar clientes</Link><Link href="/app/vagas"><span>02</span>Pipeline de vagas</Link><Link href="/app/candidatos"><span>03</span>Banco de talentos</Link></div></article><article className="panel subscription-summary"><h2>Assinatura</h2><p>{subscription.data?.status === "trialing" ? `Avaliação ativa${trialEndLabel ? ` · termina em ${trialEndLabel}` : ""}` : `Status: ${subscription.data?.status ?? "não encontrado"}`}</p><span className="plan-chip">{plan}</span></article></section>
    <section className="panel activity-panel"><div className="panel-heading"><div><h2>Atividade recente</h2><p>Ações registradas automaticamente no ambiente.</p></div></div>{audit.data?.length ? <div className="activity-list">{audit.data.map(item => <div key={item.id}><span>{ACTION_LABELS[item.action] ?? item.action}</span><strong>{ENTITY_LABELS[item.entity_type] ?? item.entity_type}</strong><time>{new Date(item.created_at).toLocaleString("pt-BR")}</time></div>)}</div> : <div className="empty-state compact">As próximas alterações aparecerão aqui após executar a migração de auditoria.</div>}</section>
  </div>;
}
