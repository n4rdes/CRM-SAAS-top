import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { requireWorkspace } from "@/lib/auth/workspace";
import { TEAM_ROLE_LABELS } from "@/lib/domain/team";
import { WorkspaceNavigation } from "./_components/workspace-navigation";
import { SidebarCollapseButton } from "./_components/sidebar-collapse-button";
import "./app.css";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { supabase, tenant, user, membership } = await requireWorkspace();
  const [{ data: subscription }, { count: unreadNotifications }] = await Promise.all([
    supabase.from("subscriptions").select("status,trial_ends_at,grace_ends_at,plan:plans(name)").eq("tenant_id", tenant.id).maybeSingle(),
    supabase.from("app_notifications").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).eq("user_id", user.id).is("read_at", null),
  ]);
  const plan = subscription?.plan as unknown as { name?: string } | null;
  const attention = ["past_due", "grace", "suspended", "canceled"].includes(subscription?.status ?? "");

  const initial = (user.email?.[0] ?? "U").toUpperCase();

  return <div className="workspace">
    <aside className="workspace-sidebar">
      <SidebarCollapseButton />
      <Link href="/app" className="workspace-brand"><span className="workspace-brand-mark"><i /></span><span><strong>Prismae</strong><small>People OS</small></span></Link>
      <div className="workspace-company"><span className="workspace-company-icon">{tenant.name.slice(0, 1).toUpperCase()}</span><div><small>Ambiente atual</small><strong>{tenant.name}</strong><span>{TEAM_ROLE_LABELS[membership.role] ?? membership.role}</span></div></div>
      <WorkspaceNavigation />
      <div className="workspace-sidebar-footer"><div className="workspace-sidebar-user"><span>{initial}</span><div><strong>{user.email?.split("@")[0] ?? "Usuário"}</strong><small>{user.email}</small></div></div><form action={signOut}><button className="workspace-signout" aria-label="Sair da conta"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" /></svg><span>Sair</span></button></form></div>
    </aside>
    <main className="workspace-main"><header className="workspace-topbar"><div className="topbar-context"><small>PRISMAE PEOPLE OS</small><strong>{tenant.name}</strong></div><div className="topbar-actions"><Link href="/app/agenda" className="topbar-agenda"><span>＋</span> Nova atividade</Link><Link href="/app/central" className="topbar-notifications" aria-label={`${unreadNotifications ?? 0} notificações não lidas`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>{Boolean(unreadNotifications) && <span>{unreadNotifications! > 9 ? "9+" : unreadNotifications}</span>}</Link><Link href="/app/assinatura" className="topbar-plan">Plano {plan?.name ?? "Basic"}</Link><span className="workspace-user-avatar">{initial}</span></div></header>{attention && <div className="billing-alert">Sua assinatura precisa de atenção. <Link href="/app/assinatura">Ver cobrança →</Link></div>}{children}</main>
  </div>;
}
