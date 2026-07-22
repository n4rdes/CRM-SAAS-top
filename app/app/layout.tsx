import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { requireWorkspace } from "@/lib/auth/workspace";
import { TEAM_ROLE_LABELS } from "@/lib/domain/team";
import "./app.css";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { supabase, tenant, user, membership } = await requireWorkspace();
  const { data: subscription } = await supabase.from("subscriptions").select("status,trial_ends_at,grace_ends_at,plan:plans(name)").eq("tenant_id", tenant.id).maybeSingle();
  const plan = subscription?.plan as unknown as { name?: string } | null;
  const attention = ["past_due", "grace", "suspended", "canceled"].includes(subscription?.status ?? "");

  return <div className="workspace"><aside className="workspace-sidebar"><Link href="/app" className="workspace-brand">prismae</Link><div className="workspace-company"><small>Ambiente</small><strong>{tenant.name}</strong><span>{TEAM_ROLE_LABELS[membership.role] ?? membership.role}</span></div><nav className="workspace-nav"><small>OPERAÇÃO</small><Link href="/app">Visão geral</Link><Link href="/app/agenda">Agenda</Link><Link href="/app/clientes">Clientes</Link><Link href="/app/vagas">Vagas</Link><Link href="/app/candidatos">Candidatos</Link><Link href="/app/relatorios">Relatórios</Link><small>ADMINISTRAÇÃO</small><Link href="/app/equipe">Equipe</Link><Link href="/app/assinatura">Assinatura</Link><Link href="/app/configuracoes">Configurações</Link></nav><form action={signOut}><button className="workspace-signout">Sair da conta</button></form></aside><main className="workspace-main"><header className="workspace-topbar"><Link href="/app/agenda" className="topbar-agenda">Abrir agenda</Link><Link href="/app/assinatura" className="topbar-plan">Plano {plan?.name ?? "Basic"}</Link><span className="workspace-user">{user.email}</span></header>{attention && <div className="billing-alert">Sua assinatura precisa de atenção. <Link href="/app/assinatura">Ver cobrança →</Link></div>}{children}</main></div>;
}
