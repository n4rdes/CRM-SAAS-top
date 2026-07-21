import Link from "next/link";
import { requireWorkspace } from "@/lib/auth/workspace";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ welcome?: string; success?: string }> }) {
  const params = await searchParams;
  const { supabase, tenant } = await requireWorkspace();
  const [clients, jobs, candidates, subscription] = await Promise.all([
    supabase.from("crm_companies").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).eq("status", "open"),
    supabase.from("candidates").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
    supabase.from("subscriptions").select("status, plan:plans(name)").eq("tenant_id", tenant.id).maybeSingle(),
  ]);
  const plan = (subscription.data?.plan as unknown as { name?: string } | null)?.name ?? "Basic";
  return <div className="workspace-content"><div className="page-heading"><div><h1>Visão geral</h1><p>Dados reais e isolados do ambiente {tenant.name}.</p></div><span className="plan-chip">Plano {plan}</span></div>{params.welcome && <div className="notice">Ambiente criado com sucesso. Agora você já pode cadastrar seus primeiros dados.</div>}{params.success && <div className="notice">{params.success}</div>}<section className="metric-grid"><article className="metric-card"><small>Clientes no CRM</small><strong>{clients.count ?? 0}</strong><em>base real</em></article><article className="metric-card"><small>Vagas abertas</small><strong>{jobs.count ?? 0}</strong><em>ATS</em></article><article className="metric-card"><small>Candidatos</small><strong>{candidates.count ?? 0}</strong><em>banco de talentos</em></article><article className="metric-card"><small>Status da assinatura</small><strong>{subscription.data?.status === "trialing" ? "Teste" : subscription.data?.status ?? "—"}</strong><em>controle no servidor</em></article></section><section className="dashboard-panels"><article className="panel"><h2>Comece por aqui</h2><p>Esses três módulos já gravam e leem os dados do Supabase.</p><div className="quick-links"><Link href="/app/clientes"><span>01</span>Novo cliente</Link><Link href="/app/vagas"><span>02</span>Abrir vaga</Link><Link href="/app/candidatos"><span>03</span>Novo candidato</Link></div></article><article className="panel"><h2>Ambiente protegido</h2><p>A sessão é renovada no servidor e as políticas RLS limitam cada consulta ao tenant do usuário.</p><Link href="/demo" className="plan-chip">Comparar com a demo</Link></article></section></div>;
}
