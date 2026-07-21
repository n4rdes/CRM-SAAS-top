import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { requireWorkspace } from "@/lib/auth/workspace";
import "./app.css";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { tenant, user } = await requireWorkspace();
  return <div className="workspace"><aside className="workspace-sidebar"><Link href="/app" className="workspace-brand">prismae</Link><div className="workspace-company"><small>Ambiente</small><strong>{tenant.name}</strong></div><nav className="workspace-nav"><Link href="/app">Visão geral</Link><Link href="/app/clientes">Clientes</Link><Link href="/app/vagas">Vagas</Link><Link href="/app/candidatos">Candidatos</Link></nav><form action={signOut}><button className="workspace-signout">Sair da conta</button></form></aside><main className="workspace-main"><header className="workspace-topbar"><span className="workspace-user">{user.email}</span></header>{children}</main></div>;
}
