"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type WorkspaceIconName = "home" | "inbox" | "calendar" | "clients" | "jobs" | "candidates" | "data" | "ats" | "people" | "leave" | "performance" | "engagement" | "automations" | "reports" | "team" | "billing" | "settings";

export const WORKSPACE_NAV_GROUPS: Array<{ label: string; links: Array<{ href: string; label: string; icon: WorkspaceIconName }> }> = [
  {
    label: "Operação",
    links: [
      { href: "/app", label: "Visão geral", icon: "home" },
      { href: "/app/central", label: "Central de trabalho", icon: "inbox" },
      { href: "/app/agenda", label: "Agenda", icon: "calendar" },
      { href: "/app/clientes", label: "Clientes", icon: "clients" },
      { href: "/app/vagas", label: "Vagas", icon: "jobs" },
      { href: "/app/candidatos", label: "Candidatos", icon: "candidates" },
      { href: "/app/ats", label: "ATS profissional", icon: "ats" },
    ],
  },
  {
    label: "Gestão de pessoas",
    links: [
      { href: "/app/pessoas", label: "Pessoas", icon: "people" },
      { href: "/app/ausencias", label: "Férias & ausências", icon: "leave" },
      { href: "/app/desempenho", label: "Desempenho", icon: "performance" },
      { href: "/app/clima", label: "Clima & engajamento", icon: "engagement" },
    ],
  },
  {
    label: "Inteligência",
    links: [
      { href: "/app/dados", label: "Dados & importação", icon: "data" },
      { href: "/app/automacoes", label: "Automações", icon: "automations" },
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

export function WorkspaceNavIcon({ name }: { name: WorkspaceIconName }) {
  const paths: Record<WorkspaceIconName, React.ReactNode> = {
    home: <><path d="M3 11.2 12 4l9 7.2" /><path d="M5.5 10v10h13V10M9.5 20v-6h5v6" /></>,
    inbox: <><path d="M4 4h16v14H4z" /><path d="M4 14h4l2 3h4l2-3h4M8 8h8M8 11h5" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></>,
    clients: <><path d="M4 21V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16" /><path d="M17 9h3v12M2 21h20M8 7h2M8 11h2M8 15h2" /></>,
    jobs: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></>,
    candidates: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M16 6h5M16 10h5M17 14h4M17 18h4" /></>,
    data: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>,
    ats: <><path d="M4 4h16v16H4zM8 8h8M8 12h5M8 16h3" /><circle cx="17" cy="16" r="2" /></>,
    people: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 6" /></>,
    leave: <><path d="M5 4h14v16H5z" /><path d="M8 2v4M16 2v4M5 9h14M9 13l2 2 4-4" /></>,
    performance: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /><path d="m4 6 5-3 5 2 6-4" /></>,
    engagement: <><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /><path d="M8 12h2l1.2-2.3L13 14l1.2-2H17" /></>,
    automations: <><path d="M8 3H4v4M16 21h4v-4M4 7c1.5-3 4-4 8-4 4.5 0 8 3.5 8 8M20 17c-1.5 3-4 4-8 4-4.5 0-8-3.5-8-8" /><path d="m9 8 6 4-6 4z" /></>,
    reports: <><path d="M5 3h14v18H5z" /><path d="M9 15v2M12 11v6M15 8v9M8 7h5" /></>,
    team: <><circle cx="9" cy="8" r="3" /><circle cx="18" cy="9" r="2" /><path d="M3 20a6 6 0 0 1 12 0M15 15a4 4 0 0 1 6 3.5" /></>,
    billing: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h3" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.13.36.34.7.6 1 .3.27.68.4 1.1.4h.1v4h-.1a1.7 1.7 0 0 0-1.7.6Z" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function WorkspaceNavigation({ activeHref, onNavigate }: { activeHref?: string; onNavigate?: (href: string) => void } = {}) {
  const pathname = usePathname();
  const currentPath = activeHref ?? pathname;
  return <nav className="workspace-nav" aria-label="Navegação principal">{WORKSPACE_NAV_GROUPS.map(group => <div className="workspace-nav-group" key={group.label}><small>{group.label}</small>{group.links.map(link => {
    const active = link.href === "/app" ? currentPath === "/app" : currentPath.startsWith(link.href);
    const content = <><span className="workspace-nav-icon"><WorkspaceNavIcon name={link.icon} /></span><span className="workspace-nav-label">{link.label}</span>{active && <i />}</>;
    return onNavigate
      ? <button type="button" title={link.label} onClick={() => onNavigate(link.href)} className={active ? "active" : ""} aria-current={active ? "page" : undefined} key={link.href}>{content}</button>
      : <Link href={link.href} title={link.label} className={active ? "active" : ""} aria-current={active ? "page" : undefined} key={link.href}>{content}</Link>;
  })}</div>)}</nav>;
}
