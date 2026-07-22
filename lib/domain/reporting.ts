export const DASHBOARD_CARD_IDS = ["clients", "jobs", "candidates", "pipeline", "people", "goals", "engagement", "time_off"] as const;
export const REPORT_CARD_IDS = ["recruitment", "commercial", "sources", "headcount", "goals", "reviews", "engagement", "time_off"] as const;

export type DashboardCardId = (typeof DASHBOARD_CARD_IDS)[number];
export type ReportCardId = (typeof REPORT_CARD_IDS)[number];

export const DASHBOARD_CARD_LABELS: Record<DashboardCardId, string> = {
  clients: "Clientes no CRM",
  jobs: "Vagas ativas",
  candidates: "Banco de candidatos",
  pipeline: "Pipeline de seleção",
  people: "Headcount",
  goals: "Metas e desempenho",
  engagement: "Clima e eNPS",
  time_off: "Férias e ausências",
};

export const REPORT_CARD_LABELS: Record<ReportCardId, string> = {
  recruitment: "Funil de recrutamento",
  commercial: "Funil comercial",
  sources: "Origem dos candidatos",
  headcount: "Headcount por departamento",
  goals: "Saúde das metas",
  reviews: "Avaliações e 1:1",
  engagement: "Clima e engajamento",
  time_off: "Férias e ausências",
};

export function sanitizeDashboardCards(values: string[]) {
  const unique = [...new Set(values)].filter((value): value is DashboardCardId => DASHBOARD_CARD_IDS.includes(value as DashboardCardId));
  return unique.length ? unique : [...DASHBOARD_CARD_IDS];
}

export function sanitizeReportCards(values: string[]) {
  const unique = [...new Set(values)].filter((value): value is ReportCardId => REPORT_CARD_IDS.includes(value as ReportCardId));
  return unique.length ? unique : [...REPORT_CARD_IDS];
}

export function sanitizeColumns(value: number, minimum: number, maximum: number, fallback: number) {
  return Number.isInteger(value) && value >= minimum && value <= maximum ? value : fallback;
}

export function normalizeReportPeriod(from?: string, to?: string, now = new Date()) {
  const fallbackTo = now.toISOString().slice(0, 10);
  const fallbackFromDate = new Date(now);
  fallbackFromDate.setDate(fallbackFromDate.getDate() - 89);
  const fallbackFrom = fallbackFromDate.toISOString().slice(0, 10);
  const pattern = /^\d{4}-\d{2}-\d{2}$/;
  const selectedFrom = from && pattern.test(from) ? from : fallbackFrom;
  const selectedTo = to && pattern.test(to) ? to : fallbackTo;
  if (selectedFrom > selectedTo) return { from: selectedTo, to: selectedTo };
  return { from: selectedFrom, to: selectedTo };
}

export function csvCell(value: unknown) {
  const raw = value === null || value === undefined ? "" : String(value);
  const text = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replaceAll('"', '""')}"`;
}

export function rowsToCsv(rows: unknown[][]) {
  return `\uFEFF${rows.map(row => row.map(csvCell).join(";")).join("\r\n")}`;
}
