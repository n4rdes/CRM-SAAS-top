export type DashboardMetricKind = "clients" | "jobs" | "candidates" | "pipeline" | "people" | "goals" | "engagement" | "time_off";

export function DashboardMetricIcon({ kind }: { kind: DashboardMetricKind }) {
  const paths: Record<DashboardMetricKind, React.ReactNode> = {
    clients: <><path d="M4 20V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v15M17 9h3v11M2 20h20M8 7h2M8 11h2M8 15h2" /></>,
    jobs: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" /></>,
    candidates: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M16 6h5M16 10h5M17 14h4M17 18h4" /></>,
    pipeline: <><path d="M4 5h16M7 12h10M10 19h4" /><path d="m18 3 2 2-2 2M15 10l2 2-2 2M12 17l2 2-2 2" /></>,
    people: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 6" /></>,
    goals: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /><path d="m15 9 5-5" /></>,
    engagement: <><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /><path d="M8 12h2l1.2-2.3L13 14l1.2-2H17" /></>,
    time_off: <><path d="M5 4h14v16H5z" /><path d="M8 2v4M16 2v4M5 9h14M9 13l2 2 4-4" /></>,
  };
  return <span className={`dashboard-metric-icon metric-icon-${kind}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg></span>;
}
