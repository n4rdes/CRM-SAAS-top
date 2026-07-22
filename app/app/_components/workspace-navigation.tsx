"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type IconName = "home" | "calendar" | "clients" | "jobs" | "candidates" | "people" | "performance" | "reports" | "team" | "billing" | "settings";

const groups: Array<{ label: string; links: Array<{ href: string; label: string; icon: IconName }> }> = [
  {
    label: "Operação",
    links: [
      { href: "/app", label: "Visão geral", icon: "home" },
      { href: "/app/agenda", label: "Agenda", icon: "calendar" },
      { href: "/app/clientes", label: "Clientes", icon: "clients" },
      { href: "/app/vagas", label: "Vagas", icon: "jobs" },
      { href: "/app/candidatos", label: "Candidatos", icon: "candidates" },
    ],
  },
  {
    label: "Gestão de pessoas",
    links: [
      { href: "/app/pessoas", label: "Pessoas", icon: "people" },
      { href: "/app/desempenho", label: "Desempenho", icon: "performance" },
      { href: "/app/relatorios", label: "Relatórios", icon: "reports" },
    ],
  },
  {
    label: "Administração",
    links: [
      { href: "/app/equipe", label: "Equipe", icon: "team" },
      { href: "/app/assinatura", label: "Assinatura", icon: "billing" },
      { href: "/app/configuracoes", label: "Configurações", icon: "settings" },
    ],
  },
];

function NavIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: <><path d="M3 11.2 12 4l9 7.2" /><path d="M5.5 10v10h13V10M9.5 20v-6h5v6" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></>,
    clients: <><path d="M4 21V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16" /><path d="M17 9h3v12M2 21h20M8 7h2M8 11h2M8 15h2" /></>,
    jobs: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></>,
    candidates: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M16 6h5M16 10h5M17 14h4M17 18h4" /></>,
    people: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 6" /></>,
    performance: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /><path d="m4 6 5-3 5 2 6-4" /></>,
    reports: <><path d="M5 3h14v18H5z" /><path d="M9 15v2M12 11v6M15 8v9M8 7h5" /></>,
    team: <><circle cx="9" cy="8" r="3" /><circle cx="18" cy="9" r="2" /><path d="M3 20a6 6 0 0 1 12 0M15 15a4 4 0 0 1 6 3.5" /></>,
    billing: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h3" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.13.36.34.7.6 1 .3.27.68.4 1.1.4h.1v4h-.1a1.7 1.7 0 0 0-1.7.6Z" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function WorkspaceNavigation() {
  const pathname = usePathname();
  return <nav className="workspace-nav" aria-label="Navegação principal">{groups.map(group => <div className="workspace-nav-group" key={group.label}><small>{group.label}</small>{group.links.map(link => {
    const active = link.href === "/app" ? pathname === "/app" : pathname.startsWith(link.href);
    return <Link href={link.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined} key={link.href}><span className="workspace-nav-icon"><NavIcon name={link.icon} /></span><span>{link.label}</span>{active && <i />}</Link>;
  })}</div>)}</nav>;
}
